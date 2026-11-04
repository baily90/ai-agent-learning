# 第27章：LangGraph 与 LangChain — 框架的生产真相

## 引言

你可能听过一个说法："做 agent 要用 LangChain"。但如果你真去翻 LangChain 的文档，会越看越懵——Chain、Agent、Tool、Graph、Memory……概念一大堆，还时不时冒出个 LangGraph，俩到底什么关系？哪个才是"正主"？

这一章，我们把 LangChain / LangGraph 彻底讲清楚，包括一个很多人不敢说的真相：**框架不是必须的，很多生产项目根本不用它**。

> **🏭 实际项目怎么做**：LangGraph / LangChain 在生产里 **90%+ 是 Python**——官方文档、社区示例、插件生态几乎全在 Python 侧，LangGraph.js（TS 版）API 对齐但生态薄、成熟度低。作为前端，你只需"了解 + 跑通"，不必深钻。更重要的真相是：**相当一部分严肃生产项目，最后发现"直接拿 SDK 写 loop"比用框架更可控**。所以本章的目标不是让你成为 LangGraph 专家，而是让你看懂它背后的**编排思想**——这个思想用 AI SDK 一样能实现。

---

## 27.1 LangChain 是什么：它到底解决了什么

### 一句话直觉

LangChain 是一个"AI 组件超市"——它把和 LLM 打交道的各种活（Prompt 模板、工具、记忆、检索、链）都做成了可拼装的积木。

### 详细原理

LangChain 最核心的抽象是 **Chain（链）**：把多个步骤串成一条流水线。

```
prompt 模板 → LLM → 输出解析
     └─────── Chain ───────┘
```

它的价值在于**组件丰富**：几百种工具集成、几十种文档加载器、各种记忆/检索模块，开箱即用。

```typescript
// LangChain.js 的经典"链"写法（了解即可）
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatDeepSeek } from "@langchain/deepseek";
import { StringOutputParser } from "@langchain/core/output_parsers";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是{role}，请用{language}回答"],
  ["user", "{input}"],
]);
const model = new ChatDeepSeek({ model: "deepseek-chat" });
const chain = prompt.pipe(model).pipe(new StringOutputParser());

const result = await chain.invoke({ role: "客服", language: "中文", input: "退款流程？" });
```

### 深层追问

**那 LangChain 和 Vercel AI SDK 有什么区别？**

两者都是"AI 开发工具"，但定位不同：

| | LangChain | Vercel AI SDK |
|---|---|---|
| 抽象层次 | 高（Chain/Agent/Graph 编排） | 低（直接的方法调用） |
| 组件生态 | 极丰富 | 精简 |
| 类型安全 | 一般 | 极好 |
| 前端集成 | 弱 | 原生（useChat 等） |
| 学习曲线 | 陡 | 平缓 |

一句话：**LangChain 重"编排 + 生态"，AI SDK 重"轻量 + 好用"。** 对你（前端）来说，AI SDK 是更好的默认选择。

---

## 27.2 LangChain 的局限：为什么"链"成了伪需求

### 一句话直觉

Chain 是"把固定步骤串起来"，但真正的 agent 是"**动态决定下一步**"——固定链条解决不了这个问题。

### 详细原理

早期的 LangChain 主打 Chain（链），但它有个根本矛盾：**链是确定性的流水线，agent 是动态的循环**。

真正的 agent 是这样的：

```
while (没完成 && 没到上限) {
  让模型决定：调哪个工具？传什么参数？
  执行工具 → 结果回喂给模型
}
```

这是一个**循环 + 动态决策**，不是一条写死的链。硬用 Chain 表达，代码又绕又别扭。于是社区慢慢转向了：

1. **LangGraph**：官方出的"图编排"框架，专门解决循环/状态/分支问题
2. **或者干脆不用框架**：直接拿 SDK 写 `while` 循环（就是第 11 章你在做的事）

### 前端类比

Chain 就像"写死的一串 `await` 调用"；agent 循环就像"一个 `while` 里根据状态决定下一步"。前者适合固定流程，后者才能应对开放任务。

---

## 27.3 LangGraph：把 Agent 画成一张图

### 一句话直觉

LangGraph 的核心思想就一句话：**把你的 agent 流程画成一张有向图**——节点（Node）是"一步"，边（Edge）是"流转关系"。

### 详细原理

LangGraph 有三个核心概念：

1. **State（状态）**：节点之间流转的共享数据（一个对象）
2. **Node（节点）**：一个处理步骤（可以是确定性代码，也可以是 LLM 调用）
3. **Edge（边）**：从哪个节点流向哪个节点（固定边 or 条件边）

```typescript
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

// ① 定义状态
const State = Annotation.Root({
  userInput: Annotation<string>,
  classification: Annotation<string>,
  answer: Annotation<string>,
});

// ② 节点 1：确定性分类（纯代码，不调 LLM，可预测可审计）
async function classifyNode(state: typeof State.State) {
  const isComplaint = /退款|退货|投诉|坏|质量问题/.test(state.userInput);
  return { classification: isComplaint ? "投诉" : "普通咨询" };
}

// ③ 节点 2/3：不同分支的 LLM 回答
async function preSaleNode(state: typeof State.State) {
  const { text } = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是售前客服",
    prompt: state.userInput,
  });
  return { answer: text };
}

async function afterSaleNode(state: typeof State.State) {
  const { text } = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是售后客服",
    prompt: state.userInput,
  });
  return { answer: text };
}

// ④ 条件路由：根据分类走不同分支
const route = (state: typeof State.State) =>
  state.classification === "投诉" ? "afterSale" : "preSale";

// ⑤ 组装图
const graph = new StateGraph(State)
  .addNode("classify", classifyNode)
  .addNode("preSale", preSaleNode)
  .addNode("afterSale", afterSaleNode)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", route, { preSale: "preSale", afterSale: "afterSale" })
  .addEdge("preSale", END)
  .addEdge("afterSale", END)
  .compile();

const result = await graph.invoke({ userInput: "我买的商品坏了，要退款" });
console.log(result.answer);
```

### 前端类比

LangGraph 的"图"就像前端的**路由表**：节点是页面组件，边是路由跳转，条件边是"根据状态决定跳哪个页面"。`START`/`END` 就是首页和兜底页。

---

## 27.4 循环：图真正的威力所在

### 一句话直觉

图的威力不在"顺序执行"，而在"**能循环**"——条件边指回上游节点，就是循环。

### 详细原理

第 13 章讲过 Multi-step Agent，LangGraph 用图优雅地表达了它：

```
START → research → reflect ─┬─ 资料不够 → 回到 research（循环）
                             └─ 资料够 → reply → END
```

```typescript
const MAX_ROUNDS = 3;
const route = (state: typeof State.State) =>
  state.sufficient || state.rounds >= MAX_ROUNDS ? "reply" : "research";

const graph = new StateGraph(State)
  .addNode("research", researchNode)
  .addNode("reflect", reflectNode)
  .addNode("reply", replyNode)
  .addEdge(START, "research")
  .addEdge("research", "reflect")
  .addConditionalEdges("reflect", route, { reply: "reply", research: "research" })
  .addEdge("reply", END)
  .compile();
```

**循环的两个铁律**：

1. **必须有退出条件**：`state.rounds >= MAX_ROUNDS` 就是兜底退出，否则死循环
2. **状态要在循环中累积**：每轮 `research` 把新资料追加到 `state.notes`，否则循环无意义

> **完整可运行代码**在 `labs/14-langgraph`，里面有三个经典循环模式（多步 agent、循环重试、多 agent 协作），配套第 16 章。

---

## 27.5 Checkpoint 与 Human-in-the-Loop

### 一句话直觉

LangGraph 内置了两样生产级能力：**断点续跑**（Checkpoint）和**人工介入**（interrupt）——这是它区别于"手写 while 循环"的核心价值。

### 详细原理

**Checkpoint（断点续跑）**：每一步之后保存状态，可以暂停、恢复、回溯。

```typescript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const graph = new StateGraph(State)
  // ...节点和边
  .compile({ checkpointer });

const config = { configurable: { thread_id: "user-123" } };
await graph.invoke({ userInput: "..." }, config);   // 带 thread_id，状态按线程保存
```

**Human-in-the-Loop（人工介入）**：在某个节点暂停，等人工批准再继续——这就是"退款申请需人工审核"的实现方式。

```typescript
import { interrupt, Command, isInterrupted, INTERRUPT } from "@langchain/langgraph";

async function auditNode(state: typeof State.State) {
  const decision = interrupt("请人工审核：是否批准退款？");  // 暂停，等 resume
  return { approval: decision };
}

const result = await graph.invoke({ userInput: "我要退款" }, config);
if (isInterrupted(result)) {
  console.log("⏸️ 已暂停，等待审核：", result[INTERRUPT][0].value);
  // 拿到人工决定后 resume
  const final = await graph.invoke(new Command({ resume: "批准" }), config);
  console.log(final.answer);
}
```

### 前端类比

Checkpoint 就像游戏存档——死了能从存档点重来；interrupt 就像表单的确认弹窗——用户点了"确认"才继续提交。

---

## 27.6 什么时候别用框架：直接写 loop

### 一句话直觉

LangGraph 的价值（checkpoint、interrupt、可视化）在**复杂编排**时才有意义。如果你的 agent 就是"调工具 + 循环"，直接拿 AI SDK 写 `while` 更简单可控。

### 详细原理

回顾第 11 章——你已经用 AI SDK 的 `stopWhen` 写出了 agent 循环，代码比 LangGraph 短得多：

```typescript
import { generateText, isStepCount, tool } from 'ai';

const result = await generateText({
  model: deepseek('deepseek-chat'),
  prompt: question,
  tools: { getOrder, getRefundPolicy },
  stopWhen: isStepCount(10),
});
```

**决策清单：**

```
你的 agent 流程复杂吗？
├── 就是"调工具 → 循环" → AI SDK 直接写，别上框架
├── 多分支、多角色、需要可视化编排 → LangGraph
├── 需要人工审批（human-in-the-loop）→ LangGraph（interrupt 帮你省事）
├── 需要断点续跑 / 故障恢复 → LangGraph（checkpoint）
└── 团队里全是前端、不想引入新概念 → AI SDK，把复杂逻辑写成普通 TS 函数
```

### 深层追问

**既然 AI SDK 也能写 agent，LangGraph 到底多给了我什么？**

多给了三样**生产级基础设施**：

1. **checkpoint**：状态持久化 + 故障恢复（手写要做状态序列化、存储、恢复，很麻烦）
2. **interrupt**：人工介入的原生支持（手写要自己设计"暂停/恢复"协议）
3. **可视化**：图结构能可视化、可调试（手写 while 循环，出问题只能靠日志猜）

如果你的场景用不到这三样，那 LangGraph 对你就是"负担"而不是"助力"。**别为了"听起来专业"上框架**——这正是第 16 章反复强调的原则。

---

## 概念辨析

### LangChain vs LangGraph

| | LangChain | LangGraph |
|---|---|---|
| 定位 | 组件生态 + 链（Chain） | 图编排（Graph） |
| 核心抽象 | Chain | State + Node + Edge |
| 循环/分支 | 弱（早期痛点） | 强（原生支持） |
| 关系 | 老大哥 | 官方下一代编排引擎 |
| 学哪个 | 了解组件即可 | 想编排才学 |

### 用框架 vs 直接用 SDK

| | 框架（LangGraph） | 直接 SDK（AI SDK） |
|---|---|---|
| 上手 | 慢 | 快 |
| 可控性 | 中（黑盒多） | 高（都是你写的代码） |
| 高级能力 | checkpoint/interrupt/可视化 | 需自己造 |
| 依赖风险 | 版本更新可能破坏 | 低 |
| 适合 | 复杂编排 | 轻量/中等 agent |

---

## 灵魂拷问

> **Q1：我到底该不该学 LangChain？之前听人说它是"做 agent 的标配"。**

> **A：** 分清楚两件事：**"了解它的思想"** 和 **"依赖它开发"**。前者值得，后者看场景。LangChain 的价值是它沉淀了很多 agent 设计的**模式**（ReAct、记忆、检索、编排），这些思想你该懂。但作为一个前端，你的主力工具是 AI SDK——它更轻、类型更好、和你的 React 生态无缝。结论：**了解 LangChain 的思想，用 AI SDK 落地，复杂编排再考虑 LangGraph。**

> **Q2：LangGraph.js 和 LangGraph（Python）有区别吗？我用 TS 会吃亏吗？**

> **A：** 有区别，而且不小。LangGraph.js 的 API 基本对齐 Python，但**生态薄、社区小、成熟度低**——官方新特性、第三方插件、踩坑资料几乎都是 Python 优先。用 TS 你大概率会遇到"文档是 Python 的、你要脑内翻译成 JS"的情况。所以对前端来说：**了解 + 跑通即可，别在生产里重度依赖 LangGraph.js**。真要上复杂编排，要么接受 Python，要么用 AI SDK 自己写清晰的 TS 函数。

> **Q3：手写 while 循环的 agent，和 LangGraph 的图，本质区别是什么？**

> **A：** 本质区别在于**状态的显式化程度**。手写 while 循环，状态是你脑子里/局部变量里的，流程一复杂就难维护；LangGraph 把状态、节点、流转关系**显式声明**出来，还能持久化（checkpoint）、可视化。但代价是引入了框架的概念负担。简单流程两者没差别，复杂流程 LangGraph 的优势才显现。

> **Q4：我见过一些"多 agent 框架"（CrewAI 之类），它们和 LangGraph 是一回事吗？**

> **A：** 不是一回事，但有重叠。CrewAI 这类主打"多 agent 角色扮演 + 协作"的高层封装；LangGraph 是更底层的"图编排引擎"，多 agent 只是它能表达的一种图结构。第 15 章讲过，很多"multi-agent 框架"扒开看就是 workflow 套壳营销。**真正的多 agent 是多个有自主 loop 的 agent 协作**，而不是把节点改名叫 agent。用 LangGraph 表达多 agent 协作，本质就是"多个 agent 节点 + 条件边"组成的图。

---

## 最佳实践

### DO

- **DO** 先理解 LangGraph 的"编排思想"（State/Node/Edge/循环），再决定用不用它
- **DO** 轻量 agent 用 AI SDK 直接写，别上框架
- **DO** 需要 human-in-the-loop / checkpoint 时，才认真考虑 LangGraph
- **DO** 循环一定加退出条件（`rounds` / `attempt` 计数器）
- **DO** 让状态在循环中累积（追加而非覆盖），否则循环无意义

### DON'T

- **DON'T** 为了"听起来专业"上框架——这是第 16 章反复强调的
- **DON'T** 在生产里重度依赖 LangGraph.js（TS 版），生态薄、成熟度低
- **DON'T** 用 Chain 硬套 agent 循环——那是 LangChain 早期的弯路
- **DON'T** 把"多 agent 框架"当救命稻草，多数是营销套壳
- **DON'T** 在循环里覆盖（而非累积）状态，会导致每轮从头开始

---

## 代码实战

> **项目归属**：完整可运行代码在 `labs/14-langgraph`（三个经典循环模式：多步 agent、循环重试、多 agent 协作）。本章摘取核心片段，完整版去看 lab。

### 多步 agent 循环（LangGraph）

```typescript
// labs/14-langgraph/examples/multi-step.ts 核心片段
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

const State = Annotation.Root({
  question: Annotation<string>,
  notes: Annotation<string>,       // 累积的研究笔记
  sufficient: Annotation<boolean>, // 反思结论
  answer: Annotation<string>,
  rounds: Annotation<number>,      // 循环上限
});

async function researchNode(state: typeof State.State) {
  const info = `[搜索结果] 关于「${state.question}」...`;
  return { notes: (state.notes ?? "") + info + "\n", rounds: state.rounds + 1 };
}

async function reflectNode(state: typeof State.State) {
  const { text } = await generateText({
    model: deepseek("deepseek-chat"),
    system: '判断资料是否足够。只输出 JSON：{"sufficient": true/false}',
    prompt: `问题：${state.question}\n资料：\n${state.notes}`,
  });
  return { sufficient: text.includes("true") };
}

async function replyNode(state: typeof State.State) {
  const { text } = await generateText({
    model: deepseek("deepseek-chat"),
    system: "只根据资料回答，不要编造。",
    prompt: `问题：${state.question}\n资料：\n${state.notes}`,
  });
  return { answer: text };
}

const MAX_ROUNDS = 3;
const route = (state: typeof State.State) =>
  state.sufficient || state.rounds >= MAX_ROUNDS ? "reply" : "research";

const graph = new StateGraph(State)
  .addNode("research", researchNode)
  .addNode("reflect", reflectNode)
  .addNode("reply", replyNode)
  .addEdge(START, "research")
  .addEdge("research", "reflect")
  .addConditionalEdges("reflect", route, { reply: "reply", research: "research" })
  .addEdge("reply", END)
  .compile();

const result = await graph.invoke({ question: "什么是 LangGraph？", rounds: 0 });
console.log("🤖 回答：", result.answer);
```

---

## 实操练习

### 目标

用 LangGraph 跑通一个"带循环"的 agent，并理解它和手写 while 循环的差异。

### 步骤

1. 跑通 `labs/14-langgraph` 的三个 demo（`npm run demo:multi-step` 等）
2. 给 `multi-step.ts` 加一个条件边：根据分类走不同分支
3. 试试 `checkpoint`：加 `MemorySaver`，用 `thread_id` 区分不同会话
4. 试试 `interrupt`：在某个节点暂停，等人工输入再继续

### 验收标准

- [ ] 能画出 `multi-step` 的图结构（节点 + 边 + 循环）
- [ ] 能说清 State / Node / Edge / 条件边四个概念
- [ ] 能解释"循环必须有退出条件"的原因
- [ ] 能说出 LangGraph 相对"手写 while"多给的三样能力

### 挑战加分项

- [ ] 用 AI SDK 的 `stopWhen` 重写 `multi-step`，对比两种实现的可读性
- [ ] 研究 `interrupt()` + `Command({ resume })` 的完整 human-in-the-loop 流程

---

## 本章小结

1. **LangChain 是组件生态，LangGraph 是图编排引擎**——两者定位不同，别混为一谈。

2. **Chain 是"固定流水线"，agent 是"动态循环"**——这是 LangChain 早期的弯路，也是 LangGraph 出现的动因。

3. **LangGraph 三要素**：State（共享状态）、Node（步骤）、Edge（流转），条件边实现分支和循环。

4. **循环铁律**：必须有退出条件，状态要在循环中累积。

5. **LangGraph 多给的三样**：checkpoint（断点续跑）、interrupt（人工介入）、可视化。

6. **生产真相**：Python 主导、TS 版了解即可；而且很多项目发现"直接 SDK 写 loop"更可控——**别为了名字上框架**。

下一章，给 agent 装上"加速器"——Redis（限流、缓存、队列）。
