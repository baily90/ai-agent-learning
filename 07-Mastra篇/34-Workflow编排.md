# 第34章：Workflow 编排 — 把多步任务升级成声明式流程

## 引言

第 13 章你手写过 Multi-step Agent（任务分解 → 逐条执行 → 错误恢复），第 16 章你又用 LangGraph 把流程画成图。那段经历最痛苦的应该是两件事：**手动管理步骤间的数据传递**，和**手动处理「中途要等人」的场景**。

Mastra 的 Workflow 就是来解决这两件事的。它让你把多步任务写成**声明式的步骤序列**，框架自动管数据流转、自动管状态持久化、原生支持「暂停 → 等人 → 恢复」。

这一章把 Workflow 的完整能力一次讲全。

---

## 34.1 心智转变：从「写执行链」到「定义步骤」

AI SDK 里，多步任务是一段**你手写的串行代码**；Mastra 里，多步任务是一组**你声明的步骤（step）+ 编排关系**。

你第 13 章手写的那套，本质上是「async/await 版」的多步执行；Mastra 把它升级成了「声明式」——**你只描述「有哪些步骤、谁接谁」，不写「怎么传数据」**。

---

## 34.2 定义步骤：createStep()

```typescript
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const extractInfo = createStep({
  id: 'extract-info',                    // 唯一标识
  inputSchema: z.object({                // 这一步吃什么
    userMessage: z.string(),
  }),
  outputSchema: z.object({               // 这一步产出什么
    intent: z.enum(['退款', '物流', '咨询']),
    orderId: z.string(),
  }),
  execute: async ({ inputData }) => {    // 真正的逻辑
    const { userMessage } = inputData;
    return { intent: '退款', orderId: 'ORD-1001' };
  },
});
```

step 是「纯函数式」的——inputData 进，outputData 出。中间可以调 agent、调工具、调 API，但接口被 schema 死死框住。

step 除了 inputSchema/outputSchema，还有几个可选 schema（后面各节展开）：

| schema | 作用 | 章节 |
|---|---|---|
| inputSchema | 输入 | 34.3 |
| outputSchema | 输出 | 34.3 |
| stateSchema | 贯穿全程的共享状态 | 34.7 |
| resumeSchema | 恢复时传入的数据（人工审批） | 34.8 |
| suspendSchema | 暂停时传出的数据 | 34.8 |

---

## 34.3 组装工作流：createWorkflow()

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

### 核心铁律：schema 咬合

Mastra 的数据流是**强类型、靠 schema 咬合**的：

1. 第一个 step 的 inputSchema 必须匹配 workflow 的 inputSchema
2. 最后一个 step 的 outputSchema 必须匹配 workflow 的 outputSchema
3. 相邻步骤之间，上一步 outputSchema 必须匹配下一步 inputSchema

对不上就报错（或用 input data mapping 转换）。这就像拼乐高——每个 step 的「输入凹槽」和「输出凸点」要能对上。

### 启动一个 workflow

```typescript
const workflow = mastra.getWorkflow('ticketWorkflow');
const run = await workflow.createRun();
const result = await run.start({
  inputData: { userMessage: '我要退款' },
});
```

---

## 34.4 并行执行：.parallel()

多个互不依赖的步骤可以同时跑：

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

并行步骤的输出以 **step 的 id 为 key** 打包成一个对象，传给下一步：

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

> 并行步骤中任何一个抛错，整个并行块失败。要「部分容忍失败」，在 step 内部用 try/catch 兜底。

---

## 34.5 条件分支：.branch()

.branch() 跑「条件为 true」的步骤。注意：**所有条件都会评估，多个为 true 就都跑**（所以要做单一路径就写互斥条件）：

```typescript
const workflow = createWorkflow({
  id: 'route',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(step1)
  .branch([
    [async ({ inputData }) => inputData.value > 10, highValueStep],
    [async ({ inputData }) => inputData.value <= 10, lowValueStep],
  ])
  .commit();
```

每个条件是一个 `[条件函数, 步骤]` 元组。分支里所有 step 需要相同的 inputSchema/outputSchema。

> 呼应第 16 章 LangGraph 的「条件边」——只是这里用「条件函数 + 步骤」的声明式写法，而不是画图。

---

## 34.6 遍历：.foreach()

当需要对一批数据逐个处理时，用 .foreach()（比如「给 100 个用户各发一份报告」）：

- 遍历集合，每个元素跑一遍后续步骤
- 配合 suspend/resume 时，用 `forEachIndex` 定位具体某一轮的挂起

（具体签名见官方 [Control Flow](https://mastra.ai/docs/workflows/control-flow) 文档，核心心智是「把一批活拆成逐个执行」。）

---

## 34.7 跨步骤共享：Workflow State

要在步骤间共享「进度/计数器/配置」这类数据，又不想塞进每一步的 input/output，用 **workflow state**：

```typescript
const step1 = createStep({
  id: 'step-1',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
  stateSchema: z.object({ counter: z.number() }),   // 声明 state 结构
  execute: async ({ inputData, state, setState }) => {
    console.log(state.counter);                     // 读
    await setState({ counter: state.counter + 1 }); // 写（后续步骤都能看到）
    return { formatted: inputData.message.toUpperCase() };
  },
});
```

state 相当于「贯穿整个 workflow 的全局变量」，但它是**带类型、可持久化**的（suspend/resume 时也会保存）。

---

## 34.8 人工介入：suspend / resume

这是 Workflow 最值钱的能力——第 16 章 LangGraph 里费劲实现的 human-in-the-loop，Mastra 用 suspend()/resume() 原生支持。

### 暂停：suspend()

```typescript
const approvalStep = createStep({
  id: 'refund-approval',
  inputSchema: z.object({ orderId: z.string(), amount: z.number() }),
  outputSchema: z.object({ decision: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),        // 恢复时要传的数据
  suspendSchema: z.object({ reason: z.string() }),          // 暂停时传出的数据（要类型化）
  execute: async ({ inputData, resumeData, suspend }) => {
    const { approved } = resumeData ?? {};
    if (approved === undefined) {
      // 第一次执行：还没人审批，暂停
      return await suspend({ reason: '金额超 500，需人工审批' });
    }
    return { decision: approved ? '退款成功' : '退款驳回' };
  },
});
```

核心逻辑：**execute 会跑两次**。第一次 resumeData 为空 → 走 suspend() 暂停；恢复后 resumeData 有值 → 走后续逻辑。

### 恢复：resume()

```typescript
const run = await workflow.createRun();
const result = await run.start({ inputData: { orderId: 'ORD-001', amount: 800 } });

if (result.status === 'suspended') {
  // ...把审批请求发给人工，拿到人点「通过」后：
  const final = await run.resume({ step: 'refund-approval', resumeData: { approved: true } });
  console.log(final.result);   // 成功结果读 result，不是 output
}
```

### 关键机制：snapshot（快照）

suspend() 会把整个 workflow 执行状态存成 snapshot，持久化到 storage。这意味着：**应用重启不丢状态**、**跨部署恢复**、**可在 Studio 里查看每一步状态**。

恢复时想读「当初暂停时传出的数据」，用 execute 的 `suspendData` 参数（不是 suspendPayload）：

```typescript
execute: async ({ inputData, resumeData, suspend, suspendData }) => {
  if (!resumeData?.approved) {
    return await suspend({ reason: '需审批' });
  }
  const reason = suspendData?.reason;   // 恢复时拿到当初暂停的理由
  return { decision: '通过' };
},
```

---

## 34.9 时间旅行：timeTravel()

从任意步骤重新执行，调试/恢复不用从头跑：

```typescript
const run = await workflow.createRun();
const result = await run.timeTravel({
  step: 'step-2',                          // 从这一步开始重跑
  inputData: { previousStepResult: '...' },  // 自定义这一步的输入
});
```

依赖 storage（读取持久化快照）。适合「某个 step 挂了，只重跑它和之后的步骤」。

---

## 34.10 错误处理

### 检查结果状态

```typescript
const result = await run.start({ inputData: {...} });

switch (result.status) {
  case 'success':   console.log(result.result); break;   // 成功，读 result
  case 'failed':    console.error(result.error); break;  // 失败
  case 'suspended': console.log('等待恢复'); break;      // 挂起
}
```

status 可能的值：success / failed / suspended / paused / tripwire。

### 定位失败的步骤

```typescript
if (result.status === 'failed') {
  for (const [stepId, stepResult] of Object.entries(result.steps)) {
    if (stepResult.status === 'failed') {
      console.error(`步骤 ${stepId} 失败:`, stepResult.error);
    }
  }
}
```

### 生命周期回调 onFinish

不 await 结果、后台跑完要做的事（日志/告警）用 onFinish：

```typescript
const run = await workflow.createRun();
await run.start({ inputData: {...} });
run.onFinish((result) => {
  console.log('工作流结束:', result.status);
});
```

> onFinish 会被 await 但不持久、不重试。要可靠完成的工作，放进 step 里。

---

## 34.11 定时执行：schedule

工作流可以声明 cron 定时触发：

```typescript
export const dailyReport = createWorkflow({
  id: 'daily-report',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  schedule: {
    cron: '0 9 * * *',                // 每天 9 点
    timezone: 'America/New_York',
    inputData: { userId: 'system' },  // 定时触发时的输入
  },
})
  .then(sendReport)
  .commit();
```

同一个 workflow 既定时跑、也能手动 `workflow.start()`。

---

## 34.12 动态工作流（Dynamic，Beta）

工作流定义用 JSON（而不是代码）表达，让「可视化编辑器 / LLM / 外部系统」在**不部署代码**的情况下创建工作流。

> Beta 状态，API 可能变。入门了解即可，常规用 createWorkflow() 就够。

---

## 34.13 嵌套工作流

一个 workflow 可以作为一个 step 被另一个 workflow 复用：

```typescript
const childWorkflow = createWorkflow({ id: 'child', ... }).then(step1).commit();
const parentWorkflow = createWorkflow({ id: 'parent', ... })
  .then(childWorkflow)   // 整个子 workflow 当一个 step 用
  .commit();
```

---

## 34.14 把 agent / tool 包装成 step

Workflow 里要调 agent（LLM 推理）或 tool（类型安全逻辑），有两种方式：**包装成 step**，或**在 execute() 里调用**。它们各有优缺点。

### 方式一：包装成 step

**Agent 作为 step**（默认契约：输入 prompt，输出 text）：

```typescript
import { createStep } from '@mastra/core/workflows';
import { testAgent } from '../agents/test-agent';

const agentStep = createStep(testAgent);   // 直接把 agent 包装成 step

export const wf = createWorkflow({})
  .map(async ({ inputData }) => ({
    prompt: `把这段转成要点：${inputData.message}`,   // agent 默认输入是 prompt
  }))
  .then(agentStep)
  .commit();
```

agent step 的默认 schema 是 `{ inputSchema: { prompt: string }, outputSchema: { text: string } }`，用 `.map()` 把上一步输出转成 prompt。

需要结构化输出时，传第二个参数：

```typescript
const articleSchema = z.object({ title: z.string(), summary: z.string() });
const agentStep = createStep(testAgent, { structuredOutput: { schema: articleSchema } });
```

还有更简洁的 `.agent()` 简写（声明式，可持久化为动态 workflow）：

```typescript
export const wf = createWorkflow({})
  .map(async ({ inputData }) => ({ prompt: `...` }))
  .agent(testAgent, { structuredOutput: { schema: articleSchema } })
  .commit();
```

**Tool 作为 step**：

```typescript
import { createStep } from '@mastra/core/workflows';
import { testTool } from '../tools/test-tool';

const toolStep = createStep(testTool);   // 工具直接当 step

export const wf = createWorkflow({})
  .then(step1)
  .map(async ({ inputData }) => ({ text: inputData.formatted }))  // 转成工具的输入
  .then(toolStep)
  .commit();
```

也有 `.tool()` 简写：`.tool(testTool)`。

### 方式二：在 execute() 里调用

```typescript
const step1 = createStep({
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('testAgent');
    const response = await agent.generate(`...${inputData.message}`, {
      memory: { thread: 'user-123', resource: 'test-123' },   // 可以传 memory 等完整选项
    });
    return { list: response.text };
  },
});
```

工具同理：`testTool.execute?.({ text }, { requestContext })`。

### 两种方式的优缺点

| 维度 | 包装成 step（createStep / .agent() / .tool()） | 在 execute() 里调用 |
|---|---|---|
| 简洁度 | ✅ 声明式、一行 | ❌ 要写调用代码 |
| 可控性 | ❌ 按默认契约，难改调用方式 | ✅ 完全控制（传 memory、处理响应、分支） |
| schema 咬合 | ✅ 自动（agent 默认 prompt→text） | 手动写 input/output |
| 动态 workflow | ✅ .agent()/.tool() 可持久化 | ❌ 有闭包，不可序列化 |
| 适用 | 「不改调用方式」的标准用法 | 「要精细控制」的场景 |

一句话：**默认就用包装成 step（简洁、可持久化）；需要传 memory、处理中间结果、做分支时，才退回 execute() 里手动调**。

---

## 概念辨析：手写 vs LangGraph vs Mastra Workflow

| 维度 | AI SDK 手写多步 | LangGraph | Mastra Workflow |
|---|---|---|---|
| 表达方式 | 串行代码 | 图（节点+边） | 声明式步骤链 |
| 数据流 | 手动传参 | State 对象 | schema 咬合自动流 |
| 分支 | if/else | 条件边 | .branch() |
| 并行 | Promise.all | 图并行 | .parallel() |
| 人工介入 | 手动实现 | interrupt() | suspend/resume |
| 持久化 | 自己搞 | checkpoint | snapshot |
| 时间旅行 | 无 | 有 | 有（timeTravel） |
| 学习曲线 | 低（但累） | 陡 | 平缓 |

一句话：**Mastra Workflow 是「LangGraph 的图编排」和「AI SDK 的简单」之间的甜点区**。

---

## 灵魂拷问

**Q1：为什么相邻 step 的 schema 必须咬合？这限制是不是太死了？**

这是「声明式编排」的代价和保障。schema 咬合带来三个好处：**编译期发现数据流错误**、**每个 step 可独立测试**、**支持持久化**（结构化数据才能存快照）。对不上就用 input data mapping 显式转换，不是死路。

**Q2：suspend 后，execute 是怎么「两次进入」同一个 step 的？**

因为 snapshot 记录了「这个 step 执行到一半」的完整状态。恢复时，框架**重新执行这个 step 的 execute**，但这次 resumeData 有值。所以 execute 要写成「幂等 + 用 resumeData 判断分支」。

**Q3：workflow 和 agent 到底怎么分工？**

**agent 处理「开放、要判断」的事，workflow 控制「确定、有顺序」的事**。工单场景就是混合——「理解用户意图」交给 agent（开放），「意图 → 查单 → 审批 → 回复」交给 workflow（确定）。agent 可以作为一个 step 被 workflow 调用，两者是「组合」不是「二选一」。

**Q4：.branch() 和 .parallel() 有什么区别？**

parallel 是「所有步骤都跑，并行执行」；branch 是「只有条件为 true 的步骤才跑」。而且 branch 里多个条件可能同时为 true（都跑），所以单路径要写互斥条件。

---

## 最佳实践

**✅ DO：**

- 每个 step 只做一件事，名字动词开头。
- 用 stateSchema 存「贯穿全程」的进度/计数；用 inputSchema/outputSchema 传「步骤间」的数据。
- 高风险操作（退款、发券、发邮件）前加 suspend 审批。
- 并行/分支里自己 try/catch，做部分容错。
- 失败后优先用 timeTravel 重跑，而不是从头再来。

**❌ DON'T：**

- 别在 execute 里写「依赖外部全局变量」的逻辑——step 要可独立测试、可重放。
- 别忽略 schema 咬合规则，靠「字段名猜」——用映射显式转换。
- 别把顺序固定的流程塞进 agent——那是 workflow 的活。

---

## 代码实战：一个带审批的退款工单

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const extractIntent = createStep({
  id: 'extract-intent',
  inputSchema: z.object({ userMessage: z.string() }),
  outputSchema: z.object({ intent: z.enum(['退款', '其他']), orderId: z.string(), amount: z.number() }),
  execute: async ({ inputData }) => {
    return { intent: '退款', orderId: 'ORD-001', amount: 800 };
  },
});

const refundApproval = createStep({
  id: 'refund-approval',
  inputSchema: z.object({ intent: z.enum(['退款', '其他']), orderId: z.string(), amount: z.number() }),
  outputSchema: z.object({ decision: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ reason: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (inputData.intent !== '退款') return { decision: '无需退款' };
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
  const final = await run.resume({ step: 'refund-approval', resumeData: { approved: true } });
  console.log(final.result);   // 读 result，不是 output
}
```

---

## 实操练习（工单客服 Agent · 第 4 步）

**练习 1**：把「意图识别 → 查询订单 → 生成回复」做成三步 workflow，用 schema 咬合串起来。

**验收标准**：run.start() 一次跑完全程，数据自动流转。

**练习 2**：在「退款」分支加 suspend 审批，金额 > 500 时暂停。

**验收标准**：status === 'suspended'，resume({ approved: true }) 后拿到 result。

**练习 3**：把「查订单」和「查物流」改成 .parallel()，再合并。

**验收标准**：下一步通过 step id 正确取到两个并行结果。

**练习 4（进阶）**：用一个 .branch() 让「退款」和「咨询」走不同分支。

**验收标准**：不同输入走不同分支，互斥条件只跑一条。

---

## 本章小结

- Workflow 用 createStep + createWorkflow + then/parallel/branch/foreach + commit 声明式编排。
- 数据流靠 schema 咬合（上一步 output 匹配下一步 input），编译期防错。
- 跨步骤共享用 stateSchema（state/setState），步骤间传参用 input/output。
- suspend/resume 原生支持人工介入，底层靠 snapshot 持久化，恢复时读 suspendData。
- 错误处理看 result.status / result.result / result.error / result.steps；onFinish 做收尾。
- 时间旅行 timeTravel 从任意步骤重跑；schedule 定时触发；workflow 可嵌套。

下一章进入记忆体系：**Memory**——lastMessages/messageHistory/workingMemory/observationalMemory/semanticRecall 全类型 + 配置 + 场景。
