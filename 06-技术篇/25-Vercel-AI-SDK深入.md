# 第25章：Vercel AI SDK 深入 — 把散着用的 API 系统串起来

## 引言

从第 2 章第一次调 API 开始，你就一直在用 Vercel AI SDK——`generateText`、`streamText`、`tool`、`embed`……但多半是"用到哪个抄哪个"，没系统看过它到底有哪些能力、每个 API 什么时候该用哪个。

这就好比你用了半年 React，一直只会 `useState` 和 `useEffect`，直到某天看到同事用 `useReducer` 优雅地管理了复杂状态，才意识到"原来这东西我一直没吃透"。

这一章就是给 AI SDK 做一次"查漏补缺 + 系统串联"。学完之后，你对它的 API 会有一个完整的心理地图，遇到需求能直接说出"这个用 `generateObject`"、"那个用 `streamText` + `onChunkFinish`"。

> **🏭 实际项目怎么做**：在 TypeScript / 前端生态里，Vercel AI SDK 是**事实标准**。很多生产项目**根本不用 LangChain**，直接靠 AI SDK 写 agent loop——因为它的 API 够轻、类型够好、和 React 生态无缝衔接。你花时间吃透它，回报率比学任何框架都高。

---

## 25.1 先建立心理地图：AI SDK 到底解决什么问题

### 一句话直觉

AI SDK 之于 AI 应用，就像 **React 之于 UI**——它不帮你"想业务"，但把最脏最重复的底层活（流式解析、工具调用循环、多模型适配、类型安全）全包了。

### 前端类比

想想你为什么要用 React 而不是手写 DOM：

- 手写 DOM：`document.createElement`、手动 `innerHTML`、手动处理事件绑定——又累又容易漏
- React：声明式组件、自动 diff、自动绑定事件

AI SDK 做的是同一件事，只不过对象从 DOM 换成了 LLM：

| 手写（裸 fetch） | AI SDK |
|---|---|
| 手动拼 OpenAI/DeepSeek 的请求体 | `generateText({ model, prompt })` |
| 手动解析 SSE 流式响应 | `streamText` + `for await` |
| 手动处理工具调用的多轮循环 | `tools` + `stopWhen` |
| 手动校验模型返回的 JSON | `generateObject` + Zod |
| 换模型要改一整套请求逻辑 | 换个 `model` 参数即可 |

### 详细原理

AI SDK 的核心是一个**统一的抽象层**：它把"和模型对话"这件事，抽象成几个正交的能力。

```
                        ┌── generateText   一次性文本生成
                        ├── streamText     流式文本生成
        Provider 适配 ──┼── generateObject 结构化输出（JSON）
        (deepseek/      ├── embed          向量化（Embedding）
         openai/        ├── tool           工具定义
         anthropic/...) └── generateText + stopWhen  多步 agent 循环
```

所谓 "Provider 适配"，就是 `@ai-sdk/deepseek`、`@ai-sdk/anthropic` 这些包——它们把各家不同的 API 格式，翻译成 AI SDK 的统一格式。你换模型只改一行 `model`，其余代码不动。

### 深层追问

**为什么 AI SDK 能统一这么多家模型？**

因为现在主流大模型服务商都提供 **OpenAI 兼容接口**（baseURL + `/chat/completions`）。AI SDK 的 `createOpenAICompatible` 就是为此设计的——你在第 9 章 RAG 里接千问 Embedding 时已经用过：

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const dashscope = createOpenAICompatible({
  name: 'dashscope',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.QWEN_API_KEY,
});
```

对不提供 OpenAI 兼容接口的（如 Anthropic），官方则有专门的 `@ai-sdk/anthropic` 包。**统一抽象 + 各家适配器**，这就是 AI SDK 的骨架。

---

## 25.2 核心 API 全景：四个高频方法

### 一句话直觉

四个方法，四种场景：要一段文本 → `generateText`；要边生成边显示 → `streamText`；要结构化数据 → `generateObject`；要向量 → `embed`。

### 详细原理

**1. `generateText` —— 一次性生成**

等模型全部生成完，一次性拿到完整文本。适合后端任务：总结、分类、抽取、agent 的中间推理。

```typescript
import { generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';

const { text, usage, finishReason, toolCalls } = await generateText({
  model: deepseek('deepseek-chat'),
  system: '你是简洁的摘要助手',
  prompt: '把下面这段话总结成 20 字以内：' + longText,
});
```

返回里除了 `text`，还有三个很有用的东西：
- `usage`：input/output token 数（成本核算、限流都靠它）
- `finishReason`：为什么结束（`stop` 正常 / `length` 超长截断 / `tool-calls` 要调工具）
- `toolCalls`：这一轮模型发起的工具调用

**2. `streamText` —— 流式生成**

边生成边返回，适合任何需要"打字机效果"的交互场景。你在第 4 章已经用熟了。

```typescript
import { streamText } from 'ai';

const result = streamText({
  model: deepseek('deepseek-chat'),
  system: '你是助手',
  prompt: '介绍一下你自己',
});

// 逐段消费
for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

**3. `generateObject` —— 结构化输出**

让模型返回符合 Zod Schema 的 JSON 对象，而不是自由文本。这是你在第 5 章学过的"结构化输出"的 SDK 形态。

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: deepseek('deepseek-chat'),
  schema: z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number(),
  }),
  prompt: '用户评价："这个东西太垃圾了"',
});
// object.sentiment === 'negative'
```

**4. `embed` —— 向量化**

把文本转成向量，RAG 的检索环节用它。第 9 章见过。

```typescript
import { embed } from 'ai';

const { embedding } = await embed({
  model: dashscope.embeddingModel('qwen3.7-text-embedding-flash'),
  value: 'JavaScript 是一种编程语言',
});
// embedding 是一个 number[]
```

### 概念辨析：什么时候用哪个

| 需求 | 用哪个 | 为什么 |
|---|---|---|
| 后端一次性出结果（总结/分类） | `generateText` | 简单，够用 |
| 用户要看着文字流出来 | `streamText` | 体验，TTFB 短 |
| 要拿到可解析的数据（判断/抽取） | `generateObject` | 类型安全，不用正则 |
| RAG 检索 / 相似度 | `embed` | 语义向量 |

---

## 25.3 Tool Calling 深入：让模型"调用函数"

### 一句话直觉

`tool()` 就是给模型一个"函数菜单"——模型自己决定调哪个、传什么参数，你的 `execute` 负责真正执行并返回结果。

### 详细原理

一个完整的工具定义有四个要素：

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const getWeather = tool({
  description: '查询某城市的实时天气。用户问天气时使用。',  // ① 描述：模型靠它决定"该不该调、什么时候调"
  inputSchema: z.object({                                   // ② 参数 schema：模型按它生成入参
    city: z.string().describe('城市名，如"北京"'),
  }),
  execute: async ({ city }) => {                            // ③ 真正的执行逻辑
    return { city, temp: 26, condition: '晴' };             // ④ 返回结果（会回喂给模型）
  },
});
```

把工具传给 `generateText`，模型就会自主决定是否调用：

```typescript
const result = await generateText({
  model: deepseek('deepseek-chat'),
  system: '你是生活助手，能查天气',
  prompt: '北京明天天气怎么样？适合出去玩吗？',
  tools: { getWeather },
});
```

### 多步工具调用：`stopWhen`

单个工具调用很简单，但真实 agent 往往要**连调多个工具**——先查订单、再查退款规则、最后综合回答。这就是第 11 章的核心循环。

关键参数是 `stopWhen`：默认调一次工具就停，你要告诉它"最多循环多少步"：

```typescript
import { generateText, isStepCount, tool } from 'ai';

const result = await generateText({
  model: deepseek('deepseek-chat'),
  prompt: question,
  tools: { getOrder, getRefundPolicy },
  stopWhen: isStepCount(10),  // 最多 10 步工具调用
});

// 回看模型每一步调了什么
for (const call of result.toolCalls) {
  console.log(`${call.toolName}(${JSON.stringify(call.input)})`);
}
```

### 深层追问

**`description` 写得好不好，直接决定模型会不会"用错工具"。** 一个经典坑：两个工具名字/描述太像（`search` vs `searchWeb`），模型就会乱选。最佳实践是写清楚 **"什么时候用"** 和 **"什么时候绝对别用"**：

```typescript
const searchProducts = tool({
  description:
    '在商品库中搜索商品。当用户询问商品价格、规格、库存时使用。' +
    '注意：不要用它查订单或退款状态，那是 getOrder 的职责。',
  inputSchema: z.object({ keyword: z.string() }),
  execute: async ({ keyword }) => { /* ... */ },
});
```

---

## 25.4 流式输出的进阶：生命周期回调

### 一句话直觉

`streamText` 不仅能拿文字，还能在"每一段生成完"和"整个流结束"时插一脚，做记账、落库、上报。

### 详细原理

`streamText` 接受几个生命周期回调，这是把它从"玩具"变成"生产级"的关键：

```typescript
const result = streamText({
  model: deepseek('deepseek-chat'),
  prompt: question,
  onChunk({ chunk }) {
    // 每个 chunk 到达时触发（打字机的一个"字"）
  },
  onFinish({ text, usage, finishReason }) {
    // 整个流结束时触发：完整文本、token 用量、结束原因
    console.log(`消耗 ${usage.totalTokens} token`);
  },
});
```

**最实用的两个场景：**

1. **成本记账**：在 `onFinish` 里拿 `usage`，写入数据库或上报给观测平台
2. **结果落库**：在 `onFinish` 里把完整回答存下来，避免前端流中断导致内容丢失

### 前端类比

`onChunk` 就像 React 的 `onChange`——输入每个字符都触发；`onFinish` 就像 `onBlur`——全部完成才触发一次。你不需要在 `onChange` 里做重活，重活（校验、保存）留给 `onBlur`。

---

## 25.5 前端集成：`useChat` 一把梭

### 一句话直觉

后端写好 API Route 后，前端用 `useChat` 就能拿到消息列表、输入框状态、加载状态——不用自己管 SSE 解析。

### 详细原理

这是 AI SDK 对前端开发者最友好的部分。后端一个 Route：

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: deepseek('deepseek-chat'),
    system: '你是助手',
    messages,
  });
  return result.toDataStreamResponse();  // 一行搞定 SSE 响应
}
```

前端一个 Hook：

```tsx
'use client';
import { useChat } from 'ai/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat();

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.role}: {m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button disabled={isLoading}>发送</button>
      </form>
    </div>
  );
}
```

`useChat` 帮你处理了：SSE 连接、消息追加、流式打字、加载状态、错误处理。**生产里 80% 的聊天 UI 都是这么写的。**

### 深层追问

**`useChat` 够用吗？什么时候要自己接管？**

`useChat` 适合标准对话。但遇到这些情况，你可能需要更细的控制，改用 `useChat` 的高级配置或直接自己写流式消费：

- 需要展示工具调用的中间状态（"正在查询订单…"）
- 需要做生成式 UI（工具结果渲染成组件，见第 18 章）
- 需要多路并发流（一个回答同时开多个"思考分支"）

这时你会用到 `useChat` 的 `experimental_throttle`、`onToolCall` 等扩展点，或者用 `streamText` 的自定义 `onToolCall` 配合前端事件流。

---

## 概念辨析

### AI SDK vs LangChain

| | Vercel AI SDK | LangChain |
|---|---|---|
| 定位 | 轻量、统一的模型调用层 | 重量级的 Agent 编排框架 + 组件生态 |
| 学习曲线 | 平缓，几个方法 | 陡峭，概念多（chain/agent/graph） |
| 类型安全 | 极好（Zod 深度集成） | 一般 |
| 前端集成 | 原生（useChat 等 Hook） | 弱 |
| 适合 | 前端/TS 团队、轻量 agent | 复杂编排、需要大量现成组件 |
| 你的选择 | **主力** | 了解即可（见第 27 章） |

### `generateText` vs `streamText`

| | generateText | streamText |
|---|---|---|
| 返回时机 | 全部生成完 | 边生成边返回 |
| 首字延迟（TTFB） | 慢（要等全量） | 快 |
| 代码复杂度 | 低 | 略高 |
| 适用 | 后端任务、中间推理 | 面向用户的对话 |

---

## 灵魂拷问

> **Q1：我能不能不用 AI SDK，直接 `fetch` 调 DeepSeek 的接口？**

> **A：** 能，而且对理解底层有帮助（第 2 章应该讲过原始请求长啥样）。但生产里不建议。裸 `fetch` 意味着你要自己处理：SSE 流式解析（`data:` 前缀、`[DONE]` 终止、断线重连）、工具调用的多轮循环、各家模型差异、错误重试。这些 AI SDK 都替你做了，而且做得比你临时手写的好。**唯一需要裸写的场景**：AI SDK 还没适配某个新模型，或者你要做极致性能优化。

> **Q2：`inputSchema` 和 `description` 有什么区别，只写一个行不行？**

> **A：** 作用不同，两个都写。`description` 是给人（其实是给模型）看的**语义说明**，告诉模型"这工具是干嘛的、什么时候用"；`inputSchema` 是**结构约束**，告诉模型"参数长什么样"。只写 `inputSchema` 不写 `description`，模型不知道何时该用这个工具；只写 `description` 不写 `inputSchema`，模型可能传错参数格式。**两者配合，模型才能正确调用。**

> **Q3：`stopWhen: isStepCount(10)` 设多大合适？设太大或太小会怎样？**

> **A：** `stopWhen` 控制的是**工具调用轮次的上限**。设太小（比如 1），agent 只能调一次工具，多步任务（先查后算）做不完；设太大（比如 100），agent 可能陷入死循环反复调同一个工具，烧钱又慢。经验值：**简单任务 3-5 步，复杂多步任务 5-10 步**。更重要的是配合一个"终止条件"——当模型认为任务完成时会自然停止，`isStepCount` 只是兜底保护，防止无限循环。

> **Q4：模型返回的工具调用参数我信得过吗？需要自己再校验一遍吗？**

> **A：** 需要。`inputSchema` 是 Zod schema，AI SDK 会在执行 `execute` 前用它**校验**模型生成的参数——不合法就抛错或重试。但这只是"类型合法"，不代表"语义正确"。比如 `city` 字段模型传了 `"北精"`（错别字），Zod 校验会通过（它是个 string），但你的 `execute` 查不到结果。所以 `execute` 内部仍要做**业务校验**：查不到就返回"未找到该城市"，而不是让错误往上抛。

---

## 最佳实践

### DO

- **DO** 把 AI SDK 当作默认选择，先问"用哪个方法"而不是"用哪个框架"
- **DO** 给每个 `tool` 写清楚 `description` 和 `inputSchema`，尤其是"何时用/何时别用"
- **DO** 用 `generateObject` 替代"让模型输出 JSON 再自己 `JSON.parse`"——类型安全，省掉解析失败的坑
- **DO** 在 `onFinish` 里记账（token、成本），这比事后补日志可靠得多
- **DO** 用 `stopWhen` 给工具循环设上限，防止死循环
- **DO** 前端对话优先用 `useChat`，别重复造轮子

### DON'T

- **DON'T** 为了"用框架"而上 LangChain，轻量场景 AI SDK 完全够
- **DON'T** 在 `onChunk` 里做重活（写库、网络请求）——每个字都触发，会拖慢流
- **DON'T** 忽略 `finishReason`——`length`（超长截断）说明你该调大 `maxOutputTokens` 或压缩输入
- **DON'T** 在生产里裸 `fetch` 调模型，除非有明确的性能/适配理由
- **DON'T** 把 `stopWhen` 设得过大——死循环是 agent 项目的头号烧钱 bug

---

## 代码实战

> **项目归属**：下面是**可独立运行**的脚本，放到任意 demo 项目里 `npx tsx` 运行即可。依赖：`ai`、`@ai-sdk/deepseek`、`zod`、`dotenv`。`.env` 里配 `DEEPSEEK_API_KEY`。

### 一：结构化输出（generateObject + Zod）

```typescript
// 25-generateObject.ts
import 'dotenv/config';
import { generateObject } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { z } from 'zod';

const schema = z.object({
  intent: z.enum(['咨询', '投诉', '下单']),
  product: z.string().nullable(),
  sentiment: z.enum(['正面', '中性', '负面']),
});

const { object } = await generateObject({
  model: deepseek('deepseek-chat'),
  schema,
  prompt: '用户消息：你们这个手机壳质量太差了，用了两天就裂了，我要投诉！',
});

console.log(object);
// { intent: '投诉', product: '手机壳', sentiment: '负面' }
```

### 二：多步 agent（tool + stopWhen）

```typescript
// 25-agent.ts
import 'dotenv/config';
import { generateText, isStepCount, tool } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { z } from 'zod';

const inventory: Record<string, number> = { iphone15: 3, airpods: 0 };

const checkStock = tool({
  description: '查询商品库存。用户问"有没有货/还有几个"时使用。',
  inputSchema: z.object({ sku: z.string().describe('商品 SKU') }),
  execute: async ({ sku }) => ({ sku, stock: inventory[sku] ?? -1 }),
});

const checkPrice = tool({
  description: '查询商品价格。用户问"多少钱"时使用。',
  inputSchema: z.object({ sku: z.string() }),
  execute: async ({ sku }) => ({ sku, price: { iphone15: 5999, airpods: 1299 }[sku] ?? -1 }),
});

const result = await generateText({
  model: deepseek('deepseek-chat'),
  system: '你是电商导购。回答"能不能买"这类问题前，先查库存和价格再综合回答。',
  prompt: 'iPhone 15 和 AirPods 都还有货吗？分别多少钱？值得买吗？',
  tools: { checkStock, checkPrice },
  stopWhen: isStepCount(8),
});

console.log('工具调用轨迹：');
for (const c of result.toolCalls) {
  console.log(`  → ${c.toolName}(${JSON.stringify(c.input)})`);
}
console.log('\n最终回答：\n' + result.text);
```

---

## 实操练习

### 目标

把之前章节里"散着用"的 AI SDK 用法，系统梳理成你自己的速查笔记。

### 步骤

1. 写一个 `generateObject` 脚本：输入一段商品评论，输出 `{ sentiment, keywords }`
2. 写一个双工具 agent：`getOrder` + `getRefundPolicy`，跑通多步调用，打印 `toolCalls` 轨迹
3. 给 `streamText` 加 `onFinish`，把每次的 token 用量累加打印出来
4. 用 `useChat` 起一个最小聊天页（如果没做过）

### 验收标准

- [ ] 能说出四个核心方法的适用场景（不查资料）
- [ ] 双工具 agent 能自主完成"先查订单、再查规则、最后回答"
- [ ] 能从 `onFinish` 拿到准确的 token 用量
- [ ] `generateObject` 返回的对象类型正确（TS 编译通过）

### 挑战加分项

- [ ] 给 `stopWhen` 换成自定义条件：当连续两次工具调用结果相同时提前终止
- [ ] 对比 `generateObject` 和"`generateText` + 手动 `JSON.parse`"在解析失败率上的差异

---

## 本章小结

1. **AI SDK 是 TS 生态的"React"**：统一抽象层 + 各家适配器，换模型只改一行。

2. **四个核心方法**：`generateText`（一次性）、`streamText`（流式）、`generateObject`（结构化）、`embed`（向量）。

3. **工具调用是 agent 的核心机制**：`tool()` 定义 + `stopWhen` 控制循环上限，`description` 和 `inputSchema` 缺一不可。

4. **生命周期回调是生产化的关键**：`onFinish` 记账、落库，`onChunk` 只做轻活。

5. **前端用 `useChat` 一把梭**：80% 的聊天 UI 就靠它，复杂场景再自己接管。

6. **生产真相**：大多数 TS agent 项目，AI SDK 就够了，不需要上 LangChain。

下一章，我们给 agent 装上"数据地基"——PostgreSQL 与 pgvector。
