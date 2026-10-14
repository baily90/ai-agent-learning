# 第12章：Agent 核心模式 — 从"你问我答"到"自主干活"

## 引言

在前面的十一章里，我们一步步给 AI 装上了各种能力：它能聊天（第 1-4 章）、能输出结构化数据（第 5 章）、能选模型（第 6 章）、能调用工具（第 7 章）、有记忆（第 8 章）、有知识库（第 9-10 章）、能看图读文件（第 11 章）。

但你有没有发现，到目前为止，我们构建的东西本质上都是同一个模式：**用户说一句，AI 做一步**。

用户说"查个天气"，AI 调用天气工具，返回结果。用户说"分析这张图"，AI 调用 Vision 能力，返回分析。每一步都需要用户来驱动。AI 就像一个非常听话但没有主动性的实习生——你说啥做啥，绝不多想一步。

这一章，我们要让这个实习生毕业。

想象一下你对助手说："帮我准备明天下午和张总的会议。"一个优秀的人类助手会怎么做？

1. 先查你明天下午的日程，确认时间段
2. 查看往期与张总的会议记录，了解背景
3. 收集相关项目的最新进度
4. 准备会议议程草案
5. 预定会议室
6. 发会议邀请
7. 把准备好的材料汇总发给你

注意：你没有告诉助手这 7 个步骤。你只给了一个**目标**，助手自己分解了任务、规划了步骤、逐步执行、并根据每步的结果调整下一步。

这就是 **Agent** 和 **Chatbot** 的本质区别。

这是本系列最关键的转折章节。从这里开始，我们不再只是"调用 AI 的能力"，而是开始构建"能自主行动的 AI 系统"。

---

## 12.1 什么是 Agent

### 一句话直觉

Agent 不只是"能聊天 + 能调工具"的 AI，而是能自主**感知环境、制定计划、执行行动、观察结果、调整策略**的完整系统。

### 前端类比：自动驾驶 vs 定速巡航

这是理解 Agent 最好的类比。

**定速巡航（Chatbot + Tool Use）**：
- 你设定速度 120km/h，车维持这个速度
- 前面有弯道？你得自己踩刹车
- 前面有车变道？你得自己打方向盘
- 每一个决策都需要人类来做

**自动驾驶（Agent）**：
- 你设定目的地"去机场"
- 车自己规划路线
- 遇到红灯自己停
- 前方有事故自动绕路
- 到了机场自动停车

从工程角度说：定速巡航是一个**单步执行器**——接收一个指令，执行一个动作。自动驾驶是一个**自主决策循环**——持续感知环境，持续做决策，持续执行行动，直到达成目标。

再用一个前端开发者更熟悉的类比：

**普通函数 vs 事件循环**：
- 普通函数：调用一次，执行一次，返回结果。就像 Chatbot 处理一个请求
- 事件循环（Event Loop）：持续运行，监听事件，处理事件，触发新事件，再监听...就像 Agent 的决策循环

### 深入原理

一个 Agent 系统的核心组件：

```
                    ┌─────────────┐
                    │   目标/任务   │  ← 用户给出
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
              ┌────▶│   推理/决策   │◀────┐
              │     └──────┬──────┘     │
              │            │            │
              │     ┌──────▼──────┐     │
              │     │   行动/执行   │     │
              │     └──────┬──────┘     │
              │            │            │
              │     ┌──────▼──────┐     │
              └─────│   观察/反馈   │─────┘
                    └─────────────┘
                    
    （循环持续，直到任务完成或达到终止条件）
```

每个组件的职责：

- **目标**：用户给出的高层任务，比如"帮我准备会议"
- **推理/决策**：LLM 分析当前状态，决定下一步做什么。这是 Agent 的"大脑"
- **行动/执行**：调用工具、API 或执行操作。这是 Agent 的"手"
- **观察/反馈**：获取行动的结果，更新对当前状态的理解。这是 Agent 的"眼"

关键洞察：**Agent 的核心能力不是"调用工具"，而是"决策"**。工具只是 Agent 的手脚，决策能力才是它的大脑。一个没有任何工具但能做出正确推理的 Agent，比一个有一百个工具但决策混乱的 Agent 强得多。

---

## 12.2 Agent vs Chatbot vs Copilot

这三个概念经常被混用，但它们代表了三种截然不同的人机协作模式。搞清楚它们的区别，你才能准确知道自己要构建的是什么。

### Chatbot（聊天机器人）

**模式**：你问一句，它答一句。完全被动。

**前端类比**：一个纯函数——给定输入，返回输出，不维护状态，不主动行动。

```
用户：明天北京天气怎么样？
Bot：明天北京晴，最高温 28°C，最低温 18°C。
用户：那我应该穿什么？
Bot：建议穿薄长袖或T恤，带个薄外套以防早晚凉。
```

每一轮都是独立的"请求-响应"。Bot 不会主动问你"需要我帮你看看后天吗？"

### Copilot（副驾驶）

**模式**：在你工作的过程中实时给建议。半主动——它会在你需要时出现，但最终决策权在你。

**前端类比**：IDE 的智能代码补全——你在写代码，它实时给你提示，但按不按 Tab 接受建议是你的事。

```
你在编辑器里写代码...
Copilot：[提示] 这个函数缺少错误处理，建议加 try-catch
你：（接受建议，加上 try-catch）
Copilot：[提示] 这段 SQL 可能有注入风险，建议用参数化查询
你：（暂时忽略）
```

Copilot 的核心是"辅助"——它让你的效率提升，但你始终是司机。

### Agent（智能代理）

**模式**：你给目标，它自己干。高度自主——它自己分解任务、决定步骤、执行操作、处理意外。

**前端类比**：CI/CD Pipeline——你只要 push 代码，Pipeline 自己跑测试、构建、部署、通知。每个步骤的结果决定下一步怎么走（测试失败了就通知开发者而不是继续部署）。

```
用户：帮我调研一下竞品 A 和竞品 B 的定价策略，整理一份对比报告。

Agent 内部过程：
  [思考] 需要获取两个竞品的定价信息，然后做对比分析
  [行动] 搜索竞品 A 的官网定价页面
  [观察] 找到了竞品 A 的三个套餐：基础版 99/月、专业版 299/月、企业版 定制
  [思考] 竞品 A 信息获取完成，接下来搜索竞品 B
  [行动] 搜索竞品 B 的官网定价页面
  [观察] 竞品 B 只有两个套餐：标准版 199/月、高级版 599/月
  [思考] 两个竞品的信息都有了，现在做对比分析
  [行动] 生成对比报告
  
Agent：这是竞品对比报告：[结构化的对比分析]
```

### 三者对比总结

| 维度 | Chatbot | Copilot | Agent |
|------|---------|---------|-------|
| 主动性 | 完全被动 | 半主动 | 高度自主 |
| 决策权 | 用户做所有决策 | 用户做最终决策 | Agent 做大部分决策 |
| 任务复杂度 | 单轮简单任务 | 持续辅助 | 多步复杂任务 |
| 错误影响 | 低（只影响单步） | 中（建议可能误导） | 高（错误可能连锁） |
| 适用场景 | 问答、客服 | 编码辅助、写作辅助 | 自动化工作流、复杂调研 |
| 实现复杂度 | 低 | 中 | 高 |

**一个重要的认识**：这三者不是非此即彼的。实际产品中，你可能需要混合使用——简单任务用 Chatbot 模式快速响应，日常工作用 Copilot 模式辅助提效，复杂任务切换到 Agent 模式自主执行。

---

## 12.3 ReAct 模式详解

### 一句话直觉

ReAct = Reasoning + Acting。AI 交替进行"推理"和"行动"，每次行动后观察结果，再决定下一步。走一步看一步。

### 前端类比

就像你在调试一个复杂的 bug：

1. **Thought**（推理）：看报错信息，分析可能的原因——"这个 TypeError 说明变量没定义，可能是异步问题"
2. **Action**（行动）：打开对应文件，加个 `console.log` 看看变量的值
3. **Observation**（观察）：运行代码，看到 `console.log` 输出 `undefined`
4. **Thought**（推理）："变量在 `await` 之前就被使用了，果然是异步问题"
5. **Action**（行动）：调整代码顺序，把变量的使用放到 `await` 之后
6. **Observation**（观察）：运行代码，bug 修复了

你没有一开始就知道 bug 的原因和解法，而是通过"推理-行动-观察"的循环，一步步逼近答案。

### 详细原理

ReAct 模式的核心是一个结构化的循环：

```
Thought: 我需要完成 XXX 任务。首先，我应该...
Action: 调用 XXX 工具，参数是 XXX
Observation: 工具返回了 XXX 结果
Thought: 根据这个结果，我发现...接下来应该...
Action: 调用 YYY 工具，参数是 YYY
Observation: 工具返回了 YYY 结果
Thought: 所有需要的信息都收集完了，我可以给出最终答案了
Final Answer: ...
```

让我们用一个完整的例子走一遍这个循环。

**用户请求**："帮我查看北京明天的天气，并给出穿衣建议。"

```
Thought: 用户想知道北京明天的天气和穿衣建议。
        我需要先查询天气数据，然后根据气温给出穿衣建议。
        第一步：调用天气 API 查询北京明天的天气。

Action: callTool("getWeather", { city: "北京", date: "tomorrow" })

Observation: { temp_high: 28, temp_low: 17, condition: "晴转多云", 
               humidity: 45, wind: "北风3-4级", uv_index: 7 }

Thought: 拿到天气数据了。明天北京晴转多云，最高 28°C，最低 17°C，
        紫外线指数 7（较强）。北风 3-4 级说明有点风。
        温差有 11 度，说明早晚凉、中午热。
        我已经有足够的信息来给出穿衣建议了。

Final Answer: 明天北京天气晴转多云，最高温 28°C，最低温 17°C。

        穿衣建议：
        - 白天可以穿短袖或薄长袖，体感舒适
        - 早晚温差大（11°C），出门带一件薄外套或衬衫
        - 紫外线较强（指数7），户外活动注意防晒
        - 有 3-4 级北风，裙装可能不太方便
```

这个例子只有一轮行动就完成了。来看一个更复杂的多轮例子。

**用户请求**："帮我对比北京和上海这周末的天气，推荐去哪个城市旅游。"

```
Thought: 用户想对比两个城市的周末天气来决定旅游目的地。
        我需要分别查询两个城市的天气，然后做对比分析。
        先查北京的。

Action: callTool("getWeather", { city: "北京", date: "saturday" })

Observation: { temp_high: 30, temp_low: 19, condition: "晴", 
               humidity: 35, wind: "微风" }

Thought: 北京周六是晴天，30°C，不错。接下来查上海的。

Action: callTool("getWeather", { city: "上海", date: "saturday" })

Observation: { temp_high: 26, temp_low: 22, condition: "小雨转阴", 
               humidity: 78, wind: "东南风3级" }

Thought: 上海周六有小雨，湿度也比较大。再查查周日的情况，
        完整对比两天的天气更有参考价值。

Action: callTool("getWeather", { city: "北京", date: "sunday" })

Observation: { temp_high: 28, temp_low: 18, condition: "多云", 
               humidity: 40, wind: "微风" }

Action: callTool("getWeather", { city: "上海", date: "sunday" })

Observation: { temp_high: 27, temp_low: 21, condition: "阴转多云", 
               humidity: 70, wind: "东南风2级" }

Thought: 数据都收集完了。北京周末两天都是好天气（晴/多云），
        上海周六有雨、周日阴转多云，湿度也大。
        从天气角度，北京更适合旅游。
        但我也应该考虑温度舒适度——北京略热（30°C），
        上海温度更宜人（26-27°C）。
        综合来看还是推荐北京，因为下雨对旅游影响太大了。

Final Answer: 周末天气对比：
        
        北京：周六晴 30°C，周日多云 28°C —— 天气很好
        上海：周六小雨 26°C，周日阴转多云 27°C —— 有雨

        推荐去北京。虽然温度略高，但两天都是好天气，
        适合户外活动。上海周六有雨，会影响行程安排。
        如果去北京，注意防晒和补水。
```

注意 Agent 在这个过程中的**决策能力**：
- 它自主决定需要查两天的天气而不只是一天
- 它综合考虑了多个因素（天气、温度、湿度）
- 它给出了有理有据的推荐，而不只是列数据

### ReAct 的优势和局限

**优势**：
- 灵活性高：每一步都根据当前观察做决策，能处理意外情况
- 推理透明：每个 Thought 步骤都解释了 Agent 的思考过程，便于调试
- 容错性好：如果一步做错了，后续可以根据观察结果自我纠正

**局限**：
- 效率不高：每一步都要等 LLM 推理，多步任务延迟累积
- 容易跑偏：如果前面的推理出错，可能带着错误方向一直走下去
- 缺乏全局视角：只看当前一步，可能错过更高效的路径

---

## 12.4 Plan-and-Execute 模式

### 一句话直觉

先制定完整的计划（所有步骤），再按计划逐步执行。先画地图再出发。

### 前端类比

就像项目管理中的两种方式：

- **ReAct** = 敏捷开发（Scrum）：每个 Sprint 结束后回顾，再决定下一个 Sprint 做什么。灵活但可能方向不清
- **Plan-and-Execute** = 瀑布模型（Waterfall）：先把需求分析、设计、开发、测试的完整计划列出来，再按计划执行。清晰但缺乏弹性

### 工作方式

```
Phase 1 — Planning（规划阶段）
┌─────────────────────────────────┐
│ 分析用户目标                      │
│ → 分解为多个子任务                 │
│ → 确定执行顺序和依赖关系            │
│ → 输出完整的行动计划               │
└─────────────────────────────────┘

Phase 2 — Execution（执行阶段）
┌─────────────────────────────────┐
│ 按计划逐步执行每个子任务            │
│ → 执行步骤 1 → 记录结果            │
│ → 执行步骤 2 → 记录结果            │
│ → ...                           │
│ → 所有步骤完成 → 汇总最终结果       │
└─────────────────────────────────┘

可选 Phase 3 — Replanning（重规划）
┌─────────────────────────────────┐
│ 如果执行中发现计划需要调整          │
│ → 暂停执行                       │
│ → 基于当前进度重新规划剩余步骤       │
│ → 继续执行新计划                   │
└─────────────────────────────────┘
```

### 一个完整的例子

**用户请求**："帮我写一份关于我们产品的竞品分析报告。"

**Phase 1 — 规划**：

```
Plan:
1. 明确我们的产品定位和核心功能
2. 识别 3-5 个主要竞品
3. 分别调研每个竞品的功能、定价、优劣势
4. 对比分析各竞品与我们产品的差异
5. 总结竞争优势和改进方向
6. 生成结构化的报告文档
```

**Phase 2 — 执行**：

```
Step 1: [搜索公司产品信息] → 了解产品定位
Step 2: [搜索行业竞品] → 确定 4 个主要竞品
Step 3: [逐个搜索竞品] → 收集功能、定价、评价信息
Step 4: [分析对比] → 形成对比矩阵
Step 5: [综合分析] → 得出结论
Step 6: [生成报告] → 输出最终文档
```

### ReAct vs Plan-and-Execute 对比

| 维度 | ReAct | Plan-and-Execute |
|------|-------|------------------|
| 策略 | 走一步看一步 | 先画地图再出发 |
| 灵活性 | 高（每步都可调整） | 中（需要重规划） |
| 效率 | 可能走弯路 | 路径更优化 |
| 适用场景 | 探索性任务、不确定性高 | 结构化任务、目标明确 |
| 全局视角 | 弱 | 强 |
| 实现复杂度 | 较低 | 较高 |
| 容错方式 | 自然纠正 | 需要重规划机制 |

### 混合模式：Plan-ReAct

实际工程中，两种模式经常混合使用：

- 用 Plan-and-Execute 做高层规划，确定大步骤
- 每个大步骤内部用 ReAct 做具体执行，处理细节和意外

```
Plan（高层规划）:
  Step 1: 收集竞品信息
  Step 2: 对比分析
  Step 3: 生成报告

Step 1 内部（ReAct 执行）:
  Thought: 先搜索竞品 A...
  Action: search("竞品A 定价")
  Observation: 找到了定价页...
  Thought: 信息不够，再搜索用户评价...
  Action: search("竞品A 用户评价")
  Observation: ...
```

这就像项目管理中把瀑布和敏捷结合——整体用瀑布确定里程碑，每个里程碑内部用敏捷做迭代。

---

## 12.5 自主决策循环的实现

### 一句话直觉

Agent 的核心实现就是一个 `while` 循环：不断让 LLM 推理和行动，直到任务完成或达到终止条件。

### 前端类比

```typescript
// 前端的事件循环（概念化）
while (true) {
  const event = await waitForEvent();  // 等待事件
  const handler = findHandler(event);   // 找到处理器
  const result = handler(event);        // 处理事件
  if (shouldStop()) break;              // 终止条件
}

// Agent 的决策循环（概念化）
while (true) {
  const decision = await llm.think(currentState);  // LLM 推理
  const result = await execute(decision.action);    // 执行行动
  currentState = updateState(result);               // 更新状态
  if (decision.isComplete || shouldStop()) break;   // 终止条件
}
```

几乎一模一样。

### 终止条件设计

这是 Agent 开发中最关键也最容易出错的部分。Agent 什么时候应该停下来？

**终止方式 1：LLM 自主判断任务完成**

LLM 在推理过程中认为任务已经完成，生成最终答案而不是继续行动。

```
Thought: 我已经收集了所有需要的信息，可以给出最终答案了。
Final Answer: ...
```

这是最理想的方式，但有风险——LLM 可能过早认为"完成了"（实际上漏了步骤），也可能永远觉得"还不够"（完美主义死循环）。

**终止方式 2：最大步数限制（stopWhen）**

设定一个硬性的最大迭代次数。超过就强制停止。

```typescript
const MAX_STEPS = 10;
let steps = 0;

while (steps < MAX_STEPS) {
  // ... Agent 循环
  steps++;
}

if (steps >= MAX_STEPS) {
  // 达到上限，强制总结当前进度
}
```

这是安全网，防止无限循环。但 `stopWhen` 设多少合适？

- **太小（如 3）**：复杂任务可能做不完
- **太大（如 100）**：如果 Agent 跑偏了，会浪费大量 token 和时间
- **经验值**：简单任务 5-8 步，中等任务 10-15 步，复杂任务 20-30 步

**终止方式 3：预算限制**

根据 token 消耗、时间消耗或金钱成本来限制。

```typescript
const MAX_TOKENS = 50000;
const MAX_TIME_MS = 60000; // 1 分钟
let totalTokens = 0;
const startTime = Date.now();

while (true) {
  if (totalTokens > MAX_TOKENS) break;  // token 超预算
  if (Date.now() - startTime > MAX_TIME_MS) break;  // 超时
  // ... Agent 循环
}
```

**终止方式 4：重复检测**

如果 Agent 连续做了相同的行动，说明它可能卡住了。

```typescript
const recentActions: string[] = [];

// 在每次行动后
recentActions.push(actionKey);
if (recentActions.length >= 3) {
  const lastThree = recentActions.slice(-3);
  if (lastThree[0] === lastThree[1] && lastThree[1] === lastThree[2]) {
    // 连续三次相同行动，可能进入死循环
    break;
  }
}
```

**最佳实践是组合使用多种终止条件**：

```typescript
while (
  !isTaskComplete &&          // 1. LLM 认为任务未完成
  steps < MAX_STEPS &&        // 2. 未超过最大步数
  totalTokens < MAX_TOKENS && // 3. 未超过 token 预算
  !isStuck                    // 4. 未检测到死循环
) {
  // Agent 循环
}
```

### 错误处理

Agent 在执行过程中工具调用可能失败（API 超时、参数错误、权限不足等）。关键原则：**不要因为一步失败就放弃整个任务**。

```typescript
try {
  const result = await executeTool(action);
  observation = result;
} catch (error) {
  // 不要 throw，而是把错误信息作为观察结果反馈给 LLM
  observation = `工具调用失败：${error.message}。请尝试其他方式。`;
  // LLM 收到这个信息后，会自己决定如何处理：
  // - 用不同参数重试
  // - 换一个工具
  // - 跳过这一步
  // - 告诉用户无法完成
}
```

这就像前端的全局错误处理——不要让一个接口报错导致整个页面白屏，而是优雅降级。

---

## 12.6 Agent 的"思维链"可视化

### 一句话直觉

让用户看到 Agent 在想什么、做什么，就像 Chrome DevTools 的 Network Tab 让你看到每一个 HTTP 请求。

### 为什么需要可视化

Agent 的决策过程可能需要几十秒甚至几分钟。如果用户只看到一个旋转的 loading 动画，体验会非常糟糕：

- 不知道 Agent 在干嘛——"它是不是卡了？"
- 不知道进度——"还要多久？"
- 不信任结果——"它是怎么得出这个结论的？"

可视化解决这三个问题。

### 可视化的层次

**Level 1：状态指示**

最基本的——告诉用户 Agent 当前在做什么。

```
🔍 正在搜索竞品信息...
📊 正在分析数据...
📝 正在生成报告...
```

**Level 2：步骤展示**

展示 Agent 的每个步骤和结果。

```
✅ 步骤 1/5：搜索竞品 A 的定价 → 找到 3 个套餐方案
✅ 步骤 2/5：搜索竞品 B 的定价 → 找到 2 个套餐方案
🔄 步骤 3/5：对比分析中...
⏳ 步骤 4/5：生成图表
⏳ 步骤 5/5：撰写报告
```

**Level 3：思维过程**

展示 Agent 的推理过程（Thought），让用户看到 Agent 的"内心独白"。

```
💭 思考：用户需要对比两个竞品的定价。我先搜索竞品 A...
🔧 行动：调用搜索工具查询 "竞品A 定价方案"
📋 结果：找到竞品 A 有基础版(99元)、专业版(299元)、企业版(定制)
💭 思考：竞品 A 的信息够了，接下来搜索竞品 B...
```

**前端实现建议**：

```
Level 1 → 所有用户看到（简洁状态）
Level 2 → 默认折叠，点击展开（步骤详情）
Level 3 → "高级"模式或开发者模式（完整思维链）
```

这就像 Chrome DevTools：普通用户看不到 Network Tab，但开发者可以打开它来调试。你的 Agent UI 也应该有这样的"调试模式"。

---

## 12.7 Agent 的不确定性

### 一句话直觉

同一个任务，Agent 可能每次走不同的路径得到不同的结果。这是特性，不是 Bug。但你需要管理这种不确定性。

### 前端类比

就像前端的并发请求：两个 API 调用，哪个先返回是不确定的。你不能假设 API A 一定比 API B 先完成。同样，Agent 的决策路径取决于 LLM 的推理过程，而 LLM 本身就有随机性（temperature 参数控制的采样随机性）。

### 不确定性的来源

1. **LLM 的采样随机性**：即使 temperature=0，不同批次的推理结果也可能略有不同
2. **外部环境变化**：工具返回的结果可能随时间变化（搜索结果、数据库内容）
3. **决策分支**：在某个节点上，两个选择可能都合理，LLM 随机选了其中一个
4. **错误和重试**：工具调用可能偶尔失败，Agent 的错误恢复路径不同

### 如何管理不确定性

**策略 1：降低温度**

对于需要确定性的 Agent，把 temperature 设置得尽可能低。

```typescript
const result = await generateText({
  model: 'openai/gpt-5',
  temperature: 0, // 最低随机性
  // ...
});
```

但注意：temperature=0 不能保证完全确定性，只能大幅降低随机性。

**策略 2：结构化约束**

通过更严格的 prompt 和输出格式来约束 Agent 的行为。

```
你必须按照以下步骤执行，不要跳过或调整顺序：
1. 先搜索 A
2. 再搜索 B
3. 最后对比 A 和 B
```

用 Zod Schema 约束输出格式，用明确的工具选择规则约束行动。

**策略 3：关键节点人工确认**

对于高风险操作，在执行前询问用户确认。

```
Agent: 我准备发送以下邮件给张总：[邮件内容]
      确认发送吗？[发送] [修改] [取消]
```

**策略 4：接受不确定性，关注结果质量**

很多时候，路径不同但结果等价。就像从家到公司可以走不同的路，只要准时到达就行。重要的是建立**结果评估标准**——不管 Agent 走了什么路径，最终结果是否满足要求。

---

## 12.8 Agent 的"自我反思"

### 一句话直觉

Agent 执行完一步后回头想想："我做得对吗？有没有更好的做法？"这个简单的机制能显著提升 Agent 的成功率。

### 前端类比

就像代码审查（Code Review）：你写完代码后，不是直接提交，而是自己先 Review 一遍——"这里有没有 Bug？命名合不合理？逻辑对不对？"这个自我审查过程能发现很多问题。

### 自我反思的实现方式

**方式 1：步骤后反思**

每执行完一步，让 LLM 评估这一步的结果。

```
[执行完搜索后]
Reflection: 搜索结果是否包含我需要的信息？
            搜索结果质量如何？信息是否可靠？
            是否需要用不同的关键词重新搜索？
```

**方式 2：阶段性反思**

每完成几个步骤，做一次整体回顾。

```
[完成前 3 步后]
Reflection: 回顾目前的进度：
            - 已完成：信息收集
            - 信息质量评估：竞品 A 的信息完整，竞品 B 缺少用户评价
            - 计划调整：需要补充竞品 B 的用户评价再继续
```

**方式 3：最终反思**

在给出最终结果前，做一次全面审查。

```
[准备输出最终报告前]
Reflection: 最终检查：
            - 是否回答了用户的所有问题？ ✅
            - 数据是否有矛盾之处？ 需要核实竞品 B 的价格
            - 结论是否有充分的论据支撑？ ✅
            - 是否有遗漏的重要信息？ 缺少市场份额数据，但用户没有要求
```

### 自我反思的效果

研究和实践都表明，加入自我反思机制后：

- Agent 的任务完成率提升 15-30%
- 幻觉和事实错误减少
- 最终输出的质量和完整性明显提升

代价是多消耗一些 token（每次反思大约多消耗几百个 token），但这通常是值得的。

就像前端的 TypeScript 类型检查——增加了编写时间，但大幅减少了运行时错误。自我反思就是 Agent 的"类型检查"。

---

## 概念辨析

### Agent vs Workflow

- **Agent**：自主决策，路径不确定，适合开放性任务。"让 AI 自己决定怎么做"
- **Workflow**：预定义流程，路径确定，适合标准化任务。"我来定义流程，AI 来执行每一步"

简单说：Agent 决定"做什么"，Workflow 只需要 AI 来"做好每一步"。这个话题第 16 章会深入探讨。

### ReAct vs Chain-of-Thought（CoT）

- **CoT（思维链）**：LLM 在生成答案前先"想一想"，展示推理过程。但只有思考，没有行动——纯脑力劳动
- **ReAct**：在 CoT 的基础上加了"行动"和"观察"。不仅想，还做。并且根据做的结果继续想

ReAct = CoT + Tool Use + 循环。

### 自主性 vs 可控性

Agent 越自主，就越不可控。这是一个根本性的张力：

- 自主性高 → 能处理更复杂的任务，但可能做出意料之外的事
- 可控性高 → 行为可预测，但灵活性受限

实际工程中的平衡点：**在安全边界内最大化自主性**。给 Agent 设定明确的行动范围（"你可以搜索和分析，但不能发送邮件和修改数据"），在范围内让它自由发挥。

就像给实习生的权限：可以查任何文档，但修改代码必须提 PR、发布必须经过审批。

---

## 灵魂拷问

> **Q: ReAct 和 Plan-and-Execute 什么场景用哪个？能混合使用吗？**

> A: 选择的关键在于**任务的确定性和复杂度**。
>
> **用 ReAct**：当任务是探索性的、不确定的、或者环境变化快的。比如"帮我调研一下这个话题"——你事先不知道会搜到什么，需要根据搜索结果动态调整方向。
>
> **用 Plan-and-Execute**：当任务结构清晰、步骤可预知、目标明确的。比如"把这份简历翻译成英文、调整格式、然后发到三个邮箱"——步骤是确定的，按计划执行就好。
>
> **混合使用是最佳实践**。高层用 Plan-and-Execute 做整体规划，确定方向；每个子步骤用 ReAct 做具体执行，处理细节。就像项目管理：大里程碑用瀑布式规划，每个里程碑内部用敏捷迭代。
>
> 实际代码中，可以让 LLM 先输出一个 plan，然后对 plan 中的每个 step 运行 ReAct 循环。如果某个 step 的执行结果导致 plan 需要调整，触发 replan。

> **Q: Agent 的自主决策循环怎么防止无限循环？只设 stopWhen 够吗？**

> A: 只设 stopWhen 远远不够。stopWhen 是最后一道防线，但好的 Agent 不应该经常触发这个限制。
>
> 你需要多层防护：
>
> 1. **stopWhen**：硬性上限，最后的安全网。
> 2. **Token 预算**：限制总 token 消耗。有些 Agent 虽然步数不多，但每步消耗大量 token。
> 3. **时间限制**：设置总执行时间上限。
> 4. **重复检测**：如果 Agent 连续执行相同或高度相似的行动，很可能陷入了循环。检测到后强制跳出。
> 5. **进度检测**：如果连续 N 步后任务状态没有实质性变化（比如信息量没有增加），可能需要换个策略。
> 6. **自我反思检查点**：每 N 步做一次反思——"我在朝目标前进吗？还是在原地打转？"
>
> 最重要的一点：**好的终止条件设计比好的循环逻辑更重要**。一个 Agent 的成熟度，很大程度上体现在它"知道什么时候该停"。

> **Q: Agent 每次执行结果不同，怎么写测试？怎么保证质量？**

> A: 这确实是 Agent 开发最头疼的问题之一，因为传统的"给定输入 X，期望输出 Y"的测试方法不再完全适用。
>
> 几个实用的测试策略：
>
> 1. **约束路径测试**：把 temperature 设为 0，使用固定的 mock 数据替代真实工具调用，让路径尽量确定。测试的不是精确输出，而是"Agent 是否按正确顺序调用了正确的工具"。
>
> 2. **结果评估测试**：不管 Agent 走了什么路径，用评估标准检查最终结果。比如"竞品分析报告必须包含至少 3 个竞品的定价信息"——这个标准与路径无关。可以用另一个 LLM 来做评估。
>
> 3. **边界测试**：测试 Agent 在异常情况下的行为——工具调用失败、返回空结果、返回格式错误的数据。Agent 应该优雅处理而不是崩溃。
>
> 4. **回归测试**：记录 Agent 的历史执行轨迹（Trace），当修改了 Agent 逻辑后，重新跑这些 case，检查结果是否退化。
>
> 5. **统计测试**：同一个 case 跑 10 次，统计成功率和结果质量。期望是"10 次中至少 8 次成功"而不是"每次都一模一样"。

> **Q: 如果 Agent 在第 3 步做错了决策，后续步骤全部基于错误结果，怎么办？**

> A: 这就是"错误传播"问题，也是 Agent 最危险的失败模式。一步错，步步错。
>
> 几种应对策略：
>
> 1. **自我反思 + 回溯**：在关键步骤后加反思检查，如果发现异常，可以回到前面的步骤重新执行。实现方式是保存每步的状态快照，必要时恢复。
>
> 2. **交叉验证**：对关键信息用多个来源或多种方式验证。比如"搜索到竞品价格是 99 元"——再搜一次，或者用另一个搜索引擎验证。
>
> 3. **人类在环（Human-in-the-Loop）**：在高风险决策点暂停，请用户确认后再继续。这在实际产品中非常常见。
>
> 4. **限制爆炸半径**：Agent 的每个行动应该是可逆的或低风险的。"搜索信息"这种行动即使错了也没关系；"删除数据"这种行动就需要确认机制。
>
> 5. **最终结果审查**：即使中间步骤有错，在输出最终结果前做一次全面审查，让 LLM 自己检查结论是否合理。
>
> 在工程实践中，第 3 点（Human-in-the-Loop）是最实用的。不要试图构建一个永远不犯错的 Agent——那不现实。而是在关键节点设置"关卡"，人类把关。

> **Q: 为什么说 Agent 的核心能力不是"调用工具"而是"决策"？**

> A: 因为工具就像编程语言的标准库——任何人都能 `import` 并调用。真正区分初级和高级工程师的不是谁能调用更多 API，而是**在什么情况下调用什么 API，以什么顺序调用，出错时如何处理**。
>
> 同样，Agent 的价值不在于它能调用多少工具，而在于它能在复杂场景中做出正确的决策：
>
> - "现在应该搜索还是应该直接分析已有信息？"
> - "搜索结果不够好，是应该换关键词重试还是换个工具？"
> - "这步失败了，是应该重试还是跳过？"
> - "信息够了吗？还是应该再收集更多？"
> - "用户的真实意图是什么？我是否需要追问？"
>
> 一个没有任何工具但能精准理解任务、合理分解步骤、在关键节点做出正确判断的"纯思考"Agent，比一个有 100 个工具但决策混乱、频繁走弯路、无法自我纠正的 Agent 有用得多。
>
> 这也是为什么 Agent 对底层模型的智能程度有很高要求——决策能力直接取决于模型的推理能力。

> **Q: Agent 需要多聪明的模型？小模型能做 Agent 吗？**

> A: 取决于任务复杂度，但总体来说，Agent 对模型智能的要求比普通问答高得多。
>
> **小模型（7B-13B 参数）能做什么**：
> - 简单的单工具调用 Agent（类似增强版 Chatbot）
> - 流程固定的 Workflow 执行
> - 有限步数（2-3 步）的简单任务
>
> **需要强模型（GPT-4 级别）的场景**：
> - 多步复杂推理
> - 需要处理意外情况的自适应任务
> - 自我反思和错误恢复
> - 需要理解模糊、隐含意图的任务
>
> 关键不是参数量，而是以下能力：
> 1. **指令遵从**：能准确理解并遵循复杂的系统提示
> 2. **推理能力**：能做多步逻辑推理
> 3. **格式遵从**：能稳定输出结构化的决策（如 JSON 格式的工具调用）
> 4. **自我纠错**：能发现自己的错误并调整
>
> 实用建议：用强模型（如 GPT-5）做决策和推理，用小模型（如 GPT-5-mini）做简单执行步骤（摘要、格式转换等），组合使用来平衡效果和成本。

> **Q: 让 Agent "解释它为什么这样做"和让它"做得更好"，哪个更难？为什么？**

> A: "做得更好"更难。远远更难。
>
> "解释为什么"相对简单，因为 LLM 天生擅长"编故事"。你让 Agent 解释它的决策过程，它总能给出一个听起来合理的解释——即使这个解释可能是事后编造的，并不是它真正的"思考过程"。这叫做**事后合理化（post-hoc rationalization）**。
>
> "做得更好"则涉及到真正改善 Agent 的决策质量，这需要：
> - 更好的模型（提升推理能力的根本途径）
> - 更好的 prompt 设计（引导 Agent 做出更好的决策）
> - 更好的工具设计（让 Agent 有更好的行动选项）
> - 更好的反馈机制（让 Agent 从错误中学习）
> - 更好的评估标准（你得先知道"什么是更好"）
>
> 这也是 AI Agent 领域的一个核心张力：Agent 的"解释能力"已经很强了（看起来很厉害），但"执行能力"还有很大提升空间（实际效果参差不齐）。
>
> 对开发者的启示：不要被 Agent 流畅的"解释"所迷惑，要建立客观的评估标准来衡量它的实际表现。就像面试中——能说的人不一定能做，能做的人才是你要的。

---

## 最佳实践

### DO

- **DO** 从简单场景开始构建 Agent，先跑通 2-3 步的任务，再逐步增加复杂度
- **DO** 设计多层终止条件（stopWhen + token 预算 + 时间限制 + 重复检测），不要只靠一个
- **DO** 把 Agent 的每一步操作记录到日志（Trace），这是调试和优化的基础
- **DO** 在高风险操作前加入人类确认环节（Human-in-the-Loop）
- **DO** 实现自我反思机制，即使简单的"检查一下上一步结果是否合理"也有很大帮助
- **DO** 把错误信息作为观察结果反馈给 LLM，而不是直接抛出异常终止循环
- **DO** 可视化 Agent 的思维过程，让用户知道它在干什么
- **DO** 对 Agent 的结果建立评估标准，不要只凭主观感觉判断好坏
- **DO** 根据任务类型选择合适的模式——简单任务用 ReAct，结构化任务用 Plan-and-Execute

### DON'T

- **DON'T** 一上来就构建复杂的多步 Agent——先确保单步 Tool Use 是稳定的
- **DON'T** 只设 stopWhen 作为唯一的安全措施——Agent 可能在 stopWhen 内就烧掉大量 token
- **DON'T** 让 Agent 执行不可逆的高风险操作（删除数据、发送邮件）而没有确认机制
- **DON'T** 忽略 Agent 的不确定性——同一任务跑两次可能结果不同，这是正常的
- **DON'T** 假设 Agent 的"解释"就是它真正的"推理过程"——LLM 很擅长事后合理化
- **DON'T** 用小模型做需要复杂推理和自我纠错的 Agent 任务——模型智能是 Agent 的天花板
- **DON'T** 在 prompt 中过度约束 Agent 的行为——过多规则会让 Agent 变得死板，失去自主决策的优势
- **DON'T** 只看 Agent 的成功案例——更要关注失败案例，从中改进

---

## 代码实战

### 实战 1：最简 ReAct Agent

用 Vercel AI SDK 实现一个最基础的 ReAct Agent。

```typescript
// simple-react-agent.ts
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';

// 定义工具
const tools = {
  getWeather: tool({
    description: '查询指定城市的天气信息',
    inputSchema: z.object({
      city: z.string().describe('城市名称'),
    }),
    execute: async ({ city }) => {
      // 模拟天气 API
      const mockWeather: Record<string, object> = {
        '北京': { temp: 28, condition: '晴', humidity: 45, wind: '北风3级' },
        '上海': { temp: 26, condition: '多云', humidity: 72, wind: '东南风2级' },
        '广州': { temp: 32, condition: '雷阵雨', humidity: 85, wind: '南风4级' },
      };
      return mockWeather[city] || { error: `未找到 ${city} 的天气数据` };
    },
  }),
  
  searchInfo: tool({
    description: '搜索互联网获取信息',
    inputSchema: z.object({
      query: z.string().describe('搜索关键词'),
    }),
    execute: async ({ query }) => {
      // 模拟搜索 API
      return {
        results: [
          { title: `关于"${query}"的搜索结果 1`, snippet: '这是一段模拟的搜索结果...' },
          { title: `关于"${query}"的搜索结果 2`, snippet: '这是另一段模拟的搜索结果...' },
        ],
      };
    },
  }),
  
  calculator: tool({
    description: '执行数学计算',
    inputSchema: z.object({
      expression: z.string().describe('数学表达式，如 "2 + 3 * 4"'),
    }),
    execute: async ({ expression }) => {
      try {
        // 注意：实际项目中不要用 eval，这里只是演示
        const result = Function(`"use strict"; return (${expression})`)();
        return { result };
      } catch {
        return { error: '计算失败，请检查表达式' };
      }
    },
  }),
};

// ReAct Agent 核心函数
async function reactAgent(userMessage: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`用户: ${userMessage}`);
  console.log('='.repeat(60));
  
  const result = await generateText({
    model: 'openai/gpt-5',
    instructions: `你是一个智能助手 Agent。你可以使用提供的工具来完成用户的任务。

请按照以下方式工作：
1. 分析用户的需求，思考需要哪些步骤
2. 逐步使用工具获取信息
3. 基于获取的信息给出完整的回答

如果工具调用失败，尝试换一种方式完成任务。
如果信息已经足够，直接给出最终回答，不要过度使用工具。`,
    prompt: userMessage,
    tools,
    stopWhen: isStepCount(10), // Vercel AI SDK 内置的循环机制
  });
  
  // 打印 Agent 的执行过程
  console.log('\n--- Agent 执行轨迹 ---');
  for (const step of result.steps) {
    if (step.toolCalls?.length) {
      for (const call of step.toolCalls) {
        console.log(`🔧 调用工具: ${call.toolName}(${JSON.stringify(call.args)})`);
      }
    }
    if (step.toolResults?.length) {
      for (const res of step.toolResults) {
        console.log(`📋 工具结果: ${JSON.stringify(res.result).slice(0, 100)}...`);
      }
    }
  }
  
  console.log(`\n🤖 最终回答: ${result.text}`);
  return result.text;
}

// 运行示例
async function main() {
  // 示例 1：简单的单工具任务
  await reactAgent('北京今天天气怎么样？需要带伞吗？');
  
  // 示例 2：需要多个工具协作的任务
  await reactAgent('帮我查一下北京和上海的天气，对比一下哪个城市更适合周末出游？');
  
  // 示例 3：需要推理的任务
  await reactAgent('如果北京温度比上海高 5 度以上，那两个城市的平均温度是多少？');
}

main();
```

### 实战 2：带自我反思的 Agent

```typescript
// reflective-agent.ts
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';

// Agent 执行记录
interface AgentStep {
  thought: string;
  action?: string;
  observation?: string;
  reflection?: string;
}

// 带反思的 Agent
async function reflectiveAgent(userTask: string) {
  const steps: AgentStep[] = [];
  let isComplete = false;
  let finalAnswer = '';
  let stepCount = 0;
  const MAX_STEPS = 8;
  
  // 构建当前上下文
  function buildContext(): string {
    let context = `用户任务: ${userTask}\n\n`;
    if (steps.length > 0) {
      context += '已执行的步骤:\n';
      for (const [i, step] of steps.entries()) {
        context += `\n--- 步骤 ${i + 1} ---\n`;
        context += `思考: ${step.thought}\n`;
        if (step.action) context += `行动: ${step.action}\n`;
        if (step.observation) context += `观察: ${step.observation}\n`;
        if (step.reflection) context += `反思: ${step.reflection}\n`;
      }
    }
    return context;
  }

  while (!isComplete && stepCount < MAX_STEPS) {
    stepCount++;
    console.log(`\n--- 步骤 ${stepCount} ---`);
    
    // 1. 推理：决定下一步做什么
    const thinkResult = await generateText({
      model: 'openai/gpt-5',
      instructions: `你是一个智能 Agent。根据当前上下文，决定下一步行动。

你必须以 JSON 格式回复：
{
  "thought": "你的思考过程",
  "action": "要执行的行动描述（如果任务已完成则为 null）",
  "toolName": "要调用的工具名（getWeather/searchInfo/none）",
  "toolArgs": {},
  "isComplete": false,
  "finalAnswer": "只有 isComplete 为 true 时才填写"
}`,
      prompt: buildContext(),
      temperature: 0,
    });
    
    let decision;
    try {
      // 从回复中提取 JSON
      const jsonMatch = thinkResult.text.match(/\{[\s\S]*\}/);
      decision = JSON.parse(jsonMatch?.[0] || '{}');
    } catch {
      console.error('解析决策失败，跳过此步');
      continue;
    }
    
    console.log(`💭 思考: ${decision.thought}`);
    
    // 检查是否完成
    if (decision.isComplete) {
      finalAnswer = decision.finalAnswer;
      isComplete = true;
      steps.push({ thought: decision.thought });
      break;
    }
    
    // 2. 执行行动
    let observation = '';
    if (decision.toolName && decision.toolName !== 'none') {
      console.log(`🔧 行动: ${decision.toolName}(${JSON.stringify(decision.toolArgs)})`);
      
      try {
        // 模拟工具调用
        if (decision.toolName === 'getWeather') {
          observation = JSON.stringify({
            city: decision.toolArgs.city,
            temp: 28, condition: '晴', humidity: 45,
          });
        } else if (decision.toolName === 'searchInfo') {
          observation = JSON.stringify({
            results: [`关于"${decision.toolArgs.query}"的搜索结果...`],
          });
        }
      } catch (error: any) {
        observation = `工具调用失败: ${error.message}`;
      }
      
      console.log(`📋 观察: ${observation.slice(0, 100)}`);
    }
    
    // 3. 反思（每步都做）
    const reflectResult = await generateText({
      model: 'openai/gpt-5-mini', // 反思用小模型省成本
      instructions: '你是一个 Agent 的自省模块。评估上一步的执行质量，简短回答。',
      prompt: `任务: ${userTask}
上一步思考: ${decision.thought}
上一步行动: ${decision.action || '无'}
上一步结果: ${observation || '无'}

请评估：
1. 这步做得对吗？
2. 结果是否有用？
3. 是否需要调整策略？
用 1-2 句话简洁回答。`,
      temperature: 0,
    });
    
    const reflection = reflectResult.text;
    console.log(`🔍 反思: ${reflection}`);
    
    steps.push({
      thought: decision.thought,
      action: decision.action,
      observation,
      reflection,
    });
  }
  
  // 如果达到步数上限还没完成
  if (!isComplete) {
    const summaryResult = await generateText({
      model: 'openai/gpt-5',
      prompt: `${buildContext()}\n\n已达到最大步数限制。请根据目前收集到的信息，给出最好的回答。如果信息不足，请说明还缺少什么。`,
    });
    finalAnswer = summaryResult.text;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🤖 最终回答: ${finalAnswer}`);
  console.log(`📊 共执行 ${stepCount} 步`);
  
  return { answer: finalAnswer, steps, stepCount };
}

// 运行
async function main() {
  await reflectiveAgent('帮我查北京的天气，然后根据天气推荐三个适合的户外活动。');
}

main();
```

### 实战 3：Plan-and-Execute Agent

```typescript
// plan-execute-agent.ts
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';

interface Plan {
  goal: string;
  steps: Array<{
    id: number;
    description: string;
    toolNeeded: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    result?: string;
  }>;
}

// 阶段 1：规划
async function createPlan(userTask: string): Promise<Plan> {
  const result = await generateText({
    model: 'openai/gpt-5',
    instructions: `你是一个任务规划专家。将用户的任务分解为具体的执行步骤。

每个步骤需要指明：
- 步骤描述
- 需要使用的工具（getWeather / searchInfo / calculator / none）

以 JSON 格式输出：
{
  "goal": "任务目标",
  "steps": [
    { "id": 1, "description": "步骤描述", "toolNeeded": "工具名" },
    ...
  ]
}

注意：
- 步骤数量控制在 3-6 个
- 步骤之间应该有清晰的逻辑顺序
- 最后一步通常是"综合分析并输出结果"`,
    prompt: `任务: ${userTask}`,
    temperature: 0,
  });
  
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  const planData = JSON.parse(jsonMatch?.[0] || '{}');
  
  return {
    goal: planData.goal,
    steps: planData.steps.map((s: any) => ({
      ...s,
      status: 'pending' as const,
    })),
  };
}

// 阶段 2：执行单个步骤
async function executeStep(
  plan: Plan,
  stepIndex: number,
  previousResults: string[]
): Promise<string> {
  const step = plan.steps[stepIndex];
  
  // 模拟工具执行
  if (step.toolNeeded === 'getWeather') {
    return JSON.stringify({
      city: '北京', temp: 28, condition: '晴',
      humidity: 45, wind: '北风3级',
    });
  }
  
  if (step.toolNeeded === 'searchInfo') {
    return `搜索结果: 关于"${step.description}"的相关信息...`;
  }
  
  // 对于不需要工具的步骤（如分析、总结），用 LLM 执行
  const result = await generateText({
    model: 'openai/gpt-5',
    instructions: '你是一个任务执行者。根据之前步骤的结果，执行当前步骤。',
    prompt: `任务目标: ${plan.goal}
当前步骤: ${step.description}

之前步骤的结果:
${previousResults.map((r, i) => `步骤 ${i + 1}: ${r}`).join('\n')}

请执行当前步骤并给出结果。`,
    temperature: 0,
  });
  
  return result.text;
}

// 阶段 3（可选）：重规划
async function replan(
  plan: Plan,
  completedSteps: number,
  issue: string
): Promise<Plan> {
  const result = await generateText({
    model: 'openai/gpt-5',
    instructions: '你是一个任务规划专家。根据执行中发现的问题，调整剩余计划。以 JSON 格式输出新的计划。',
    prompt: `原始计划: ${JSON.stringify(plan)}
已完成步骤数: ${completedSteps}
遇到的问题: ${issue}

请调整剩余步骤。`,
    temperature: 0,
  });
  
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch?.[0] || '{}');
}

// 主流程
async function planAndExecuteAgent(userTask: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 任务: ${userTask}`);
  console.log('='.repeat(60));
  
  // Phase 1: 规划
  console.log('\n🗺️ Phase 1: 制定计划...');
  const plan = await createPlan(userTask);
  
  console.log(`目标: ${plan.goal}`);
  console.log('计划步骤:');
  for (const step of plan.steps) {
    console.log(`  ${step.id}. ${step.description} [工具: ${step.toolNeeded}]`);
  }
  
  // Phase 2: 逐步执行
  console.log('\n⚡ Phase 2: 执行计划...');
  const results: string[] = [];
  
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    console.log(`\n  🔄 步骤 ${step.id}: ${step.description}`);
    step.status = 'in_progress';
    
    try {
      const result = await executeStep(plan, i, results);
      step.status = 'completed';
      step.result = result;
      results.push(result);
      console.log(`  ✅ 完成: ${result.slice(0, 80)}...`);
    } catch (error: any) {
      step.status = 'failed';
      console.log(`  ❌ 失败: ${error.message}`);
      
      // 可以在这里触发重规划
      // const newPlan = await replan(plan, i, error.message);
      // 简化处理：跳过失败步骤，继续执行
      results.push(`步骤 ${step.id} 执行失败: ${error.message}`);
    }
  }
  
  // 输出最终结果
  console.log('\n📊 执行完成');
  console.log('最终结果:', results[results.length - 1]);
  
  return {
    plan,
    results,
    finalResult: results[results.length - 1],
  };
}

// 运行
async function main() {
  await planAndExecuteAgent(
    '帮我调研一下北京、上海、广州三个城市的天气，然后推荐最适合本周末出游的城市，并给出旅游建议。'
  );
}

main();
```

### 实战 4：带思维可视化的 Agent UI

```typescript
// app/components/AgentChat.tsx
'use client';
import { useState } from 'react';

// Agent 步骤的类型定义
interface AgentStep {
  type: 'thought' | 'action' | 'observation' | 'reflection' | 'answer';
  content: string;
  timestamp: number;
  toolName?: string;
  status?: 'running' | 'completed' | 'failed';
}

interface Message {
  role: 'user' | 'agent';
  content: string;
  steps?: AgentStep[];
}

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<AgentStep[]>([]);
  const [showThoughts, setShowThoughts] = useState(false);
  
  const handleSubmit = async () => {
    if (!input.trim() || isRunning) return;
    
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsRunning(true);
    setCurrentSteps([]);
    
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      
      // 假设后端返回 SSE 流，每行是一个 Agent 步骤
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      const steps: AgentStep[] = [];
      let finalAnswer = '';
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          try {
            const step: AgentStep = JSON.parse(line);
            steps.push(step);
            setCurrentSteps([...steps]);
            
            if (step.type === 'answer') {
              finalAnswer = step.content;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
      
      setMessages(prev => [
        ...prev,
        { role: 'agent', content: finalAnswer, steps },
      ]);
    } catch (error) {
      console.error('Agent 错误:', error);
      setMessages(prev => [
        ...prev,
        { role: 'agent', content: '抱歉，执行过程中出现了错误。' },
      ]);
    } finally {
      setIsRunning(false);
      setCurrentSteps([]);
    }
  };
  
  // 渲染 Agent 的思维步骤
  const renderSteps = (steps: AgentStep[]) => (
    <div className="mt-2 border-l-2 border-gray-200 pl-3 space-y-1">
      {steps.map((step, i) => (
        <div key={i} className="text-sm">
          {step.type === 'thought' && (
            <div className="text-purple-600">
              <span className="font-medium">思考：</span>
              {step.content}
            </div>
          )}
          {step.type === 'action' && (
            <div className="text-blue-600">
              <span className="font-medium">行动：</span>
              {step.toolName && <code className="bg-blue-50 px-1 rounded">{step.toolName}</code>}
              {' '}{step.content}
              {step.status === 'running' && <span className="animate-pulse ml-1">...</span>}
            </div>
          )}
          {step.type === 'observation' && (
            <div className="text-green-600">
              <span className="font-medium">结果：</span>
              {step.content}
            </div>
          )}
          {step.type === 'reflection' && (
            <div className="text-amber-600">
              <span className="font-medium">反思：</span>
              {step.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
  
  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* 顶部设置栏 */}
      <div className="p-3 border-b flex items-center justify-between">
        <h1 className="font-bold">AI Agent 助手</h1>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showThoughts}
            onChange={(e) => setShowThoughts(e.target.checked)}
          />
          显示思维过程
        </label>
      </div>
      
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-lg p-3 rounded-lg ${
              msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {showThoughts && msg.steps && renderSteps(msg.steps)}
            </div>
          </div>
        ))}
        
        {/* 实时显示 Agent 执行过程 */}
        {isRunning && currentSteps.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-lg p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Agent 正在工作中...</div>
              {renderSteps(currentSteps)}
            </div>
          </div>
        )}
        
        {isRunning && currentSteps.length === 0 && (
          <div className="flex justify-start">
            <div className="p-3 rounded-lg bg-gray-50">
              <span className="animate-pulse">Agent 正在思考...</span>
            </div>
          </div>
        )}
      </div>
      
      {/* 输入区域 */}
      <div className="p-4 border-t flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="输入任务，让 Agent 自主完成..."
          className="flex-1 px-3 py-2 border rounded"
          disabled={isRunning}
        />
        <button
          onClick={handleSubmit}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isRunning ? '执行中...' : '发送'}
        </button>
      </div>
    </div>
  );
}
```

### 实战 5：Agent 后端 API（结合 Vercel AI SDK 的 stopWhen）

```typescript
// app/api/agent/route.ts
import { streamText, tool, isStepCount } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { message } = await req.json();
  
  const result = streamText({
    model: 'openai/gpt-5',
    instructions: `你是一个能自主完成任务的 AI Agent。

你的工作方式：
1. 分析用户的任务，拆解为步骤
2. 逐步使用工具获取信息
3. 每步完成后评估进度
4. 所有信息收集完毕后，给出完整的最终回答

注意事项：
- 如果工具调用失败，尝试其他方式
- 如果信息已经足够，不要过度使用工具
- 最终回答要完整、有条理、对用户有帮助
- 对不确定的信息要标注"不确定"`,
    
    messages: [{ role: 'user', content: message }],
    
    tools: {
      getWeather: tool({
        description: '查询城市天气',
        inputSchema: z.object({
          city: z.string().describe('城市名'),
        }),
        execute: async ({ city }) => {
          // 替换为真实的天气 API
          return { city, temp: 28, condition: '晴', humidity: 45 };
        },
      }),
      
      searchWeb: tool({
        description: '搜索互联网信息',
        inputSchema: z.object({
          query: z.string().describe('搜索关键词'),
        }),
        execute: async ({ query }) => {
          // 替换为真实的搜索 API
          return { results: [{ title: '搜索结果', snippet: '...' }] };
        },
      }),
      
      readFile: tool({
        description: '读取用户上传的文件内容',
        inputSchema: z.object({
          fileId: z.string().describe('文件 ID'),
        }),
        execute: async ({ fileId }) => {
          // 替换为真实的文件读取逻辑
          return { content: '文件内容...' };
        },
      }),
    },
    
    stopWhen: isStepCount(10),
    
    // 每步回调，可以用于记录 Trace
    onStepEnd({ text, toolCalls, toolResults, finishReason }) {
      console.log('[Agent Step]', {
        hasText: !!text,
        toolCalls: toolCalls?.length || 0,
        finishReason,
      });
    },
  });
  
  return createUIMessageStreamResponse({
  stream: toUIMessageStream({ stream: result.stream }),
});
}
```

---

## 实操练习

### 目标

将贯穿项目"AI 智能工作助手"从被动的 Chatbot 升级为能自主分步完成任务的 Agent。

### 步骤

1. **实现基础 ReAct 循环**
   - 使用 Vercel AI SDK 的 `stopWhen` 参数，让 AI 能多步调用工具
   - 定义 3-5 个实用工具（天气查询、网页搜索、计算器、文件读取）
   - 测试一个需要 2-3 步才能完成的任务

2. **添加思维过程可视化**
   - 在前端展示 Agent 的每个步骤（思考、行动、观察）
   - 实现"显示/隐藏思维过程"的开关
   - 在 Agent 执行过程中实时展示进度

3. **实现终止条件**
   - 设置 `stopWhen` 为合理的值（8-12）
   - 添加 token 消耗统计
   - 实现重复行动检测

4. **添加错误处理**
   - 工具调用失败时，将错误信息反馈给 LLM 而不是直接报错
   - 实现优雅降级：如果 Agent 循环异常终止，给出已收集信息的摘要

5. **实现自我反思（进阶）**
   - 在关键步骤后让 Agent 评估自己的执行质量
   - 如果反思结果不佳，尝试调整策略

### 验收标准

- [ ] Agent 能自主完成一个至少需要 3 步工具调用的任务
- [ ] 前端能实时展示 Agent 的思维和行动过程
- [ ] 有合理的终止条件，不会出现无限循环
- [ ] 工具调用失败时 Agent 能自主调整策略
- [ ] 用户能通过开关查看或隐藏 Agent 的思维过程

### 挑战加分项

- 实现 Plan-and-Execute 模式，让 Agent 先输出计划再逐步执行
- 实现 Human-in-the-Loop：高风险操作前暂停并请求用户确认
- 添加 Agent 执行的 Trace 记录（保存到文件或数据库），支持回放
- 实现混合模式：简单任务用 ReAct，复杂任务自动切换到 Plan-and-Execute
- 支持用户中途打断 Agent 的执行

---

## 本章小结

这一章是整个学习路径的关键转折点。我们从"调用 AI 的能力"跨越到了"构建能自主行动的 AI 系统"。

**核心要点回顾**：

1. **Agent 的本质**：不是"Chatbot + 工具"，而是一个能自主感知、决策、行动、观察、调整的循环系统。核心能力是决策，不是工具调用。

2. **三种模式的区别**：
   - Chatbot：你问我答，完全被动
   - Copilot：实时辅助，人类做最终决策
   - Agent：给目标自主干，高度自主

3. **ReAct 模式**：推理和行动交替进行，走一步看一步。灵活但可能效率不高。

4. **Plan-and-Execute 模式**：先制定完整计划再逐步执行。高效但灵活性受限。实际中常混合使用。

5. **自主决策循环**：本质是 `while` 循环 + LLM 推理 + 工具调用 + 终止条件。终止条件的设计比循环本身更重要。

6. **不确定性是特性**：Agent 每次可能走不同路径，通过降低温度、结构化约束、结果评估来管理，而不是消除。

7. **自我反思**：让 Agent "检查自己做得对不对"，简单但有效，能显著提升任务完成率。

8. **可视化**：让用户看到 Agent 的思维过程，建立信任感，也方便调试。

**从这一章开始，你构建的不再是一个"能聊天的 AI"，而是一个"能干活的 AI"。** 接下来的章节将在此基础上继续深入——第 13 章讲如何让 Agent 处理更复杂的多步任务（包括错误恢复和任务分解），第 14 章讲如何用 MCP 协议标准化 Agent 的工具接入，第 15 章讲如何让多个 Agent 协作完成更大的目标。

Agent 的时代已经到来。作为前端开发者，你比任何人都更适合构建 Agent 的交互体验——因为 Agent 的价值最终都要通过用户界面来传递。
