# 第39章：多 Agent 与 MCP — 从单打独斗到团队协作

## 引言

第 15 章你手写过多 Agent 协作（规划师 → 执行者 → 评审），核心痛点是「谁调谁、怎么传上下文、结果怎么汇总」全靠手写。第 14 章你接过 MCP 协议做标准化工具接入，要手动配 client。

Mastra 把这两件事收进了框架。这一章讲透：多 agent（subagents + 模式）和 MCP + A2A/ACP 协议。

---

## 39.1 什么时候该用多 agent

一句话：**当一个 agent 不再是一个好的边界时**。具体信号：

- 任务跨越不同种类的工作（研究、规划、写作、评审）
- 一个 agent 要装太多工具、太多上下文
- 不同阶段需要不同的 prompt / 模型 / 护栏

> 反过来说：**能用一个 agent 就先用一个**，加了结构反而变差就别加。这是第 15 章就强调过的原则。

---

## 39.2 Subagents：父 agent 委托子 agent

### 定义

```typescript
import { Agent } from '@mastra/core/agent';

// 子 agent 1：查事实
const researchAgent = new Agent({
  id: 'research-agent',
  name: 'research-agent',
  description: '收集事实信息，返回要点摘要。',     // description 给父 agent 看
  model: 'deepseek/deepseek-chat',
});

// 子 agent 2：写回复
const writingAgent = new Agent({
  id: 'writing-agent',
  name: 'writing-agent',
  description: '把信息组织成条理清晰的客服回复。',
  model: 'deepseek/deepseek-chat',
});

// 父 agent：协调者（supervisor）
const supportAgent = new Agent({
  id: 'support',
  name: 'support',
  instructions: '你是客服主管。查事实委托 research-agent，写回复委托 writing-agent。',
  model: 'deepseek/deepseek-chat',
  agents: { researchAgent, writingAgent },   // 关键：挂上子 agent
});
```

父 agent 根据 instructions 和子 agent 的 description，**自己判断**什么时候委托给谁，最后汇总。

> 关键：子 agent 的 description 写得好不好，直接决定委托准不准——这和第 7 章「工具 description 决定调用准不准」是同一个道理。

---

## 39.3 Delegation Hooks：控制委托

父 agent 委托子 agent 时，你可以**拦截、改写、拒绝**：

```typescript
const supportAgent = new Agent({
  id: 'support',
  name: 'support',
  model: 'deepseek/deepseek-chat',
  agents: { researchAgent },
  delegation: {
    onDelegationStart: async ({ subagent, prompt }) => {
      // 场景 1：拒绝委托（敏感任务不给子 agent）
      // return { proceed: false, rejectionReason: '该任务需人工处理' };

      // 场景 2：改写发给子 agent 的 prompt
      return {
        proceed: true,
        modifiedPrompt: `${prompt}\n（注意：只查公开信息，不涉及用户隐私）`,
      };
    },
  },
});
```

常见用途：权限控制（proceed: false）、上下文注入（modifiedPrompt）、租户隔离（threadMetadata）。

---

## 39.4 多 agent 模式

Mastra 的三种多 agent 编排模式：

| 模式 | 谁在控制 | 适用 |
|---|---|---|
| **Supervisor** | 父 agent 全程掌控，委托 + 汇总 | 需要统一协调、结果汇总 |
| **Handoff（交接）** | 控制权转移给下一个专家 | 下一个专家直接接手对话 |
| **Workflow** | 代码定义执行路径 | 顺序/分支确定、要可预测 |

选择关键：**任务推进时，谁在控制？** supervisor 是「中心协调」，handoff 是「接力棒传递」，workflow 是「代码定路径」。

---

## 39.5 MCP：标准化工具接入

### MCPClient：接入外部工具

```typescript
import { MCPClient } from '@mastra/mcp';

const mcpClient = new MCPClient({
  id: 'my-mcp-client',
  servers: {
    wikipedia: {
      command: 'npx',                    // 本地命令启动
      args: ['-y', 'wikipedia-mcp'],
    },
    weather: {
      url: new URL('https://weather.example.com/mcp'),   // 或远程 URL
      requestInit: {
        headers: { Authorization: `Bearer ${process.env.WEATHER_API_KEY}` },
      },
    },
  },
});

const assistant = new Agent({
  id: 'assistant',
  name: 'assistant',
  model: 'deepseek/deepseek-chat',
  instructions: '用可用的 MCP 工具回答问题，并注明来源。',
  tools: await mcpClient.getTools(),   // MCP 工具一键接入
});
```

这就是第 14 章「热插拔工具」的框架版——你不再手写 MCP client，Mastra 帮你处理协议细节。

### MCPServer：反向暴露

Mastra 也能用 MCPServer 把你的 agent/workflow/工具暴露给**其他系统**（比如 Claude Desktop 或别的 agent）。

---

## 39.6 A2A / ACP（跨平台 agent 通信）

- **A2A（Agent-to-Agent）**：开放协议，跨网络/框架/厂商/语言委托工作。用 agent card 发现、JSON-RPC 调用。适合「把远程 agent 当子 agent 用」。
- **ACP**：另一种 agent 通信协议。

> 入门了解即可——跨组织的多 agent 协作才需要这些。同项目内用 subagents 就够。

---

## 概念辨析

**Q：Subagents 和 Workflow 都涉及「多个组件」，怎么选？**

任务边界清晰、顺序固定 → workflow；任务开放、需要 agent 自己判断派给谁 → subagents。工单场景常是「workflow 管主干 + 某一步用 subagent 做专业判断」的混合。

**Q：MCP 和普通 createTool() 工具有什么区别？**

普通工具是你写的函数；MCP 工具是外部服务通过标准协议暴露的。MCP 的价值是「一次接入、到处复用」——同一个 MCP server 能被任何支持 MCP 的框架调用。

**Q：Supervisor 和 Handoff 模式本质区别？**

Supervisor：父 agent 全程在岗，委托完还汇总结果（中心化）。Handoff：控制权彻底交给下一个专家，第一个 agent 不再管（接力棒）。前者适合「要统一汇总」，后者适合「下一个人直接接手」。

---

## 灵魂拷问

**Q1：为什么子 agent 的 description 这么关键？**

因为父 agent 是**靠读 description 判断「该委托给谁」**的。description 就是子 agent 给父 agent 的「能力名片」。写模糊了，父 agent 就会「委托错人」。这和工具 description 决定「何时调工具」是同一机制——**模型的决策质量，取决于你给它的描述质量**。

**Q2：什么时候该用 handoff 而不是 supervisor？**

当你希望「下一个专家**直接对用户**继续对话」，而不是「把结果汇报给中心再转发」。比如「售前 agent 聊完，把用户无缝交给售后 agent」——交接比汇总更自然。代价是上下文管理更复杂（要决定下一个 agent 继承什么）。

---

## 最佳实践

**✅ DO：**

- 子 agent 的 description 写清「能力 + 边界」。
- 用 delegation hooks 做权限控制和上下文约束。
- MCP server 凭证放环境变量。
- 能用一个 agent 就先用一个，别为了「多 agent」而多 agent。

**❌ DON'T：**

- 别让子 agent 数量爆炸——超过 4、5 个，父 agent 反而委托错。
- 别把敏感工具直接暴露给子 agent 不加管控——用 delegation 的 proceed: false 兜底。
- 别用 subagents 套「顺序固定」的流程——那是 workflow 的活。

---

## 代码实战：带子 agent 的工单客服

```typescript
import { Agent } from '@mastra/core/agent';
import { getOrder, checkLogistics } from '../tools/order';

const orderAgent = new Agent({
  id: 'order-agent',
  name: 'order-agent',
  description: '查询订单状态、物流信息的专家。',
  model: 'deepseek/deepseek-chat',
  tools: { getOrder, checkLogistics },
});

const toneAgent = new Agent({
  id: 'tone-agent',
  name: 'tone-agent',
  description: '把结论改写成温柔、安抚的客服话术。',
  model: 'deepseek/deepseek-chat',
});

const supportAgent = new Agent({
  id: 'support-supervisor',
  name: 'support-supervisor',
  instructions: '你是客服主管。用户问订单就委托 order-agent 查；回复前委托 tone-agent 润色。',
  model: 'deepseek/deepseek-chat',
  agents: { orderAgent, toneAgent },
});
```

---

## 实操练习（工单客服 Agent · 第 9 步）

**练习 1**：把客服拆成「查单 + 润色」两个子 agent，父 agent 协调。

**验收标准**：父 agent 能根据用户问题自动委托正确子 agent。

**练习 2**：加 delegation hook，退款任务改写 prompt 附加约束。

**验收标准**：委托时能看到 prompt 被改写。

**练习 3**：接一个 MCP server（如 wikipedia-mcp），把工具给 agent。

**验收标准**：agent 能调 MCP 工具并注明来源。

---

## 本章小结

- 多 agent 用 subagents：父 agent 按子 agent 的 description 自动委托。
- delegation hooks 提供拦截/改写/拒绝委托（权限、租户、上下文）。
- 三种模式：supervisor（中心协调）、handoff（接力交接）、workflow（代码定路径）。
- MCP：MCPClient 接入外部工具，MCPServer 反向暴露；A2A/ACP 跨平台通信。
- 选型：subagents 开放任务，workflow 确定流程。

下一章是最后一章：**部署与前端对接**——把工单客服从本地 demo 变成上线服务。
