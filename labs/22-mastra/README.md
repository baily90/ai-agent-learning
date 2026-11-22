# Lab 22 · Mastra 综合实战：智能工单客服 Agent

> 配套第 31~37 章。目标：用一个完整的「工单客服」项目，把 Mastra 七章的知识点全部串起来。

## 跑起来

```bash
cp .env.example .env      # 填 DeepSeek key
npm install

# 1. Agent + 工具 + 多 Agent + 评测（第32/35/36章）
npm run demo:agent "帮我查一下订单 ORD-1001 到哪了"

# 2. Workflow + 人工审批 suspend/resume（第33章，无需 API key）
npm run demo:workflow

# 3. 记忆（第34章）
npm run demo:memory
```

## 学什么

这是前面 30 章「亲手造轮子」的升级版——**同一个工单场景，用 Mastra 一站式搞定**。一个项目串起七章知识点：

| 章节 | 知识点 | 在本项目的位置 |
|------|--------|---------------|
| 31 | 环境搭建、provider/model 字符串、资源注册 | `package.json` + `src/mastra/index.ts` |
| 32 | Agent 定义 + createTool 工具 | `src/mastra/agents/support.ts` + `src/mastra/tools/order.ts` |
| 33 | Workflow 编排 + suspend/resume 人工审批 | `src/mastra/workflows/ticket.ts` |
| 34 | 记忆（workingMemory + resource/thread） | `support.ts` 的 `memory` 配置 |
| 35 | 评测（scorer + sampling） | `support.ts` 的 `scorers` 配置 |
| 36 | 多 Agent（subagents） | `support.ts` 的 `agents: { orderExpert, toneExpert }` |
| 37 | 部署（mastra build / server adapter） | 见下方「部署与前端对接」 |

## 项目结构

```
src/
├── mastra/
│   ├── index.ts            # Mastra 实例：注册 agent + workflow + storage
│   ├── agents/support.ts   # 主管 agent + 子 agent + memory + scorers
│   ├── tools/order.ts      # getOrder / checkLogistics / applyRefund 三个工具
│   └── workflows/ticket.ts # 工单流程：分类 → 查单 → 审批 → 回复
└── demo/
    ├── agent.ts            # 演示：agent + 工具 + 多 agent
    ├── workflow.ts         # 演示：workflow + suspend/resume
    └── memory.ts           # 演示：记忆（resource/thread 隔离）
```

## 核心机制讲解

### 1. 工具必须 createTool（第32章）

`src/mastra/tools/order.ts` 里三个工具都用 `createTool()` 定义（`id` + `description` + `inputSchema`(zod) + `execute(inputData, context)`）。**用普通对象会静默失败**，这是新手最容易踩的坑。

### 2. 人工审批 suspend/resume（第33章）

`ticket.ts` 的 `refund-approval` 步骤演示了完整流程：

- 退款金额 > 500 → `suspend({ reason })` 暂停
- 人工点「通过」→ `run.resume({ resumeData: { approved: true } })` 继续
- 底层靠 snapshot 持久化，**重启不丢状态**

`demo/workflow.ts` 单脚本演示了「启动 → 暂停 → 恢复」全过程，无需 API key。

### 3. 记忆 + 评测 + 多 Agent 一个 Agent 全挂上（第34/35/36章）

`support.ts` 一个 Agent 同时配了：

- `memory`：`workingMemory: true` 记住用户偏好
- `scorers`：相关性（抽样 50%）+ 毒性（全量）自动打分
- `agents`：`orderExpert` + `toneExpert` 两个子 agent，主管自动委托

## 部署与前端对接（第37章）

**本地开发**：`npx mastra dev` 起 Playground，可视化调试 + 看 trace。

**生产部署**：`npx mastra build` 构建后部署到任意 Node 环境（v22.13+）。

**嵌入现有服务**：用 server adapter（`@mastra/express` / `@mastra/next` / `@mastra/hono` 等）把 Mastra 端点挂进你的应用。

**前端对接**：因为 Mastra 底层是 AI SDK，前端直接用你早就会的 `useChat`：

```typescript
import { useChat } from '@ai-sdk/react';

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/chat',   // 指向你的 Mastra 服务端点
});
```

## 练什么（挑战）

**挑战 1：加一个「质检」子 agent**
现在只有查单 + 润色两个子 agent。再加一个 `qualityCheck` 子 agent，让主管在回复前先委托它质检。

**挑战 2：给 workflow 加并行**
把「查订单」和「查物流」改成 `.parallel()`，再合并结果（参考第 33 章）。

**挑战 3：退款驳回分支**
现在审批只演示「通过」。改成 `resumeData: { approved: false }` 时，回复不同的文案，并在 workflow 里加一个条件分支。

**挑战 4：接一个 MCP server**
用 `MCPClient` 接一个真实 MCP server（如 wikipedia-mcp），把它的工具给 agent 用（参考第 36 章）。

> ⚠️ 说明：Mastra API 迭代很快。本项目代码基于 2026-11 的官方文档，若某处 API 对不上，以 <https://mastra.ai/docs> 为准。
