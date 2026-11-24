# 第33章：Tool 深入 — createTool 的完整配置

## 引言

第 7 章你第一次学 Function Calling 时，用的是 AI SDK 的 tool()：写 description、写 inputSchema（zod）、写 execute。那时候你可能没意识到，一个「好用的工具」背后有一堆细节——输出要不要校验？要不要渲染给前端？要不要人工审批？这些你在 AI SDK 里都得自己手写。

Mastra 的 createTool() 把这些细节全做成了配置项。这一章把它讲透。

---

## 33.1 createTool 的完整结构

先看一张全景图：

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getOrder = createTool({
  id: 'getOrder',                       // 唯一标识（必填）
  title: '查询订单',                     // 展示名（给前端 UI 用，不发给模型）
  description: '根据订单号查询订单状态。用户询问订单进度时调用。',  // 给模型看的使用说明
  inputSchema: z.object({                // 输入（Standard JSON Schema / zod）
    orderId: z.string().describe('订单号，如 ORD-1001'),
  }),
  outputSchema: z.object({               // 输出（用于校验 + 类型推导）
    orderId: z.string(),
    status: z.string(),
    amount: z.number(),
  }),
  execute: async ({ orderId }) => {      // 真正的执行逻辑
    return { orderId, status: '已发货', amount: 299 };
  },
});
```

八个字段，各有分工：

| 字段 | 作用 | 必填 |
|---|---|---|
| id | 唯一标识，代码里引用用 | ✅ |
| description | 给模型看的「何时该调这个工具」 | ✅ |
| inputSchema | 输入参数校验（zod） | ✅ |
| execute | 执行逻辑 | ✅（除非 renderOnly） |
| title | 前端 UI 展示名，**不发给模型** | ❌ |
| outputSchema | 输出结构校验 + 类型推导 | ❌（建议加） |
| strict | 严格输入生成（见 33.6） | ❌ |
| outputValidation | 输出校验策略（见 33.5） | ❌ |
| renderOnly | 纯展示工具（见 33.7） | ❌ |
| requireApproval | 执行前人工审批（见 33.8） | ❌ |

---

## 33.2 execute 签名：execute(inputData, context)

这是最容易踩的坑（前面第 32 章也强调过）：

```typescript
execute: async ({ orderId }, context) => {
  // 第一个参数：inputSchema 校验后的入参，直接解构
  // 第二个参数：执行上下文（可省略）
  return { orderId };
}
```

- **第一个参数**：入参，\(直接解构\)，不是 `{ context }` 包装。
- **第二个参数 context**：运行时上下文，含 requestContext、tracingContext、abortSignal 等。不用可以省略。

> 别写成 `execute: async ({ context }) => { const { orderId } = context }` —— 那是旧写法，会取不到参。

---

## 33.3 输入/输出 schema：zod 是你的朋友

### description 决定「何时调」

description 是给模型看的「使用说明书」，写不清模型就不知道该啥时候调（呼应第 7 章）：

```typescript
// ❌ 太模糊
description: '查询订单',

// ✅ 说清触发条件
description: '根据订单号查询订单状态。当用户询问订单进度、是否发货、物流信息时调用。',
```

### inputSchema 里 describe 每个字段

```typescript
inputSchema: z.object({
  orderId: z.string().describe('订单号，如 ORD-1001'),
  reason: z.string().describe('退款原因'),
}),
```

`.describe()` 会传给模型，帮它填对参数——这是第 7 章你就该养成的习惯。

---

## 33.4 输出校验：outputValidation

工具返回的结果如果和 outputSchema 对不上，Mastra 怎么处理？用 outputValidation 控制：

```typescript
execute: async () => {
  // 假设这里返回了一个不符合 outputSchema 的结果
  return { wrongField: true };
}
outputValidation: 'strict'   // 或 'warn'，默认 strict
```

| 值 | 行为 |
|---|---|
| 'strict'（默认） | 校验失败时，用「校验错误对象」替换结果 |
| 'warn' | 校验失败但**原样返回**实际结果（适合副作用已发生的工具） |

> 关键判断：如果工具的「副作用」已经发生（比如已经写了数据库），就别用 strict 把结果替换掉，用 warn 更合理。

---

## 33.5 strict 模式

`strict: true` 会让 Mastra 在支持的模型适配器上开启「严格工具输入生成」——让模型返回更贴合 schema 的参数：

```typescript
const tool = createTool({
  id: 'calc',
  description: '计算两数之和',
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  strict: true,   // 让模型更严格地生成符合 schema 的参数
  execute: async ({ a, b }) => ({ result: a + b }),
});
```

适合「参数类型严格、模型容易跑偏」的场景。

---

## 33.6 renderOnly：纯展示工具（呼应生成式 UI）

第 18 章你做过生成式 UI——工具调用的目的不是「算数据」，而是「让前端渲染一个组件」（比如展示一张订单卡片）。这种工具用 renderOnly，**不写 execute**：

```typescript
const showCard = createTool({
  id: 'show-card',
  description: '展示商品卡片',
  inputSchema: z.object({ productId: z.string() }),
  renderOnly: true,   // 只负责「告诉前端渲染」，不执行
});
```

Mastra 会流式发出这个工具调用，并返回 { acknowledged: true } 让 agent 继续。前端监听这个 tool-call 事件渲染组件。

> ⚠️ 注意：acknowledged 只表示「调用已发出」，**不代表浏览器真的渲染了**。如果这个操作的结果会影响 agent 后续判断，别用 renderOnly。

---

## 33.7 requireApproval：执行前人工审批

危险操作（删除、退款、发邮件）用 requireApproval 让工具在执行前等人批准（第 32.7 节讲过，这里补上在 createTool 里的位置）：

```typescript
const deleteTool = createTool({
  id: 'delete-record',
  description: '按 ID 删除记录',
  inputSchema: z.object({ id: z.string() }),
  requireApproval: true,   // 执行前暂停，等 approveToolCall
  execute: async ({ id }) => {
    await db.delete(id);
    return { deleted: true };
  },
});
```

---

## 概念辨析：AI SDK tool() vs Mastra createTool()

| 维度 | AI SDK tool() | Mastra createTool() |
|---|---|---|
| 入参 | execute(args) | execute(inputData, context) |
| 输出校验 | 手动 | outputValidation 内置 |
| 人工审批 | 手动 | requireApproval 内置 |
| 纯展示 | 手动 | renderOnly 内置 |
| 前端展示名 | 无 | title |
| 严格输入 | 部分 | strict |

一句话：createTool 把「工具该有的企业级细节」都内置了，你从「写一堆样板」变成「填几个配置」。

---

## 灵魂拷问

**Q1：为什么 description 和 title 要分开？description 不是给模型看的吗？**

对，description 给模型看（决定「何时调」），title 给前端看（决定「怎么展示」）。分开是因为两者受众不同：模型需要「触发条件」，前端需要「人类可读的名字」。如果混在一起，模型会读到一堆对决策没用的「展示性」文字，反而干扰判断。

**Q2：outputValidation 的 strict 和 warn 到底怎么选？**

看「副作用」：如果工具只是查数据（无副作用），校验失败用 strict（替换成错误对象，让模型知道错了）更安全；如果工具已经产生副作用（写了库、发了请求），用 warn（原样返回），否则 strict 会把真实结果丢掉。核心原则：**别让校验机制掩盖真实发生的事**。

**Q3：renderOnly 工具和普通工具的本质区别？**

普通工具：模型 → 工具执行 → 返回结果 → 模型继续。renderOnly：模型 → 发出「渲染请求」→ 立即返回 acknowledged → 模型继续（不等前端）。它把「渲染」从「执行」里解耦出来，让 agent 不因等前端渲染而卡住。

---

## 最佳实践

**✅ DO：**

- 每个工具独立成文件（tools/getOrder.ts），可复用、可单测。
- description 写清触发条件；inputSchema 每个字段都 describe。
- 加 outputSchema，享受类型推导 + 输出校验。
- 危险工具加 requireApproval。

**❌ DON'T：**

- 别用普通对象定义工具——必须 createTool()（否则静默失败）。
- 别把入参塞进 context——execute 第一个参数直接解构。
- 别把业务敏感逻辑（扣款）暴露成工具却不加鉴权/审批。

---

## 代码实战：一个完整的工单工具集

```typescript
// src/mastra/tools/order.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// 查询订单（无副作用，用默认 strict 校验）
export const getOrder = createTool({
  id: 'getOrder',
  title: '查询订单',
  description: '根据订单号查询订单状态与金额。用户询问订单进度、是否发货、金额时调用。',
  inputSchema: z.object({ orderId: z.string().describe('订单号，如 ORD-1001') }),
  outputSchema: z.object({ orderId: z.string(), status: z.string(), amount: z.number() }),
  execute: async ({ orderId }) => {
    return { orderId, status: '已发货', amount: 299 };
  },
});

// 申请退款（有副作用 + 需审批）
export const applyRefund = createTool({
  id: 'applyRefund',
  title: '申请退款',
  description: '为用户提交退款申请。用户明确要求退款时调用。',
  inputSchema: z.object({ orderId: z.string(), reason: z.string() }),
  outputSchema: z.object({ approved: z.boolean() }),
  requireApproval: true,
  execute: async ({ orderId, reason }) => {
    return { approved: true };
  },
});

// 展示订单卡片（纯展示，生成式 UI 用）
export const showOrderCard = createTool({
  id: 'showOrderCard',
  title: '展示订单卡片',
  description: '在界面上展示订单卡片。',
  inputSchema: z.object({ orderId: z.string() }),
  renderOnly: true,
});
```

---

## 实操练习（工单客服 Agent · 第 3 步）

**练习 1**：写一个 checkLogistics 工具，加 title 和 outputSchema。

**验收标准**：模型能正确调用；返回结果类型推导正确。

**练习 2**：故意让工具返回不符合 outputSchema 的结果，对比 outputValidation 的 strict 和 warn 两种表现。

**验收标准**：能说出两者区别（strict 替换结果 / warn 原样返回）。

**练习 3**：写一个 renderOnly 工具，在前端监听 tool-call 事件渲染组件。

**验收标准**：agent 调该工具时前端弹出组件，且 agent 不卡住。

---

## 本章小结

- createTool 八字段：id / description / inputSchema / execute（必填）+ title / outputSchema / strict / outputValidation / renderOnly / requireApproval（可选）。
- execute 签名是 execute(inputData, context)，入参直接解构，别塞进 context。
- outputValidation 控制「输出校验失败」时 strict（替换）还是 warn（原样返回）。
- renderOnly 做纯展示工具，requireApproval 做危险操作审批。

下一章进入编排核心：**Workflow**——then/parallel/分支/foreach、state、suspend/resume、快照、时间旅行、错误处理、定时、动态、嵌套，一次讲全。
