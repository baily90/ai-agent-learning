# 第36章：多 Agent 与 MCP — 从单打独斗到团队协作

## 引言

第 15 章你手写过多 Agent 协作（规划师 → 执行者 → 评审），第 14 章你接过 MCP 协议做标准化工具接入。那两章的核心痛点你应该还记得：**多 agent 之间的「谁调谁、怎么传上下文、结果怎么汇总」全靠你手写**，MCP 的 client 也要手动配。

Mastra 把这两件事都收进了框架。这一章我们看看：多 Agent（subagents）和 MCP 在 Mastra 里的原生形态。

---

## 36.1 多 Agent：Subagents（子代理）

### 心智转变

第 15 章你手写多 agent，要自己写「路由逻辑」（哪个任务派给谁）。Mastra 的 subagents 思路是：**父 agent 自己决定什么时候委托给谁**——你只需要给每个子 agent 写清楚「它是干什么的」（description）。

### 前端类比

- 手写多 agent 路由 ≈ 手写一个 switch-case 分发器
- Mastra subagents ≈ 一个「懂业务的经理」+ 几个「专家」，经理自己判断该找谁

### 定义子 agent + 父 agent

```typescript
import { Agent } from '@mastra/core/agent';

// 子 agent 1：查事实
const researchAgent = new Agent({
  id: 'research-agent',
  description: '收集事实信息，返回要点摘要。',     // description 给父 agent 看
  model: 'deepseek/deepseek-chat',
});

// 子 agent 2：写回复
const writingAgent = new Agent({
  id: 'writing-agent',
  description: '把信息组织成条理清晰的客服回复。',
  model: 'deepseek/deepseek-chat',
});

// 父 agent：协调者（supervisor）
const supportAgent = new Agent({
  id: 'support',
  instructions: '你是客服主管。需要查事实就委托 research-agent，写回复就委托 writing-agent。',
  model: 'deepseek/deepseek-chat',
  agents: { researchAgent, writingAgent },   // 关键：挂上子 agent
});
```

调用：

```typescript
const stream = await supportAgent.stream('查一下我们退款政策，然后给我一段正式回复', {
  maxSteps: 10,
});
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

父 agent 会根据 instructions 和子 agent 的 description，自动判断「查政策 → 委托 research」→「写回复 → 委托 writing」→「汇总」。

---

## 36.2 委托控制：Delegation Hooks

父 agent 委托子 agent 时，你可以**拦截、改写、甚至拒绝**这次委托——这对企业场景（权限、租户隔离）很有用：

```typescript
const supportAgent = new Agent({
  id: 'support',
  model: 'deepseek/deepseek-chat',
  agents: { researchAgent },
  delegation: {
    onDelegationStart: async ({ subagent, prompt }) => {
      // 场景 1：拒绝委托（比如敏感任务不允许子 agent 碰）
      // return { proceed: false, rejectionReason: '该任务需要人工处理' };

      // 场景 2：改写发给子 agent 的 prompt
      return {
        proceed: true,
        modifiedPrompt: `${prompt}\n（注意：只查公开信息，不涉及用户隐私）`,
      };
    },
  },
});
```

常见模式：

- **权限控制**：`proceed: false` 拒绝不该委托的任务
- **上下文注入**：`modifiedPrompt` 给子 agent 附加约束
- **租户隔离**：`threadMetadata` 给子 agent 的 thread 打标签，方便过滤

---

## 36.3 MCP：标准化的工具接入

### 心智转变

第 14 章你学 MCP 时，要自己写 client、自己管连接。Mastra 用 `MCPClient` 把 MCP server 的工具**一键变成 agent 的工具**。

### 连接 MCP server

```bash
npm install @mastra/mcp
```

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
```

### 把 MCP 工具给 agent 用

```typescript
import { Agent } from '@mastra/core/agent';

const assistant = new Agent({
  id: 'assistant',
  name: 'Assistant',
  instructions: '用可用的 MCP 工具回答问题，并注明信息来源。',
  model: 'deepseek/deepseek-chat',
  tools: await mcpClient.getTools(),   // MCP 工具一键接入
});
```

> 这就是第 14 章「热插拔工具」的框架版——你不再手写 MCP client，Mastra 帮你把协议细节全处理了。

### 反向：把 Mastra 暴露成 MCP server

Mastra 还能用 `MCPServer` 把你的 agent/workflow/工具暴露给**其他系统**——比如让 Claude Desktop 或别的 agent 调用你的工单客服。

---

## 概念辨析：Subagents vs MCP vs Workflow

| 概念 | 解决什么 | 你第几章学过 |
|---|---|---|
| **Subagents** | 一个 agent 委托多个专家，自动路由 | 第 15 章多 agent |
| **MCP** | 标准化接入外部工具/数据 | 第 14 章 MCP 协议 |
| **Workflow** | 确定性多步流程 | 第 16 章 |

关键区分：**subagents 是「agent 自主决定委托」**（适合开放任务），**workflow 是「你预先定义好顺序」**（适合确定流程）。MCP 是「工具接入协议」，和谁调用无关。

---

## 灵魂拷问

**Q1：父 agent 是怎么「知道」该委托给哪个子 agent 的？**

靠两样东西：父 agent 的 **instructions**（描述协调策略）+ 每个子 agent 的 **description**（描述能力边界）。模型读这两者，自己决定委托谁。所以——**description 写得好不好，直接决定委托准不准**。这和第 7 章「工具 description 决定调用准不准」是同一个道理。

**Q2：subagents 和 workflow 都涉及「多个步骤/多个 agent」，怎么选？**

一句话：**任务边界清晰、顺序固定 → workflow；任务开放、需要 agent 自己判断派给谁 → subagents**。工单场景里，往往是「workflow 管主干流程 + 某一步里用 subagent 做专业判断」的混合。

**Q3：MCP 和普通 createTool() 工具有什么区别？**

普通工具是**你写的函数**；MCP 工具是**外部服务通过标准协议暴露的**。MCP 的价值在于「一次接入、到处复用」——同一个 MCP server（比如数据库查询），能被任何支持 MCP 的框架/产品调用。你第 14 章学的「标准化」思想，Mastra 帮你落地了。

---

## 最佳实践

**✅ DO：**

- 子 agent 的 `description` 写清「能力 + 边界」，父 agent 才能准确委托。
- 用 delegation hooks 做权限控制和上下文约束。
- MCP server 的凭证放环境变量，别硬编码。

**❌ DON'T：**

- 别让子 agent 数量爆炸——超过 4、5 个，父 agent 反而容易「委托错」。
- 别把敏感工具直接暴露给子 agent 不加管控——用 delegation 的 `proceed: false` 兜底。
- 别用 subagents 去套「顺序固定」的流程——那是 workflow 的活。

---

## 代码实战：一个带子 agent 的工单客服

```typescript
// 专业子 agent：查订单
const orderAgent = new Agent({
  id: 'order-agent',
  description: '查询订单状态、物流信息的专家。',
  model: 'deepseek/deepseek-chat',
  tools: { getOrder, checkLogistics },
});

// 专业子 agent：写安抚话术
const toneAgent = new Agent({
  id: 'tone-agent',
  description: '把结论改写成温柔、安抚的客服话术。',
  model: 'deepseek/deepseek-chat',
});

// 主管 agent
const supportAgent = new Agent({
  id: 'support-supervisor',
  instructions: '你是客服主管。用户问订单就委托 order-agent 查；回复前委托 tone-agent 润色语气。',
  model: 'deepseek/deepseek-chat',
  agents: { orderAgent, toneAgent },
});
```

---

## 实操练习（工单客服 Agent · 第 6 步）

**练习 1**：把客服 agent 拆成「查单子 agent + 润色子 agent」，用父 agent 协调。

**验收标准**：父 agent 能根据用户问题自动委托正确的子 agent。

**练习 2**：加一个 delegation hook，当子 agent 要处理「退款」时改写 prompt 附加约束。

**验收标准**：委托时能看到 prompt 被改写。

**练习 3（进阶）**：接一个 MCP server（如 wikipedia-mcp），把它的工具给 agent 用。

**验收标准**：agent 能调用 MCP 工具回答问题并注明来源。

---

## 本章小结

- 多 agent 用 **subagents**：父 agent（supervisor）根据子 agent 的 description 自动委托。
- **delegation hooks** 提供拦截/改写/拒绝委托的能力（权限、租户、上下文控制）。
- MCP 用 `MCPClient` 一键接入外部工具，`MCPServer` 反向暴露 Mastra 能力。
- 选型：**subagents 处理开放任务，workflow 处理确定流程**。

下一章是最后一篇：**部署与前端对接**——把工单客服从「本地 demo」变成「能上线、前端能调的服务」。
