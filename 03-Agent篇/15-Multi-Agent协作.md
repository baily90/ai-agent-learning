# 第15章：Multi-Agent 协作 — 一个人干不完，那就组个团队

## 引言

上一章我们学了 MCP 协议，让 Agent 可以通过标准化方式接入各种工具。但到目前为止，我们的系统里始终只有**一个 Agent**在单打独斗——它要理解用户意图、规划任务、调用工具、生成回复，所有事情一肩扛。

这像什么？像一个全栈工程师独自开发一个复杂项目。小项目没问题，但当项目变大——前端要写 React，后端要搞数据库优化，还得配 CI/CD 和 K8s——一个人再厉害也扛不住。

现实中我们怎么做？**组团队**。前端工程师专注 UI，后端工程师搞 API，DevOps 负责部署。每个人在自己的领域更专业、更高效。

Multi-Agent 系统就是这个思路：**与其让一个 Agent 什么都做但什么都不够好，不如让多个专业 Agent 各司其职，协同完成复杂任务**。

本章我们将深入探讨：为什么需要多 Agent？有哪些协作模式？Agent 之间怎么通信？以及如何在实际项目中落地多 Agent 架构。

---

## 15.1 为什么需要多个 Agent

### 一句话直觉

一个通才 Agent 什么都能做但什么都不精，多个专业 Agent 各司其职效果更好。

### 前端类比

想象一个全栈工程师同时负责：React 前端、Node.js 后端、PostgreSQL 数据库、AWS 部署、UI 设计。他每件事都能做，但每件事都做得一般。

现在换成一个专业团队：前端工程师把 UI 做到极致，后端工程师把 API 优化到毫秒级，DBA 把查询调到最优。**分工带来的不是简单的 1+1=2，而是专业化带来的质量飞跃**。

### 详细原理

单个 Agent 面临几个核心瓶颈：

**1. System Prompt 的"人设冲突"**

一个 Agent 的 System Prompt 要同时定义它是"客服专家""技术顾问""数据分析师"，这些角色可能有矛盾的行为准则。客服要热情友好、尽量满足用户，但风控分析要冷静客观、严格审查。一个 System Prompt 很难同时表达这两种"人格"。

这就像一个 React 组件既要当 Modal 又要当 Table 还要当 Form，props 一大堆，逻辑全耦合在一起——**God Component 反模式**。

**2. 工具集的膨胀**

单 Agent 要调用所有工具。当工具数量从 5 个涨到 50 个，模型选择正确工具的准确率会明显下降。而且每次调用都要把所有工具的描述发给模型，浪费 Token。

这就像一个 `utils.ts` 文件有 200 个函数，什么 `formatDate`、`validateEmail`、`calculateTax`、`sendNotification` 全在里面。你找一个函数要翻半天，IDE 的自动补全也会变得很慢。

**3. 上下文窗口的争抢**

一个 Agent 处理所有事情，意味着所有相关信息都要塞进同一个上下文窗口。客户的对话历史、数据库查询结果、文档检索内容、工具调用结果……很快就会撞到上下文长度限制。

**4. 错误的"传染"**

单 Agent 如果在某个环节出错（比如检索了错误的文档），这个错误会影响后续所有决策。而多 Agent 系统中，一个 Agent 的错误可以被另一个 Agent 发现和纠正。

### 深层追问：什么时候该拆？

不是所有场景都需要多 Agent。关键判断标准：

- **任务复杂度**：如果任务可以用一个清晰的 System Prompt + 几个工具搞定，单 Agent 就够了
- **专业度要求**：不同子任务需要截然不同的领域知识和行为模式
- **工具集重叠度**：如果不同子任务需要的工具几乎不重叠，说明它们天然适合拆分
- **可靠性要求**：关键决策需要"第二意见"来交叉验证

**经验法则**：先用单 Agent 跑通，当你发现 System Prompt 变得臃肿、工具选择频繁出错、或者某个领域的回答质量明显不够时，再考虑拆分。这和微服务的演进路径一模一样——**先单体，再拆分**。

---

## 15.2 Multi-Agent 的核心架构模式

这是本章最重要的部分。四种模式各有适用场景，选错了模式比不用多 Agent 还糟糕。

### 模式一：Orchestrator（编排者）模式

**一句话直觉**：一个"经理"Agent 指挥多个"员工"Agent，经理决定把任务分配给谁。

**前端类比**：项目经理收到一个需求，拆解后分别交给前端工程师、后端工程师、设计师去完成，最后汇总结果。或者更技术化的类比——**一个父组件管理多个子组件的状态，根据条件渲染不同的子组件**。

```
用户请求 → Orchestrator Agent → 分析任务 → 选择合适的 Agent
                                    ├→ Agent A（客服）→ 结果
                                    ├→ Agent B（技术）→ 结果
                                    └→ Agent C（数据）→ 结果
                                  ← 汇总结果 → 返回用户
```

**适用场景**：客服系统（根据问题类型分配到不同专业 Agent）、复杂的多步骤任务（经理负责分解和协调）。

**优点**：
- 清晰的控制层级，便于监控和调试
- 经理 Agent 可以做全局优化（比如避免重复工作）
- 容易添加新的专业 Agent

**缺点**：
- 经理 Agent 是单点故障——它判断错了，整个系统就错了
- 经理 Agent 的协调能力取决于模型能力
- 多了一跳的延迟和 Token 消耗

### 模式二：Pipeline（流水线）模式

**一句话直觉**：Agent A 的输出是 Agent B 的输入，像工厂流水线一样串行处理。

**前端类比**：Unix 管道 `cat file | grep error | sort | uniq -c`，每个命令处理上一个命令的输出。或者 Express 中间件链：`app.use(auth).use(validate).use(handle).use(respond)`。

```
用户输入 → Agent A（理解意图）→ Agent B（检索信息）→ Agent C（生成回复）→ Agent D（审核质量）→ 最终输出
```

**适用场景**：
- 内容创作：调研 → 写作 → 审核 → 润色
- 数据处理：提取 → 清洗 → 分析 → 可视化
- 代码生成：需求分析 → 架构设计 → 编码 → 测试

**优点**：
- 流程清晰，每个 Agent 的职责单一
- 容易测试（可以单独测试每个环节）
- 可以为不同环节使用不同的模型（耗时但不需要高智能的步骤用便宜模型）

**缺点**：
- 串行执行，总延迟是所有环节之和
- 前面的错误会累积（**垃圾进，垃圾出**）
- 不灵活，遇到异常很难"跳回"前面的步骤

### 模式三：Debate（辩论）模式

**一句话直觉**：多个 Agent 对同一问题给出不同意见，通过"辩论"得出更好的答案。

**前端类比**：Code Review。一段代码由三个开发者分别审查，一个关注性能，一个关注安全，一个关注可维护性。最终综合三个人的意见做出修改决定。

```
                    ┌→ Agent A（乐观派）→ 意见 A ─┐
用户问题 ──→ 同时分发 ├→ Agent B（谨慎派）→ 意见 B ──├→ 仲裁 Agent → 综合结论
                    └→ Agent C（创新派）→ 意见 C ─┘
```

**适用场景**：
- 风险评估（需要多角度分析）
- 创意生成（不同风格的方案对比）
- 重要决策（投资建议、医疗诊断辅助）
- 内容审核（多个审核维度）

**优点**：
- 结果质量更高（多角度综合）
- 能有效减少单一视角的偏见
- 天然适合并行执行

**缺点**：
- Token 消耗成倍增长（同一问题要处理多次）
- 仲裁逻辑本身也可能出错
- 对于有明确答案的问题，辩论是浪费

### 模式四：Swarm（群体）模式

**一句话直觉**：Agent 之间对等协作，没有中心控制者，通过规则和通信自组织。

**前端类比**：微服务架构。没有一个"总控服务"，每个服务自己知道该做什么，服务之间通过消息队列（Kafka/RabbitMQ）通信。或者想想 React 的事件冒泡——没有一个全局控制器，每个组件自己决定怎么响应事件。

```
Agent A ←──消息──→ Agent B
  ↕                  ↕
Agent C ←──消息──→ Agent D
```

**适用场景**：
- 大规模信息搜集（每个 Agent 负责一个信息源）
- 分布式任务处理（任务量大，需要水平扩展）
- 模拟场景（多个 Agent 扮演不同角色进行模拟）

**优点**：
- 高度可扩展
- 没有单点故障
- 能涌现出个体无法产生的"集体智能"

**缺点**：
- 最难调试和控制
- 可能陷入无限循环或震荡
- 结果不确定性最高

### 模式选择指南

```
你的任务需要...
├── 一个"大脑"统筹全局？            → Orchestrator 模式
├── 多个步骤依次处理？               → Pipeline 模式
├── 多角度分析同一问题？             → Debate 模式
└── 大量对等 Agent 自由协作？         → Swarm 模式
```

实际项目中，这些模式经常混合使用。比如一个客服系统：整体是 Orchestrator 模式（经理分配任务），但"内容生成"环节内部是 Pipeline 模式（起草 → 审核 → 润色），而"风险评估"环节用 Debate 模式（多角度审查）。

---

## 15.3 Agent 间的通信机制

多个 Agent 要协作，就必须能交换信息。这就像前端工程师和后端工程师要协作，需要定义 API 接口一样。

### 共享上下文（Shared Context）

**一句话**：所有 Agent 看到相同的消息历史，就像一个群聊。

**前端类比**：React Context 或 Redux Store。所有组件共享同一份全局状态，谁都能读，谁都能写。

```typescript
// 概念示意
const sharedContext = {
  messages: [...],      // 完整的对话历史
  taskState: {...},     // 当前任务状态
  intermediateResults: {...}  // 中间结果
};

// 每个 Agent 都能读写这个 context
agentA.run(sharedContext);
agentB.run(sharedContext);
```

**优点**：实现简单，信息完全透明。

**缺点**：随着对话增长，上下文越来越大，Token 消耗高。而且所有 Agent 看到所有信息，可能造成"信息过载"——Agent 被不相关的信息干扰。

**适用**：Agent 数量少（2-3 个），任务关联性强。

### 消息传递（Message Passing）

**一句话**：Agent 之间直接发消息，像同事之间发 Slack 消息。

**前端类比**：React 的 props 传递或者组件间的 callback 通信。父组件把数据通过 props 传给子组件，子组件通过 callback 把结果传回来。

```typescript
// 概念示意
const resultA = await agentA.run({
  task: "分析用户的问题类型",
  input: userMessage
});

const resultB = await agentB.run({
  task: "根据问题类型生成回复",
  input: resultA.output,         // A 的输出作为 B 的输入
  context: resultA.metadata      // 附带 A 的元数据
});
```

**优点**：精确控制每个 Agent 接收什么信息，避免信息过载。

**缺点**：需要精心设计消息格式和协议。

**适用**：Pipeline 模式，Agent 之间有明确的上下游关系。

### 黑板模式（Blackboard）

**一句话**：共享一个"白板"，Agent 在上面读写信息，每个 Agent 只关注自己感兴趣的部分。

**前端类比**：一个共享的数据库或状态管理系统。不同的模块往里面写数据，也从里面读数据，但每个模块只关心自己那部分。类似 Redux 的分片 store，每个 reducer 只处理自己那个 slice。

```typescript
// 概念示意
const blackboard = {
  userIntent: null,          // 意图分析 Agent 写入
  retrievedDocs: null,       // 检索 Agent 写入
  draftResponse: null,       // 生成 Agent 写入
  qualityScore: null,        // 审核 Agent 写入
  finalResponse: null        // 最终结果
};

// 每个 Agent 读取自己需要的字段，写入自己负责的字段
intentAgent.run(blackboard);    // 读 userMessage，写 userIntent
searchAgent.run(blackboard);    // 读 userIntent，写 retrievedDocs
generateAgent.run(blackboard);  // 读 retrievedDocs，写 draftResponse
reviewAgent.run(blackboard);    // 读 draftResponse，写 qualityScore
```

**优点**：灵活，Agent 之间解耦。新增 Agent 只需要知道黑板上有什么字段。

**缺点**：需要管理并发读写，可能有竞态条件。

**适用**：多个 Agent 需要协作但不需要严格的执行顺序。

### 事件驱动（Event-Driven）

**一句话**：发布/订阅模式，Agent 发布事件，其他 Agent 订阅感兴趣的事件。

**前端类比**：浏览器的 EventEmitter 或者 Node.js 的事件系统。一个组件 dispatch 一个事件，其他订阅了这个事件的组件自动响应。

```typescript
// 概念示意
const eventBus = new EventEmitter();

// 意图分析 Agent 完成后发布事件
intentAgent.on('complete', (result) => {
  eventBus.emit('intent-analyzed', result);
});

// 检索 Agent 订阅意图分析事件
eventBus.on('intent-analyzed', (intent) => {
  searchAgent.run(intent);
});

// 生成 Agent 订阅检索完成事件
eventBus.on('docs-retrieved', (docs) => {
  generateAgent.run(docs);
});
```

**优点**：高度解耦，天然支持异步和并行。

**缺点**：调试困难（事件流不直观），容易形成"事件风暴"。

**适用**：Swarm 模式，大规模 Agent 系统。

### 通信机制选择

| 场景 | 推荐机制 |
|------|----------|
| 2-3 个 Agent 简单协作 | 共享上下文 |
| Pipeline 流水线 | 消息传递 |
| 灵活的多 Agent 协作 | 黑板模式 |
| 大规模分布式 Agent | 事件驱动 |

---

## 15.4 角色设计：给每个 Agent 一个清晰的"人设"

多 Agent 系统的关键不在于 Agent 的数量，而在于**每个 Agent 的角色是否定义清晰**。

### System Prompt 的差异化

每个 Agent 的 System Prompt 应该明确三件事：
1. **你是谁**：专业领域和能力范围
2. **你该做什么**：核心职责
3. **你不该做什么**：能力边界

```typescript
// 客服分诊 Agent
const triageAgent = {
  systemPrompt: `你是一个客服分诊专家。你的职责是：
    1. 分析用户问题的类型（退款/技术支持/投诉/咨询）
    2. 判断问题的紧急程度（高/中/低）
    3. 提取关键信息（订单号、产品名等）
    
    你不需要解决用户的问题，只需要准确分类。
    如果用户的问题涉及多个类型，选择最主要的那个。`,
  tools: [classifyTool, extractInfoTool]
};

// 退款处理 Agent
const refundAgent = {
  systemPrompt: `你是一个退款处理专家。你的职责是：
    1. 查询订单信息
    2. 判断是否符合退款条件
    3. 执行退款或解释拒绝原因
    
    你只处理退款相关问题。如果用户问了其他问题，
    礼貌告知并建议重新咨询。
    退款金额超过 500 元需要标记为"需人工审批"。`,
  tools: [queryOrderTool, checkRefundPolicyTool, processRefundTool]
};
```

注意两点：
- **工具分配不同**：分诊 Agent 有分类工具，退款 Agent 有订单查询和退款工具。每个 Agent 只拥有自己需要的工具，这样模型选择工具时更准确。
- **明确边界**：退款 Agent 知道自己"只处理退款"，遇到其他问题不会越界。

### 角色设计原则

**1. 单一职责**

每个 Agent 只做一件事，做到极致。这和 React 组件的设计原则完全一致——一个组件只负责一个功能。

**2. 明确的输入输出契约**

每个 Agent 应该有清晰的"接口定义"——接收什么格式的输入，返回什么格式的输出。这就像 TypeScript 的 interface 定义：

```typescript
interface TriageResult {
  category: 'refund' | 'tech-support' | 'complaint' | 'inquiry';
  urgency: 'high' | 'medium' | 'low';
  extractedInfo: {
    orderId?: string;
    productName?: string;
    issueDescription: string;
  };
}
```

**3. 最小权限原则**

每个 Agent 只拥有完成自己任务所需的最少工具和权限。退款 Agent 不应该有修改用户密码的工具，技术支持 Agent 不应该有退款权限。这是安全的基本要求。

---

## 15.5 任务路由：用户的请求该交给谁？

在 Orchestrator 模式中，最关键的问题是：**用户说了一句话，经理 Agent 怎么决定交给哪个员工 Agent？**

### 路由策略

**1. LLM 路由（智能路由）**

让经理 Agent（LLM）自己判断应该交给谁。最灵活，但也最不确定。

```typescript
const routerPrompt = `你是一个任务路由器。根据用户的问题，选择最合适的处理 Agent：
- refund_agent: 处理退款、退货、换货
- tech_agent: 处理技术问题、使用指南、Bug 反馈
- complaint_agent: 处理投诉、不满、差评
- general_agent: 处理其他一般性咨询

只返回 agent 名称，不要解释。`;
```

**2. 关键词/规则路由（确定性路由）**

用传统的 if-else 或正则匹配做第一层路由，简单场景不需要浪费 LLM 调用。

```typescript
function routeByKeywords(message: string): string {
  if (/退款|退货|换货|退钱/.test(message)) return 'refund_agent';
  if (/报错|bug|无法|打不开|崩溃/.test(message)) return 'tech_agent';
  if (/投诉|差评|不满|举报/.test(message)) return 'complaint_agent';
  return 'general_agent';
}
```

**3. Embedding 路由（语义路由）**

用 Embedding 相似度匹配，平衡灵活性和确定性。事先为每个 Agent 准备一些"典型问题"的 Embedding，新问题来了就算相似度，选最近的。

**4. 混合路由**

实际项目中最常见的做法：**先用规则路由处理明确的场景，规则匹配不上的再用 LLM 路由**。这样既保证了确定性场景的准确率，又兼顾了模糊场景的灵活性。

```typescript
function hybridRoute(message: string): string {
  // 第一层：规则路由（快速、确定）
  const ruleResult = routeByKeywords(message);
  if (ruleResult !== 'general_agent') return ruleResult;
  
  // 第二层：LLM 路由（灵活、智能）
  return await llmRoute(message);
}
```

这个模式在前端很常见——先用 `switch-case` 处理已知路由，最后用通配符 `*` 兜底。

---

## 15.6 A2A（Agent-to-Agent）协议

### MCP 的局限

前一章我们学了 MCP（Model Context Protocol），它解决的是 **Agent 到 Tool 的通信**问题——标准化了 Agent 如何发现和调用工具。但 MCP 没有解决一个问题：**Agent 和 Agent 之间怎么通信？**

如果 Agent A 想请 Agent B 帮忙，用 MCP 的话，Agent B 要被包装成一个"工具"。但 Agent 和工具有本质区别：工具是被动的（你调用它它就执行），Agent 是主动的（它有自己的判断和决策能力）。把 Agent 降格为工具，丢失了 Agent 的核心价值。

### Google 的 A2A 协议

2025 年 4 月，Google 提出了 A2A（Agent-to-Agent）协议，专门解决 Agent 间的通信问题。

**核心思想**：

- **Agent Card**：每个 Agent 发布一个"名片"（类似 MCP 的工具描述），描述自己能做什么、接受什么输入
- **Task**：A2A 的核心通信单元。一个 Agent 给另一个 Agent 发送一个 Task，对方处理后返回结果
- **Streaming**：支持长时间任务的流式更新
- **Push Notification**：任务完成后主动通知

**前端类比**：如果说 MCP 像 REST API（客户端调用服务端），那 A2A 更像 WebSocket 或 gRPC——双向的、流式的、有状态的通信。

### MCP 和 A2A 的关系

它们不是竞争关系，而是互补的：

```
用户 ←→ Agent A ←—A2A—→ Agent B
              ↓                ↓
           MCP: 调用工具 X   MCP: 调用工具 Y
```

- **MCP**：Agent 和 Tool 之间的通信标准（垂直方向）
- **A2A**：Agent 和 Agent 之间的通信标准（水平方向）

目前 A2A 还在早期阶段，生态远不如 MCP 成熟。但它代表了一个重要方向：**当不同公司、不同平台的 Agent 需要互相协作时，需要一个标准协议**。就像不同微服务之间需要统一的 API 规范一样。

---

## 15.7 实际案例

### 案例一：智能客服系统

```
用户: "我上周买的耳机有杂音，想退款"

→ 分诊 Agent：
  类型=退款+技术问题，紧急度=中，提取：产品=耳机，时间=上周
  决策：先交给技术 Agent 确认问题，再交给退款 Agent 处理

→ 技术 Agent：
  "耳机杂音可能的原因有...您可以先尝试...如果仍有问题确认是硬件故障"
  结论：需要退款处理

→ 退款 Agent：
  查询订单 → 在退款期内 → 符合退款条件 → 发起退款
  "已为您发起退款，预计 3-5 个工作日到账"

→ 分诊 Agent 汇总：
  "您的耳机杂音确认为硬件问题，已为您发起退款..."
```

这就是 Orchestrator + Pipeline 的混合模式：分诊 Agent 是编排者，技术和退款 Agent 串行处理。

### 案例二：内容创作流水线

```
用户: "帮我写一篇关于 React Server Components 的技术博客"

→ 调研 Agent（Pipeline 第1步）：
  - 搜索最新的 RSC 资料
  - 整理核心概念和最新进展
  - 输出：结构化的调研报告

→ 写作 Agent（Pipeline 第2步）：
  - 基于调研报告撰写初稿
  - 加入代码示例
  - 输出：博客初稿

→ 审核 Agent（Pipeline 第3步）：
  - 检查技术准确性
  - 检查行文流畅度
  - 输出：审核意见和修改建议

→ 写作 Agent（Pipeline 第4步，可选循环）：
  - 根据审核意见修改
  - 输出：终稿
```

纯 Pipeline 模式，每个 Agent 专注自己的环节。

### 案例三：代码开发团队

```
用户: "帮我实现一个用户注册功能"

→ 架构 Agent：
  "建议采用以下结构..."
  - API Route: /api/auth/register
  - 数据模型: User { email, passwordHash, ... }
  - 验证逻辑: email 格式、密码强度

→ 编码 Agent：
  基于架构方案生成代码
  
→ 测试 Agent：
  生成测试用例，运行测试

→ Review Agent（Debate 模式）：
  - 安全 Review Agent: "密码存储应使用 bcrypt..."
  - 性能 Review Agent: "建议给 email 字段加唯一索引..."
  - 代码质量 Review Agent: "这个函数太长了，建议拆分..."
```

这里 Review 环节用了 Debate 模式——多个 Agent 从不同角度审查。

---

## 概念辨析

### Multi-Agent vs 一个 Agent 多个 Tool

| 维度 | 一个 Agent + 多 Tool | Multi-Agent |
|------|---------------------|-------------|
| 决策者 | 一个 LLM | 多个 LLM |
| System Prompt | 一个（通用） | 多个（专业） |
| 工具集 | 共享所有工具 | 每个 Agent 有专属工具 |
| 上下文 | 全部在一个窗口 | 可以分散到不同窗口 |
| 成本 | 低（一次 LLM 调用） | 高（多次 LLM 调用） |
| 适用 | 简单任务 | 复杂专业任务 |

**关键判断**：如果不同的子任务需要不同的"人格"（System Prompt）和不同的工具集，那就该拆成多个 Agent。如果只是功能多，但"人格"一致，多加几个 Tool 就行了。

### Orchestrator vs Workflow

Orchestrator 是一种 Agent 模式——由 LLM 动态决定任务分配。Workflow 是确定性的流程编排——由代码预定义每一步做什么。下一章会详细讨论这个区别。

---

## 灵魂拷问

> **Q: 多 Agent 和"一个 Agent 多个 Tool"有什么本质区别？什么时候该拆成多个 Agent？**

> A: 本质区别在于**决策主体**。一个 Agent 多个 Tool 是"一个大脑指挥多只手"，所有决策由同一个 LLM 做出，工具只是被动执行。Multi-Agent 是"多个大脑协作"，每个 Agent 有自己的判断力和专业知识。
>
> 该拆的信号：（1）System Prompt 超过 2000 字还在膨胀；（2）工具超过 15 个，模型经常选错；（3）不同子任务需要截然不同的行为模式（客服 vs 风控）；（4）某个领域的回答质量明显不够好。
>
> 不该拆的信号：任务简单，一个 Prompt 能搞定；工具之间关联性强，拆了反而需要频繁通信。
>
> 这和微服务的决策一模一样——**不要为了拆而拆，拆分的成本（通信、一致性、部署）必须小于收益（专业化、可维护性）**。

> **Q: Orchestrator 模式的"经理 Agent"自己也是 LLM，它的管理能力可靠吗？**

> A: 这是个好问题，答案是"有限可靠"。经理 Agent 的两个核心能力：任务理解和任务分配。对于明确的任务分类（退款/技术/投诉），准确率可以到 95%+；但对于模糊的、跨领域的任务，就没那么靠谱了。
>
> 实际中怎么办？**不要把所有压力都给经理 Agent**。用混合路由——简单的用规则路由（100% 准确），复杂的才让 LLM 判断。另外，给经理 Agent 一个"兜底策略"：判断不了的交给通用 Agent，或者直接转人工。
>
> 更进一步，可以让经理 Agent 的决策变得"可检查"——输出结构化的路由理由，后续可以人工审核和优化路由规则。这就像一个项目经理的分配决策要在项目管理工具里有记录，方便复盘。

> **Q: Agent 之间的通信消耗 Token，多 Agent 的成本是不是成倍增长？怎么控制？**

> A: 是的，Token 消耗一定会增加，但不一定是"成倍"。控制方法有：
>
> （1）**精简传递的信息**。Agent A 不需要把完整上下文传给 Agent B，只传必要信息。这就像 API 设计——不要返回整张表的数据，只返回需要的字段。
>
> （2）**不同 Agent 用不同模型**。编排者用聪明但贵的模型（如 Claude Opus），执行者用便宜的模型（如 Claude Haiku）。翻译、摘要这类不需要高推理能力的任务，小模型足够了。
>
> （3）**缓存中间结果**。如果同类问题的处理路径相似，可以缓存路由决策和中间结果。
>
> （4）**避免不必要的 Agent 通信**。如果分诊 Agent 能确定问题类型，就不需要再让分析 Agent"确认一下"。
>
> 最重要的是**权衡**：多 Agent 多花的钱，换来了更好的回答质量和更高的可靠性。如果答案质量从 70 分提升到 95 分，多花 3 倍 Token 可能完全值得。

> **Q: 如果两个 Agent 给出矛盾的建议，"经理 Agent"怎么仲裁？**

> A: 几种策略：
>
> （1）**基于置信度**。让每个 Agent 输出时附带置信度评分，选置信度高的。
>
> （2）**基于角色权重**。安全相关的问题，安全 Agent 的意见权重更高；性能相关的问题，性能 Agent 优先。这需要在经理 Agent 的 System Prompt 里定义优先级规则。
>
> （3）**追问澄清**。经理 Agent 把矛盾反馈给两个 Agent，让他们针对分歧点给出更多论据，再做判断。这就像两个开发者在 Code Review 里意见不同，让他们互相 comment 讨论。
>
> （4）**兜底人工**。如果 Agent 之间矛盾严重且无法自动仲裁，标记为"需人工决策"。别忘了，Agent 是辅助人类的，不是替代人类的。

> **Q: MCP 解决的是 Agent-to-Tool 的通信，A2A 解决的是 Agent-to-Agent 的通信。它们会融合吗？**

> A: 短期不会融合，因为解决的问题不同——Tool 是被动的、确定性的，Agent 是主动的、非确定性的。但长期可能会有更上层的统一协议把两者包含进来。
>
> 一种可能的演进：Agent 通过 A2A 发现和协作，通过 MCP 调用工具。就像浏览器用 HTTP 和服务器通信（A2A），但具体的数据操作通过数据库协议完成（MCP）。
>
> 也有一种"务实"的路径：把 Agent 封装为 MCP Tool。虽然丢失了 Agent 的一些特性（如流式交互、主动通知），但对于简单场景足够了。很多团队目前就是这么做的。

> **Q: 多 Agent 系统的调试难度呈指数增长，怎么定位"是哪个 Agent 出了问题"？**

> A: 这确实是多 Agent 系统最大的痛点。解决方案：
>
> （1）**全链路追踪（Tracing）**。给每个请求分配唯一 ID，记录它经过了哪些 Agent、每个 Agent 的输入输出是什么、耗时多少。这和微服务的分布式追踪（Jaeger/Zipkin）思路一样。
>
> （2）**结构化日志**。每个 Agent 的决策过程要有日志：收到了什么输入、做了什么判断、选择了什么工具、输出了什么结果。
>
> （3）**单元测试每个 Agent**。多 Agent 系统的优势之一就是可以单独测试每个 Agent。固定输入看输出对不对，和测试 React 组件一样。
>
> （4）**回放机制**。记录完整的 Agent 交互日志，出问题时可以回放重现。
>
> （5）**降级策略**。怀疑某个 Agent 出问题时，临时绕过它或者替换成一个简单的规则逻辑，看问题是否消失。这和排查微服务故障的"灰度切流"思路类似。

---

## 最佳实践

### DO

- **从单 Agent 开始，确认瓶颈后再拆分**。过早拆分是万恶之源，和过早优化一样
- **给每个 Agent 清晰的角色定义**，包括"你不该做什么"
- **为不同 Agent 分配不同的工具集**，遵循最小权限原则
- **使用混合路由策略**——规则路由处理确定场景，LLM 路由兜底模糊场景
- **为每个 Agent 的输入输出定义 TypeScript 接口**，让类型系统帮你检查
- **实现全链路追踪**，否则出了问题你根本不知道哪里错了
- **让不同 Agent 使用不同的模型**，根据任务复杂度选择性价比最优的

### DON'T

- **不要为了"多 Agent"而多 Agent**。三个 Agent 互相转来转去，还不如一个 Agent 直接搞定
- **不要让 Agent 之间传递完整的上下文**。精简信息，只传必要的内容
- **不要忽视经理 Agent 的可靠性**。它是整个系统的瓶颈，要重点测试
- **不要跳过单元测试**。先确保每个 Agent 单独工作正常，再测试协作
- **不要期望 Agent 能完美仲裁矛盾**。设计好人工兜底的机制
- **不要在 Agent 之间建立环形依赖**。A 调 B、B 调 A 很容易造成无限循环

---

## 代码实战

我们用 Vercel AI SDK 实现一个简单的 Multi-Agent 客服系统：一个 Orchestrator Agent 指挥三个专业 Agent。

### 定义专业 Agent

```typescript
// agents/types.ts
import { ModelMessage } from 'ai';

// 每个 Agent 的标准接口——输入输出都有类型约束
interface AgentConfig {
  name: string;
  systemPrompt: string;
  tools?: Record<string, any>;
}

interface AgentResult {
  agent: string;
  response: string;
  metadata?: Record<string, any>;
}
```

```typescript
// agents/specialist-agents.ts
import { deepseek } from '@ai-sdk/deepseek';
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';

// 退款处理 Agent
async function refundAgent(input: string, context?: Record<string, any>): Promise<AgentResult> {
  const { text } = await generateText({
    // 执行型 Agent 用性价比高的小模型
    model: deepseek('deepseek-chat'),
    instructions: `你是一个退款处理专家。你的职责是：
      1. 查询订单信息
      2. 判断是否符合退款条件（7天无理由，商品未损坏）
      3. 给出退款处理建议
      
      你只处理退款相关问题。对于其他问题，回复"这不在我的处理范围内"。
      保持专业、简洁，用结构化的方式输出。`,
    tools: {
      queryOrder: tool({
        description: '查询订单信息',
        inputSchema: z.object({
          orderId: z.string().describe('订单号'),
        }),
        execute: async ({ orderId }) => {
          // 实际项目中这里查数据库
          return {
            orderId,
            product: '无线耳机 Pro',
            amount: 299,
            date: '2025-05-07',
            status: 'delivered',
          };
        },
      }),
      checkRefundPolicy: tool({
        description: '检查退款政策',
        inputSchema: z.object({
          orderId: z.string(),
          reason: z.string(),
        }),
        execute: async ({ orderId, reason }) => {
          return {
            eligible: true,
            policy: '7天无理由退款',
            note: '商品需保持完好',
          };
        },
      }),
    },
    stopWhen: isStepCount(5),
    prompt: input,
  });

  return { agent: 'refund', response: text };
}

// 技术支持 Agent
async function techAgent(input: string, context?: Record<string, any>): Promise<AgentResult> {
  const { text } = await generateText({
    model: deepseek('deepseek-chat'),
    instructions: `你是一个技术支持专家。你的职责是：
      1. 诊断用户遇到的技术问题
      2. 提供分步解决方案
      3. 如果无法远程解决，建议送修
      
      你只处理产品使用和技术相关问题。
      用简单易懂的语言，避免专业术语。`,
    tools: {
      searchKnowledgeBase: tool({
        description: '搜索技术知识库',
        inputSchema: z.object({
          query: z.string().describe('搜索关键词'),
        }),
        execute: async ({ query }) => {
          return {
            solutions: [
              '检查蓝牙连接是否正常',
              '重置耳机：长按电源键 10 秒',
              '更新手机蓝牙驱动',
            ],
          };
        },
      }),
    },
    stopWhen: isStepCount(5),
    prompt: input,
  });

  return { agent: 'tech', response: text };
}

// 通用咨询 Agent
async function generalAgent(input: string, context?: Record<string, any>): Promise<AgentResult> {
  const { text } = await generateText({
    model: deepseek('deepseek-chat'),
    instructions: `你是一个友好的客服助手。处理一般性咨询，包括：
      - 产品介绍和推荐
      - 物流查询
      - 会员权益说明
      
      保持热情友好的态度。如果问题超出你的能力范围，
      建议用户拨打人工客服热线。`,
    stopWhen: isStepCount(3),
    prompt: input,
  });

  return { agent: 'general', response: text };
}

export { refundAgent, techAgent, generalAgent };
```

### 实现 Orchestrator Agent

```typescript
// agents/orchestrator.ts
import { deepseek } from '@ai-sdk/deepseek';
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { refundAgent, techAgent, generalAgent } from './specialist-agents';

// Agent 注册表——方便扩展新 Agent
const agentRegistry: Record<string, (input: string, context?: any) => Promise<AgentResult>> = {
  refund: refundAgent,
  tech: techAgent,
  general: generalAgent,
};

async function orchestrate(userMessage: string): Promise<string> {
  // 第一步：经理 Agent 分析用户意图并路由
  // 注意这里用更强的模型，因为路由决策很关键
  const { text: routingDecision } = await generateText({
    model: deepseek('deepseek-chat'),
    instructions: `你是一个客服团队的经理。你的职责是分析用户问题并分配给合适的专家处理。

可用的专家团队：
- refund: 退款退货处理专家
- tech: 技术支持专家
- general: 通用咨询专家

分析用户问题后，按以下 JSON 格式输出（不要输出其他内容）：
{
  "agent": "选择的专家名称",
  "reason": "选择原因（一句话）",
  "refinedQuery": "为专家优化后的问题描述"
}`,
    prompt: userMessage,
  });

  // 解析路由决策
  let routing;
  try {
    routing = JSON.parse(routingDecision);
  } catch {
    // JSON 解析失败，兜底到通用 Agent
    routing = {
      agent: 'general',
      reason: '路由解析失败，使用通用处理',
      refinedQuery: userMessage,
    };
  }

  console.log(`[路由决策] Agent: ${routing.agent}, 原因: ${routing.reason}`);

  // 第二步：分发给对应的专业 Agent
  const handler = agentRegistry[routing.agent] || agentRegistry.general;
  const result = await handler(routing.refinedQuery);

  console.log(`[Agent 响应] ${result.agent}: ${result.response.substring(0, 100)}...`);

  // 第三步：经理 Agent 审核和润色最终回复（可选）
  // 简单场景可以直接返回专业 Agent 的结果
  // 复杂场景可以让经理 Agent 包装一下
  return result.response;
}

// 使用示例
async function main() {
  const questions = [
    '我买的耳机有杂音，想退款',
    '你们的会员有什么优惠？',
    '蓝牙连不上手机怎么办？',
  ];

  for (const q of questions) {
    console.log(`\n用户: ${q}`);
    console.log('-'.repeat(50));
    const answer = await orchestrate(q);
    console.log(`回复: ${answer}`);
    console.log('='.repeat(50));
  }
}

main();
```

### Pipeline 模式：内容审核流水线

```typescript
// pipeline/content-review.ts
import { deepseek } from '@ai-sdk/deepseek';
import { generateText, Output, isStepCount } from 'ai';
import { z } from 'zod';

// Pipeline 中每个节点的标准接口
interface PipelineStage<TInput, TOutput> {
  name: string;
  execute: (input: TInput) => Promise<TOutput>;
}

// 第一阶段：内容理解
const contentAnalyzer: PipelineStage<string, { summary: string; topics: string[]; sentiment: string }> = {
  name: 'content-analyzer',
  execute: async (content) => {
    const { output } = await generateText({
      model: deepseek('deepseek-chat'),
      instructions: '你是一个内容分析专家。分析给定内容的主题、摘要和情感倾向。',
      output: Output.object({
        schema: z.object({
          summary: z.string().describe('内容摘要，50字以内'),
          topics: z.array(z.string()).describe('涉及的主题标签'),
          sentiment: z.enum(['positive', 'neutral', 'negative']).describe('情感倾向'),
        }),
      }),
      prompt: content,
    });
    return output;
  },
};

// 第二阶段：安全审核
const safetyReviewer: PipelineStage<
  { content: string; analysis: any },
  { safe: boolean; issues: string[] }
> = {
  name: 'safety-reviewer',
  execute: async ({ content, analysis }) => {
    const { output } = await generateText({
      model: deepseek('deepseek-chat'),
      instructions: `你是一个内容安全审核专家。检查内容是否包含：
        - 暴力或仇恨言论
        - 虚假信息
        - 隐私泄露
        - 违规广告`,
      output: Output.object({
        schema: z.object({
          safe: z.boolean().describe('内容是否安全'),
          issues: z.array(z.string()).describe('发现的问题列表，没有则为空数组'),
        }),
      }),
      prompt: `请审核以下内容：\n${content}\n\n内容分析结果：${JSON.stringify(analysis)}`,
    });
    return output;
  },
};

// 第三阶段：质量评分
const qualityScorer: PipelineStage<
  { content: string; analysis: any; safety: any },
  { score: number; feedback: string }
> = {
  name: 'quality-scorer',
  execute: async ({ content, analysis, safety }) => {
    const { output } = await generateText({
      model: deepseek('deepseek-chat'),
      instructions: '你是一个内容质量评审专家。从原创性、准确性、可读性三个维度评分。',
      output: Output.object({
        schema: z.object({
          score: z.number().min(0).max(100).describe('综合质量分 0-100'),
          feedback: z.string().describe('改进建议'),
        }),
      }),
      prompt: `请评估以下内容的质量：\n${content}\n\n分析：${JSON.stringify(analysis)}\n安全审核：${JSON.stringify(safety)}`,
    });
    return output;
  },
};

// 执行 Pipeline
async function runContentPipeline(content: string) {
  console.log('=== 内容审核 Pipeline 开始 ===\n');

  // 阶段 1：分析
  console.log('[阶段1] 内容分析...');
  const analysis = await contentAnalyzer.execute(content);
  console.log('分析结果:', analysis);

  // 阶段 2：安全审核
  console.log('\n[阶段2] 安全审核...');
  const safety = await safetyReviewer.execute({ content, analysis });
  console.log('安全结果:', safety);

  // 如果不安全，提前终止（短路逻辑）
  if (!safety.safe) {
    console.log('\n⚠ 内容未通过安全审核，终止流水线');
    return { passed: false, reason: safety.issues };
  }

  // 阶段 3：质量评分
  console.log('\n[阶段3] 质量评分...');
  const quality = await qualityScorer.execute({ content, analysis, safety });
  console.log('质量结果:', quality);

  // 最终判定
  const passed = quality.score >= 60;
  console.log(`\n=== Pipeline 结束 === 结果: ${passed ? '通过' : '不通过'}`);

  return {
    passed,
    analysis,
    safety,
    quality,
  };
}
```

### Debate 模式：多角度代码审查

```typescript
// debate/code-review.ts
import { deepseek } from '@ai-sdk/deepseek';
import { generateText, Output, isStepCount } from 'ai';
import { z } from 'zod';

const reviewSchema = z.object({
  score: z.number().min(0).max(10),
  issues: z.array(z.object({
    severity: z.enum(['critical', 'warning', 'suggestion']),
    description: z.string(),
    suggestion: z.string(),
  })),
  summary: z.string(),
});

// 三个不同视角的 Review Agent，并行执行
async function debateCodeReview(code: string) {
  // 并行执行三个 Review Agent
  const [securityReview, performanceReview, maintainabilityReview] = await Promise.all([
    // 安全视角
    generateText({
      model: deepseek('deepseek-chat'),
      instructions: `你是一个安全审查专家。从安全角度审查代码：
        - SQL 注入、XSS、CSRF 风险
        - 敏感信息泄露
        - 权限控制漏洞
        只关注安全问题，不评论代码风格。`,
      output: Output.object({ schema: reviewSchema }),
      prompt: `审查以下代码的安全性：\n\n${code}`,
    }),
    // 性能视角
    generateText({
      model: deepseek('deepseek-chat'),
      instructions: `你是一个性能优化专家。从性能角度审查代码：
        - 不必要的重复计算
        - 内存泄漏风险
        - N+1 查询问题
        只关注性能问题，不评论安全性。`,
      output: Output.object({ schema: reviewSchema }),
      prompt: `审查以下代码的性能：\n\n${code}`,
    }),
    // 可维护性视角
    generateText({
      model: deepseek('deepseek-chat'),
      instructions: `你是一个代码质量专家。从可维护性角度审查代码：
        - 命名规范
        - 函数复杂度
        - 是否遵循 SOLID 原则
        只关注可维护性，不评论安全和性能。`,
      output: Output.object({ schema: reviewSchema }),
      prompt: `审查以下代码的可维护性：\n\n${code}`,
    }),
  ]);

  // 仲裁：汇总所有意见
  const allIssues = [
    ...securityReview.output.issues.map(i => ({ ...i, source: 'security' })),
    ...performanceReview.output.issues.map(i => ({ ...i, source: 'performance' })),
    ...maintainabilityReview.output.issues.map(i => ({ ...i, source: 'maintainability' })),
  ];

  // 按严重程度排序
  allIssues.sort((a, b) => {
    const order = { critical: 0, warning: 1, suggestion: 2 };
    return order[a.severity] - order[b.severity];
  });

  return {
    scores: {
      security: securityReview.output.score,
      performance: performanceReview.output.score,
      maintainability: maintainabilityReview.output.score,
      overall: (
        securityReview.output.score * 0.4 +     // 安全权重最高
        performanceReview.output.score * 0.3 +
        maintainabilityReview.output.score * 0.3
      ).toFixed(1),
    },
    issues: allIssues,
  };
}
```

这段代码展示了 Debate 模式的精髓：**三个 Agent 用 `Promise.all` 并行执行**，各自从不同角度审查代码，最后汇总意见并按优先级排序。注意不同维度有不同的权重——安全问题权重最高（0.4）。

---

## 实操练习

### 目标

为我们的 AI 智能助手项目添加 Multi-Agent 能力，实现一个"智能工作助手团队"。

### 步骤

1. **定义三个专业 Agent**：
   - 日程管理 Agent：处理日程查询、创建、修改
   - 知识问答 Agent：基于 RAG 回答专业问题
   - 写作辅助 Agent：帮忙写邮件、报告、总结

2. **实现 Orchestrator Agent**：
   - 分析用户意图
   - 路由到正确的专业 Agent
   - 汇总结果返回

3. **添加全链路追踪**：
   - 每个请求生成唯一 traceId
   - 记录每个 Agent 的输入、输出、耗时

4. **实现混合路由**：
   - 关键词路由：包含"日程/会议/日历"→ 日程 Agent
   - LLM 路由：兜底复杂场景

### 验收标准

- [ ] 三个专业 Agent 能独立工作并通过单元测试
- [ ] Orchestrator 能正确路由至少 90% 的测试用例
- [ ] 每个请求都有完整的追踪日志
- [ ] 路由失败时有合理的兜底策略

### 挑战加分项

- 实现 Pipeline 模式的写作 Agent：调研 → 起草 → 审核 → 定稿
- 为写作质量审核环节实现 Debate 模式（多角度评审）
- 添加 Agent 性能仪表盘：每个 Agent 的平均耗时、调用次数、成功率
- 实现 Agent 的动态注册和发现（新增 Agent 不需要修改 Orchestrator 代码）

---

## 本章小结

本章我们学习了 Multi-Agent 系统的核心概念和实践方法：

1. **为什么需要多 Agent**：专业分工带来质量提升，但要避免过早拆分。判断标准是 System Prompt 膨胀、工具选择出错、需要不同"人格"。

2. **四种核心模式**：
   - **Orchestrator**：经理分配任务，适合需要统筹协调的场景
   - **Pipeline**：流水线串行处理，适合有明确阶段的任务
   - **Debate**：多角度辩论，适合需要综合意见的决策
   - **Swarm**：对等协作，适合大规模分布式任务

3. **通信机制**：共享上下文、消息传递、黑板模式、事件驱动，各有适用场景。

4. **角色设计**：每个 Agent 要有清晰的"人设"（System Prompt）、专属工具集和明确的能力边界。

5. **任务路由**：用混合策略——规则路由处理确定场景，LLM 路由兜底模糊场景。

6. **A2A 协议**：Agent 间通信的新兴标准，与 MCP 互补而非竞争。

**最重要的一句话**：Multi-Agent 不是银弹。先用单 Agent 跑通，明确瓶颈后再拆分。拆分的原则和微服务一样——**高内聚，低耦合，演进式架构**。

下一章我们将讨论一个更根本的问题：很多时候你可能根本不需要 Agent，一个 Workflow 就够了。
