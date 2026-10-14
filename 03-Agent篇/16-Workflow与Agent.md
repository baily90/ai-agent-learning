# 第16章：Workflow vs Agent — 不是所有钉子都需要 Agent 这把锤子

## 引言

学到这里，你已经掌握了 Agent 的核心能力：Function Calling、Memory、RAG、MCP、Multi-Agent。一路走来，Agent 看起来无所不能——能规划、能执行、能纠错、能协作。

然后你兴冲冲地回到公司，跟老板说："我们的客服系统应该做成 Agent！"

老板问了你一个问题："用户点击'查询订单'按钮，调一下数据库把结果展示出来，这也需要 Agent 吗？"

你愣住了。

是的，**不是所有的 AI 应用都需要 Agent**。实际上，大多数落地的 AI 应用都不是 Agent，而是 **Workflow**——一种预定义的、确定性的 AI 处理流程。

这一章可能是本书最重要的一章之一。因为它要回答一个核心问题：**什么时候该用 Agent，什么时候 Workflow 就够了？** 选错了架构，你会发现：用 Agent 做简单事——费钱、不可控、难调试；用 Workflow 做复杂事——僵硬、无法应对变化、到处打补丁。

Anthropic 官方在其 Agent 设计指南中明确建议：**先从 Workflow 开始，只在必要时升级为 Agent**。让我们来理解为什么。

---

## 16.1 什么是 AI Workflow

### 一句话直觉

AI Workflow 就是"写好剧本的 AI"——每一步做什么是人类预定义的，AI 只在特定节点做决策，整体流程是固定的。

### 前端类比

Express/Koa 的中间件链。

```typescript
app.use(authenticate)    // 第1步：认证（固定）
   .use(validateInput)   // 第2步：验证（固定）
   .use(processRequest)  // 第3步：业务逻辑（内部可能有灵活逻辑）
   .use(formatResponse)  // 第4步：格式化响应（固定）
   .use(errorHandler);   // 第5步：错误处理（固定）
```

每个请求都按这个顺序走。中间件的**顺序是固定的**，但每个中间件**内部可以有灵活的逻辑**。认证中间件可能根据不同的 token 类型走不同分支，但"先认证再验证再处理"这个大流程不会变。

AI Workflow 也是这样：整体流程是代码写死的，但某些节点内部会调用 LLM 来做灵活的判断。

### 详细原理

一个典型的 AI Workflow 长这样：

```
输入 → 预处理 → [LLM: 分类] → 条件分支 → [LLM: 生成] → 后处理 → 输出
        (代码)     (AI节点)     (代码)       (AI节点)     (代码)
```

关键特征：
- **流程是代码定义的**，不是 AI 自主决策的
- **LLM 只在特定节点被调用**，做分类、生成、摘要等具体任务
- **流程走向是可预测的**——给定相同输入，走的路径基本一致
- **每一步都可以独立测试和监控**

举个具体例子——邮件自动回复系统：

```
收到邮件
  → [代码] 提取发件人、主题、正文
  → [LLM] 判断邮件类型（询价/投诉/合作/垃圾邮件）
  → [代码] 根据类型走不同分支：
      ├ 询价 → [LLM] 基于产品目录生成报价回复
      ├ 投诉 → [LLM] 生成安抚回复 + [代码] 创建工单
      ├ 合作 → [代码] 转发给商务部门
      └ 垃圾邮件 → [代码] 直接归档
  → [代码] 发送回复/执行动作
```

注意：整个流程中有两处调用 LLM（分类和生成回复），但流程的走向由代码控制。LLM 不会自己决定"我要先查一下数据库再回复"或"这个邮件我需要多思考几轮"——这些决策权在代码手里。

---

## 16.2 什么是 Agent（再回顾）

### 一句话直觉

Agent 是"即兴表演的 AI"——给它一个目标，它自己决定怎么一步步达成，每次的路径可能不同。

### 和 Workflow 的根本区别

Agent 的核心是一个**自主决策循环**：

```
目标 → LLM 思考 → 选择行动 → 执行 → 观察结果 → LLM 再思考 → ... → 完成
```

没有人告诉 Agent "第一步做什么，第二步做什么"。它自己看情况决定。给同一个任务，第一次可能先搜索再计算，第二次可能先计算再验证。**路径是非确定性的**。

用前端的话说：Workflow 是声明式路由（每个 URL 对应一个固定组件），Agent 是动态路由（根据运行时状态决定渲染什么）。

不，更准确地说：Workflow 是 `switch-case`，Agent 是 `while(true) { 让 AI 决定下一步 }`。

---

## 16.3 核心区别对比

这张表值得你打印出来贴在工位上：

| 维度 | Workflow | Agent |
|------|----------|-------|
| **确定性** | 高——流程固定，代码控制 | 低——每次路径可能不同 |
| **可预测性** | 强——容易写测试用例 | 弱——难以穷举所有可能路径 |
| **灵活性** | 低——只能处理预设的场景 | 高——能应对没见过的新场景 |
| **可靠性** | 高——流程走错了一定是代码 bug | 依赖模型能力——同一个问题可能这次对下次错 |
| **Token 成本** | 可控——每个节点消耗多少可以估算 | 不确定——Agent 可能"思考"很多轮 |
| **延迟** | 可控——节点数固定，总耗时可估 | 不确定——可能 1 轮就完成，也可能 10 轮 |
| **调试** | 简单——每个节点的输入输出都清晰 | 困难——要理解 AI 的"思考过程" |
| **开发成本** | 前期高（要设计流程）| 前期低（丢给 AI 就行）|
| **维护成本** | 低（流程可控）| 高（模型更新可能改变行为）|
| **适用场景** | 标准化、重复性流程 | 开放式、探索性任务 |

### 用前端的话翻译一下

**Workflow** 就像一个 **表单向导（Form Wizard）**——第一页填个人信息，第二页填地址，第三页确认提交。步骤固定，用户只能按顺序走。每一步的 UI 是固定的，但表单内部的验证逻辑可以很复杂。

**Agent** 就像一个 **AI 聊天界面**——用户随便说什么，AI 自己决定怎么回应。可能调工具，可能直接回答，可能反问。你无法预测对话会走向哪里。

### 一个关键洞察

Workflow 和 Agent 不是非此即彼的选择，而是一个**光谱**：

```
纯代码逻辑 ←————————————————————————→ 纯 Agent 自主决策
(if-else)    Workflow     混合架构     Agent    (完全自由)
             (代码流程    (Workflow+    (自主     
              +AI节点)    Agent混合)    决策循环)
```

大多数实际应用落在中间的"混合架构"区域。

---

## 16.4 选择指南：该用 Workflow 还是 Agent

### 明确适合 Workflow 的场景

**1. 数据处理管道**

"每天从 10 个数据源拉取数据，清洗格式，AI 做摘要，存入数据库，生成日报。"

流程完全固定，数据源固定，输出格式固定。AI 只在"摘要"这一个环节用到。不需要 Agent。

**2. 表单审批流**

"用户提交报销申请 → AI 检查是否合规 → 超过 5000 元需要经理审批 → 通过后打款。"

每一步清清楚楚。AI 在"合规检查"节点用到，但整体流程不需要 AI 来决定。

**3. 固定格式的内容生成**

"输入产品信息，生成淘宝详情页文案。"

输入固定，输出格式固定，中间就是一次 LLM 调用。经典的 Workflow 场景。

**4. 分类然后处理**

"用户发消息 → AI 分类（售前/售后/投诉）→ 走不同的处理逻辑。"

这就是前面说的邮件系统。分类是 AI 做的，但分完类之后走哪条路是代码决定的。

### 明确适合 Agent 的场景

**1. 开放式研究任务**

"帮我调研一下竞品的定价策略，和我们做个对比分析。"

不知道要搜多少次、搜什么关键词、需要分析哪些维度。这需要 Agent 自主规划。

**2. 复杂的多步推理**

"根据这份财报数据，分析公司的财务健康状况，给出投资建议。"

需要计算、比较、推理，每一步的具体操作取决于上一步的发现。无法预定义流程。

**3. 多工具协调**

"帮我安排下周的出差：查机票、订酒店、排日程、通知同事。"

需要调用多个工具，而且调用顺序和参数取决于前面的结果（比如先查到航班时间，才能订对应日期的酒店）。

**4. 创意性任务**

"帮我设计一个新功能的技术方案。"

没有标准答案，需要探索和创造。Agent 可以尝试不同方向，迭代优化。

### 灰色地带：如何判断

很多场景不那么绝对，怎么判断？问自己三个问题：

**问题 1：流程能画出流程图吗？**

如果你能在白板上画出清晰的流程图——每个节点做什么、每个分支的条件是什么——那就用 Workflow。如果画着画着发现"这里取决于 AI 分析的结果""这里可能需要再查一些资料"，那说明需要 Agent。

**问题 2：失败的后果有多严重？**

给客户自动发退款、操作数据库、发送正式邮件——这些场景失败后果严重，优先用 Workflow（可控性高）。生成一段内部参考文案、做个初步分析——失败后果可控，可以用 Agent。

**问题 3：你能穷举所有可能的输入吗？**

如果用户的输入是有限的（从下拉框选择、固定格式的数据），用 Workflow。如果用户可以自由输入任何内容（聊天框），可能需要 Agent。

**一个实用的启发式**：

```
能用 Workflow 解决的 → 用 Workflow
Workflow 搞不定但能用 Workflow + 局部 Agent 的 → 用混合架构
只有 Agent 才能搞定的 → 用 Agent
```

---

## 16.5 混合架构：最佳实践往往是两者结合

### 一句话直觉

外层 Workflow 保证流程可控，内层 Agent 在特定节点做灵活决策。

### 前端类比

React 应用的架构就是典型的混合模式：

- **路由层是 Workflow**：`/login` 展示登录页，`/dashboard` 展示仪表盘，`/settings` 展示设置页。路径是固定的，你不会说"让 AI 决定用户应该看到哪个页面"。
- **组件内部可以是 Agent 式的**：仪表盘页面里的 AI 助手组件，可以根据用户的自然语言请求灵活地展示不同的图表和数据。

整体可控，局部灵活。

### 实际案例：智能客服的混合架构

```
[Workflow 层 — 代码控制]
接收用户消息
  → [LLM节点] 意图分类（售前/售后/投诉/闲聊）
  → [代码] 路由到对应处理模块
      │
      ├ 售前咨询 [Workflow]
      │   → [代码] 查询产品目录
      │   → [LLM节点] 生成产品推荐
      │   → [代码] 格式化回复
      │
      ├ 售后问题 [Agent — 这里需要灵活性]
      │   → Agent 自主决策：可能查订单、查物流、查知识库、请求退款...
      │   → Agent 的工具调用受限（只有售后相关的工具）
      │   → Agent 的输出会经过一个审核节点
      │
      ├ 投诉处理 [Workflow]
      │   → [代码] 创建工单
      │   → [LLM节点] 生成安抚回复
      │   → [代码] 通知主管
      │
      └ 闲聊 [简单LLM调用]
          → [LLM节点] 直接回复
  
  → [代码] 记录日志
  → [代码] 发送回复
```

为什么售前用 Workflow 而售后用 Agent？

- **售前**：场景有限（介绍产品、报价、比较），流程清晰。用 Workflow 更可靠。
- **售后**：问题五花八门（退货、换货、维修、物流异常、质量投诉......），而且经常需要多步操作（查订单 → 查物流 → 发现异常 → 联系仓库 → 给用户回复）。每个用户的问题路径不同，写死流程太僵硬。

关键点：**即使用 Agent 的环节，也要被 Workflow 包裹着**。Agent 不是无限自由的——它只能使用售后相关的工具，它的输出要经过审核，整个对话在 Workflow 的框架内进行。

这就像你在公司里有一定的自主权（Agent），但你的工作仍然在部门的管理流程（Workflow）框架内。

---

## 16.6 Workflow 的构建方式

### 方式一：代码实现

最直接的方式——用 `if-else`、`switch`、函数链来实现流程控制。

```typescript
// 代码实现 Workflow 的好处：类型安全、可测试、版本控制
async function emailWorkflow(email: EmailInput): Promise<EmailOutput> {
  // 步骤1：预处理（纯代码）
  const cleaned = preprocessEmail(email);
  
  // 步骤2：AI 分类（LLM 节点）
  const category = await classifyEmail(cleaned);
  
  // 步骤3：条件分支（纯代码）
  switch (category) {
    case 'inquiry':
      return await handleInquiry(cleaned);
    case 'complaint':
      return await handleComplaint(cleaned);
    case 'spam':
      return { action: 'archive', reply: null };
    default:
      return await handleGeneral(cleaned);
  }
}
```

**优点**：完全的类型安全，IDE 支持好，可以写单元测试，版本控制（Git）友好。

**缺点**：修改流程需要改代码和部署，非技术人员无法参与。

**适合**：开发者主导的项目，流程不会频繁变动。

### 方式二：可视化编排工具

n8n、Dify、LangFlow、Coze 这类工具提供拖拽式的流程编辑器。

**前端类比**：低代码平台。就像 Retool 让你拖拽组件构建后台页面一样，这些工具让你拖拽节点构建 AI 流程。

**优点**：
- 非技术人员也能搭建和修改流程
- 流程可视化，一目了然
- 通常内置了很多常用节点（LLM 调用、HTTP 请求、数据库查询）
- 快速原型验证

**缺点**：
- 复杂逻辑不好表达（可视化工具做 `for` 循环都费劲）
- 调试能力有限（相比 IDE 的断点调试）
- 供应商锁定风险
- 性能优化空间小
- 版本控制和 Code Review 困难

**适合**：运营团队自主搭建的流程，快速验证的 POC，流程频繁调整的场景。

### 方式三：DSL 定义

用 JSON 或 YAML 描述流程，由引擎解释执行。

```yaml
# workflow-definition.yaml
name: email-processor
steps:
  - id: preprocess
    type: function
    handler: preprocessEmail
    
  - id: classify
    type: llm
    model: gpt-5-mini
    prompt: "将以下邮件分类为：inquiry/complaint/spam/general"
    input: ${preprocess.output}
    
  - id: route
    type: switch
    condition: ${classify.output.category}
    branches:
      inquiry: handleInquiry
      complaint: handleComplaint
      spam: archive
      default: handleGeneral
```

**优点**：流程定义和执行逻辑分离，可以动态加载不同流程。

**缺点**：需要自己实现执行引擎，且 DSL 的表达能力有限。

**适合**：需要动态切换流程的平台型产品。

### 如何选择？

| 构建方式 | 适合的团队 | 适合的场景 |
|---------|-----------|-----------|
| 代码实现 | 开发者团队 | 流程固定，需要高可靠性 |
| 可视化工具 | 运营+开发混合团队 | 流程频繁调整，快速迭代 |
| DSL 定义 | 平台型产品团队 | 需要支持多租户不同流程 |

很多团队的实际路径是：**先用可视化工具验证想法，再用代码重写核心流程**。就像前端经常先用 Figma 画原型，再用代码实现。

---

## 16.7 从 Agent 降级到 Workflow

这是一个反直觉但极其实用的技巧：当你发现 Agent 在某个场景下不够可靠时，**把它的"自主决策"固化为确定性流程**。

### 怎么降级

**第一步：观察 Agent 的实际行为**

让 Agent 跑一段时间，收集它的决策日志：它通常先调用哪个工具？然后做什么？分支条件是什么？

**第二步：提取模式**

你会发现：对于 80% 的请求，Agent 走的路径其实差不多。比如客服 Agent 处理退款：

```
90% 的情况：查订单 → 检查退款条件 → 执行退款/拒绝退款
5% 的情况：查订单 → 发现订单异常 → 查更多信息 → 手动处理
5% 的情况：各种奇怪的路径
```

**第三步：固化主路径**

把 90% 的主路径写成 Workflow，剩下 10% 的异常情况保留 Agent 或转人工。

```typescript
// 从 Agent 降级为 Workflow
async function refundWorkflow(request: RefundRequest) {
  // 步骤1：查订单（固定步骤，不需要 AI 决定）
  const order = await queryOrder(request.orderId);
  
  // 步骤2：检查条件（规则判断，比 AI 判断更可靠）
  if (!order) return { success: false, reason: '订单不存在' };
  if (order.daysAfterDelivery > 7) return { success: false, reason: '超过7天退款期' };
  if (order.status === 'refunded') return { success: false, reason: '已退款' };
  
  // 步骤3：只在需要灵活判断的地方用 AI
  // 比如判断退款理由是否合理（这个很难用规则穷举）
  const reasonAnalysis = await analyzRefundReason(request.reason);
  
  if (reasonAnalysis.valid) {
    return await processRefund(order);
  } else {
    // 理由不充分，但也不能直接拒绝，转人工
    return { success: false, reason: '需人工审核', escalate: true };
  }
}
```

### 降级的好处

- **可靠性大幅提升**：关键步骤不依赖 AI 的不确定性判断
- **成本大幅下降**：从多轮 LLM 调用变成一次或零次
- **延迟大幅降低**：代码逻辑的执行是毫秒级的
- **可测试性**：可以写确定性的单元测试

### 什么时候该降级

- Agent 在某个场景下的准确率低于你的容忍阈值（比如低于 95%）
- 同一类请求的处理路径高度相似（80%+ 走相同路径）
- 该场景的错误后果严重（涉及钱、隐私、安全）
- Token 成本成为负担

---

## 16.8 Anthropic 的建议

Anthropic 在其官方的 Agent 构建指南中明确提出：

> **"When building applications with LLMs, we recommend finding the simplest solution possible, and only increasing complexity when needed. This might mean not building agentic systems at all."**
> 
> （当构建 LLM 应用时，我们建议找到最简单的可行方案，只在必要时增加复杂性。这可能意味着根本不需要构建 Agent 系统。）

为什么？几个原因：

**1. Agent 的复杂性不是线性增长的**

每增加一个"自主决策点"，系统的不确定性不是 +1，而是 x2。两个决策点有 4 种可能路径，三个有 8 种，十个有 1024 种。你没法测试所有路径。

而 Workflow 的复杂性是线性的——多加一个节点，多写一个测试。

**2. 模型能力有天花板**

当前最强的模型在复杂推理上仍然会犯错。让模型在一个受限的框架内做简单判断（Workflow 模式），比让模型自主规划复杂路径（Agent 模式）可靠得多。

就像初级开发者：给他一个明确的任务（实现这个函数），他做得不错；让他自己设计整个架构，可能就翻车了。

**3. 可观测性和调试**

Workflow 的每一步都是透明的——输入是什么、输出是什么、为什么走这个分支。Agent 的"思考过程"是个黑盒，出了问题很难定位。

在生产环境中，可调试性和可观测性的价值远远超过灵活性。

**4. 成本和延迟的可预测性**

Workflow 的成本和延迟可以精确估算——总共调几次 LLM，每次大概多少 Token，总耗时多少。对于 SLA（服务等级协议）严格的业务场景，这种可预测性至关重要。

Agent 的成本和延迟是个随机变量——可能这次 2 秒搞定，下次 30 秒还在循环。这种不确定性在 to B 产品中是不可接受的。

### Anthropic 建议的渐进式路径

```
Level 0: 单次 LLM 调用
         ↓ 不够用了
Level 1: LLM + 简单代码逻辑（Workflow）
         ↓ 还是不够灵活
Level 2: 多步 Workflow（链式 LLM 调用）
         ↓ 需要动态决策了
Level 3: 带路由的 Workflow（LLM 做分类/路由）
         ↓ 场景太复杂，无法预定义所有路径了
Level 4: Agent（自主决策循环）
         ↓ 任务太大，一个 Agent 扛不住了
Level 5: Multi-Agent 系统
```

**每升一级都要问自己：当前这一级真的解决不了问题吗？**

很多团队从 Level 0 直接跳到 Level 4 甚至 Level 5，然后发现系统不稳定、成本爆炸、调试噩梦。回头一看，其实 Level 2 就够了。

---

## 概念辨析

### Workflow vs Pipeline vs Chain

这三个词经常被混用，但有微妙区别：

| 概念 | 含义 | 例子 |
|------|------|------|
| **Workflow** | 包含条件分支的流程 | if 分类=A then 处理A else 处理B |
| **Pipeline** | 纯线性的步骤序列 | 分析 → 生成 → 审核 → 发布 |
| **Chain** | 多个 LLM 调用串联 | LLM1 的输出是 LLM2 的输入 |

Pipeline 是 Workflow 的特例（没有分支的 Workflow）。Chain 是 Pipeline 的特例（每个节点都是 LLM）。

### 确定性 vs 非确定性

"确定性"不是说"每次输出一模一样"——即使在 Workflow 中，LLM 节点的输出也可能每次不同（因为 temperature > 0）。这里的"确定性"指的是**流程路径**——Workflow 走哪条分支是确定的（由代码条件决定），Agent 走哪条路径是不确定的（由 LLM 在运行时决定）。

### Orchestration vs Choreography

这对概念来自微服务领域，在 AI 系统中同样适用：

- **Orchestration（编排）**：一个中心控制者决定流程。Workflow 和 Orchestrator 模式都属于这一类。
- **Choreography（编舞）**：没有中心控制者，每个参与者根据规则自行协作。Swarm 模式属于这一类。

大多数生产系统用 Orchestration，因为更可控。

---

## 灵魂拷问

> **Q: 你的老板说"我们要做一个 AI Agent"。如何判断他实际需要的是 Agent 还是 Workflow？**

> A: 不要纠结老板用了什么词，要听他描述的**具体需求**。问几个关键问题：
>
> （1）"用户的操作路径是固定的还是开放的？"——如果是固定的（比如提交表单、走审批流），那是 Workflow。
>
> （2）"你能列出所有可能的场景吗？"——如果能穷举，Workflow；不能穷举，可能需要 Agent。
>
> （3）"出错了怎么办？"——如果答案是"不能出错，涉及钱/安全"，优先用 Workflow（可靠性高）。
>
> （4）"现在人工是怎么处理的？"——观察人工操作是不是按固定流程走的。如果人工都是按 SOP（标准操作流程）做的，那 Workflow 就够了。如果人工处理时也需要大量临场判断，那可能需要 Agent。
>
> 很多时候老板说"要做 Agent"，实际上他想要的是"AI 自动化的工作流"，也就是 Workflow。先做 Workflow，跑起来之后，再讨论哪些环节需要 Agent 级别的灵活性。

> **Q: 为什么 Anthropic 建议"先 Workflow 后 Agent"而不是反过来？**

> A: 因为**从简单到复杂容易，从复杂到简单难**。
>
> 先做 Workflow 的好处：（1）快速上线——Workflow 的开发和测试周期短；（2）建立基线——你知道 Workflow 能覆盖多少场景，哪些场景搞不定；（3）积累数据——Workflow 运行过程中产生的日志，可以帮你理解哪些环节真正需要 Agent 级别的灵活性。
>
> 如果反过来先做 Agent：你不知道哪些复杂性是必要的，可能花了 3 个月做了一个 Agent 系统，最后发现 80% 的场景用 `if-else` 就能搞定。
>
> 这和做产品的思路一样——先 MVP，再迭代。不要一上来就做"完美架构"。

> **Q: 一个能处理 90% 场景的 Workflow + 10% 人工兜底，和一个能处理 95% 场景的 Agent，选哪个？为什么？**

> A: **大多数情况下选前者**。原因：
>
> （1）**Workflow 的 90% 是确定的 90%**——你清楚知道哪些场景能处理，哪些不能。Agent 的 95% 是不确定的——你不知道它这次成功了下次会不会失败。
>
> （2）**10% 人工兜底的成本是可控的**。假设每天 1000 个请求，100 个转人工。如果人工处理一个请求的成本是 5 元，每天 500 元。Agent 处理那额外 5% 省下的 50 个人工请求值 250 元，但 Agent 的开发、维护、Token 消耗可能远超这个数。
>
> （3）**人工兜底有额外价值**。人工处理的那 10% 请求，恰好是最复杂、最有学习价值的 case。分析这些 case，你可以不断优化 Workflow 的覆盖率，从 90% 提升到 93%、95%...
>
> 但也有例外：如果人工兜底的成本极高（比如需要专家级人力），或者人工不可用（比如凌晨 3 点没人值班），那 Agent 的价值就凸显了。

> **Q: 混合架构的边界怎么划？哪些节点用固定逻辑，哪些交给 AI 自主决策？**

> A: 用两个维度判断每个节点：
>
> **维度一：决策的确定性**。能用规则表达的用固定逻辑（"超过 7 天不能退款"——这是规则），不能用规则穷举的用 AI（"用户的退款理由是否合理"——这需要理解自然语言）。
>
> **维度二：错误的严重性**。错了代价大的用固定逻辑（转账、删除数据），错了可以容忍的用 AI（生成文案、推荐内容）。
>
> 画个象限图：
>
> | | 确定性高 | 确定性低 |
> |--|---------|---------|
> | **后果严重** | 固定逻辑（必须） | 固定逻辑 + AI 辅助 + 人工审核 |
> | **后果轻微** | 固定逻辑（省 Token） | AI 自主决策（可以） |
>
> 左上角（确定性高 + 后果严重）：用 `if-else`，绝对不用 AI。比如：金额计算。
> 右下角（确定性低 + 后果轻微）：放手让 AI 做。比如：聊天回复。
> 右上角（确定性低 + 后果严重）：最棘手的区域。AI 做初步判断，但必须有人工审核或规则兜底。

> **Q: Workflow 的可视化编排工具（如 Dify/n8n）适合什么团队？和纯代码实现相比各有什么利弊？**

> A: 可视化工具适合两类团队：（1）有非技术人员（产品、运营）需要参与流程设计和调整的团队；（2）需要快速验证想法、做 POC 的团队。
>
> **可视化工具的优势**：上手快、迭代快、流程一目了然、内置了常用集成（邮件、数据库、API）。适合从 0 到 1 的阶段。
>
> **可视化工具的劣势**：复杂逻辑表达能力弱（想想用流程图画一个嵌套循环）、调试能力有限、难以做版本控制和 Code Review、性能优化空间小、存在供应商锁定风险。
>
> **纯代码实现的优势**：灵活性、可测试性、可维护性、性能优化空间大。适合从 1 到 100 的阶段。
>
> **实际建议**：用可视化工具验证想法和搭建原型，核心流程用代码实现。就像你会用 Figma 画 UI 原型，但不会用 Figma 做真正的前端开发。
>
> 有一个常见的陷阱：团队在可视化工具上搭了越来越复杂的流程，到后来维护成本极高，但迁移到代码又是个巨大工程。所以要**及早决定什么时候从可视化工具毕业**。

> **Q: 如果模型能力持续提升，Workflow 最终会被 Agent 完全取代吗？**

> A: 短期（3-5 年）不会，长期不确定。几个原因：
>
> （1）**确定性的价值不会消失**。即使模型能力提升到 99.9% 准确率，对于金融交易、医疗决策这类场景，人们仍然会选择确定性的流程。因为 0.1% 的错误也承受不起。确定性是一种工程原则，不会因为 AI 变强就过时。
>
> （2）**成本和延迟**。Workflow 的代码逻辑几乎零成本、毫秒级延迟。即使模型再便宜，也不可能比 `if (x > 7) return false` 更便宜。
>
> （3）**可审计性**。很多行业（金融、医疗、法律）需要可解释、可审计的决策过程。Workflow 天然满足，Agent 需要额外的努力。
>
> 但模型能力提升确实会改变边界——现在需要 Workflow 硬编码的场景，未来一部分可以交给 Agent。**Workflow 不会消失，但它的领地会缩小**。就像汇编语言不会消失，但写汇编的场景越来越少。

---

## 最佳实践

### DO

- **先问"能不能用 Workflow 解决"，再考虑 Agent**。这是最重要的设计原则
- **从最简单的方案开始**。单次 LLM 调用 → Chain → Workflow → Agent，逐级升级
- **明确每个 AI 节点的输入输出契约**，用 TypeScript interface 或 Zod schema 定义
- **为 Workflow 中的每个节点写单元测试**，特别是 LLM 节点（用 mock 或 snapshot 测试）
- **在 Workflow 和 Agent 之间设置清晰的边界**——哪些节点是固定逻辑，哪些交给 AI，要有明确的设计决策记录
- **监控 Agent 节点的行为**，积累数据后把稳定的模式降级为 Workflow
- **保留人工兜底通道**，不管用 Workflow 还是 Agent

### DON'T

- **不要因为"Agent 更酷"就选 Agent**。技术选型的标准是适合，不是先进
- **不要在关键路径上使用不确定性高的 Agent**。退款、转账、数据删除这些操作，用 Workflow + 人工审批
- **不要忽视 Workflow 的维护成本**。流程图越画越大，分支越来越多，最终也会变成"意大利面条式代码"
- **不要把可视化编排工具的 POC 直接搬到生产**。POC 是验证想法的，生产系统需要更多的考量（错误处理、监控、回滚等）
- **不要在选型阶段讨论太久**。花两天做个 POC 比开三天会更有效。实际跑一下就知道 Workflow 够不够用了
- **不要期望一次设计就完美**。Workflow 和 Agent 的边界会随着业务发展和模型能力变化而调整

---

## 代码实战

我们来实现一个混合架构的智能工作助手：外层 Workflow 控制整体流程，内层在需要灵活性的地方使用 Agent。

### 定义 Workflow 节点

```typescript
// workflow/types.ts
import { z } from 'zod';

// Workflow 的每个节点有明确的类型定义
interface WorkflowNode<TInput, TOutput> {
  name: string;
  type: 'code' | 'llm' | 'agent';  // 节点类型：纯代码 / LLM 调用 / Agent
  execute: (input: TInput) => Promise<TOutput>;
}

// 用户意图分类的输出 schema
const IntentSchema = z.object({
  category: z.enum([
    'schedule',       // 日程管理
    'knowledge',      // 知识问答
    'writing',        // 写作辅助
    'task',           // 任务管理
    'general',        // 一般对话
  ]),
  confidence: z.number().min(0).max(1),
  extractedEntities: z.object({
    datetime: z.string().optional(),
    subject: z.string().optional(),
    people: z.array(z.string()).optional(),
  }),
});

type Intent = z.infer<typeof IntentSchema>;
```

### 实现混合架构

```typescript
// workflow/assistant-workflow.ts
import { generateText, Output, tool, isStepCount } from 'ai';
import { z } from 'zod';

// ============================================
// 第一层：Workflow 节点（确定性流程）
// ============================================

// 节点1：意图分类（LLM 节点，但输出是结构化的）
async function classifyIntent(userMessage: string): Promise<Intent> {
  const { output } = await generateText({
    model: 'openai/gpt-5-mini',  // 分类用小模型就够了
    instructions: `你是一个意图分类器。将用户的消息分类为以下类别之一：
      - schedule: 涉及日程、会议、提醒、日历
      - knowledge: 提问、查询信息、寻求解释
      - writing: 写邮件、写报告、写文案、翻译
      - task: 创建任务、查看待办、更新进度
      - general: 闲聊、打招呼、其他`,
    output: Output.object({ schema: IntentSchema }),
    prompt: userMessage,
  });
  return output;
}

// 节点2：日程管理（Workflow — 流程固定）
async function handleSchedule(message: string, entities: Intent['extractedEntities']) {
  // 日程管理的逻辑是固定的，不需要 Agent
  
  // 子步骤1：判断操作类型
  const action = detectScheduleAction(message);
  
  switch (action) {
    case 'query': {
      // 查询日程：直接查数据库
      const events = await queryCalendar(entities.datetime);
      // 用 LLM 将结构化数据转为自然语言
      const { text } = await generateText({
        model: 'openai/gpt-5-mini',
        instructions: '将日程数据转换为友好的自然语言描述。',
        prompt: `用户问: ${message}\n日程数据: ${JSON.stringify(events)}`,
      });
      return text;
    }
    case 'create': {
      // 创建日程：提取信息 → 验证 → 创建
      if (!entities.datetime) {
        return '请告诉我具体的时间。比如："明天下午3点开会"';
      }
      await createCalendarEvent({
        title: entities.subject || '未命名事件',
        datetime: entities.datetime,
        attendees: entities.people || [],
      });
      return `已创建日程：${entities.subject}，时间：${entities.datetime}`;
    }
    default:
      return '请告诉我你想查询日程还是创建日程？';
  }
}

// 辅助函数：检测日程操作类型（纯代码，不需要 AI）
function detectScheduleAction(message: string): 'query' | 'create' | 'unknown' {
  if (/查|看|有什么|安排|日程/.test(message)) return 'query';
  if (/创建|添加|安排|约|订/.test(message)) return 'create';
  return 'unknown';
}

// 节点3：知识问答（简单的 RAG Workflow）
async function handleKnowledge(message: string) {
  // 步骤1：检索相关文档（代码逻辑）
  const docs = await searchKnowledgeBase(message);
  
  // 步骤2：基于文档生成回答（LLM 节点）
  const { text } = await generateText({
    model: 'openai/gpt-5',  // 知识问答用更强的模型
    instructions: `基于以下参考文档回答用户问题。
      如果文档中没有相关信息，坦率地说"我在知识库中没有找到相关信息"。
      不要编造信息。`,
    prompt: `参考文档：\n${docs.map(d => d.content).join('\n---\n')}\n\n用户问题：${message}`,
  });
  
  return text;
}

// ============================================
// 第二层：Agent 节点（灵活决策）
// ============================================

// 节点4：写作辅助（Agent — 需要灵活性）
// 写作任务多种多样，很难预定义所有路径
async function handleWriting(message: string) {
  const { text } = await generateText({
    model: 'openai/gpt-5',
    instructions: `你是一个写作助手。你可以帮用户：
      - 写邮件（商务/正式/随意）
      - 写报告摘要
      - 润色和改写文本
      - 翻译
      
      根据用户的需求灵活调整。如果信息不足，主动询问。`,
    tools: {
      searchWebForReference: tool({
        description: '搜索网络获取参考信息',
        inputSchema: z.object({
          query: z.string().describe('搜索关键词'),
        }),
        execute: async ({ query }) => {
          // 实际项目中调用搜索 API
          return { results: [`关于 "${query}" 的参考资料...`] };
        },
      }),
      getEmailTemplate: tool({
        description: '获取邮件模板',
        inputSchema: z.object({
          type: z.enum(['business', 'formal', 'casual']).describe('邮件类型'),
        }),
        execute: async ({ type }) => {
          const templates = {
            business: '尊敬的 {{name}}，\n\n关于{{subject}}...',
            formal: '{{name}} 您好，\n\n兹就{{subject}}...',
            casual: 'Hi {{name}},\n\n关于{{subject}}...',
          };
          return { template: templates[type] };
        },
      }),
    },
    stopWhen: isStepCount(5),  // 限制 Agent 的最大步数，避免失控
    prompt: message,
  });
  
  return text;
}

// ============================================
// 主 Workflow：串联所有节点
// ============================================

async function assistantWorkflow(userMessage: string) {
  const traceId = generateTraceId();
  const startTime = Date.now();
  
  console.log(`[${traceId}] 开始处理: "${userMessage}"`);
  
  // 步骤1：意图分类（LLM 节点）
  const intent = await classifyIntent(userMessage);
  console.log(`[${traceId}] 意图分类: ${intent.category} (${intent.confidence})`);
  
  // 步骤2：置信度检查（代码逻辑）
  // 如果分类置信度太低，走兜底策略
  if (intent.confidence < 0.6) {
    console.log(`[${traceId}] 置信度不足，使用通用回复`);
    return await handleGeneral(userMessage);
  }
  
  // 步骤3：路由到对应处理逻辑（代码逻辑）
  let response: string;
  
  switch (intent.category) {
    case 'schedule':
      // Workflow 处理：流程固定，可靠性高
      response = await handleSchedule(userMessage, intent.extractedEntities);
      break;
      
    case 'knowledge':
      // Workflow 处理：RAG 流程固定
      response = await handleKnowledge(userMessage);
      break;
      
    case 'writing':
      // Agent 处理：需要灵活性
      response = await handleWriting(userMessage);
      break;
      
    case 'task':
      // Workflow 处理
      response = await handleTask(userMessage, intent.extractedEntities);
      break;
      
    default:
      response = await handleGeneral(userMessage);
  }
  
  // 步骤4：日志记录（代码逻辑）
  const duration = Date.now() - startTime;
  console.log(`[${traceId}] 处理完成, 耗时: ${duration}ms, 类型: ${intent.category}`);
  
  return response;
}

// ============================================
// 辅助函数
// ============================================

function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

async function queryCalendar(datetime?: string) {
  // 实际项目中查询日历 API
  return [
    { title: '周会', time: '10:00-11:00', attendees: ['Alice', 'Bob'] },
    { title: '产品评审', time: '14:00-15:00', attendees: ['Charlie'] },
  ];
}

async function createCalendarEvent(event: any) {
  // 实际项目中调用日历 API 创建事件
  console.log('创建日程:', event);
}

async function searchKnowledgeBase(query: string) {
  // 实际项目中做向量检索
  return [
    { content: '相关文档内容 1...', score: 0.92 },
    { content: '相关文档内容 2...', score: 0.85 },
  ];
}

async function handleTask(message: string, entities: any) {
  return '任务管理功能开发中...';
}

async function handleGeneral(message: string) {
  const { text } = await generateText({
    model: 'openai/gpt-5-mini',
    instructions: '你是一个友好的工作助手。回答用户的一般性问题。',
    prompt: message,
  });
  return text;
}
```

### 关键设计决策说明

来看看上面代码中的几个关键设计决策：

```typescript
// 决策1：意图分类用 generateText 而不是 Agent
// 原因：分类是确定性任务，不需要自主决策。
//       用 generateText 保证输出格式，方便后续 switch-case
const intent = await classifyIntent(userMessage);

// 决策2：日程管理用 Workflow（switch-case）而不是 Agent
// 原因：操作类型有限（查询/创建/修改），流程固定。
//       而且涉及日历操作，需要可靠性
switch (action) { case 'query': ... case 'create': ... }

// 决策3：写作辅助用 Agent（带 tools 的 generateText）
// 原因：写作任务多样性高，难以穷举所有场景。
//       可能需要搜索参考资料、选择模板等灵活操作。
//       但限制了 stopWhen=5，避免 Agent 失控

// 决策4：置信度不足时走兜底而不是猜测
// 原因：宁可给一个通用回复，也不要错误路由到专业模块
if (intent.confidence < 0.6) return handleGeneral(message);
```

每个决策都有明确的理由。**好的架构不是凭感觉选的，而是每个选择背后都有清晰的 why**。

### Workflow 流程可视化

为了让非技术同事也能理解系统的工作方式，我们可以输出流程的可视化描述：

```typescript
// workflow/visualize.ts

// 把 Workflow 的执行过程记录下来，方便调试和展示
interface WorkflowTrace {
  traceId: string;
  nodes: {
    name: string;
    type: 'code' | 'llm' | 'agent';
    input: any;
    output: any;
    duration: number;
    model?: string;
    tokensUsed?: number;
  }[];
  totalDuration: number;
  totalTokens: number;
}

function printWorkflowTrace(trace: WorkflowTrace) {
  console.log(`\n=== Workflow 执行追踪 [${trace.traceId}] ===`);
  console.log(`总耗时: ${trace.totalDuration}ms | 总 Token: ${trace.totalTokens}\n`);
  
  trace.nodes.forEach((node, i) => {
    const icon = node.type === 'code' ? '[代码]' : 
                 node.type === 'llm' ? '[LLM]' : '[Agent]';
    console.log(`${i + 1}. ${icon} ${node.name}`);
    console.log(`   耗时: ${node.duration}ms`);
    if (node.model) console.log(`   模型: ${node.model}`);
    if (node.tokensUsed) console.log(`   Token: ${node.tokensUsed}`);
    console.log('');
  });
}

// 输出示例：
// === Workflow 执行追踪 [trace_1234] ===
// 总耗时: 2340ms | 总 Token: 1250
//
// 1. [LLM] 意图分类
//    耗时: 380ms
//    模型: gpt-5-mini
//    Token: 150
//
// 2. [代码] 路由分发
//    耗时: 1ms
//
// 3. [Agent] 写作辅助
//    耗时: 1959ms
//    模型: gpt-5
//    Token: 1100
```

这种追踪输出让你一眼就能看出：哪些步骤消耗了最多时间和 Token，方便优化。如果你发现 Agent 节点消耗了 80% 的资源，就可以考虑是否能把它降级为 Workflow。

---

## 实操练习

### 目标

将我们的 AI 智能助手重构为混合架构——核心流程用 Workflow 保证可靠性，灵活部分用 Agent。

### 步骤

1. **梳理现有功能，分类为 Workflow 或 Agent**：
   - 日程管理：Workflow（流程固定）
   - 知识问答：Workflow（RAG 流程固定）
   - 写作辅助：Agent（需要灵活性）
   - 通用对话：简单 LLM 调用

2. **实现意图分类节点**：
   - 用 `generateText` 实现结构化分类
   - 定义明确的分类 schema
   - 添加置信度阈值，低置信度走兜底

3. **实现混合路由**：
   - 关键词路由作为第一层（快速、确定）
   - LLM 分类作为第二层（灵活、智能）
   - 兜底策略作为第三层（安全网）

4. **添加 Workflow 追踪**：
   - 每个节点记录输入、输出、耗时
   - 区分 code/llm/agent 节点
   - 输出可视化的执行追踪

5. **实现 Agent → Workflow 降级机制**：
   - 监控 Agent 节点的行为模式
   - 当某个模式出现频率超过阈值时，提示可以降级

### 验收标准

- [ ] 所有功能模块有明确的 Workflow/Agent 分类文档
- [ ] 意图分类准确率 > 90%（用至少 50 个测试用例验证）
- [ ] Workflow 节点有单元测试
- [ ] Agent 节点有 stopWhen 限制和超时机制
- [ ] 每个请求输出完整的追踪日志
- [ ] 有清晰的降级策略（Agent 不可用时 fallback 到 Workflow 或人工）

### 挑战加分项

- 实现 A/B 测试框架：同一个功能用 Workflow 和 Agent 两种方式实现，对比效果
- 为 Workflow 实现可视化配置界面（React 组件，拖拽编辑流程）
- 实现自动降级：当 Agent 节点的错误率超过阈值时，自动切换到 Workflow 备选方案
- 构建一个决策矩阵工具：输入场景特征，输出推荐使用 Workflow 还是 Agent

---

## 本章小结

本章我们探讨了 AI 应用架构中最重要的设计决策之一：Workflow vs Agent。

1. **Workflow 是确定性的 AI 流程**：流程由代码定义，AI 只在特定节点做决策。可预测、可测试、成本可控。类比 Express 中间件链。

2. **Agent 是非确定性的 AI 决策循环**：每次可能走不同的路径。灵活、能应对新场景，但不可预测、难调试、成本不确定。

3. **选择指南**：
   - 能画出流程图 → Workflow
   - 失败后果严重 → Workflow
   - 能穷举所有场景 → Workflow
   - 需要开放式探索 → Agent
   - 大多数情况 → 先 Workflow，不够再升级

4. **混合架构是最佳实践**：外层 Workflow 保证流程可控，内层在需要灵活性的节点使用 Agent。就像 React 应用的路由是固定的，但组件内部可以灵活渲染。

5. **Anthropic 的建议**：先从最简单的方案开始（单次 LLM 调用），逐级升级（Chain → Workflow → Agent → Multi-Agent），每升一级都问自己"当前方案真的不够吗？"

6. **Agent 可以降级为 Workflow**：观察 Agent 的行为模式，把稳定的路径固化为代码逻辑，只保留真正需要灵活性的部分。

**最重要的一句话**：**不是所有钉子都需要 Agent 这把锤子。好的工程师选择合适的工具，而不是最炫酷的工具。**

下一章我们将进入体验篇，讨论如何为 Agent 设计优秀的用户界面——毕竟再强大的 Agent，如果用户体验不好，也白搭。
