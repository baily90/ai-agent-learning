# 附录 C：主流框架横向对比

> 对比 AI Agent 开发中主流的 TypeScript/JavaScript 框架和 SDK，帮你做技术选型。

---

## 写在前面

AI 开发的框架生态正处于"春秋战国"时期——新框架不断涌现，旧框架快速迭代。本附录的对比基于撰写时（2026 年 10 月）的状态，具体细节可能会过时，但**对比维度和选型思路**是持久的。

我们对比以下五个框架/SDK：

1. **Vercel AI SDK** — 本资料使用的主力 SDK
2. **LangChain.js** — 最老牌的 LLM 框架
3. **Claude Agent SDK（Anthropic SDK）** — Anthropic 官方的 Agent 开发 SDK
4. **Mastra** — 新兴的 TypeScript AI 框架
5. **CrewAI（JS 版）** — 多 Agent 框架

---

## 横向对比表

| 维度 | Vercel AI SDK | LangChain.js | Claude Agent SDK | Mastra | CrewAI (JS) |
|------|--------------|-------------|-----------------|--------|-------------|
| **定位** | 轻量级 AI UI 开发 SDK | 全能型 LLM 应用框架 | Anthropic Agent 开发 SDK | TypeScript AI 应用框架 | 多 Agent 协作框架 |
| **上手难度** | 低 | 中-高 | 中 | 中 | 中-高 |
| **TypeScript** | 一等公民，类型完善 | 支持但类型偶有缺陷 | 一等公民 | 一等公民，TypeScript-first | 类型支持有限 |
| **模型支持** | 多厂商（OpenAI/Anthropic/Google/DeepSeek 等） | 多厂商 | 仅 Anthropic Claude | 多厂商 | 多厂商 |
| **Tool Use** | `tool()` + Zod | `DynamicTool` / `StructuredTool` | 原生支持，自动工具循环 | `createTool()` | Agent 级别的工具定义 |
| **Streaming** | 原生支持，和 React/Next.js 深度集成 | 支持，但集成度不如 Vercel | 原生流式输出 | 支持 | 有限支持 |
| **RAG 支持** | 需自行搭建或用社区方案 | 内置完整的 RAG 工具链 | 需自行搭建 | 内置 RAG 支持 | 通过工具接入 |
| **Agent 模式** | `stopWhen` 驱动的工具循环 | AgentExecutor / LangGraph | 原生 Agent Loop，内置思考能力 | 支持 Agent 模式 | 核心能力，多种 Agent 模式 |
| **Multi-Agent** | 需自行编排 | LangGraph 支持 | 原生支持编排和委托 | 支持 Workflow 编排 | 核心能力，Crew 概念 |
| **MCP 支持** | 社区方案 | 社区方案 | 原生支持 MCP Server | 内置 MCP 支持 | 有限 |
| **生态** | Next.js 生态深度集成 | 最大的社区和插件生态 | Anthropic 官方维护 | 快速成长中 | Python 版生态强，JS 版较新 |
| **生产就绪** | 高（Vercel 背书） | 高（大量生产案例） | 高（Anthropic 官方） | 中（较新） | 中 |
| **学习资源** | 官方文档优秀 | 文档丰富但有时跟不上更新 | 官方文档 + 示例 | 文档在完善中 | Python 版资源多，JS 版少 |

---

## 1. Vercel AI SDK

### 一段话总结

Vercel AI SDK 是一个专注于 AI 应用 UI 层的轻量级 SDK。它不试图做一个"全能框架"，而是把"调用 AI 模型"和"在前端展示 AI 输出"这两件事做到极致。如果你用 React/Next.js 做前端，它是最自然的选择。

### 代码示例：带工具调用的聊天

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: 'openai/gpt-5',
  tools: {
    getWeather: tool({
      description: '获取城市天气',
      inputSchema: z.object({
        city: z.string().describe('城市名称'),
      }),
      execute: async ({ city }) => {
        return { city, temp: 22, condition: '晴' };
      },
    }),
  },
  stopWhen: isStepCount(5),
  prompt: '北京今天天气怎么样？',
});

console.log(result.text);
```

### 优点

- **和 Next.js/React 深度集成**：`useChat`、`useObject` 这些 React Hooks 让前端集成 AI 像用 `useState` 一样自然
- **流式输出体验极佳**：SSE 流式传输 + React Hooks 自动更新，打字机效果开箱即用
- **类型安全**：Zod Schema 从定义到输出全程类型推导，TypeScript 开发体验一流
- **多模型适配**：统一的 API 抽象层，切换 OpenAI/Anthropic/DeepSeek 只需换一行代码
- **结构化输出**：`generateText` + Zod 的组合是目前最优雅的结构化输出方案
- **轻量无包袱**：不引入复杂的抽象概念，学习成本低

### 缺点

- **RAG 不内置**：需要自己搭建向量检索流水线，或用第三方库
- **Multi-Agent 不内置**：复杂的多 Agent 编排需要自己实现
- **主要面向 Vercel 生态**：虽然可以独立使用，但和 Next.js + Vercel 配合最佳
- **底层能力偏薄**：定位是"调用层"而非"框架层"，复杂场景需要额外的架构设计

### 我的建议

**什么时候选它**：
- 你的技术栈是 React / Next.js
- 你需要做有优秀前端交互的 AI 应用
- 你希望从简单开始，按需增加复杂度
- 你重视 TypeScript 类型安全

**什么时候不选它**：
- 你需要一个"全包"的 Agent 框架（内置 RAG、内置 Multi-Agent）
- 你的项目没有前端（纯后端 Agent 服务）
- 你需要极其复杂的 Agent 编排能力

---

## 2. LangChain.js

### 一段话总结

LangChain 是 AI 开发领域最早也最全面的框架，后来推出了 JS/TS 版本。它试图提供从 Prompt 模板到 Agent 到 RAG 到评估的"全家桶"。生态最丰富，但也因此最复杂。

### 代码示例：带工具调用的聊天

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

const weatherTool = new DynamicStructuredTool({
  name: 'getWeather',
  description: '获取城市天气',
  schema: z.object({
    city: z.string().describe('城市名称'),
  }),
  func: async ({ city }) => {
    return JSON.stringify({ city, temp: 22, condition: '晴' });
  },
});

const model = new ChatOpenAI({ modelName: 'gpt-5' });
const prompt = ChatPromptTemplate.fromMessages([
  ['system', '你是一个有帮助的助手。'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
]);

const agent = createToolCallingAgent({ llm: model, tools: [weatherTool], prompt });
const executor = new AgentExecutor({ agent, tools: [weatherTool] });
const result = await executor.invoke({ input: '北京今天天气怎么样？' });

console.log(result.output);
```

### 优点

- **生态最完善**：几乎所有 AI 相关的能力都有对应的组件——向量数据库连接器、文档加载器、各种检索策略
- **RAG 全链路支持**：文档加载、分块、Embedding、检索、重排序都有内置支持
- **LangGraph 强大**：用于构建复杂的 Agent 工作流和多 Agent 系统的图状态机
- **LangSmith 集成**：配套的可观测性平台，可以追踪每一次 LLM 调用的详情
- **社区活跃**：最多的教程、示例和社区讨论

### 缺点

- **抽象层过重**：大量的 class 继承、概念嵌套，学习曲线陡峭。一个简单的工具调用需要创建 Tool、Agent、AgentExecutor、Prompt Template 等多个对象
- **API 频繁变动**：版本更新激进，旧教程可能很快过时
- **TypeScript 类型不够好**：虽然支持 TS，但类型推导不如 Vercel AI SDK 精确
- **性能开销**：大量抽象层带来运行时开销，对于简单场景显得臃肿
- **"全家桶"的代价**：即使你只需要其中 10% 的功能，也要理解它的整体架构

### 我的建议

**什么时候选它**：
- 你需要一个"全包"的 RAG 方案，不想自己搭建
- 你的项目需要对接很多不同的向量数据库、文档源
- 你需要 LangGraph 来做复杂的 Agent 工作流
- 你需要 LangSmith 的可观测性能力

**什么时候不选它**：
- 你的场景简单（基本的 AI 对话 + 工具调用），不需要那么多抽象
- 你对 TypeScript 类型安全要求很高
- 你追求轻量和可控性
- 你不想被"全家桶"锁定

---

## 3. Claude Agent SDK（Anthropic SDK）

### 一段话总结

Anthropic 官方推出的 Agent 开发 SDK，专为 Claude 模型设计。它提供了原生的 Agent 循环、工具调用和多 Agent 编排能力。如果你主用 Claude 模型，这是最"原生"的选择，类似于用 React 做前端时选 Next.js。

### 代码示例：带工具调用的聊天

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const result = await client.messages.create({
  model: 'claude-sonnet-5',
  max_tokens: 1024,
  tools: [
    {
      name: 'getWeather',
      description: '获取城市天气',
      input_schema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名称' },
        },
        required: ['city'],
      },
    },
  ],
  messages: [
    { role: 'user', content: '北京今天天气怎么样？' },
  ],
});

// Claude Agent SDK 会自动处理工具调用循环
console.log(result);
```

### 优点

- **和 Claude 模型深度集成**：利用 Claude 的 Extended Thinking（扩展思考）能力，Agent 推理质量更高
- **原生 MCP 支持**：Anthropic 是 MCP 协议的提出者，SDK 天然支持 MCP Server 接入
- **Multi-Agent 原生支持**：内置 Handoff（委托）和 Orchestration（编排）模式
- **安全设计**：内置 Guardrails 概念，安全防护是一等公民
- **官方维护**：Anthropic 直接维护，和模型能力保持同步更新

### 缺点

- **只支持 Claude 模型**：如果你想切换到 GPT-4 或 DeepSeek，需要换 SDK
- **生态相对较新**：社区插件和第三方集成不如 LangChain 丰富
- **前端集成需要额外工作**：不像 Vercel AI SDK 有开箱即用的 React Hooks
- **RAG 需要自建**：SDK 本身不内置 RAG 流水线

### 我的建议

**什么时候选它**：
- 你的产品主要使用 Claude 模型
- 你需要利用 Claude 的 Extended Thinking 能力来构建高质量推理 Agent
- 你需要原生的 MCP 支持
- 你重视 Agent 的安全性设计

**什么时候不选它**：
- 你需要支持多个模型提供商
- 你的前端是 React/Next.js，希望有深度集成的 UI 方案
- 你需要内置的 RAG 能力

---

## 4. Mastra

### 一段话总结

Mastra 是一个新兴的 TypeScript-first AI 框架，定位是"给 TypeScript 开发者的 AI 应用框架"。它试图在 Vercel AI SDK 的轻量和 LangChain 的全面之间找到平衡点——既有结构，又不过度抽象。内置了 Agent、RAG、Workflow 和 MCP 支持。

### 代码示例：带工具调用的聊天

```typescript
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { openai } from '@mastra/openai';
import { z } from 'zod';

const weatherTool = createTool({
  id: 'getWeather',
  description: '获取城市天气',
  inputSchema: z.object({
    city: z.string().describe('城市名称'),
  }),
  execute: async ({ context }) => {
    return { city: context.city, temp: 22, condition: '晴' };
  },
});

const agent = new Agent({
  name: 'weatherAgent',
  instructions: '你是一个有帮助的助手。',
  model: 'openai/gpt-5',
  tools: { getWeather: weatherTool },
});

const result = await agent.generate('北京今天天气怎么样？');
console.log(result.text);
```

### 优点

- **TypeScript-first**：从设计上就是给 TS 开发者用的，类型体验好
- **内置 RAG**：提供了向量存储、文档分块、检索等 RAG 组件
- **Workflow 引擎**：内置工作流定义和执行能力，支持条件分支和并行
- **MCP 原生支持**：可以直接连接 MCP Server
- **模块化设计**：需要什么用什么，不强制引入全部功能
- **API 设计简洁**：比 LangChain 的抽象层少得多

### 缺点

- **相对较新**：社区规模和生态还在成长中
- **生产案例少**：还没有大规模的线上验证
- **文档在完善中**：有些高级用法的文档不够详细
- **前端集成不如 Vercel AI SDK**：没有专门的 React Hooks 层

### 我的建议

**什么时候选它**：
- 你想要一个"适度抽象"的 TypeScript AI 框架——比 Vercel AI SDK 多一些结构，比 LangChain 少一些复杂
- 你需要内置的 RAG 和 Workflow 能力
- 你对新框架有一定的容忍度，愿意和框架一起成长

**什么时候不选它**：
- 你需要大量生产验证的成熟方案
- 你需要和 Next.js 深度集成的 UI 方案
- 你不想成为早期采用者

---

## 5. CrewAI（JS 版）

### 一段话总结

CrewAI 的核心概念是"Crew"（团队）——多个有不同角色和目标的 Agent 组成一个团队，协作完成复杂任务。它是 Multi-Agent 场景的专用框架。Python 版非常成熟，JS/TS 版本较新但在快速跟进。

### 代码示例：带工具调用的多 Agent 聊天

```typescript
import { Agent, Task, Crew } from 'crewai-js';

// 定义不同角色的 Agent
const researcher = new Agent({
  role: '研究员',
  goal: '搜集关于指定主题的最新信息',
  backstory: '你是一位经验丰富的技术研究员',
  tools: [searchTool],
});

const writer = new Agent({
  role: '撰稿人',
  goal: '基于研究结果撰写清晰易懂的报告',
  backstory: '你是一位优秀的技术文档撰写者',
});

// 定义任务
const researchTask = new Task({
  description: '研究 React Server Components 的最新进展',
  agent: researcher,
});

const writeTask = new Task({
  description: '基于研究结果写一篇 500 字的技术简报',
  agent: writer,
});

// 组建团队并执行
const crew = new Crew({
  agents: [researcher, writer],
  tasks: [researchTask, writeTask],
  process: 'sequential', // 串行执行
});

const result = await crew.kickoff();
console.log(result);
```

### 优点

- **Multi-Agent 是核心能力**：角色定义、任务分配、团队协作是框架的一等公民
- **概念直观**：Agent（员工）、Task（任务）、Crew（团队）的比喻非常好理解
- **多种协作模式**：串行、并行、分层（管理者-执行者）
- **Python 版成熟度高**：如果你的团队有 Python 开发者，JS 和 Python 版可以互补

### 缺点

- **JS 版相对较新**：功能完整度和稳定性不如 Python 版
- **单 Agent 场景杀鸡用牛刀**：如果你不需要多 Agent 协作，框架的优势发挥不出来
- **TypeScript 类型支持有限**：JS 版的类型定义不够完善
- **前端集成需要额外工作**：不提供 React/Vue 集成方案
- **流式输出支持有限**：对于需要实时 UI 反馈的前端场景不够友好

### 我的建议

**什么时候选它**：
- 你的核心需求是多个 Agent 协作完成复杂任务
- 你需要定义不同"角色"的 Agent，并让它们按流程协作
- 你的团队同时有 Python 和 JS 开发者

**什么时候不选它**：
- 你只需要单个 Agent 做工具调用
- 你需要优秀的前端集成和流式体验
- JS 版的成熟度不能满足你的生产要求

---

## 选型建议汇总

### 按场景推荐

| 你的场景 | 推荐框架 | 原因 |
|---------|---------|------|
| React/Next.js 应用 + AI 对话 | **Vercel AI SDK** | 前端集成最佳，流式体验一流 |
| 需要完整 RAG 全链路 | **LangChain.js** 或 **Mastra** | 内置 RAG 工具链，不用自己搭 |
| 主用 Claude 模型做 Agent | **Claude Agent SDK** | 原生 Claude 能力，MCP 支持 |
| 多 Agent 协作系统 | **CrewAI** 或 **Claude Agent SDK** | Multi-Agent 是核心能力 |
| TypeScript-first 全栈 AI 应用 | **Mastra** | TS 类型体验好，功能适度全面 |
| 快速 Demo / 学习 | **Vercel AI SDK** | 上手最快，文档最友好 |
| 企业级 AI 平台 | **LangChain.js** + **LangSmith** | 生态最完善，可观测性最强 |

### 按经验水平推荐

| 你的阶段 | 推荐 | 原因 |
|---------|------|------|
| AI 开发入门 | **Vercel AI SDK** | 概念少，上手快，文档好 |
| 有一定经验，需要更多能力 | **Vercel AI SDK** + 按需引入其他 | 先用轻量方案，不够再加 |
| 做复杂 Agent 系统 | **LangChain.js（LangGraph）** 或 **Claude Agent SDK** | 工具链完善，适合复杂场景 |
| 做 Multi-Agent 产品 | **CrewAI** 或 **Claude Agent SDK** | 多 Agent 是核心能力 |

### 可以混合使用

这些框架不是互斥的。很多实际项目会混合使用：

- **前端交互层**用 Vercel AI SDK（React Hooks + 流式输出）
- **Agent 核心逻辑层**用 Claude Agent SDK 或 LangChain.js（复杂编排）
- **Multi-Agent 编排层**用 CrewAI 的概念（角色分工和任务分配）

就像你的前端项目可能同时用 React（UI 框架）+ TanStack Query（数据获取）+ Zustand（状态管理）一样——每个工具做自己最擅长的事。

---

## 本附录的核心建议

如果你是本资料的目标读者（前端开发者，AI 初学者），我的建议非常明确：

**从 Vercel AI SDK 开始。**

原因：
1. 它和你的技术栈（React/Next.js/TypeScript）最贴合
2. 学习曲线最平缓——你会的 Zod、用的 React Hooks 直接复用
3. 本资料的所有代码示例都基于它，学习路径一致
4. 当你用它碰到能力边界时（比如需要复杂 RAG、需要 Multi-Agent），你已经对 AI 开发有了足够的理解，那时再选择性地引入其他框架

不要在入门阶段纠结框架选型。**框架是工具，不是信仰**。先把 AI 开发的核心概念（Prompt、Tool Use、RAG、Agent 模式）搞懂，框架随时可以换。就像你学会了 React 的思想，换到 Vue 也很快——因为核心概念是相通的。
