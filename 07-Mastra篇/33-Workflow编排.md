# 第33章：Workflow 编排 — 把多步任务升级成声明式流程

## 引言

第 13 章你手写过 Multi-step Agent（任务分解 → 逐条执行 → 错误恢复），第 16 章你又用 LangGraph 把流程画成图。那段经历你现在回想起来，最痛苦的应该是两件事：**手动管理步骤间的数据传递**，和**手动处理「中途要等人」的场景**。

Mastra 的 Workflow 就是来解决这两件事的。它让你把多步任务写成**声明式的步骤序列**，框架自动管数据流转、自动管状态持久化、原生支持「暂停 → 等人 → 恢复」。

这一章是 Mastra 的重头戏，我们重点讲透。

---

## 33.1 心智转变：从「写执行链」到「定义步骤」

### 一句话直觉

AI SDK 里，多步任务是一段**你手写的串行代码**；Mastra 里，多步任务是一组**你声明的步骤（step）+ 编排关系**。

### 前端类比

这就像从「回调地狱」到「async/await」，再到「声明式流程引擎」：

- 回调地狱：手动管理每一步的依赖和顺序
- async/await：顺序清晰了，但数据传递还要手动 `const a = await step1(); const b = await step2(a)`
- Mastra Workflow：声明 `.then(step1).then(step2)`，框架自动把 step1 的输出喂给 step2 的输入

你第 13 章手写的那套，本质上就是「async/await 版」的多步执行；Mastra 把它升级成了「声明式」——**你只描述「有哪些步骤、谁接谁」，不写「怎么传数据」**。

### 核心原则（先记住这条铁律）

Mastra Workflow 的数据流是**强类型、靠 schema 咬合**的：

1. 第一个 step 的 `inputSchema` 必须匹配 workflow 的 `inputSchema`
2. 最后一个 step 的 `outputSchema` 必须匹配 workflow 的 `outputSchema`
3. 相邻步骤之间，上一步的 `outputSchema` 必须匹配下一步的 `inputSchema`

这就像拼乐高——每个 step 的「输入凹槽」和「输出凸点」要能对上。对不上就报错（或用映射转换，见 33.5）。

---

## 33.2 定义步骤：createStep()

```typescript
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const extractInfo = createStep({
  id: 'extract-info',                    // 唯一标识
  inputSchema: z.object({                 // 这一步吃什么
    userMessage: z.string(),
  }),
  outputSchema: z.object({                // 这一步产出什么
    intent: z.enum(['退款', '物流', '咨询']),
    orderId: z.string().nullable(),
  }),
  execute: async ({ inputData }) => {     // 真正的逻辑
    const { userMessage } = inputData;
    // 这里可以调 agent、调工具、调外部 API
    return { intent: '退款', orderId: 'ORD-2024-001' };
  },
});
```

关键点：**step 是「纯函数式」的**——`inputData` 进，`outputData` 出，中间可以干任何事（调 agent、调工具、调 API），但接口被 schema 死死框住。

---

## 33.3 组装工作流：createWorkflow()

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

export const ticketWorkflow = createWorkflow({
  id: 'ticket-workflow',
  inputSchema: z.object({ userMessage: z.string() }),
  outputSchema: z.object({ reply: z.string() }),
})
  .then(extractInfo)     // 步骤 1
  .then(handleRefund)    // 步骤 2
  .commit();             // 完成组装
```

`.then()` 串起步骤，`.commit()` 收尾。数据从第一个 step 自动流到最后一个。

### 启动一个 workflow

```typescript
const workflow = mastra.getWorkflow('ticketWorkflow');
const run = await workflow.createRun();
const result = await run.start({
  inputData: { userMessage: '我要退款，订单号 ORD-2024-001' },
});
```

`run.start()` 会从头执行所有步骤，返回最终 `outputSchema` 里的结果。

---

## 33.4 并行执行：.parallel()

多个互不依赖的步骤可以同时跑。比如「查订单」和「查物流」没依赖，就并行：

```typescript
const workflow = createWorkflow({
  id: 'order-check',
  inputSchema: z.object({ orderId: z.string() }),
  outputSchema: z.object({ report: z.string() }),
})
  .parallel([checkOrderStatus, checkLogistics])   // 同时跑
  .then(mergeReport)                               // 合并结果
  .commit();
```

并行步骤的输出会以 **step 的 id 为 key** 打包成一个对象，传给下一步：

```typescript
const mergeReport = createStep({
  id: 'merge-report',
  inputSchema: z.object({
    'check-order-status': z.object({ status: z.string() }),
    'check-logistics': z.object({ logistics: z.string() }),
  }),
  outputSchema: z.object({ report: z.string() }),
  execute: async ({ inputData }) => {
    const { status } = inputData['check-order-status'];
    const { logistics } = inputData['check-logistics'];
    return { report: `订单状态：${status}，物流：${logistics}` };
  },
});
```

> 提示：并行步骤中任何一个抛错，整个并行块失败。要「部分容忍失败」，就在 step 内部用 try/catch 兜底（这和第 19 章的容错思路一脉相承）。

---

## 33.5 跨步骤共享数据：Workflow State

有时候你要在步骤间共享「进度」「计数器」「配置」这类数据，又不想让它们塞进每一步的 inputSchema/outputSchema。这时用 **workflow state**：

```typescript
const step1 = createStep({
  id: 'step-1',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
  stateSchema: z.object({ counter: z.number() }),   // 声明 state 结构
  execute: async ({ inputData, state, setState }) => {
    console.log(state.counter);                     // 读
    await setState({ counter: state.counter + 1 }); // 写（给后续步骤用）
    return { formatted: inputData.message.toUpperCase() };
  },
});
```

state 相当于「贯穿整个 workflow 的全局变量」，但它是**带类型、可持久化**的。

---

## 33.6 人工介入：suspend / resume（企业级核心）

这是 Workflow 最值钱的能力，也是你在第 16 章 LangGraph 里费劲实现过的「human-in-the-loop」——Mastra 用 `suspend()` / `resume()` 原生支持。

### 场景

工单客服里，「退款金额超过 500 元」必须人工审批，不能 agent 自动退。这就是 suspend 的典型用例。

### 暂停：suspend()

```typescript
const approvalStep = createStep({
  id: 'refund-approval',
  inputSchema: z.object({ orderId: z.string(), amount: z.number() }),
  outputSchema: z.object({ decision: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),   // 恢复时要传的数据
  execute: async ({ inputData, resumeData, suspend }) => {
    const { amount } = inputData;
    const { approved } = resumeData ?? {};             // 恢复时才有值

    if (approved === undefined) {
      // 第一次执行：还没人审批，暂停
      return await suspend({
        reason: '金额超 500 元，需人工审批',
        amount,
      });
    }

    // 恢复后：approved 有值了，继续
    return { decision: approved ? '已退款' : '已驳回' };
  },
});
```

核心逻辑：**execute 会跑两次**。第一次 `resumeData` 为空 → 走 `suspend()` 暂停；恢复后 `resumeData` 有值 → 走后面的逻辑。

### 恢复：resume()

```typescript
const run = await workflow.createRun();
const result = await run.start({ inputData: { orderId: 'ORD-001', amount: 800 } });

if (result.status === 'suspended') {
  // ...把审批请求发给人工，拿到人点「通过」后：
  await run.resume({
    step: 'refund-approval',          // 或直接传 step 对象
    resumeData: { approved: true },   // 人工的决策
  });
}
```

**`resume()` 可以从任何地方调用**——HTTP 接口、定时器、消息事件。这正是企业审批流的实现方式。

### 关键机制：snapshot（快照）

`suspend()` 会把当前整个 workflow 的执行状态（每步的输入输出、state、跑到哪了）存成一个 **snapshot**，持久化到存储里。这意味着：

- **应用重启不丢状态**：恢复时从快照精确还原，接着跑。
- **跨部署恢复**：快照存在配置的存储 provider 里，换台机器也能续。
- 你可以在 Studio 里看到每一步的状态，甚至**时间旅行**——回放/重试单个步骤。

> 这和第 16 章 LangGraph 的 checkpoint 是同一个思路，只是 Mastra 把它做成了「step 级别、声明式」的体验。

---

## 33.7 定时执行：Scheduled Workflow

有些工作流要定时跑（比如每天汇总未处理工单）。Mastra 支持给 workflow 配置 schedule，到点自动触发——不需要你另写 cron。

（具体 cron 表达式和配置项见官方文档 [Scheduled Workflows](https://mastra.ai/docs/workflows/scheduled-workflows)，核心心智是「把定时任务也声明成 workflow 的属性」）。

---

## 概念辨析：AI SDK 手写 vs LangGraph vs Mastra Workflow

| 维度 | AI SDK 手写多步 | LangGraph | Mastra Workflow |
|---|---|---|---|
| 表达方式 | 串行代码 | 图（节点+边） | 声明式步骤链 |
| 数据流 | 手动传参 | State 对象 | schema 咬合自动流 |
| 人工介入 | 手动实现 | interrupt() | suspend/resume |
| 持久化 | 自己搞 | checkpoint | snapshot |
| 时间旅行 | 无 | 有（回退重放） | 有（回放单个 step） |
| 学习曲线 | 低（但累） | 陡 | 平缓 |

一句话：**Mastra Workflow 是「LangGraph 的图编排」和「AI SDK 的简单」之间的甜点区**——比裸写省心，比画图好懂，还保留了最常用的持久化和人工介入。

---

## 灵魂拷问

**Q1：为什么相邻 step 的 schema 必须咬合？这限制是不是太死了？**

这是「声明式编排」的代价和保障。schema 咬合带来三个好处：**编译期就能发现数据流错误**（不用跑到一半才发现字段名写错）、**每个 step 可独立测试**（输入输出明确）、**支持持久化**（结构化数据才能存快照）。如果实在对不上，框架提供了 **input data mapping** 做字段转换——不是死路，而是「显式声明转换」。

**Q2：suspend 后，execute 是怎么「两次进入」同一个 step 的？**

因为 snapshot 记录了「这个 step 执行到一半」的完整状态。恢复时，框架**重新执行这个 step 的 execute 函数**，但这次 `resumeData` 里有了人工传进来的数据。所以你的 execute 要写成「**幂等 + 用 resumeData 判断分支**」——第一次走 suspend，第二次走后续逻辑。这也是为什么 execute 要尽量纯。

**Q3：workflow 和 agent 到底怎么分工？什么时候用哪个？**

记住一句话：**agent 处理「开放、要判断」的事，workflow 控制「确定、有顺序」的事**。工单场景就是典型混合——「理解用户意图」交给 agent（开放），「意图 → 查单 → 审批 → 回复」这个流程交给 workflow（确定）。Mastra 里 agent 可以作为一个 step 被 workflow 调用（下一步章会讲），两者是「组合」不是「二选一」。

---

## 最佳实践

**✅ DO：**

- 每个 step 只做**一件事**，名字动词开头（`extract-info`、`check-logistics`）。
- 用 `stateSchema`（`state`/`setState`）存「贯穿全程」的进度/计数；用 `inputSchema`/`outputSchema`（`inputData`）传「步骤间」的数据。
- 高风险操作（退款、发券、发邮件）前加 suspend 审批。
- 并行步骤里自己 try/catch，做部分容错。

**❌ DON'T：**

- 别在 execute 里写「依赖外部全局变量」的逻辑——step 要可独立测试、可重放。
- 别把整个业务塞进一个巨型 step——拆细，每个 step 职责单一。
- 别忽略 schema 咬合规则，靠「字段名猜」——用映射显式转换。

---

## 代码实战：一个带审批的退款工单流程

```typescript
// src/mastra/workflows/refund.ts
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const extractIntent = createStep({
  id: 'extract-intent',
  inputSchema: z.object({ userMessage: z.string() }),
  outputSchema: z.object({
    intent: z.enum(['退款', '其他']),
    orderId: z.string(),
    amount: z.number(),
  }),
  execute: async ({ inputData }) => {
    // 简化演示：真实项目这里调 agent 解析
    return { intent: '退款', orderId: 'ORD-001', amount: 800 };
  },
});

const refundApproval = createStep({
  id: 'refund-approval',
  inputSchema: z.object({ orderId: z.string(), amount: z.number() }),
  outputSchema: z.object({ decision: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { approved } = resumeData ?? {};
    if (approved === undefined) {
      return await suspend({ reason: '退款金额超 500，需人工审批' });
    }
    return { decision: approved ? '退款成功' : '退款驳回' };
  },
});

export const refundWorkflow = createWorkflow({
  id: 'refund-workflow',
  inputSchema: z.object({ userMessage: z.string() }),
  outputSchema: z.object({ decision: z.string() }),
})
  .then(extractIntent)
  .then(refundApproval)
  .commit();
```

启动与恢复：

```typescript
const wf = mastra.getWorkflow('refundWorkflow');
const run = await wf.createRun();
const result = await run.start({ inputData: { userMessage: '我要退款 ORD-001' } });

if (result.status === 'suspended') {
  console.log('等待人工审批…');
  // 人工点了「通过」后：
  const final = await run.resume({ step: 'refund-approval', resumeData: { approved: true } });
  console.log(final.output);
}
```

---

## 实操练习（工单客服 Agent · 第 3 步）

**练习 1**：把「意图识别 → 查询订单 → 生成回复」做成一个三步 workflow，用 schema 咬合串起来。

**验收标准**：`run.start()` 一次跑完全程，中间数据自动流转，无需手动传参。

**练习 2**：在「退款」分支加一个 suspend 审批步骤，金额 > 500 时暂停。

**验收标准**：`run.start()` 返回 `status: 'suspended'`，`run.resume({ approved: true })` 后拿到最终结果。

**练习 3（进阶）**：把「查订单」和「查物流」改成 `.parallel()` 并行，再合并。

**验收标准**：下一步通过 step id 正确取到两个并行结果。

---

## 本章小结

- Workflow 把多步任务写成**声明式步骤链**（`createStep` + `createWorkflow` + `.then()/.parallel()` + `.commit()`）。
- 数据流靠 **schema 咬合**：上一步 output 匹配下一步 input，编译期防错。
- 跨步骤共享用 **workflow state**（`state`/setState），步骤间传参用 input/output。
- **suspend/resume** 原生支持人工介入，底层靠 snapshot 持久化——重启不丢、可时间旅行。
- agent 处理「开放判断」，workflow 控制「确定流程」，两者组合使用。

下一章我们给工单客服装上「记忆」：**记忆与 RAG**——把第 9、10 章手写的检索管道，变成 Mastra 的内置能力。
