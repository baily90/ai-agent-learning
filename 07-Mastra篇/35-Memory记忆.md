# 第35章：Memory 记忆 — 四种记忆类型一次讲透

## 引言

第 8 章你手写对话记忆（消息数组、滑动窗口、摘要压缩），第 9、10 章你手写 RAG（分块、向量化、检索、重排）。那时你就知道「记忆」不是一件简单的事——它至少有好几种形态，各有各的适用场景。

Mastra 的 Memory 把这几种形态全做成了配置。但**很多人只用了 lastMessages 就以为「会了记忆」**——那只是冰山一角。这一章把 Mastra 的四种记忆类型 + 全部配置 + 适用场景一次讲透。

---

## 35.1 Memory 全景图

先建立整体认知。Mastra 的记忆分四大类，对应你第 8/9 章学的概念：

| 记忆类型 | 本质（对应 AI SDK 知识） | 关键配置 | 默认状态 |
|---|---|---|---|
| **消息历史** Message History | 第8章「滑动窗口」 | lastMessages / messageHistory | 开启（默认10条） |
| **工作记忆** Working Memory | 第8章「长期记忆/结构化事实」 | workingMemory: { enabled, scope, template } | 关闭 |
| **观察记忆** Observational Memory | 第8章「摘要压缩 + 滑动窗口」 | observationalMemory: true | 关闭 |
| **语义召回** Semantic Recall | 第9章「RAG/向量检索」 | semanticRecall + vector + embedder | 关闭 |

一句话记住分工：**消息历史记「最近说了啥」，工作记忆记「用户是谁」，观察记忆压「长对话」，语义召回搜「以前聊过啥」**。

---

## 35.2 前置：storage + thread/resource

记忆要持久化，必须先配 storage：

```typescript
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';

export const mastra = new Mastra({
  storage: new LibSQLStore({ id: 'mastra-storage', url: 'file:./mastra.db' }),
});
```

记忆按两个标识组织：

- **resource**：主体（通常是用户 ID），「这段记忆属于谁」
- **thread**：会话（一次对话），「这是哪一段对话」

```typescript
await agent.generate('你好', {
  memory: { resource: 'user-123', thread: 'conversation-1' },
});
```

> 关键：一个 resource 可以有多个 thread；同一 resource + thread 组合 = 一段独立对话。这是第 8 章「按 sessionId 存消息」的框架版。

---

## 35.3 消息历史：lastMessages vs messageHistory

### lastMessages：按「条数」截断

```typescript
memory: new Memory({
  options: {
    lastMessages: 10,   // 只把最近 10 条消息塞进上下文
  },
}),
```

- `lastMessages: N` = 保留最近 N 条（默认 10）
- `lastMessages: false` = 彻底关闭消息历史
- `lastMessages: Number.MAX_SAFE_INTEGER` = 全量

**关键坑**：lastMessages 按「条数」算，而**一条对话可能产生多条消息**——用户消息、助手消息、工具调用、工具结果、信号都各算一条。所以「10 条」可能只覆盖 2-3 轮对话。而且窗口每轮往前滑，旧消息出上下文 → 破坏 prompt 缓存。

### messageHistory：按「token 预算」截断（官方推荐）

因为「条数」是上下文大小的糟糕代理（一条消息可能是 10 token 也可能是 5000 token），官方推荐用 token 预算：

```typescript
memory: new Memory({
  options: {
    messageHistory: {
      maxTokens: 10000,        // 整个 prompt 的 token 上限
      atMaxRemoveTokens: 2000, // 超限时，砍到 maxTokens - 2000（默认砍 25%）
    },
  },
}),
```

超过 maxTokens 时，最旧的消息被丢弃，直到 prompt ≤ maxTokens - atMaxRemoveTokens。受保护内容、成对的工具调用+结果不会被拆开。

| 维度 | lastMessages | messageHistory |
|---|---|---|
| 衡量单位 | 条数 | token 数 |
| 精准度 | 粗（条数≠大小） | 准（真实占用） |
| 适用 | 简单场景 | 官方推荐 |

### 场景：短对话

消息历史适合「简单、短平快的对话」——客服第一轮咨询、一次性问答。对话一长就该考虑观察记忆（35.5）。

---

## 35.4 工作记忆：Working Memory

工作记忆存「关于用户的持久结构化事实」——名字、偏好、目标。跨会话记住「这个用户是 VIP、常用地址上海」。

### 完整配置

```typescript
memory: new Memory({
  options: {
    workingMemory: {
      enabled: true,
      scope: 'resource',        // 或 'thread'
      template: `# User Profile
- **Name**:
- **Location**:
- **Preferences**:
`,
    },
  },
}),
```

三个配置：

| 配置 | 作用 |
|---|---|
| enabled | 开关 |
| scope | **resource**（默认，跨会话按用户记）或 **thread**（会话内记） |
| template | 工作记忆的 Markdown 模板（告诉 agent 记哪些维度） |

### 两种 scope 的区别

- **resource 级**（默认）：记忆跨该用户的所有 thread 持久化——「记住这个用户，无论哪次对话」
- **thread 级**：记忆隔离在单个会话内

> 呼应第 8 章「长期记忆」——你手写的「用户画像存储」，Mastra 用 workingMemory + scope 帮你搞定。

---

## 35.5 观察记忆：Observational Memory

长对话会把上下文窗口塞爆。观察记忆（OM）用**两个后台 agent**自动压缩：

### 两层机制

1. **Observer（观察者）**：当未观察的消息超过 `observation.messageTokens`（默认 30000 token），把旧消息压成**短小的、带日期的观察笔记**（比原文小 5~40 倍）。
2. **Reflector（反思者）**：当观察笔记超过 `reflection.observationTokens`（默认 40000 token），把整个观察日志**再压缩**成更凝练的反思。

### 三层上下文结构

```
近期消息（原文）      ← 当前任务的最新对话
观察（Observations）  ← Observer 压出的近期摘要
反思（Reflections）   ← Reflector 压出的历史总纲
```

agent 看到的是「最近消息全文 + 更早的观察 + 更早的反思」，上下文始终小而聚焦。

### 开启（含完整配置项）

```typescript
memory: new Memory({
  storage: new LibSQLStore({ id: 'storage', url: 'file:./memory.db' }),
  options: {
    observationalMemory: {
      // —— 用哪个模型做压缩（默认 'auto'，自动选低成本模型）——
      model: 'deepseek/deepseek-flash',   // Observer + Reflector 共用一个模型
      // observation.model / reflection.model  // 也可分别指定两个角色的模型

      // —— Observer（观察者）：把旧消息压成观察 ——
      observation: {
        messageTokens: 30000,       // 未观察消息超过这个 token 数就触发压缩（默认 30000）
        bufferTokens: 0.2,          // 后台 Observer 每累计约 20% 阈值就跑一次（默认 0.2）
        bufferActivation: 0.8,      // 压缩激活后保留约 20% 近期消息（默认 0.8）
        blockAfter: 1.2,            // 超过 1.2 倍阈值（36000 token）就同步阻塞等压缩（默认 1.2）
        threadTitle: true,          // 话题变化时自动建议新的 thread 标题
        observeAttachments: ['image/*', 'application/pdf'],  // Observer 看哪些附件
        observeOnContextOverflow: true,  // 上下文超限时自动压缩并重试一次（默认 true）
      },

      // —— Reflector（反思者）：把观察日志再压缩成反思 ——
      reflection: {
        observationTokens: 40000,   // 观察日志超过这个 token 数就触发反思（默认 40000）
      },
    },
  },
}),
```

### 配置项速查

| 配置 | 默认 | 作用 |
|---|---|---|
| model | 'auto' | Observer/Reflector 用哪个模型（自动选低成本模型） |
| observation.messageTokens | 30000 | 触发「观察」的消息 token 阈值 |
| observation.bufferTokens | 0.2 | 后台 Observer 跑的频率（阈值比例） |
| observation.bufferActivation | 0.8 | 压缩后保留多少近期消息 |
| observation.blockAfter | 1.2 | 后台压缩跟不上的「阻塞线」 |
| observation.threadTitle | false | 话题变化时自动改 thread 标题 |
| observation.observeAttachments | ['image/*','application/pdf'] | Observer 看哪些附件 |
| observation.observeOnContextOverflow | true | 上下文超限自动压缩重试 |
| reflection.observationTokens | 40000 | 触发「反思」的观察日志 token 阈值 |

> 最常用要调的就两个：observation.messageTokens（压缩触发点）和 reflection.observationTokens（反思触发点）。其余多数用默认即可。

### 为什么它比 lastMessages 更适合长对话

- **上下文稳定**：观察追加到稳定的前缀，**prompt 缓存友好**（不像 lastMessages 每轮滑动导致缓存失效）。
- **不丢早期决策**：长任务跑几小时、几天，也不丢关键信息。

> 这呼应第 8 章「摘要压缩 + 滑动窗口」——你手写的那套「把旧消息摘要、只留最近几条」，Mastra 用 Observer+Reflector 两个 agent 自动做了，还做得更聪明（分层 + 缓存友好）。

### 场景：长对话/长任务

客服长会话、coding agent 跑几天、browser agent 长时间浏览——凡是「一次任务超过几十轮」的，都该用观察记忆。

---

## 35.6 语义召回：Semantic Recall

语义召回是「记忆版的 RAG」——用户换一种说法问之前聊过的事，关键词搜不到，语义搜得到。

### 原理（呼应第 9 章）

1. 新消息进来 → 向量化（embedding）
2. 拿向量去向量库搜「语义相近」的历史消息
3. 把最相关的历史消息注入当前上下文
4. 生成后，新消息也写进向量库，供下次召回

你第 9 章手写的那条 RAG 管道，它内置了。

### 开启（需要 vector + embedder）

```typescript
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';

memory: new Memory({
  storage: new LibSQLStore({ id: 'agent-storage', url: 'file:./local.db' }),
  vector: new LibSQLVector({ id: 'agent-vector', url: 'file:./local.db' }),
  embedder: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
  options: {
    semanticRecall: true,   // 或对象形式配置 topK/messageRange
  },
}),
```

**必须同时提供 vector（向量库）+ embedder（embedding 模型）**，除非向量库自己会 embedding（如 MongoDB 自动 embedding）。

### 配置

```typescript
options: {
  semanticRecall: {
    topK: 5,              // 召回几条最相似的消息
    messageRange: 2,      // 每条命中消息前后各带几条上下文
    scope: 'thread',      // 只搜当前 thread，还是搜所有 thread
  },
}
```

| 配置 | 作用 |
|---|---|
| topK | 召回几条最相似消息 |
| messageRange | 每条命中前后带几条（补足上下文） |
| scope | 只搜当前 thread / 搜该用户所有 thread |

### 场景：跨会话语义检索

「上次我们聊退款最后定了什么？」——原文写的是「那笔钱退给他吧」。关键词搜不到，语义召回能命中。

---

## 35.7 其他配置

```typescript
memory: new Memory({
  options: {
    readOnly: true,            // 只读：不保存新消息、不给更新工具
    retainFullInput: true,     // 输入原样处理，不做历史过滤
  },
  embeddingDimension: 1536,    // 显式指定 embedding 维度（避免首次探测）
}),
```

| 配置 | 作用 |
|---|---|
| readOnly | 只读记忆（预览、子 agent 只引用不改写） |
| retainFullInput | 输入原样处理，保留消息顺序 |
| embeddingDimension | 显式指定 embedding 维度 |

---

## 35.8 多用户线程（Multi-user Threads）

一个 thread 可以被多个用户共享（协作场景）：用 sendMessage 给每条消息带上说话人身份：

```typescript
agent.sendMessage(
  { contents: '把封面改成青色。', attributes: { name: 'Alice', role: 'editor' } },
  { resourceId: 'doc_42', threadId: 'doc_42' },
);
```

模型会收到带身份的 `<user name="Alice" role="editor">` 标签，能区分谁说了什么。

---

## 35.9 底层机制：Memory Processors

上面这些记忆能力，底层都是 Mastra 自动往 agent 管线里插的「memory 处理器」：

| 处理器 | 对应配置 | 作用 |
|---|---|---|
| MessageHistory | lastMessages / messageHistory | 加载/保存消息历史 |
| SemanticRecall | semanticRecall | 向量检索 + 写 embedding |
| WorkingMemory | workingMemory | 管理工作记忆状态 |

你不需要手动配置这些处理器——开了对应的 memory 选项，它们就自动生效。了解它只是为了「调试时看得懂 trace」。

---

## 35.10 选型决策表

| 你的场景 | 用哪种 memory |
|---|---|
| 短平快对话 | 消息历史 lastMessages（或 messageHistory） |
| 跨会话记用户偏好 | workingMemory（scope: resource） |
| 长对话/长任务（几十轮以上） | observationalMemory |
| 需要语义检索历史消息 | semanticRecall |
| 多人协作一个文档 | multi-user threads |
| 子 agent 只读记忆 | readOnly |

**组合使用**：真实企业 agent 往往是「messageHistory（近期）+ workingMemory（用户画像）+ semanticRecall（历史检索）」一起上。

---

## 概念辨析

**Q：lastMessages 和 observationalMemory 都管「上下文太长」，区别在哪？**

lastMessages 是「粗暴截断」——只留最近 N 条，更早的直接丢，且每轮滑动破坏缓存。observationalMemory 是「智能压缩」——旧消息压成摘要保留，上下文稳定、缓存友好。**前者丢信息，后者保信息**。

**Q：workingMemory 和 observationalMemory 都「跨轮记信息」，区别在哪？**

workingMemory 记的是「结构化事实」（用户名字、偏好），是**持久、主动维护**的画像。observationalMemory 记的是「对话过程摘要」，是**自动压缩**的流水账。一个记「人」，一个记「事」。

---

## 灵魂拷问

**Q1：为什么官方推荐 messageHistory（token 预算）而不是 lastMessages（条数）？**

因为「条数」是上下文大小的糟糕代理。一条工具结果可能 5000 token，十条可能 50 token。按条数截断会导致：要么上下文还很大就砍了有用信息，要么砍完还是超限。token 预算是「真实占用」的精准控制。

**Q2：semanticRecall 和 Knowledge（第 36 章）都是 RAG，区别在哪？**

semanticRecall 搜的是「**对话历史消息**」（这个 agent 和用户聊过什么）；Knowledge 搜的是「**外部知识文档**」（公司政策、产品手册）。一个是「回忆对话」，一个是「查资料」。

**Q3：observationalMemory 的 Observer 和 Reflector 为什么分两层？**

一层压缩（Observer）会越积越多，所以需要第二层（Reflector）把压缩结果再压缩。这是「分层摘要」——近期细、远期粗，和你第 8 章学的「滚动摘要 + 滑动窗口」是同一个思想，只是自动化了。

---

## 最佳实践

**✅ DO：**

- 多租户场景用 resource + thread 严格隔离，别串数据。
- 长对话开 observationalMemory，别硬扛 lastMessages。
- 语义召回配好 vector + embedder + topK。
- 记用户偏好用 workingMemory（scope: resource）。

**❌ DON'T：**

- 别把 workingMemory 写成 workingMemory: true（布尔）——是对象 { enabled: true }。
- 别把不同用户数据放进同一个 thread——串记忆还有安全隐患。
- 别以为「开了记忆就万事大吉」——召回质量、上下文裁剪还是要按第 8/9 章原理调。

---

## 代码实战：一个组合多种 memory 的客服

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';

const supportAgent = new Agent({
  id: 'support',
  name: 'support',
  model: 'deepseek/deepseek-chat',
  instructions: '你是客服，记住用户偏好，长对话保持连贯。',
  memory: new Memory({
    storage: new LibSQLStore({ id: 'storage', url: 'file:./mastra.db' }),
    vector: new LibSQLVector({ id: 'vector', url: 'file:./mastra.db' }),
    embedder: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
    options: {
      messageHistory: { maxTokens: 10000 },   // 近期消息（token 预算）
      workingMemory: { enabled: true, scope: 'resource' },  // 记住用户偏好
      semanticRecall: true,                   // 语义召回历史
    },
  }),
});
```

调用：

```typescript
await supportAgent.generate('我叫小明，常用顺丰发货', {
  memory: { resource: 'user-100', thread: 'chat-1' },
});
const r = await supportAgent.generate('我叫什么？', {
  memory: { resource: 'user-100', thread: 'chat-1' },
});
console.log(r.text);  // "你叫小明"
```

---

## 实操练习（工单客服 Agent · 第 5 步）

**练习 1**：给客服 agent 配 messageHistory（token 预算 8000）。

**验收标准**：长对话时上下文不超限，旧消息被自动裁剪。

**练习 2**：开 workingMemory（scope: resource），让 agent 记住用户偏好。

**验收标准**：不同 thread 里 agent 都能记住同一用户的偏好。

**练习 3**：开 semanticRecall，让 agent 能语义检索历史消息。

**验收标准**：用户换一种说法问之前聊过的事，agent 能答对。

**练习 4（进阶）**：开 observationalMemory，跑 30 轮以上长对话。

**验收标准**：上下文不爆，agent 不丢早期关键信息。

---

## 本章小结

- 记忆四类型：消息历史（滑动窗口）、工作记忆（长期事实）、观察记忆（分层压缩）、语义召回（向量检索）。
- 消息历史有 lastMessages（条数）和 messageHistory（token 预算，官方推荐）两种。
- 工作记忆是对象 { enabled, scope, template }，scope 决定跨会话还是会话内。
- 观察记忆用 Observer + Reflector 两层自动压缩，长对话首选。
- 语义召回是记忆版 RAG，需 vector + embedder，配 topK/messageRange/scope。
- 真实场景常组合使用。

下一章讲 **RAG 与知识 Knowledge**——把「查外部文档」和「回忆对话」分开，讲清 Mastra 的知识库能力。
