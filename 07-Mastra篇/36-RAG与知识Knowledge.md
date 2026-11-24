# 第36章：RAG 与知识 Knowledge — 把「查资料」和「回忆对话」分开

## 引言

第 9、10 章你手写了完整的 RAG 管道：分块、向量化、检索、重排、注入 prompt。那时你构建的是「外部知识库」——公司文档、产品手册、FAQ。但到了第 35 章你会发现，Mastra 的 Memory（semantic recall）搜的是「**对话历史**」。

那么「**让 agent 查外部文档**」这件事，Mastra 怎么解决？答案是 **Knowledge**——一个专门给 agent 用的知识库。

> ⚠️ 注意：Knowledge 目前是 **alpha** 状态，API 可能变。但概念和思路是稳定的，值得学。

---

## 36.1 先分清：Memory vs Knowledge

这是很多人会混的两个概念：

| | Memory | Knowledge |
|---|---|---|
| 存什么 | 对话里发生了什么 | 对话之外的知识 |
| 例子 | 「用户上次说要退款」 | 「公司退款政策文档」 |
| 时间跨度 | 某个 thread 的历史 | 跨会话、跨 agent 共享 |
| 对应旧知识 | 第 8 章记忆 | 第 9/10 章 RAG |

一句话：**Memory 是「回忆对话」，Knowledge 是「查资料」**。

---

## 36.2 Knowledge 的核心概念

Knowledge 不是「一堆文档」，而是一个**知识图谱**：

| 概念 | 是什么 |
|---|---|
| **page** | 一个主题：名字 + 简介 + Markdown 正文。可像文件夹一样嵌套（`org:acme#policies/refund`） |
| **note** | 加在 page 上的短小事实/评论，带作者归属 |
| **link** | 连接 page：正文里写 `[[org:acme#policies/refund]]` |
| **scope** | 图谱的分区（`org:acme`、`team:support`），隔离数据 |
| **role** | 一个 run 在 scope 里的权限：viewer / contributor / editor / owner |

page 之间靠 link 连接，所以它是「图」而不是「文档列表」。

---

## 36.3 开启 Knowledge

```typescript
import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';

export const knowledge = new Knowledge({
  id: 'company',
  storage: new LibSQLStore({ id: 'knowledge', url: 'file:./knowledge.db' }),
  vector: new LibSQLVector({ id: 'knowledge-vector', url: 'file:./knowledge.db' }),   // 可选：开启语义搜索
  embedder: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),           // 可选：同上
  scopes: knowledgeMemoryScopes(),
  tools: true,          // 给 agent 挂上 search/read/write 工具
});
```

- `tools: true` = 读 + 写工具都开
- `tools: { read: true }` = 只开读（只回答、不改内容的 docs agent 用这个）
- 配 vector + embedder = 开启「按语义搜索」（否则只按关键词）

---

## 36.4 搜索

agent 用 `knowledge_search` 工具搜索。默认是**关键词匹配**（匹配 page 名字/简介/正文/note 文本，名字权重最高）。

配了 vector + embedder 后，可以**按语义搜**——搜 "reimbursement" 能命中讲「退钱」的页面（即使没有共同词）。

> 这呼应第 10 章「混合检索」——关键词 + 语义，按 rank 合并。

---

## 36.5 挂到 agent

```typescript
import { Agent } from '@mastra/core/agent';
import { knowledge } from '../knowledge';

export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'support-agent',
  instructions: '帮客户处理订单。',
  model: 'deepseek/deepseek-chat',
  knowledge,   // 挂上，agent 自动获得 search/read/write 工具
});
```

挂上后 agent 自动获得工具 + 简短使用说明，你不需要在 instructions 里再描述这些工具。

---

## 36.6 灌数据（Seed Content）

Knowledge 目前没有 importer，需要从服务端代码灌数据：

```typescript
// 写入一个页面
await knowledge.upsertPage({
  scope: 'docs:acme',
  path: 'guides/install',       // 路径 → 变成 page docs:acme#guides/install
  name: '安装指南',
  body: '...markdown 正文...',
  author: 'seed:docs',
});

// 加一条带日期的 note
await knowledge.addNote({
  scope: 'docs:acme',
  path: 'guides/install',
  text: 'Node 18 支持到 [[docs:acme#releases/2026-12]] 结束。',
  when: new Date('2026-11-01'),
  author: 'seed:docs',
});
```

> upsertPage / addNote 是给「可信服务端代码」用的，不做 run scope 检查。

---

## 36.7 场景与现状提醒

**适合场景**：让 agent 回答「基于公司文档/政策/FAQ」的问题；多个 agent 共享一套知识；agent 之间「交接工作」（一个 agent 写发现，另一个 agent 读）。

**现状提醒（alpha）**：
- API 可能变，生产使用先观望。
- 没有内置 importer（要自己 upsert）。
- 不能过期旧 page。

如果只是「查外部文档」，你也可以退回第 9/10 章的手写 RAG（自己分块 + 向量库 + 检索工具），思路完全通用。

---

## 概念辨析

**Q：Knowledge 的「语义搜索」和 Memory 的「semanticRecall」都用 vector + embedder，是一回事吗？**

底层机制一样（都是向量化 + 相似度搜索），但搜的对象不同：semanticRecall 搜「对话历史消息」，Knowledge 搜「知识图谱的 page/note」。**同一个 RAG 技术，作用在两个不同的数据源上**。

---

## 灵魂拷问

**Q1：为什么 Knowledge 要做成「图」（page + link）而不是「文档列表」？**

因为真实知识是**关联的**——退款政策会引用「退款流程」页面，退款流程又引用「财务条款」。图结构让 agent 能顺着 link 找到相关内容，而不是孤立的文档。这比「平铺的文档列表 + 检索」更接近知识的真实结构。

**Q2：Knowledge 和「把文档塞进向量库 + 检索工具」的传统 RAG 有什么区别？**

传统 RAG 是「无结构文档 + 向量检索」；Knowledge 是「有结构的知识图谱（page/note/link/scope）+ 关键词/语义混合检索 + 角色权限」。它多了**结构、关联、权限**这三样传统 RAG 容易忽略的东西。但代价是它还在 alpha、生态不成熟。

---

## 最佳实践

**✅ DO：**

- 只读的 docs agent 用 tools: { read: true }，别给写权限。
- 用 scope 隔离不同租户/团队的数据。
- 搜不到的词写进 page 的 name/description（提高关键词命中）。

**❌ DON'T：**

- 别在 alpha 阶段把它当生产核心依赖——留好回退到手写 RAG 的方案。
- 别给一个 agent 挂多个 scope 还都开写权限——会串数据（文档明确提醒）。

---

## 代码实战：一个「公司文档问答」agent

```typescript
import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { Agent } from '@mastra/core/agent';

const knowledge = new Knowledge({
  id: 'company',
  storage: new LibSQLStore({ id: 'knowledge', url: 'file:./knowledge.db' }),
  vector: new LibSQLVector({ id: 'knowledge-vector', url: 'file:./knowledge.db' }),
  embedder: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
  scopes: knowledgeMemoryScopes(),
  tools: { read: true },   // 只读
});

const docsAgent = new Agent({
  id: 'docs-agent',
  name: 'docs-agent',
  instructions: '只基于公司文档回答问题，找不到就说不知道。',
  model: 'deepseek/deepseek-chat',
  knowledge,
});
```

---

## 实操练习（工单客服 Agent · 第 6 步）

**练习 1**：建一个 Knowledge 实例，用 upsertPage 灌入 3 篇 FAQ。

**验收标准**：agent 能通过 knowledge_search 搜到并引用 FAQ 内容。

**练习 2**：配 vector + embedder，让 agent 能语义搜（搜「报销」能命中「费用退回」页面）。

**验收标准**：无共同关键词的查询也能命中。

**练习 3**：用 tools: { read: true } 建一个只读 docs agent。

**验收标准**：agent 只能读，不能改内容。

---

## 本章小结

- Memory 回忆对话，Knowledge 查外部资料——两者互补，别混。
- Knowledge 是知识图谱：page/note/link/scope/role。
- 挂到 agent 用 knowledge 选项；tools 控制读写权限；vector+embedder 开启语义搜索。
- 灌数据用 upsertPage / addNote。
- alpha 状态，生产用谨慎，可回退手写 RAG。

下一章讲 **评估 Evals**——把第 21 章手写的评测，升级成内置 scorer + dataset + experiment 的完整评测循环。
