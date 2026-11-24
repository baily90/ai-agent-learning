# 第32章：Agent 与 Tool — 把工具调用循环变成三行配置

## 引言

第 7 章你第一次学会 Function Calling，第 12 章你手写了完整的 ReAct 循环——那时代码大概是这样的：自己维护 messages 数组、每次调用后检查 `finishReason`、发现 `tool-calls` 就手动执行工具、把结果塞回消息、再循环……写得多了，你甚至能闭着眼睛默写这套 loop。

好消息是：**这套 loop 你不用再写了**。Mastra 的 Agent 把「模型 → 工具调用 → 执行 → 回填 → 再调用」这条循环全部内置。你只需要回答两个问题：这个 agent 是谁？它能用什么工具？

这一章，我们把这个转变讲透。

---

## 32.1 心智转变：从「写循环」到「填配置」

### 一句话直觉

在 AI SDK 里，工具调用循环是**你写的代码**；在 Mastra 里，工具调用循环是**Agent 的一个内置能力**。你的角色从「写循环的人」变成「定义 agent 的人」。

### 前端类比

想想你从「手写表单提交」到「用 React Hook Form」的转变：

- 手写：监听 onChange、手动存 state、手动校验、手动防抖……每个表单都重写一遍
- React Hook Form：声明 `register('field')` + 校验规则，库帮你跑完整个流程

Mastra 的 Agent + Tool 就是 agent 领域的「React Hook Form」——你声明「agent 有什么工具」，循环交给框架。

### 详细原理

回顾 AI SDK 手写工具循环的三个核心动作：

```
1. generateText({ tools })        → 模型决定是否调工具
2. 检查 result.toolCalls          → 有就执行工具
3. 把工具结果 push 回 messages    → 再调一次模型
4. 重复直到 finishReason === 'stop'
```

Mastra 的 Agent 内部就是这段逻辑的成品版，还额外加了：自动管理消息历史、自动处理多轮、自动决定何时停、把每一步都记进 trace。

---

## 32.2 定义 Agent

### 基本结构

```typescript
import { Agent } from '@mastra/core/agent';

const supportAgent = new Agent({
  id: 'support',                    // 唯一标识
  name: 'support',
  model: 'deepseek/deepseek-chat',    // provider/model 字符串
  instructions: '你是电商客服，语气友好，先安抚再解决问题。',
});
```

三个必填项：`name`（标识）、`model`（字符串）、`instructions`（人设/系统提示词）。

### instructions 就是 system prompt

你第 3 章学的 Prompt 工程在这里原样适用——`instructions` 就是 `system` 角色：

```typescript
const agent = new Agent({
  id: 'support',
  name: 'support',
  model: 'deepseek/deepseek-chat',
  instructions: `你是「云上商城」的售后客服。

规则：
1. 先安抚用户情绪，再解决问题
2. 涉及退款金额超过 500 元的，必须先查询订单再回答
3. 不知道的信息不要编造，引导用户提供更多细节`,
});
```

### 给 agent 挂上工具

```typescript
const agent = new Agent({
  id: 'support',
  name: 'support',
  model: 'deepseek/deepseek-chat',
  instructions: '你是售后客服。',
  tools: { getOrder, checkLogistics, applyRefund },  // 工具集合
});
```

挂上工具后，agent 就会自动在需要时调用它们——**没有手写循环**。

---

## 32.3 定义 Tool：必须用 createTool()

### 关键规则（最容易踩的坑）

Mastra 的工具**必须**用 `createTool()` 定义。传一个普通对象会**静默失败**——agent 压根不调用它，你还不知道为什么。

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getOrder = createTool({
  id: 'getOrder',                     // 唯一标识
  description: '根据订单号查询订单状态。用户提到"我的订单/物流/退款"时调用。',
  inputSchema: z.object({              // zod，和 AI SDK 的 tool 一样
    orderId: z.string().describe('订单号，如 ORD-2024-001'),
  }),
  execute: async ({ orderId }) => {    // 入参直接解构，第一个参数就是 inputData
    // 这里查数据库 / 调内部 API
    return { orderId, status: '已发货', total: 299 };
  },
});
```

### 和 AI SDK 的 tool 对照

AI SDK 的 `tool()` 和 Mastra 的 `createTool()` 字段几乎一一对应，你第 7 章学的知识直接迁移：

| AI SDK `tool()` | Mastra `createTool()` |
|---|---|
| `description` | `description`（相同，引导模型何时调用） |
| `inputSchema`（zod） | `inputSchema`（zod，相同） |
| `execute(args)` | `execute(inputData, context)`（入参直接解构，第二参是执行上下文） |
| （无 id，用对象 key） | `id`（显式声明，字符串） |

> 注意 `execute` 的签名：`execute(inputData, context)`。入参在**第一个参数**里直接解构（`async ({ orderId }) =>`），第二个参数 `context` 是运行时上下文（requestContext、abortSignal 等，可省略）。和 AI SDK 的 `tool()` 几乎一样，**别把入参塞进 context**。

### description 的重要性（呼应第 7 章）

工具的 `description` 是给模型看的「使用说明书」。写不清楚，模型就不知道该什么时候调。比如：

```typescript
// ❌ 太模糊，模型不知道何时用
description: '查询订单',

// ✅ 说清触发条件
description: '根据订单号查询订单状态。当用户询问订单进度、是否发货、物流信息时调用。',
```

---

## 32.4 结构化输出：让 agent 返回 JSON

企业场景里，你经常要 agent 返回结构化数据（第 5 章学过）。Mastra 用 `structuredOutput` 定义输出 schema——注意 **agent 级别要放在 `defaultOptions.structuredOutput` 里，不是 `output` 字段**（`output` 只是旧的单次调用参数）：

```typescript
import { z } from 'zod';

const agent = new Agent({
  id: 'ticket-classifier',
  name: 'ticket-classifier',
  model: 'deepseek/deepseek-chat',
  instructions: '把用户消息分类。',
  defaultOptions: {
    structuredOutput: {
      schema: z.object({
        category: z.enum(['退款', '物流', '咨询', '投诉']),
        urgency: z.enum(['低', '中', '高']),
        summary: z.string().describe('一句话概括用户诉求'),
      }),
    },
  },
});
```

这样 agent 的每次返回都会被约束成这个 JSON 结构。读取结果用 `response.object`（已按 schema 校验、带类型推导）：

```typescript
const response = await agent.generate('我要退款，订单号 ORD-1001');
console.log(response.object.category);  // '退款'
console.log(response.object.urgency);   // '高'
```

---

## 概念辨析：AI SDK 手写循环 vs Mastra Agent

| 维度 | AI SDK 手写 | Mastra Agent |
|---|---|---|
| 工具循环 | 自己写 for/while + 检查 finishReason | 内置，自动跑 |
| 消息历史 | 自己维护 messages 数组 | 自动管理 |
| 多轮对话 | 自己 push 历史 | 自动 |
| 停止条件 | 自己写 stopWhen | 内置默认 + 可配 |
| 可观测 | 自己打日志 / 接 Langfuse | 自动记 trace |
| 灵活度 | 完全可控，适合特殊逻辑 | 够用，特殊逻辑可降级到 AI SDK |

一句话：**90% 的场景用 Mastra Agent 更省事；剩下 10% 需要精细控制循环时，你随时可以回到 AI SDK 手写**（第 31 章灵魂拷问 Q3 说过，两者共存）。

---

## 灵魂拷问

**Q1：为什么 Mastra 要强制 `createTool()`，普通对象为什么不 work？**

因为工具不只是「描述 + 函数」，框架还需要给工具注入**运行时上下文**（`context`：agent 是谁、workflow 在哪一步、有没有权限等），并在调用前后做**记录、追踪、错误处理**。`createTool()` 返回的是一个带元数据的工具对象，普通对象缺这些元数据，框架识别不了，于是「静默失败」。

**Q2：Agent 的 tool loop 和 AI SDK 的 `stopWhen` 是什么关系？**

`stopWhen` 是 AI SDK 控制「循环最多跑几轮」的开关；Mastra Agent 把「合理默认 + 可配置」做了封装。你在 Mastra 里看到的 trace 里，每一步 tool call 本质就是 AI SDK 的一轮 `generateText`。**封装没有魔法，底层还是你熟悉的那套。**

**Q3：工具执行报错了怎么办？agent 会崩吗？**

不会。Mastra 会把工具抛出的异常捕获，作为工具结果返回给模型（告诉它「这个工具失败了」），让模型自己决定下一步（换工具、换个参数、或如实告知用户）。这和你第 19 章学的「容错」思路一致——**把错误交给模型处理，而不是让整个流程崩溃**。

---

## 最佳实践

**✅ DO：**

- 工具 `description` 写清楚**触发条件**，别只写「查询 XX」。
- 工具独立成文件（`src/mastra/tools/getOrder.ts`），agent 只负责引用。
- 输入用 zod 严格校验，`describe()` 写清每个字段含义。
- 工具返回结构化对象（而不是拼接好的字符串），方便 agent 后续处理和 trace 展示。

**❌ DON'T：**

- 别用普通对象定义工具——必须 `createTool()`。
- 别在 `execute` 里写耗时过长的同步逻辑，优先异步。
- 别把业务敏感逻辑（扣款、发券）直接暴露成工具却不加任何鉴权——工具就是 agent 的「手」，要给手装护栏（第 20 章安全思路，后续 workflow 章会加人工审批）。

---

## 代码实战：一个会查订单的客服 agent

```typescript
// src/mastra/tools/getOrder.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getOrder = createTool({
  id: 'getOrder',
  description: '根据订单号查询订单状态。用户询问订单进度、是否发货、物流信息时调用。',
  inputSchema: z.object({
    orderId: z.string().describe('订单号，如 ORD-2024-001'),
  }),
  execute: async ({ orderId }) => {
    // 模拟查询（真实项目里这里查数据库）
    const mockOrders: Record<string, any> = {
      'ORD-2024-001': { status: '已发货', logistics: '顺丰 SF123456', total: 299 },
      'ORD-2024-002': { status: '待付款', total: 1299 },
    };
    const order = mockOrders[orderId];
    if (!order) return { error: '订单不存在，请核对订单号' };
    return order;
  },
});
```

```typescript
// src/mastra/agents/support.ts
import { Agent } from '@mastra/core/agent';
import { getOrder } from '../tools/getOrder';

export const supportAgent = new Agent({
  id: 'support',
  name: 'support',
  model: 'deepseek/deepseek-chat',
  instructions: '你是售后客服，查询订单用 getOrder 工具，不要编造物流信息。',
  tools: { getOrder },
});
```

```typescript
// src/mastra/index.ts
import { Mastra } from 'mastra';
import { supportAgent } from './agents/support';

export const mastra = new Mastra({
  agents: { support: supportAgent },
});
```

`npx mastra dev` 后在 Playground 输入「帮我查下 ORD-2024-001 到哪了」，观察：agent 自动调用 `getOrder`，拿到结果后组织成自然语言回复，全程 trace 可见。

---

## 实操练习（工单客服 Agent · 第 2 步）

**练习 1**：给客服 agent 加第二个工具 `checkLogistics`（查询物流），字段用 zod 定义。

**验收标准**：用户问「物流」时 agent 调 `checkLogistics`，问「订单」时调 `getOrder`，不混淆。

**练习 2**：新建一个 `ticket-classifier` agent，用 `defaultOptions.structuredOutput` 让返回分类 JSON（退款/物流/咨询/投诉 + 紧急度）。

**验收标准**：任意输入都能拿到合规的 JSON，类型不报错。

**练习 3（进阶）**：故意用「普通对象」定义一个工具挂上去，观察 agent 是否忽略它，然后用 `createTool()` 重写。

**验收标准**：能说出「静默失败」的原因（见灵魂拷问 Q1）。

---

## 本章小结

- Mastra Agent 把 AI SDK 的工具调用循环**内置**了，你从「写循环」变成「填配置」。
- Agent 三要素：`name` / `model`（字符串）/ `instructions`（就是 system prompt）。
- 工具必须用 `createTool()` 定义（`id` + `description` + `inputSchema`(zod) + `execute(inputData, context)`），普通对象会静默失败。
- `execute` 的参数在 `context` 里，取参要 `const { xx } = context`。
- 结构化输出用 `output` + zod。
- 工具报错不会崩，会作为结果交给模型自行决策（容错思路延续）。

下一章进入 Mastra 真正的重头戏：**Workflow 编排**——把「多步任务」从第 13 章的手写执行链，升级成声明式步骤。
