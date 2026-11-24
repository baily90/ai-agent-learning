# 第31章：Mastra 入门与核心心智 — 从造轮子到开成品车

## 引言

前面 30 章，你亲手把 AI Agent 的每个零件都造了一遍：第 7 章手写工具调用循环、第 12 章手写 ReAct 循环、第 13 章手写多步任务分解、第 15 章手写多 Agent 协作、第 16 章用 LangGraph 画图编排……你已经是一个「会造轮子」的人了。

这一章开始换个视角：如果把这些轮子交给一个成熟的框架，会是什么体验？

**Mastra** 就是这样一个框架——它把你在前面章节里手工写的 agent loop、工具循环、workflow、RAG、评测、可观测性，全部做成了开箱即用的 API。从这一章起（第 31~40 章），我们系统、深入地学习 Mastra，最后用一个「智能工单客服 Agent」把所有知识点串起来。

> 本部分共 10 章，每一章都遵循同一个原则：**先回忆你之前用 AI SDK 手写时踩过的坑，再看 Mastra 怎么帮你填平它**。

---

## 31.1 核心心智：AI SDK 是零件，Mastra 是整车

### 一句话直觉

Mastra 之于 AI SDK，就像 **Next.js 之于 React**——React 给你组件和 hooks，Next.js 在此基础上给你路由、SSR、数据获取、部署。你依然在写 React，但 Next.js 把「搭应用」的脏活累活包了。

### 前端类比

| 你熟悉的前端 | AI 领域对应 |
|---|---|
| React（组件、hooks、状态） | Vercel AI SDK（generateText、streamText、tool、embed） |
| Next.js（路由、SSR、数据、部署） | Mastra（Agent、Workflow、Memory、Evals、部署） |
| 手写 webpack 配置 | 手写 agent loop + 工具循环 + RAG 管道 |
| 用 Vite/Next 脚手架 | 用 `mastra init` 脚手架 |

关键点：**Mastra 不是「替代」AI SDK，而是「站在它肩膀上」**。你之前学的 `generateText`、`streamText`、`tool` 这些概念全部还有效——Mastra 只是把它们背后的「编排」工作接管了。

### 详细原理

回顾你前面手写的东西，Mastra 分别对应到哪：

```
你前面手写的（AI SDK 裸写）               Mastra 的对应物
─────────────────────────────────────────────────────
第07/12章：手写工具调用循环               → Agent（自动跑 tool loop）
第13章：手写多步任务分解                   → Workflow（声明式步骤）
第08章：手写对话记忆/滑动窗口             → Memory（自动管理上下文）
第09/10章：手写 RAG 管道                  → Semantic Recall / Knowledge（内置检索）
第15章：手写多 Agent 编排                 → Subagents（多 agent 协作）
第21章：手写评测脚本                      → Evals（内置 + 自定义）
第22章：接 Langfuse 做追踪                → Observability（内置 traces）
第14章：手写 MCP client                   → 内置 MCP 支持
```

所以学 Mastra 的本质是：**把「你手动实现过一遍的能力」升级成「框架内置的 API」**。因为你造过轮子，你会秒懂每个 API 在帮你省什么。

### 深层追问

**为什么 Mastra 选择基于 AI SDK，而不是像 LangChain 那样自己造一套 provider 抽象？**

因为「跟模型对话」这件事，Vercel AI SDK 已经做到了事实标准级别——provider 全、类型好、流式强、和 React 生态无缝。Mastra 再去造一个 provider 抽象是重复造轮子。它把精力放在 AI SDK **不提供**的东西上：编排、记忆、评测、可观测、部署。这是很聪明的定位。

（对照：LangGraph/LangChain 是「全家桶」——从 provider 抽象到编排全都自己来，所以它庞大、抽象重。Mastra 只做「AI SDK 之上」这一层，所以更轻。）

---

## 31.2 环境搭建：一条命令起步

### 方式一：CLI 脚手架（推荐）

```bash
npx create-mastra@latest my-agent
```

按提示选模板，脚手架会生成完整项目结构。

### 方式二：手动搭建（理解每个文件）

如果你想知道脚手架到底生成了什么，手动来一遍：

```bash
mkdir my-agent && cd my-agent
npm init -y
```

改 `package.json`，加 `"type": "module"`，然后装依赖：

```bash
npm install @mastra/core mastra zod typescript @types/node dotenv
npm install -D tsx
```

建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

### 项目结构

```
my-agent/
├── src/
│   └── mastra/
│       ├── index.ts        # 导出 Mastra 实例（注册 agent/workflow/tool）
│       ├── agents/         # 定义各种 agent
│       ├── tools/          # 定义工具
│       └── workflows/      # 定义 workflow
├── .env                    # 模型 API Key
├── package.json
└── tsconfig.json
```

> 核心心智：Mastra 项目里，你写的是「**资源**」——agent、tool、workflow——然后统一注册到一个 Mastra 实例里。这和你之前的「一个脚本跑一个功能」完全不同，更像「一个应用注册一堆能力」。

---

## 31.3 模型配置：`provider/model` 字符串

### 和 AI SDK 的对照

在 AI SDK 里，你传的是 **model 对象**：

```typescript
import { deepseek } from '@ai-sdk/deepseek';
const model = deepseek('deepseek-chat');
```

在 Mastra 里，你传的是 **`provider/model` 字符串**：

```typescript
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  id: 'assistant',
  name: 'assistant',
  model: 'deepseek/deepseek-chat',   // 字符串，不是对象！
  instructions: '你是客服助手',
});
```

Mastra 的 **model router** 会拿这个字符串去解析对应的 provider。这是 Mastra 和 AI SDK 最明显的写法差异之一，**别混用**——传对象会出错。

### 关键：不用装任何 AI SDK provider 包

Mastra 的 model router **原生支持大量 provider**，你只需要：

1. 写 `provider/model` 字符串
2. 在 `.env` 里配好对应的环境变量

**不需要** `import { deepseek } from '@ai-sdk/deepseek'`，也**不需要**安装 `@ai-sdk/*` 包（除非官方文档明确要求）。这是和裸 AI SDK 最大的不同——AI SDK 要你 import provider 对象，Mastra 只要一个字符串 + 环境变量。

### .env 里配 Key

```bash
# .env
DEEPSEEK_API_KEY=sk-xxx
OPENAI_API_KEY=sk-xxx
```

### 常见 provider 的环境变量

| model 前缀 | 环境变量 |
|---|---|
| `deepseek/*` | `DEEPSEEK_API_KEY` |
| `openai/*` | `OPENAI_API_KEY` |
| `anthropic/*` | `ANTHROPIC_API_KEY` |
| `google/*` | `GOOGLE_API_KEY` |
| `alibaba/*`（阿里云/通义） | `DASHSCOPE_API_KEY` |

> 完整列表见官方 [Models 目录](https://mastra.ai/models) 和 [环境变量表](https://mastra.ai/models/environment-variables)。

### 详细原理

为什么 Mastra 用字符串而不是对象？因为 Mastra 的「资源」（agent/workflow）经常要**序列化、持久化、跨进程传递**（比如 suspend 后恢复、部署到云端）。字符串好序列化，对象不行。这也是为它的 workflow 持久化能力做铺垫（第 34 章你会看到）。

---

## 31.4 CLI 与 Studio：开发期的左膀右臂

### CLI

Mastra 自带命令行工具，用来**开发调试**而不是写代码：

```bash
npx mastra dev        # 启动开发环境（含 Studio）
npx mastra build      # 构建
npx mastra run        # 直接跑某个 agent/workflow
```

### Studio

`mastra dev` 会起一个本地 **Studio**（网页），你可以：

- 直接和 agent 对话测试
- 查看每次运行的 **trace**（每一步花了多少 token、调了什么工具）
- 调试 workflow 的每一步状态、查看 workflow 的图
- 查看 agent 的 **Memory** 面板（第 35 章会用到）

> 这相当于 AI SDK 时代的「console.log + 手动 curl」，现在变成图形界面。你之前为了调试 agent 循环打的那些日志，Mastra 免费送你了（详见第 38 章）。

---

## 31.5 注册资源：Mastra 实例

所有 agent/tool/workflow 最终都要注册到一个 Mastra 实例上，才能被 CLI/Studio/部署识别：

```typescript
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { supportAgent } from './agents/support';
import { ticketWorkflow } from './workflows/ticket';

export const mastra = new Mastra({
  storage: new LibSQLStore({ id: 'mastra-storage', url: 'file:./mastra.db' }),  // 持久化（记忆/快照用）
  agents: { support: supportAgent },       // 注册 agent
  workflows: { ticket: ticketWorkflow },   // 注册 workflow
});
```

> `storage` 是记忆、workflow 快照等需要持久化的功能的地基（第 35 章详讲）。这里先记住：**要持久化，就得配 storage**。

---

## 概念辨析：AI SDK vs Mastra vs LangGraph

这里只做 20 秒快速定位，完整对比见附录 C 和第 27 章：

| | 定位 | 你什么时候用 |
|---|---|---|
| **Vercel AI SDK** | 模型调用层（零件） | 只要「调模型 + 流式 + 工具」，不要框架 |
| **Mastra** | AI SDK 之上的应用框架（整车） | 要 agent + workflow + RAG + evals 一站式 |
| **LangGraph** | 独立全家桶（另一种整车，Python 血统） | 要 checkpoint/时间旅行那套重武器 |

一句话：**AI SDK 你已经在用了；Mastra 是「继续用 AI SDK、但把上层全部包圆」的最自然升级**。

---

## 灵魂拷问

**Q1：既然 Mastra 底层就是 AI SDK，那我还有必要单独学 AI SDK 吗？**

有，而且非常有必要。原因有三：

1. **Mastra 是「薄薄一层」**，遇到它没覆盖的边角，你还是得降级到 AI SDK 写。
2. **理解才能调试**：Mastra 的 trace 里暴露的都是 AI SDK 的概念（tool call、step、token usage），不懂 AI SDK 你看不懂 trace。
3. **不绑定框架**：AI SDK 是事实标准，Mastra 只是其中一个上层框架。学会「底层」，换框架都容易。

**Q2：Mastra 的 `model: 'deepseek/deepseek-chat'` 字符串，和 AI SDK 的 `deepseek('deepseek-chat')` 对象，本质区别是什么？**

本质是「**可序列化 vs 不可序列化**」。字符串能存进数据库、能 JSON 序列化、能跨进程传递；对象是运行时实体，序列化会丢失方法。Mastra 需要把 agent/workflow 持久化（suspend/resume、云端部署），所以用字符串。这是「为了分布式能力而做的 API 设计取舍」。

**Q3：Mastra 为什么不用装 `@ai-sdk/*` 包就能调各种模型？**

因为 Mastra 内置了一个 **model router**，它把 `provider/model` 字符串映射到各家的 HTTP 接口 + 环境变量。AI SDK 的 provider 包本质也是干这件事，只是 AI SDK 要你显式 import、Mastra 帮你隐式路由。两者殊途同归，但 Mastra 把「接 provider」这一步藏得更深。

---

## 最佳实践

**✅ DO：**

- 一个 agent 一个文件，统一放 `src/mastra/agents/`，工具放 `tools/`，workflow 放 `workflows/`。
- model 用 `provider/model` 字符串，key 放环境变量，别硬编码。
- 开发期开着 `mastra dev` 的 Studio，边写边在网页上测。

**❌ DON'T：**

- 别把 model 写成 AI SDK 的对象（`deepseek('deepseek-chat')`）——Mastra 要字符串。
- 别为调模型去装 `@ai-sdk/*` 包——Mastra 原生路由，装了反而是多余的。
- 别一上来就上复杂 workflow——先写单个 agent 跑通，再逐步加步骤。

---

## 代码实战：第一个 Mastra agent

最小可运行示例：

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  id: 'greeter',
  name: 'greeter',
  model: 'deepseek/deepseek-chat',   // 注意：字符串，不需要 import provider
  instructions: '你是一个简洁友好的助手，回答不超过 50 字。',
});

export const mastra = new Mastra({
  agents: { greeter: agent },
});
```

跑起来：

```bash
# .env 配好 DEEPSEEK_API_KEY
npx mastra dev
```

在 Studio 里选 `greeter` agent，输入「你好」，就能看到回复和完整 trace。

对比一下你第 12 章手写的 agent loop（要自己管理消息数组、判断 stopWhen、手动循环调用）——**Mastra 把这些都藏进 Agent 内部了**。

---

## 实操练习（为工单客服项目打地基）

**练习 1**：用 `npx create-mastra@latest` 初始化项目，跑通 `mastra dev`，在 Studio 里和默认 agent 对话。

**验收标准**：Studio 能对话，能点开一次运行的 trace 看到 token 用量。

**练习 2**：把默认 agent 的 model 换成 `deepseek/deepseek-chat`，只配 `DEEPSEEK_API_KEY` 环境变量（不装任何 `@ai-sdk/*` 包）。

**验收标准**：切换模型只改一行字符串 + 一个环境变量，能正常对话。

---

## 本章小结

- Mastra 是**构建在 Vercel AI SDK 之上**的应用框架，关系像 Next.js 之于 React。
- 核心心智转变：**从「写脚本」到「定义资源」**——定义 agent/tool/workflow，注册到 Mastra 实例。
- 最易错的点：**model 用 `provider/model` 字符串 + 环境变量**，不是 AI SDK 的对象，也**不需要装 `@ai-sdk/*` 包**。
- 开发期用好 `mastra dev` + Studio，等于白送一个调试界面。
- 要持久化（记忆/快照）就配 `storage`。

下一章进入第一个核心能力：**Agent 深入**——把它第 7、12 章手写的循环，以及流式、护栏、处理器这些你之前要自己拼的东西，一次讲透。
