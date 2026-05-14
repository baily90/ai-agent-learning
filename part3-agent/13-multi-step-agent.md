# 第13章：Multi-step Agent — 把大象装进冰箱

## 引言

"把大象装进冰箱需要几步？" —— 打开冰箱门、把大象放进去、关上冰箱门。三步。

这个经典脑筋急转弯其实藏着一个深刻的工程道理：**再复杂的任务，都可以拆解成一系列简单的步骤**。问题在于，谁来拆？怎么拆？拆完怎么执行？中间出错了怎么办？

在前面的章节里，我们的 Agent 已经能调用工具、检索知识库、做出决策了。但如果你观察这些 Agent 的行为模式，它们本质上还是"**一问一答**"——用户问一个问题，Agent 执行一轮或几轮工具调用，返回结果。整个过程在一次交互里就完成了。

但现实世界的任务远比这复杂。

> 用户："帮我写一篇关于 MCP 协议的技术调研报告。"

这一句话背后，需要的操作链路是：

1. 确定报告结构和读者群体
2. 搜索 MCP 的官方文档和相关文章
3. 整理搜索结果，提取关键信息
4. 规划报告大纲
5. 逐节撰写内容
6. 检查引用是否准确
7. 审校全文，修改语法和逻辑
8. 生成最终版本

这就像你在前端项目里配置的 CI/CD Pipeline —— 不是一个命令搞定一切，而是 **lint → test → build → deploy** 多个 stage 串联执行，每个 stage 的输出是下一个 stage 的输入，中间任何一个环节失败都得处理。

本章就来解决这个问题：**如何让 Agent 像流水线一样，自主规划并执行多步复杂任务。**

---

## 13.1 为什么需要多步 Agent

### 一句话直觉

单步 Agent 是螺丝刀，多步 Agent 是自动化产线。

### 前端类比

你刚学前端的时候，部署一个项目是这样的：手动 `npm run build`，手动把 dist 目录传到服务器，手动重启 nginx。每一步都要你亲自盯着。

后来你配了 CI/CD：push 代码自动触发 → 跑测试 → 构建 → 部署 → 发通知。你只需要 `git push`，剩下的全自动。

多步 Agent 就是 AI 领域的 CI/CD —— 你给它一个高层目标，它自己拆解成步骤，自己执行，自己处理异常。

### 详细原理

单步 Agent 的局限性来自三个方面：

**1. 认知负荷限制**

即使是最强的大模型，在一次调用里处理过多信息也会质量下降。把一个大任务拆成小步骤，每一步 AI 只需要聚焦在有限的上下文上，输出质量反而更高。这就像你写代码时，一个 500 行的函数远不如 10 个 50 行的函数好维护。

**2. 信息依赖链**

很多任务的后续步骤依赖前序步骤的结果。你不搜索资料，就没法写报告；你不写初稿，就没法审校。这种依赖关系要求 Agent 有"先做 A，再用 A 的结果做 B"的能力。

**3. 容错需求**

一口气干完所有事情，中间出错了只能从头来过。分步执行的好处是：第 3 步失败了，前 2 步的结果还在，修复后从第 3 步继续就行。

```
单步 Agent 的模式：
用户 → [一次性处理所有事] → 结果（可能超长、质量不稳定）

多步 Agent 的模式：
用户 → [分解计划] → [步骤1] → [步骤2] → ... → [步骤N] → 结果（每步质量可控）
```

### 深层追问

多步 Agent 的核心挑战不是"能不能执行多步"，而是**多步之间的协调**。这就引出了本章最重要的四个主题：任务分解、执行编排、状态管理、错误恢复。

---

## 13.2 任务分解（Task Decomposition）

### 一句话直觉

任务分解就是把"把大象装进冰箱"变成一个可执行的步骤清单。

### 前端类比

产品经理给你一句话需求："做一个用户管理页面"。你第一件事不是写代码，而是拆 Jira：

- 设计数据模型
- 写 CRUD 接口
- 做列表页
- 做详情页
- 做权限控制
- 写单元测试

这个"需求 → 任务列表"的过程，就是任务分解。

### 详细原理

任务分解有两种基本策略：

#### 策略一：AI 自主分解

让大模型根据用户的高层目标，自己生成一个结构化的执行计划。

```
输入："帮我分析竞品的定价策略"
AI 输出的计划：
{
  "steps": [
    { "id": 1, "action": "确定主要竞品列表", "tool": "search" },
    { "id": 2, "action": "搜索每个竞品的定价页面", "tool": "search", "depends_on": [1] },
    { "id": 3, "action": "提取定价信息和方案对比", "tool": "extract", "depends_on": [2] },
    { "id": 4, "action": "分析定价模式和策略", "tool": "analyze", "depends_on": [3] },
    { "id": 5, "action": "生成对比报告", "tool": "generate", "depends_on": [4] }
  ]
}
```

**优点**：灵活，能处理从未见过的任务类型。
**缺点**：不稳定，可能漏掉关键步骤，或者分解得不合理。

#### 策略二：预定义模板

为常见任务类型预设分解模板，AI 只需要填充参数。

```
模板 "技术调研报告"：
1. 确认调研范围和关键词 → {topic}
2. 多源搜索（官方文档、博客、GitHub）→ {sources}
3. 信息提取和去重 → {key_points}
4. 大纲生成 → {outline}
5. 逐节撰写 → {content}
6. 审校 → {final}
```

**优点**：稳定可靠，步骤经过验证。
**缺点**：覆盖有限，遇到新任务类型需要新模板。

#### 实践中的最佳方案：混合策略

让 AI 先尝试自主分解，然后用预定义的规则或模板来"审核"这个计划。比如：

- 规则 1：搜索类步骤必须在分析类步骤之前
- 规则 2：生成长文本之前必须有大纲步骤
- 规则 3：总步骤数不应超过 10 步（太多说明分解过细了）

### 分解粒度：多细才算合适？

分解粒度是一个典型的权衡问题：

```
太粗（2-3步）："搜索资料 → 写报告"
  问题：每步的工作量太大，出错难定位，AI 质量不稳定

太细（20+步）："打开浏览器 → 输入关键词 → 点击搜索 → 点击第一个结果..."
  问题：管理开销超过执行本身，步骤间的状态传递变成噩梦

刚好（5-8步）：每步有明确的输入输出，可独立验证
  类比：函数的单一职责原则 —— 做一件事，做好这件事
```

经验法则：**一个步骤应该对应一次有意义的状态变化**。"搜索了新信息"是有意义的变化，"拼接了一个字符串"不是。

### 动态调整：计划赶不上变化

这是多步 Agent 最难的部分。执行到第 3 步时发现：搜索结果和预期完全不同，原来的计划不再合理。怎么办？

三种策略：

**刚性执行**：不管发生什么，按原计划走。简单但可能产出垃圾结果。

**每步重新规划**：执行完每一步，都重新评估剩余计划。灵活但成本高（每步都要多一次 AI 调用来评估）。

**触发式调整**：正常按计划执行，但设置"触发条件"——当某一步的输出和预期严重不符时，才触发重新规划。这是实践中最常用的方案。

```
触发条件示例：
- 搜索返回 0 条结果 → 重新规划搜索策略
- 文本生成质量评分 < 阈值 → 增加一步"修改润色"
- 用户反馈"方向不对" → 暂停，重新确认需求
```

---

## 13.3 执行链（Execution Chain）

### 一句话直觉

执行链就是步骤之间的"连线方式"——串联、并联还是条件分支。

### 前端类比

这简直就是 JavaScript 异步编程的翻版：

```javascript
// 顺序执行 = Promise chain
await step1();
await step2(); // 依赖 step1 的结果
await step3(); // 依赖 step2 的结果

// 并行执行 = Promise.all
await Promise.all([searchGoogle(), searchBing(), searchGitHub()]);

// 条件分支 = if-else
const result = await analyze();
if (result.needsMoreData) {
  await searchMore();
} else {
  await generateReport();
}

// 循环执行 = while loop
let quality = 0;
while (quality < 0.8) {
  await revise();
  quality = await evaluate();
}
```

### 详细原理

#### 顺序执行

最简单也最常见的模式。步骤之间有严格的数据依赖。

```
搜索资料 → 整理大纲 → 撰写内容 → 审校修改
     ↓          ↓          ↓          ↓
  搜索结果    结构化大纲   完整初稿    最终版本
```

关键设计：每一步的输出格式要明确定义，因为它是下一步的输入。这就像 API 设计里的"契约"——上游保证输出格式，下游基于格式解析。

#### 并行执行

当多个步骤之间没有数据依赖时，可以同时执行以节省时间。

```
         ┌→ 搜索 Google ─┐
用户需求 ├→ 搜索 GitHub ─├→ 合并结果 → 分析
         └→ 搜索论文库 ──┘
```

但并行执行有一个隐藏的陷阱：**资源竞争**。如果两个并行步骤都要调用同一个 API，而这个 API 有频率限制，就会冲突。在 Agent 场景下，"资源"通常是 LLM 的 API 调用配额、外部工具的访问频率、或者共享的上下文窗口。

#### 条件分支

根据某一步的执行结果，动态选择后续路径。

```
分析数据 → 数据充分？─ 是 → 直接生成报告
                     └ 否 → 补充搜索 → 重新分析 → 生成报告
```

这要求 Agent 能"评判"中间结果的质量。实践中通常通过以下方式实现：

- 让 AI 自己评估（让另一个 AI 调用来打分）
- 规则判断（搜索结果数量 < 3 就算"不充分"）
- 用户确认（关键节点暂停，等用户反馈）

#### 循环执行

某些步骤需要反复执行直到达标。最典型的场景：**自我修正**。

```
while (未达标) {
  生成内容 → 自我评估 → 发现问题 → 修改内容
}
```

这里最关键的设计是**退出条件**：如果 Agent 永远觉得自己写得不够好，就会陷入死循环。必须设置最大重试次数、超时时间、或者"足够好"的阈值。

```
实践中的退出条件组合：
1. 质量评分 >= 0.8（达标退出）
2. 已重试 3 次（强制退出）
3. 执行时间 > 60 秒（超时退出）
满足任意一条即退出
```

---

## 13.4 状态管理

### 一句话直觉

多步 Agent 的状态管理，就是给流水线的每个工位装上"半成品货架"。

### 前端类比

在 React 里，你用 `useState` 管理组件状态，用 Redux/Zustand 管理全局状态，用 `localStorage` 做持久化。多步 Agent 的状态管理几乎是同一套思路，只是场景不同：

| React 状态管理 | Agent 状态管理 |
|------------|------------|
| `useState` —— 组件局部状态 | 单步执行的局部变量 |
| `Redux store` —— 全局共享状态 | Agent 执行过程的全局上下文 |
| `localStorage` —— 持久化 | Checkpoint 快照 |
| `状态序列化 / hydration` | Agent 中间状态的保存和恢复 |

### 详细原理

Agent 执行过程中需要管理三类状态：

#### 1. 执行计划状态

```typescript
interface AgentPlan {
  steps: Step[];           // 所有步骤
  currentStepIndex: number; // 当前执行到哪一步
  status: 'planning' | 'executing' | 'paused' | 'completed' | 'failed';
}

interface Step {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  dependencies: string[];   // 依赖哪些步骤的结果
  result?: unknown;         // 执行结果
  error?: string;           // 错误信息
}
```

#### 2. 中间产出物

每一步的输出结果需要保存，因为后续步骤可能要用。这就像 CI/CD 里的 **artifacts**。

```
步骤1 "搜索资料" → 产出物：[搜索结果列表]
步骤2 "生成大纲" → 产出物：[大纲 JSON]（需要读取步骤1的产出物）
步骤3 "撰写内容" → 产出物：[文章全文]（需要读取步骤1和步骤2的产出物）
```

关键问题：**产出物放在哪？**

- **放在内存里**：简单直接，但 Agent 进程重启就丢了
- **放在 LLM 的上下文里**：让 AI 能直接看到，但上下文窗口有限
- **放在外部存储里**：可靠持久，但需要"投喂"给 AI 才能使用

实践中通常是混合方案：关键产出物放在外部存储（数据库、文件系统），同时在 LLM 上下文里放一个"摘要"供 AI 参考。

#### 3. Checkpoint（检查点）

Checkpoint 是对 Agent 某一时刻完整状态的快照。它的作用是：如果后续步骤失败了，可以从最近的 Checkpoint 恢复，而不用从头开始。

```
执行步骤1 → [保存 Checkpoint-1]
执行步骤2 → [保存 Checkpoint-2]
执行步骤3 → 失败！
                ↓
从 Checkpoint-2 恢复 → 重试步骤3
```

Checkpoint 需要序列化的内容：

```typescript
interface Checkpoint {
  timestamp: number;
  planState: AgentPlan;         // 计划执行状态
  artifacts: Record<string, any>; // 所有中间产出物
  context: Message[];           // 到目前为止的对话上下文
  metadata: {
    totalTokensUsed: number;
    totalTimeMs: number;
    stepResults: Record<string, StepResult>;
  };
}
```

但 Checkpoint 有一个根本性的局限：**它只能恢复 Agent 的内部状态，无法恢复外部世界的状态**。如果步骤 2 已经发了一封邮件，步骤 3 失败后回滚到步骤 2，那封邮件不会自动撤回。这就是分布式系统里经典的"补偿事务"问题。

---

## 13.5 错误恢复策略

### 一句话直觉

错误恢复就是给 Agent 写 try-catch，但比前端的 try-catch 复杂得多。

### 前端类比

在前端做错误处理，你有这些工具：

```javascript
// 1. 重试
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fetch(url); }
    catch (e) { if (i === maxRetries - 1) throw e; }
  }
}

// 2. 降级
function renderChart(data) {
  try { return <FancyChart data={data} />; }
  catch { return <SimpleTable data={data} />; }  // 降级方案
}

// 3. 断路器
if (failureCount > threshold) {
  return cachedResult; // 不再尝试，用缓存
}
```

多步 Agent 的错误恢复策略与之类似，但要处理的情况更复杂。

### 详细原理

#### 策略一：重试（Retry）

最简单的恢复策略。某一步失败了，原地重新执行。

适用场景：
- API 调用超时、网络抖动
- AI 生成的格式不对（JSON 解析失败）
- 临时性的外部服务不可用

不适用场景：
- 逻辑错误（同样的输入会产生同样的错误）
- 权限问题（重试一万次也没用）

实践要点：
- 指数退避（第一次等 1 秒，第二次等 2 秒，第三次等 4 秒）
- 最大重试次数（一般 3 次够了）
- 重试时加入随机性（jitter），避免多个 Agent 同时重试把上游打崩

#### 策略二：回退（Rollback）

撤销已执行的步骤，回到一个已知的安全状态。

```
步骤1: 创建草稿 ✓
步骤2: 添加数据 ✓
步骤3: 生成图表 ✗ → 回退到步骤2的状态
```

这直接对应数据库的事务回滚。但 Agent 场景下的回退比数据库难得多：

- **可回退的操作**：修改文件、更新数据库记录、修改内部状态
- **不可回退的操作**：发送邮件、调用第三方 API、发布内容

对于不可回退的操作，需要引入"补偿操作"的概念：

```
操作：发送了一封错误的邮件
补偿：再发一封更正邮件

操作：创建了一个 Jira ticket
补偿：关闭或删除这个 ticket
```

不是所有操作都有完美的补偿方案，这就是为什么**关键操作必须在执行前确认**（Human-in-the-Loop）。

#### 策略三：替代路径（Alternative Path）

当一条路走不通时，换一条路。

```
方案A：通过 Google API 搜索 → 失败
         ↓
方案B：通过 Bing API 搜索 → 成功！继续执行
```

这类似前端的"降级方案"（graceful degradation），也类似微服务架构中的"熔断后走备用链路"。

实现上，需要在规划阶段就考虑好替代方案：

```typescript
interface StepDefinition {
  primary: Action;        // 主要方案
  fallbacks: Action[];    // 备选方案列表，按优先级排列
  skipCondition?: () => boolean;  // 满足条件时跳过此步
}
```

#### 策略四：人工介入（Human Escalation）

当自动恢复策略都不奏效时，或者某些决策 Agent 自己拿不准时，暂停执行，等待人类介入。

```
Agent: "在执行第4步时遇到了问题：搜索结果里有两种矛盾的观点，
       我不确定应该引用哪一种。请您确认：
       A) 观点一：MCP 已经是行业标准
       B) 观点二：MCP 还在早期阶段
       或者 C) 两种观点都引用，做对比分析"

用户: "选 C"

Agent: "收到，继续执行..."
```

---

## 13.6 Human-in-the-Loop：人机协作

### 一句话直觉

Human-in-the-Loop 就是给自动驾驶加上人工接管按钮。

### 前端类比

你一定写过这种代码：

```javascript
// 危险操作前加确认
const handleDelete = async () => {
  const confirmed = await confirm('确定要删除吗？此操作不可撤销。');
  if (confirmed) {
    await deleteItem(id);
  }
};
```

关键是**什么操作需要确认，什么操作不需要**。删除要确认，查看不需要。Agent 场景下也是同样的问题。

### 确认点设计原则

**必须确认的场景：**
- 不可逆操作（发邮件、发布内容、删除数据）
- 涉及金钱（下单、付款、退款）
- 计划变更（AI 觉得原计划需要调整，先问用户同意不同意）
- 敏感信息（要访问用户的私人数据）

**不需要确认的场景：**
- 只读操作（搜索、查询）
- 中间处理（数据清洗、格式转换）
- 已授权的操作（用户事先明确授权过的）

**自适应确认策略：**

这是一个高级技巧——根据 Agent 的"信心"来动态决定是否需要确认。

```
信心 > 90%：自动执行
信心 60-90%：执行后通知用户（用户可事后撤销）
信心 < 60%：暂停，等待用户确认
```

信心的来源可以是 AI 的自我评估、历史成功率、或者任务的风险等级。

### 异步等待的架构设计

当 Agent 需要等待用户输入时，不能让整个服务"阻塞"在那里。这需要一个异步架构：

```
Agent 执行到确认点 → 保存状态到数据库 → 发送通知给用户 → 释放计算资源
                                                            ↓
用户收到通知 → 做出决定 → 触发回调 → 从数据库加载状态 → 继续执行
```

这就是消息队列的经典场景。前端开发者应该对这种模式不陌生——它就像一个需要用户审批的工作流，只不过审批者是真人，而不是另一个系统。

---

## 13.7 长时间运行的 Agent

### 一句话直觉

有些任务需要跑几分钟甚至几小时，你不能让用户盯着一个转圈圈的 loading 等那么久。

### 前端类比

你处理过文件上传吗？大文件上传不能用普通的 HTTP 请求——它可能要几分钟，需要进度条、断点续传、后台执行。长时间运行的 Agent 面临完全相同的挑战。

```
短任务（< 30秒）：同步等待，展示 loading
中等任务（30秒 - 5分钟）：显示进度条，允许后台执行
长任务（> 5分钟）：后台执行，定期推送进度通知
```

### 详细原理

#### 超时处理

Serverless 函数通常有执行时间限制（Vercel 默认 10 秒，最长 300 秒）。长时间运行的 Agent 不能放在 Serverless 里。

解决方案：
- **分片执行**：把长任务拆成多个短任务，每个短任务在 Serverless 函数时间限制内完成。通过队列串联。
- **长连接服务**：使用独立的服务器进程（非 Serverless），通过 WebSocket 和前端保持连接。
- **任务队列**：Agent 执行过程放到后台任务队列（BullMQ、Inngest 等），前端轮询或通过 WebSocket 接收状态更新。

#### 进度推送

用户需要知道 Agent 的执行进度。两种技术方案：

**Server-Sent Events（SSE）**：服务端单向推送，前端只接收。简单轻量。

```
Agent 执行步骤1 → SSE: { step: 1, status: "completed", message: "搜索完成" }
Agent 执行步骤2 → SSE: { step: 2, status: "running", message: "正在生成大纲..." }
Agent 执行步骤2 → SSE: { step: 2, status: "completed", message: "大纲已生成" }
```

**WebSocket**：双向通信。适合需要用户中途交互的场景。

```
服务端 → 前端: { type: "progress", step: 3, message: "需要确认..." }
前端 → 服务端: { type: "confirm", decision: "approve" }
服务端 → 前端: { type: "progress", step: 4, message: "继续执行..." }
```

#### 断线恢复

用户关掉浏览器又打开，应该能看到 Agent 的最新状态。这意味着：

1. Agent 的执行状态必须持久化到数据库
2. 前端加载时先查询当前任务状态
3. 如果任务还在执行，重新建立 SSE/WebSocket 连接

这和前端常见的"刷新页面后恢复状态"是同一个问题——关键在于状态持久化和状态恢复。

---

## 概念辨析

### 多步 Agent vs Workflow

| 维度 | 多步 Agent | Workflow |
|------|-----------|----------|
| 步骤定义 | AI 动态生成 | 人工预定义 |
| 执行路径 | 可能随时调整 | 固定不变 |
| 适用场景 | 开放式任务 | 标准化流程 |
| 可靠性 | 较低（AI 可能出错） | 较高（路径确定） |
| 灵活性 | 高（能处理新任务） | 低（只能处理预设的） |

实践中往往是混合方案：大框架用 Workflow 保证稳定性，细节用 Agent 保证灵活性。比如"写技术报告"的大流程是固定的（搜索→大纲→撰写→审校），但每一步的具体执行由 AI 灵活处理。

### 任务分解 vs Prompt Chaining

Prompt Chaining 是一种更简单的多步模式：直接用代码定义每一步的 prompt，按顺序调用。它和 Agent 的任务分解的区别在于：

- **Prompt Chaining**：开发者在代码里写死步骤和顺序
- **任务分解**：AI 自己决定步骤和顺序

Prompt Chaining 更像是"预设的流水线"，而任务分解是"AI 自主规划的流水线"。前者更稳定，后者更灵活。

### Checkpoint vs 缓存

- **Checkpoint**：保存完整的执行状态快照，用于故障恢复
- **缓存**：保存特定步骤的输出结果，用于避免重复计算

二者的区别在于目的：Checkpoint 是为了"从断点继续"，缓存是为了"跳过已完成的步骤"。但在实现上，它们经常共享同一个存储系统。

---

## 灵魂拷问

> **Q: AI 分解任务的能力可靠吗？如果它分解错了怎么办？谁来验证计划的合理性？**

A: 坦率说，**不完全可靠**。AI 的任务分解能力和它的通用推理能力正相关——处理它"见过"的任务类型时表现不错，面对全新类型的任务就可能分解得一塌糊涂。

验证计划合理性有三种手段：

1. **规则校验**：预定义一组规则，自动检查计划是否合理。比如"不能在获取数据之前分析数据"、"步骤数不能超过 15"。这能过滤掉明显不合理的计划。

2. **AI 交叉验证**：让另一个 AI 调用来审核计划。"请评估以下计划是否合理，是否有遗漏的步骤"。这能提升质量，但增加了 Token 消耗。

3. **Human-in-the-Loop**：关键任务的计划必须经过用户确认。这最可靠，但会打断自动化流程。

实践建议：低风险任务用规则校验自动放行，中风险任务用 AI 交叉验证，高风险任务必须人工确认。

---

> **Q: Agent 执行到一半发现计划需要调整，应该"将错就错走下去"还是"推倒重来"？**

A: 两种极端都不好。将错就错可能产出垃圾结果浪费用户时间，推倒重来则丢弃了已完成步骤的成果。

最佳策略是**局部重规划**：保留已完成步骤的结果（它们往往是有价值的），只对剩余步骤进行重新规划。

```
原计划：A → B → C → D → E
执行到 C 时发现问题
         ↓
保留 A、B 的结果
从 C 开始重新规划：C' → D' → F（新步骤）
```

类比一下：你写代码写到一半发现架构不对，你不会把已经写好的工具函数都删了重来——你保留能用的部分，调整后面的设计。

技术实现上，关键是让 AI 在重规划时能"看到"已完成步骤的结果，这样它才能基于已有信息做出更好的计划。

---

> **Q: Checkpoint 恢复听起来很好，但如果外部状态已经变了（比如已经发了一封邮件），怎么办？**

A: 这是分布式系统领域的经典问题，叫做"Saga Pattern"中的补偿事务。核心思想是：**你无法撤销已经发生的事情，但你可以执行一个"补偿动作"来抵消它的影响**。

在 Agent 场景下，操作可以分为三类：

- **可逆操作**：修改草稿、更新数据库字段 → 直接撤销
- **可补偿操作**：发邮件 → 发一封更正邮件；创建 Jira → 关闭 Jira
- **不可补偿操作**：公开发布的言论、已执行的金融交易

对于不可补偿操作，唯一的策略是**预防**：这类操作必须放在确认点之后，确保执行时万无一失。这也解释了为什么 Human-in-the-Loop 不是"锦上添花"，而是"必须有"。

---

> **Q: Human-in-the-Loop 的确认点设计得太多用户烦，太少可能出大错。有没有自适应的方案？**

A: 有。核心思路是**建立信任梯度**。

新用户或新场景：确认点多一些，Agent 每一步都请示。
用户对 Agent 建立信任后：逐步减少确认点，只在高风险操作时确认。
同类任务执行多次后：用户可以配置"自动批准"规则。

实现上，可以维护一个"信任分数"：

```
初始信任分 = 50
用户确认 Agent 的决策 → 信任分 +5
用户否决 Agent 的决策 → 信任分 -15（否决的惩罚更重）
Agent 犯错 → 信任分 -30
```

当信任分超过某个阈值时，某些确认点可以自动跳过。这有点像手机上的"已信任此设备，不再需要验证码"。

---

> **Q: 串行执行安全但慢，并行执行快但可能有依赖冲突。怎么自动判断哪些步骤可以并行？**

A: 这本质上是编译原理里的"依赖分析"问题。方法是：

1. 为每个步骤标注它的"输入"（需要什么数据）和"输出"（产出什么数据）
2. 如果步骤 B 的输入不包含步骤 A 的输出，则 A 和 B 可以并行
3. 构建一个有向无环图（DAG），用拓扑排序找出并行组

```
步骤1(输出:搜索结果) → 步骤3(输入:搜索结果)
步骤2(输出:用户画像) → 步骤3(输入:用户画像)

结论：步骤1 和 步骤2 可以并行，步骤3 必须等它们都完成
```

前端的打包工具（Webpack/Vite）其实就在做类似的事情——分析模块依赖关系，能并行处理的就并行。

在 AI 自主分解的计划中，可以让 AI 在生成步骤时就标注依赖关系（`depends_on` 字段），然后用代码来构建 DAG 和调度并行执行。

---

> **Q: Agent 跑了 10 分钟还没完成，用户关掉了浏览器。Agent 应该继续执行还是停下来？**

A: 取决于任务类型和成本。两种策略：

**策略一：继续执行**。适用于有明确产出物的任务（生成报告、数据分析）。用户回来后可以查看结果。就像你提交了一个 CI 任务后关掉页面，CI 不会因此停止。

**策略二：暂停并保存进度**。适用于需要用户交互的任务，或者执行成本高（Token 消耗大）的任务。暂停后保存 Checkpoint，用户回来可以选择继续或取消。

**策略三：超时自动终止**。给每个任务设置最大执行时间，超时后自动停止并保存已有结果。这是对"失控 Agent"的安全兜底——你不希望一个 Agent 因为陷入死循环而烧掉你一整天的 API 额度。

最佳实践是让用户在创建任务时选择：

```
□ 关闭页面后继续在后台执行
□ 关闭页面后暂停，下次打开时继续
□ 最长执行时间：[30分钟 ▼]
```

---

## 最佳实践

### DO

- **DO 先规划再执行**：让 Agent 生成一个计划，用结构化格式（JSON）输出，验证后再开始执行。不要让 Agent "想到哪做到哪"。
- **DO 设置超时和重试上限**：每一步都应该有超时时间和最大重试次数。没有退出条件的循环是定时炸弹。
- **DO 保存中间结果**：每完成一步就保存结果。即使后续步骤全失败，至少前面的成果还在。
- **DO 对不可逆操作加确认**：发邮件、付款、删除数据这类操作，一定要让用户确认。没有例外。
- **DO 提供进度反馈**：用户需要知道 Agent 在干什么。至少在每个步骤开始和结束时通知用户。
- **DO 记录执行日志**：每一步的输入、输出、耗时、Token 消耗都应该记录下来，方便 debug 和优化。
- **DO 设计优雅的降级方案**：当某条路走不通时，有备选方案。完全走不通时，能给用户一个"到目前为止已完成的部分结果"，比什么都不返回要好。

### DON'T

- **DON'T 把所有逻辑塞进一个 prompt**：一个超长的 prompt 让 AI 一次搞定所有事，质量和可控性都很差。分步才是正道。
- **DON'T 忽略错误处理**：Agent 执行多步时出错是常态，不是异常。没有错误处理的多步 Agent 等于一个没有 try-catch 的异步链——早晚崩。
- **DON'T 无限重试**：3 次失败就该换策略或者停下来问人。无限重试既浪费钱又解决不了问题。
- **DON'T 并行执行有共享状态的步骤**：除非你有明确的并发控制机制，否则不要让多个步骤同时修改同一份数据。
- **DON'T 信任 AI 的自我评估**：AI 说"我的输出质量很高"不代表真的高。用具体的验证手段（规则检查、格式校验、另一个 AI 评估）来判断。
- **DON'T 让 Agent 在没有上限的情况下运行**：没有最大执行时间、没有最大 Token 预算、没有最大步骤数 —— 这是在裸奔。

---

## 代码实战

### 实战：构建一个多步研究 Agent

我们来用 Vercel AI SDK 构建一个能自主规划并执行多步任务的 Agent。这个 Agent 接收一个研究主题，自动分解任务、执行搜索、整理分析、生成报告。

```typescript
// types.ts — 核心类型定义
import { z } from 'zod';

// 执行计划的 Schema
export const StepSchema = z.object({
  id: z.string(),
  description: z.string(),
  action: z.enum(['search', 'analyze', 'generate', 'review']),
  dependsOn: z.array(z.string()).default([]),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']).default('pending'),
});

export const PlanSchema = z.object({
  goal: z.string(),
  steps: z.array(StepSchema),
});

export type Step = z.infer<typeof StepSchema>;
export type Plan = z.infer<typeof PlanSchema>;

// Checkpoint 类型
export interface Checkpoint {
  planState: Plan;
  artifacts: Record<string, string>;
  timestamp: number;
  tokensUsed: number;
}

// Agent 执行事件（用于进度推送）
export type AgentEvent =
  | { type: 'plan_created'; plan: Plan }
  | { type: 'step_started'; stepId: string; description: string }
  | { type: 'step_completed'; stepId: string; result: string }
  | { type: 'step_failed'; stepId: string; error: string }
  | { type: 'plan_adjusted'; newPlan: Plan }
  | { type: 'confirmation_needed'; stepId: string; message: string }
  | { type: 'completed'; finalResult: string }
  | { type: 'failed'; error: string };
```

```typescript
// planner.ts — 任务分解模块
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { PlanSchema, type Plan } from './types';

export async function createPlan(userGoal: string): Promise<Plan> {
  const { object: plan } = await generateObject({
    model: openai('gpt-4o'),
    schema: PlanSchema,
    prompt: `你是一个任务规划专家。请将以下用户目标分解为 3-8 个可执行的步骤。

用户目标：${userGoal}

规则：
1. 每个步骤必须有明确的动作类型：search（搜索信息）、analyze（分析数据）、generate（生成内容）、review（审校检查）
2. 用 dependsOn 标注步骤之间的依赖关系
3. search 类步骤应该在 analyze 之前
4. 最后一步应该是 review 类型
5. 步骤描述要具体、可执行，不要太抽象`,
  });

  return plan;
}

// 验证计划的合理性
export function validatePlan(plan: Plan): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // 规则1：步骤数在合理范围内
  if (plan.steps.length < 2) issues.push('步骤太少，可能遗漏了关键环节');
  if (plan.steps.length > 10) issues.push('步骤太多，建议合并相关步骤');

  // 规则2：依赖关系不能形成环
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stepMap = new Map(plan.steps.map(s => [s.id, s]));

  function hasCycle(stepId: string): boolean {
    if (visiting.has(stepId)) return true;
    if (visited.has(stepId)) return false;
    visiting.add(stepId);
    const step = stepMap.get(stepId);
    if (step) {
      for (const dep of step.dependsOn) {
        if (hasCycle(dep)) return true;
      }
    }
    visiting.delete(stepId);
    visited.add(stepId);
    return false;
  }

  for (const step of plan.steps) {
    if (hasCycle(step.id)) {
      issues.push(`检测到循环依赖，涉及步骤 ${step.id}`);
      break;
    }
  }

  // 规则3：search 应在 analyze 之前
  const searchSteps = plan.steps.filter(s => s.action === 'search');
  const analyzeSteps = plan.steps.filter(s => s.action === 'analyze');
  for (const analyzeStep of analyzeSteps) {
    const hasSearchDep = analyzeStep.dependsOn.some(depId =>
      searchSteps.some(s => s.id === depId)
    );
    if (!hasSearchDep && searchSteps.length > 0) {
      issues.push(`分析步骤 "${analyzeStep.id}" 没有依赖任何搜索步骤`);
    }
  }

  return { valid: issues.length === 0, issues };
}
```

```typescript
// executor.ts — 步骤执行引擎
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { Step, Checkpoint, AgentEvent } from './types';

// 单步执行器
async function executeStep(
  step: Step,
  artifacts: Record<string, string>,
  maxRetries: number = 3
): Promise<string> {
  // 收集依赖步骤的结果作为上下文
  const context = step.dependsOn
    .map(depId => `[${depId}的结果]:\n${artifacts[depId] || '(无结果)'}`)
    .join('\n\n');

  const actionPrompts: Record<string, string> = {
    search: `请根据以下任务描述搜索和整理相关信息。列出关键发现。
任务：${step.description}
${context ? `\n已有信息：\n${context}` : ''}`,

    analyze: `请分析以下信息，提取关键洞察和结论。
任务：${step.description}
${context ? `\n待分析的信息：\n${context}` : ''}`,

    generate: `请根据以下信息生成内容。
任务：${step.description}
${context ? `\n参考信息：\n${context}` : ''}`,

    review: `请审校以下内容，检查逻辑、准确性和完整性。指出问题并给出修改建议。
任务：${step.description}
${context ? `\n待审校的内容：\n${context}` : ''}`,
  };

  // 带重试的执行
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { text } = await generateText({
        model: openai('gpt-4o'),
        prompt: actionPrompts[step.action] || actionPrompts.generate,
        maxTokens: 2000,
      });
      return text;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        // 指数退避
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw new Error(`步骤 "${step.id}" 执行失败（已重试 ${maxRetries} 次）: ${lastError?.message}`);
}

// 保存检查点
function saveCheckpoint(
  plan: Plan,
  artifacts: Record<string, string>,
  tokensUsed: number
): Checkpoint {
  const checkpoint: Checkpoint = {
    planState: structuredClone(plan),
    artifacts: { ...artifacts },
    timestamp: Date.now(),
    tokensUsed,
  };
  // 实际项目中这里应该写入数据库或文件系统
  // 这里简化为内存保存
  return checkpoint;
}
```

```typescript
// agent.ts — 多步 Agent 主流程
import { createPlan, validatePlan } from './planner';
import type { Plan, AgentEvent, Checkpoint } from './types';

interface AgentOptions {
  maxStepTimeMs?: number;    // 单步超时时间
  maxTotalTimeMs?: number;   // 总超时时间
  maxRetries?: number;       // 单步最大重试次数
  onEvent?: (event: AgentEvent) => void;  // 事件回调
  onConfirmation?: (message: string) => Promise<boolean>;  // 确认回调
}

export async function runMultiStepAgent(
  userGoal: string,
  options: AgentOptions = {}
) {
  const {
    maxStepTimeMs = 30_000,
    maxTotalTimeMs = 300_000,
    maxRetries = 3,
    onEvent = () => {},
    onConfirmation,
  } = options;

  const startTime = Date.now();
  const artifacts: Record<string, string> = {};
  let tokensUsed = 0;

  // === 阶段 1：生成计划 ===
  const plan = await createPlan(userGoal);
  const validation = validatePlan(plan);

  if (!validation.valid) {
    // 计划有问题，让 AI 修正
    console.warn('计划验证问题:', validation.issues);
    // 实际实现中可以让 AI 根据反馈修正计划
  }

  onEvent({ type: 'plan_created', plan });

  // === 阶段 2：按依赖顺序执行 ===
  const completedSteps = new Set<string>();

  while (completedSteps.size < plan.steps.length) {
    // 检查总超时
    if (Date.now() - startTime > maxTotalTimeMs) {
      onEvent({ type: 'failed', error: '执行超时，已保存进度' });
      break;
    }

    // 找出所有可以执行的步骤（依赖已满足且未完成）
    const readySteps = plan.steps.filter(
      step =>
        step.status === 'pending' &&
        step.dependsOn.every(dep => completedSteps.has(dep))
    );

    if (readySteps.length === 0 && completedSteps.size < plan.steps.length) {
      onEvent({ type: 'failed', error: '检测到死锁：有步骤无法执行' });
      break;
    }

    // 并行执行所有就绪步骤
    const execPromises = readySteps.map(async step => {
      step.status = 'running';
      onEvent({ type: 'step_started', stepId: step.id, description: step.description });

      try {
        // 对不可逆操作请求确认
        if (step.action === 'generate' && onConfirmation) {
          const confirmed = await onConfirmation(
            `准备执行: ${step.description}\n是否继续？`
          );
          if (!confirmed) {
            step.status = 'skipped';
            return;
          }
        }

        // 执行步骤（带超时）
        const result = await Promise.race([
          executeStep(step, artifacts, maxRetries),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('步骤执行超时')), maxStepTimeMs)
          ),
        ]);

        // 保存结果
        artifacts[step.id] = result;
        step.status = 'completed';
        completedSteps.add(step.id);
        onEvent({ type: 'step_completed', stepId: step.id, result });

        // 保存检查点
        saveCheckpoint(plan, artifacts, tokensUsed);
      } catch (error) {
        step.status = 'failed';
        const errorMsg = error instanceof Error ? error.message : String(error);
        onEvent({ type: 'step_failed', stepId: step.id, error: errorMsg });

        // 尝试跳过非关键步骤
        if (step.action === 'review') {
          step.status = 'skipped';
          completedSteps.add(step.id);
          console.warn(`审校步骤 ${step.id} 失败，已跳过`);
        }
      }
    });

    await Promise.all(execPromises);
  }

  // === 阶段 3：汇总结果 ===
  const completedArtifacts = Object.entries(artifacts)
    .map(([stepId, result]) => {
      const step = plan.steps.find(s => s.id === stepId);
      return `## ${step?.description || stepId}\n\n${result}`;
    })
    .join('\n\n---\n\n');

  onEvent({ type: 'completed', finalResult: completedArtifacts });
  return completedArtifacts;
}
```

```typescript
// api/research/route.ts — Next.js API 路由（带 SSE 进度推送）
import { runMultiStepAgent } from '@/lib/agent';

export async function POST(req: Request) {
  const { goal } = await req.json();

  // 使用 TransformStream 实现 SSE
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // 后台执行 Agent
  (async () => {
    try {
      await runMultiStepAgent(goal, {
        maxTotalTimeMs: 120_000,
        onEvent: async (event) => {
          // 将事件写入 SSE 流
          const data = `data: ${JSON.stringify(event)}\n\n`;
          await writer.write(encoder.encode(data));
        },
      });
    } catch (error) {
      const data = `data: ${JSON.stringify({
        type: 'failed',
        error: String(error),
      })}\n\n`;
      await writer.write(encoder.encode(data));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

```typescript
// components/MultiStepAgent.tsx — 前端进度展示组件
'use client';

import { useState, useCallback } from 'react';
import type { AgentEvent, Plan, Step } from '@/lib/types';

function StepStatusIcon({ status }: { status: Step['status'] }) {
  switch (status) {
    case 'pending': return <span className="text-gray-400">○</span>;
    case 'running': return <span className="text-blue-500 animate-pulse">◉</span>;
    case 'completed': return <span className="text-green-500">●</span>;
    case 'failed': return <span className="text-red-500">✕</span>;
    case 'skipped': return <span className="text-yellow-500">◎</span>;
    default: return null;
  }
}

export function MultiStepAgent() {
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const startAgent = useCallback(async () => {
    setIsRunning(true);
    setEvents([]);
    setPlan(null);
    setResult(null);

    const response = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event: AgentEvent = JSON.parse(line.slice(6));
          setEvents(prev => [...prev, event]);

          // 更新 UI 状态
          if (event.type === 'plan_created') {
            setPlan(event.plan);
          } else if (event.type === 'step_started' && plan) {
            setPlan(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                steps: prev.steps.map(s =>
                  s.id === event.stepId ? { ...s, status: 'running' as const } : s
                ),
              };
            });
          } else if (event.type === 'step_completed' && plan) {
            setPlan(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                steps: prev.steps.map(s =>
                  s.id === event.stepId ? { ...s, status: 'completed' as const } : s
                ),
              };
            });
          } else if (event.type === 'completed') {
            setResult(event.finalResult);
          }
        }
      }
    }

    setIsRunning(false);
  }, [goal, plan]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="输入你的研究目标，例如：分析 2024 年前端框架趋势"
          className="w-full p-3 border rounded-lg"
          disabled={isRunning}
        />
        <button
          onClick={startAgent}
          disabled={isRunning || !goal}
          className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {isRunning ? '执行中...' : '开始研究'}
        </button>
      </div>

      {/* 执行计划可视化 */}
      {plan && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-bold mb-3">执行计划</h3>
          <div className="space-y-2">
            {plan.steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                <StepStatusIcon status={step.status} />
                <span className={step.status === 'running' ? 'font-medium' : ''}>
                  {step.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最终结果 */}
      {result && (
        <div className="p-4 bg-green-50 rounded-lg">
          <h3 className="font-bold mb-2">研究结果</h3>
          <div className="whitespace-pre-wrap text-sm">{result}</div>
        </div>
      )}
    </div>
  );
}
```

---

## 实操练习

### 目标

为你的 AI 工作助手添加多步任务执行能力。用户可以输入一个复杂的研究目标，助手自动分解任务、逐步执行、实时展示进度。

### 步骤

1. **定义类型系统**：创建 `Plan`、`Step`、`Checkpoint`、`AgentEvent` 等类型定义
2. **实现任务分解**：使用 `generateObject` 让 AI 生成结构化的执行计划，并实现计划验证逻辑
3. **实现执行引擎**：
   - 支持按依赖关系顺序执行
   - 每步执行带超时和重试
   - 执行完每步保存检查点
4. **实现 SSE 进度推送**：创建 API 路由，将 Agent 事件通过 Server-Sent Events 推送给前端
5. **实现前端进度展示**：
   - 展示执行计划列表和每步状态
   - 实时更新步骤状态（pending → running → completed/failed）
   - 最终结果展示
6. **测试**：输入"帮我调研 Vercel AI SDK 的核心功能和最佳实践"，验证整个流程

### 验收标准

- 输入一个研究目标后，Agent 能自动生成 3-8 步的执行计划
- 前端能实时看到每个步骤的执行状态
- 单步失败时能自动重试（最多 3 次）
- 整个执行过程有总超时限制
- 最终能输出一个完整的研究结果

### 挑战加分项

- **并行优化**：实现基于依赖关系的并行调度，无依赖的步骤同时执行
- **Checkpoint 恢复**：将 Checkpoint 持久化到 localStorage 或数据库，页面刷新后能从断点继续
- **动态重规划**：当某步的结果和预期不符时（比如搜索结果为空），自动调整后续计划
- **Human-in-the-Loop**：在关键步骤前弹出确认对话框，等待用户确认后继续
- **取消功能**：用户可以在执行过程中取消任务，Agent 优雅地停止并保存已有结果

---

## 本章小结

本章我们学习了如何构建能够自主规划和执行多步任务的 Agent。核心知识点回顾：

1. **任务分解**是多步 Agent 的起点。AI 自主分解灵活但不稳定，预定义模板稳定但不灵活，实践中用混合方案：AI 生成 + 规则校验。

2. **执行链**有四种基本模式：顺序执行（Promise chain）、并行执行（Promise.all）、条件分支（if-else）、循环执行（while loop）。选择哪种取决于步骤之间的依赖关系。

3. **状态管理**是多步 Agent 的骨架。需要管理执行计划状态、中间产出物和 Checkpoint。Checkpoint 让故障恢复成为可能，但无法恢复外部世界的状态。

4. **错误恢复**有四张牌：重试、回退、替代路径、人工介入。它们不是互斥的，而是按优先级组合使用。

5. **Human-in-the-Loop** 不是可选项而是必需品，关键在于确认点的设计——对不可逆操作必须确认，其他操作可以用信任梯度机制逐步减少确认。

6. **长时间运行**的 Agent 需要后台执行、进度推送和断线恢复机制。SSE 或 WebSocket 是前端获取进度的主要手段。

下一章我们将学习 MCP 协议——它让 Agent 的工具连接变得标准化，就像 USB 接口统一了所有外设的连接方式。你的 Agent 将不再局限于代码里硬编码的工具，而是可以热插拔任意 MCP 兼容的工具服务。
