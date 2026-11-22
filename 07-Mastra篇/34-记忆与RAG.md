# 第34章：记忆与 RAG — 把检索管道变成内置能力

## 引言

第 8 章你手写对话记忆（维护消息数组、滑动窗口、摘要压缩），第 9、10 章你手写 RAG（分块 → 向量化 → 检索 → 重排 → 注入 prompt）——那套管道你现在应该还记得有多繁琐：自己管 embedding、自己连向量库、自己拼 prompt。

Mastra 把这两件事都做成了**配置项**。这一章我们看看：记忆（Memory）和知识检索（RAG）在 Mastra 里是怎么「一行配置」搞定的。

---

## 34.1 心智转变：从「搭管道」到「开开关」

### 一句话直觉

AI SDK 里，记忆和 RAG 是**你搭的管道**；Mastra 里，它们是 **Memory 对象的几个配置开关**。

### 前端类比

- 手写 RAG 管道 ≈ 手写 React 的状态管理（useState/useEffect 满天飞）
- Mastra Memory ≈ 用 Zustand/Redux（声明式、内置能力、自动持久化）

你第 9 章手写的那套「查向量库 → 取 topK → 拼进 prompt」，Mastra 叫 **semantic recall**，一个开关就开。

### 一个前置条件：Storage

记忆要持久化，必须先配**存储**。Mastra 用 `LibSQLStore` 做默认存储：

```typescript
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: ':memory:',          // 或 file:./mastra.db 持久化到文件
  }),
});
```

> 这是记忆和 RAG 的地基——没配 storage，记忆存不下来。

---

## 34.2 对话记忆：Message History

### 开一个带记忆的 agent

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

const supportAgent = new Agent({
  name: 'support',
  model: 'deepseek/deepseek-chat',
  instructions: '你是客服助手。',
  memory: new Memory({
    options: {
      lastMessages: 20,        // 最近 20 条消息塞进上下文
    },
  }),
});
```

### 用 resource + thread 隔离会话

```typescript
// 用户 A 的第一次对话
await supportAgent.generate('我最喜欢的颜色是蓝色', {
  memory: { resource: 'user-123', thread: 'conversation-1' },
});

// 同一 thread 下，agent 记得上下文
const r = await supportAgent.generate('我刚才说我喜欢的颜色是什么？', {
  memory: { resource: 'user-123', thread: 'conversation-1' },
});
// → "蓝色"
```

两个关键概念：

- **resource**：稳定的「主体」标识（通常是用户 ID）
- **thread**：一次「会话」的隔离 ID

同一个 `resource + thread` 组合，就是一段独立的对话上下文。这和第 8 章你手写「按 sessionId 存消息数组」是同一件事，只是现在自动持久化了。

---

## 34.3 语义召回：Semantic Recall（内置 RAG）

长对话里，用户可能问「上次我们聊退款最后定了什么？」，而原文写的是「那笔钱退给他吧」——**关键词搜不到，语义搜得到**。这就是 semantic recall 的价值。

### 开启语义召回

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';

const supportAgent = new Agent({
  name: 'support',
  model: 'deepseek/deepseek-chat',
  instructions: '你是客服助手。',
  memory: new Memory({
    storage: new LibSQLStore({ id: 'agent-storage', url: 'file:./local.db' }),
    vector: new LibSQLVector({ id: 'agent-vector', /* ... */ }),
    options: {
      semanticRecall: true,       // 开启语义召回
    },
  }),
});
```

### 原理（呼应第 9 章）

semantic recall 就是你在第 9 章手写的 RAG 管道的成品版：

1. 新消息进来 → 向量化（embedding）
2. 拿向量去向量库搜「语义相近」的历史消息
3. 把最相关的历史消息注入当前上下文
4. 生成后，把新消息也写进向量库，供下次召回

**你手写过的每一步，它都内置了。** 这就是「从造轮子到开成品车」的直观体现。

---

## 34.4 工作记忆与观察记忆

### Working Memory（工作记忆）

存「关于用户的持久结构化信息」——名字、偏好、目标。跨会话记住「这个用户是 VIP、常用地址是上海」这类事实。

```typescript
memory: new Memory({
  options: {
    workingMemory: true,      // 开启工作记忆
  },
}),
```

### Observational Memory（观察记忆）

长对话会把上下文窗口塞爆。observational memory 用**后台 agent**把旧消息压缩成「观察摘要」，保留信息、缩小上下文。就像第 8 章你手写的「摘要压缩」，但自动化了。

```typescript
memory: new Memory({
  options: {
    observationalMemory: true,
  },
}),
```

> 记忆三层：**message history**（原始消息）→ **working memory**（结构化事实）→ **observational memory**（压缩摘要）。从「记原话」到「记事实」到「记要点」，一层比一层精炼。

---

## 34.5 外部知识检索：Knowledge（RAG 的文档版）

上面讲的 memory 是「回忆对话」。而**外部知识库**（公司政策、产品文档、FAQ）在 Mastra 里叫 **Knowledge**：

```typescript
import { Knowledge } from '@mastra/core/knowledge';

const knowledge = new Knowledge({
  id: 'company',
  storage,
  scopes: { /* ... */ },
  tools: true,          // 自动给 agent 挂上 search/read/write 工具
});
```

Knowledge 是一个「页面 + 笔记 + 链接」组成的**知识图谱**，按 scope 隔离（比如 `org:acme`、`team:support`）。agent 拿到 `tools: true` 后，就能搜索、读取这些知识页。

> ⚠️ **注意**：Knowledge 目前是 **alpha** 状态，API 可能变。生产使用建议先观望，或用 semantic recall + 自定义检索工具替代（后者的思路和第 9、10 章完全一致）。

---

## 概念辨析：Memory vs Knowledge vs 手写 RAG

| 概念 | 记的是什么 | 时间跨度 | 对应你之前的 |
|---|---|---|---|
| **Message History** | 当前对话的原始消息 | 单线程 | 第 8 章消息数组 |
| **Working Memory** | 关于用户的结构化事实 | 跨会话 | 第 8 章长期记忆 |
| **Observational Memory** | 压缩后的对话摘要 | 单线程长对话 | 第 8 章摘要压缩 |
| **Semantic Recall** | 语义相似的历史消息 | 跨消息 | 第 9 章向量检索 |
| **Knowledge** | 外部文档/政策/FAQ | 跨会话跨 agent | 第 10 章 RAG 进阶 |

一句话：**Memory 管「对话里发生了什么」，Knowledge 管「对话之外有什么知识」**。

---

## 灵魂拷问

**Q1：semantic recall 和手写 RAG 的本质区别是什么？**

没有本质区别——它就是 RAG，只是把「向量化、检索、注入、回写」这条管道做成了框架内置。你第 9 章学的 embedding、相似度、topK 这些概念**一个都不浪费**：它们全都还在，只是你从「写管道的人」变成「调开关的人」。理解原理依然重要（否则出了召回不准的问题你无从排查）。

**Q2：resource 和 thread 为什么要分开？**

因为它们回答两个不同的问题：**「这是谁」**（resource，稳定身份）和**「这次聊的是哪段」**（thread，会话隔离）。一个用户（resource）可以有多个会话（thread）。分开后，你既能「跨会话记用户偏好」（working memory 按 resource），又能「会话内连续对话」（message history 按 thread）。

**Q3：记忆会不会越存越多把成本搞爆？**

会，这正是 memory processors（第 8 章你手写过的「滑动窗口/裁剪/优先级」）和 observational memory 存在的意义。Mastra 的策略是：原始消息只留最近 N 条，更早的压缩成观察摘要、或进向量库按需召回。**核心思路和你第 8 章学的完全一致：分层存储 + 按需检索。**

---

## 最佳实践

**✅ DO：**

- 多租户场景用 `resource + thread` 严格隔离会话，别串数据。
- 长对话场景开 `observationalMemory` + `semanticRecall`，控制上下文大小的同时保住记忆。
- 外部文档检索优先评估 Knowledge（虽然 alpha），或用 semantic recall + 自定义工具兜底。

**❌ DON'T：**

- 别把所有历史消息无脑塞进上下文——成本会爆，用 `lastMessages` 限制。
- 别把不同用户的数据放进同一个 thread——会串记忆（还有安全隐患）。
- 别以为「开了记忆就万事大吉」——召回质量、上下文裁剪这些还是要你按第 9、10 章的原理去调。

---

## 代码实战：带记忆 + 语义召回的客服 agent

```typescript
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';

const storage = new LibSQLStore({ id: 'storage', url: 'file:./mastra.db' });

const supportAgent = new Agent({
  name: 'support',
  model: 'deepseek/deepseek-chat',
  instructions: '你是客服，记住用户说过的重要信息（名字、诉求、偏好）。',
  memory: new Memory({
    storage,
    vector: new LibSQLVector({ id: 'vector' }),
    options: {
      lastMessages: 20,
      semanticRecall: true,        // 语义召回
      workingMemory: true,         // 记住用户偏好
    },
  }),
});

export const mastra = new Mastra({
  storage,
  agents: { support: supportAgent },
});
```

调用：

```typescript
// 第一轮：告诉它一个信息
await supportAgent.generate('我叫小明，我的订单经常用顺丰发货', {
  memory: { resource: 'user-100', thread: 'chat-1' },
});

// 第二轮：它记得
const r = await supportAgent.generate('我叫什么？', {
  memory: { resource: 'user-100', thread: 'chat-1' },
});
// → "你叫小明"
```

---

## 实操练习（工单客服 Agent · 第 4 步）

**练习 1**：给客服 agent 配 `Memory`，用 `resource + thread` 隔离两个不同用户。

**验收标准**：用户 A 和用户 B 各聊各的，互不串记忆。

**练习 2**：开 `semanticRecall`，让 agent 在长对话中能「语义」回忆起之前聊过的诉求。

**验收标准**：用户换一种说法问之前的事，agent 仍能答对。

**练习 3（进阶）**：把 FAQ 文档灌进 Knowledge（或手动建向量检索工具），让 agent 能回答「基于公司文档」的问题。

**验收标准**：agent 回答引用文档内容，而不是编造。

---

## 本章小结

- 记忆和 RAG 在 Mastra 里是 **Memory 对象的配置开关**，不再是手写管道。
- 记忆分三层：message history（原始）/ working memory（事实）/ observational memory（摘要）。
- **semantic recall** 就是内置 RAG——向量化 + 语义检索，你第 9 章手写的那套它全内置。
- 用 `resource + thread` 隔离会话，`storage` 是持久化的地基。
- 外部文档检索用 **Knowledge**（alpha，注意 API 可能变）。

下一章进入「质量护栏」：**评估与可观测性**——把你第 21、22 章手写的评测脚本和 Langfuse 追踪，变成 Mastra 的内置能力。
