# 第17章：Agent UI/UX 设计模式 -- 前端开发者的主场

## 引言

终于到了你最擅长的领域。

前面十几章，你一直在学 AI 的"后端逻辑"——Prompt 怎么写、工具怎么调、Agent 怎么编排。坦白说，这些知识对前端开发者来说多少有点"客场作战"的感觉。但这一章不同，这是你的主场。

先问一个问题：你觉得 Agent 的界面应该长什么样？

如果你的第一反应是"一个聊天框"，那说明你被 ChatGPT 洗脑了。

聊天框只是 Agent UI 的一种形态，而且在大多数业务场景下，它甚至不是最好的形态。想想看：你用 Figma 的 AI 功能时，界面是聊天框吗？你用 GitHub Copilot 时，界面是聊天框吗？你用 Notion AI 时，虽然有对话，但核心体验是嵌入到编辑器里的，不是一个孤零零的聊天窗口。

Agent UI 的本质挑战和传统 Web UI 完全不同。传统 UI 是**确定性**的——用户点按钮，你知道会发生什么、需要多久、结果是什么。但 Agent UI 面对的是**不确定性怪兽**——AI 什么时候回完不知道，回什么内容不知道，中间要调几次工具不知道，结果对不对也不知道。

这一章，我们要系统地解决这些问题。不是给你一个 UI 组件库让你抄，而是建立一套设计模式（Design Pattern），让你面对任何 Agent 场景都能设计出专业的交互体验。

这是前端开发者在 AI 时代最大的差异化优势——后端工程师和算法工程师可以把模型调得很好，但他们做不出让用户觉得"哇，这个 AI 用起来真舒服"的体验。而这，正是你的活儿。

---

## 17.1 Agent UI 不等于聊天框：重新理解 AI 交互范式

### 一句话直觉

聊天框是 Agent UI 的"Hello World"，不是终极形态。

### 前端类比

回想一下 Web 开发的历史。最早的网页就是一堆超链接和文本——所有交互都是"点链接 → 加载新页面"。后来我们有了表单、AJAX、SPA、拖拽、实时协作……交互范式在不断进化。

AI 界面现在就处于"超链接时代"。所有人都在做聊天框，就像 1995 年所有网站都是纯文本页面一样。聊天框能用，但远不是最优解。

```
Web 交互的进化：
纯文本页面 → 表单 → AJAX → SPA → 实时协作（Google Docs）→ ?

AI 交互的进化：
聊天框（ChatGPT）→ 嵌入式 AI（Copilot）→ Agent 面板 → Generative UI → ?
```

你现在就站在这个进化路径的关键节点上。

### 详细原理

为什么聊天框不是最佳方案？因为它有几个根本性的限制：

**1. 线性结构 vs 非线性任务**

聊天是线性的——一条消息接一条消息。但 Agent 执行任务是非线性的——它可能同时调用三个工具、在两个分支间做决策、需要你确认某一步后再继续。把这些塞进一个线性的消息流里，就像用 `git log` 来展示一棵复杂的分支图——信息是全的，但体验很差。

**2. 信息密度低**

聊天消息天然"瘦长"——一条消息占一行或几行，大量空白浪费了屏幕空间。但 Agent 产生的结果往往是结构化的——表格、图表、代码、表单——这些用聊天泡泡来展示非常别扭。

**3. 缺乏全局视野**

当 Agent 执行一个多步任务时，用户需要知道"整体进度"。聊天框里你只能看到最新的一条消息，想看之前的步骤要往上翻。这就像一个没有进度条的下载器——技术上在工作，但用户焦虑得要命。

**4. 操作效率低**

在聊天框里，用户的每次交互都要"打字 → 发送 → 等回复"。但很多场景下，用户的需求可以用更高效的方式表达——选择、滑动、拖拽、点击。

### 深层追问

**那为什么 ChatGPT 用聊天框这么成功？**

因为 ChatGPT 解决的是**通用对话**问题——用户不知道 AI 能做什么，最灵活的交互方式就是自然语言输入。但当你做的是一个**特定领域的 Agent 产品**时，你是知道用户要做什么的。既然知道，就应该为这个场景设计最优的交互方式，而不是退回到最通用（也最低效）的聊天框。

类比：所有的应用本质上都是"输入 → 处理 → 输出"，但你不会因此把所有应用都做成一个命令行界面。命令行最通用，但不是最好用。

### 实际场景

根据不同的 Agent 场景，UI 形态应该不同：

| 场景 | 最佳 UI 形态 | 为什么不是聊天框 |
|------|-------------|----------------|
| 代码助手 | 内联建议 + 侧边面板 | 程序员不想离开编辑器去聊天 |
| 数据分析 Agent | 仪表盘 + 可交互图表 | 数据需要可视化，不是文字描述 |
| 工作流自动化 | 步骤面板 + 审批流 | 用户需要看到全局进度和控制权 |
| 客服 Agent | 聊天框 + 知识面板 | 这是少数适合聊天框的场景 |
| 设计辅助 Agent | 画布嵌入式 | 设计师需要在设计工具中直接操作 |
| 文档写作助手 | 内联编辑 + 浮窗 | 写作者不想切换上下文 |

---

## 17.2 Agent 交互的四大特殊挑战

### 一句话直觉

Agent UI 之所以难做，是因为你要在不确定性的海洋里给用户确定性的感觉。

### 前端类比

传统 Web 开发中，你调一个 REST API，请求时间大概 200ms-2s，返回格式确定，成功失败有 HTTP 状态码。你知道怎么做 loading 状态、怎么做错误处理、怎么做乐观更新。

但 Agent 的"API 调用"完全不一样：

```typescript
// 传统 API 调用——确定性
const user = await fetch('/api/user/123'); // 200ms，{ name, email }

// Agent "API 调用"——不确定性爆炸
const result = await agent.execute('帮我分析上个月的销售数据');
// 要多久？3秒？30秒？3分钟？不知道
// 返回什么？文字？图表？表格？不知道
// 中间干了啥？调了几个工具？查了什么数据库？不知道
// 结果对吗？可能对，可能有幻觉，不知道
```

你的 UI 要在这四个"不知道"上，给用户最好的体验。

### 详细原理

**挑战一：时间不确定性**

传统 API 的响应时间是可预测的——你知道一个数据库查询大概几十毫秒，一个外部 API 调用大概几百毫秒。但 Agent 的执行时间取决于任务复杂度：一个简单问答 2 秒搞定，一个需要调用 5 个工具的分析任务可能要 30 秒，一个包含多轮推理的复杂任务可能要几分钟。

这直接影响了 loading 状态的设计。传统的 spinner 或 skeleton screen 在 2 秒内是可以接受的，但如果一个 spinner 转了 30 秒，用户会觉得"是不是卡了？要不要刷新？"

**挑战二：内容不确定性**

传统 API 返回固定格式的 JSON，你的 UI 是预先设计好的。但 Agent 返回的内容是不确定的——可能是一段文字、一个代码块、一个表格、一个图表、甚至是一组操作建议。你的 UI 必须足够灵活，能优雅地渲染各种类型的内容。

**挑战三：过程不透明**

传统 API 是黑盒，但用户不在意——你点了"提交订单"，只需要知道成功还是失败。但 Agent 不一样，当它花了 20 秒执行一个任务时，用户强烈想知道"它在干什么"。这种透明度需求是 Agent UI 独有的。

如果你什么都不展示，用户会觉得 AI "在偷懒"或"卡住了"。如果你展示了太多技术细节，用户会觉得"这是什么乱七八糟的东西"。找到合适的透明度是一门艺术。

**挑战四：信任不确定性**

传统应用的结果是确定的——你转账 100 块，余额减少 100 块，这是数学事实。但 Agent 的结果可能是错的——它可能产生幻觉、遗漏信息、或者误解了你的意图。用户需要某种方式来判断"这个结果可信吗"。

### 深层追问

**这四个挑战的核心矛盾是什么？**

核心矛盾是：**用户期望确定性，但 AI 本质上是概率性的**。你的 UI 设计不是要消除不确定性（那是 AI 研究者的活），而是要**管理不确定性的用户感知**——让用户在不确定的过程中感到安心和掌控。

这和天气预报的设计哲学一样。天气预报本质上是不确定的（概率预测），但好的天气 App 会让你觉得"我知道明天大概是什么天气，我可以据此做决策"。坏的天气 App 要么过度承诺（"明天一定是晴天"然后打脸），要么过度谨慎（"明天有 30-70% 的概率下雨"让你无法决策）。

---

## 17.3 思维链可视化（Thought Chain）

### 一句话直觉

让用户看到 AI "在想什么"，就像看到厨师在明厨亮灶里做菜——过程透明，信任自然建立。

### 前端类比

你用 Chrome DevTools 调试一个复杂请求时，Network Tab 会展示完整的请求链：DNS 解析 → TCP 连接 → TLS 握手 → 发送请求 → 等待响应 → 下载内容。每个阶段都有时间线、状态和详情。你不需要看懂每个字节，但这种透明度让你确信"浏览器在正常工作"。

思维链可视化做的是同样的事——不是让用户看懂 AI 的每一步推理，而是让用户确信"AI 在认真工作"。

### 详细原理

思维链可视化不是简单地把 AI 的内部思考过程（thinking tokens）原样展示给用户。那是原始数据，不是用户体验。你需要做的是**结构化地展示 Agent 的工作流程**。

一个 Agent 的典型执行过程是：

```
接收任务 → 分析任务 → 决定调用工具A → 等待工具A结果 → 
分析结果 → 决定调用工具B → 等待工具B结果 → 综合分析 → 生成回答
```

把这个过程映射到 UI 上，每一步应该有：

1. **状态标识**：正在进行 / 已完成 / 失败
2. **简要描述**：用户能理解的自然语言描述，不是技术术语
3. **时间信息**：每一步花了多久
4. **详情展开**：点击可以看到更多细节（工具参数、返回结果等）

关键设计原则：

**原则一：摘要优先，详情按需**

默认只展示每一步的摘要（"正在查询销售数据..."），用户感兴趣时点击展开看详情。这就像 React DevTools 默认折叠组件树——给你全局视野，需要时再深入。

```
✅ 理解任务：分析上个月销售数据    [0.8s]
✅ 查询数据库：获取10月销售记录    [2.1s]  ▸
🔄 生成图表：按品类汇总趋势        [进行中...]
⬜ 撰写分析报告
⬜ 生成优化建议
```

**原则二：使用用户语言，不是技术术语**

不要展示 `Calling function: query_database with params: {table: 'sales', ...}`。用户看不懂，也不需要看懂。应该展示 `正在查询销售数据...`。

但是——保留技术详情作为"高级模式"。有些用户（比如开发者）确实想看到原始的工具调用参数和返回值。用折叠面板让这些信息可访问但不干扰。

**原则三：动画和过渡传达"活跃感"**

一个静态的 spinner 让人觉得可能卡住了。但如果你能展示文字在逐步出现、步骤在逐个完成、进度条在缓慢推进——用户会觉得"AI 在忙活，没有偷懒"。

这里有一个前端开发者特别擅长的技巧：**感知性能优化**。实际的执行速度你改不了（那是模型的事），但感知上的速度你可以通过 UI 来优化。类比：你做页面加载优化时，骨架屏（Skeleton Screen）并没有让页面加载更快，但用户感觉更快了。

**原则四：允许用户跳过**

不是所有用户都关心 Agent 在干什么。有的用户只想要结果。所以思维链展示应该是**可折叠/可关闭的**，而不是强制占据屏幕空间。

### 深层追问

**用户真的需要看到思维链吗？什么时候该展示，什么时候该隐藏？**

这取决于两个因素：

1. **任务的风险等级**：高风险任务（涉及金钱、数据修改、发送邮件）应该展示详细的思维链，让用户确认每一步是合理的。低风险任务（查询天气、翻译文本）隐藏就好。

2. **等待时间**：如果 Agent 2 秒就完成了，展示思维链反而多此一举。但如果要等 20 秒以上，不展示思维链用户会觉得"是不是死了"。

经验法则：**3 秒以内不展示，3-10 秒展示简要进度，10 秒以上展示详细步骤。**

---

## 17.4 工具调用可视化（Tool Call Display）

### 一句话直觉

Agent 调工具就像你在 DevTools 里看到的 API 请求——用户需要知道发生了什么，但不需要看到原始 payload。

### 前端类比

Chrome DevTools 的 Network Tab 是完美的类比：

```
Name              Status  Type     Size    Time
─────────────────────────────────────────────────
GET /api/sales     200    json     12.3KB   245ms
POST /api/report   200    json     1.2KB    180ms
GET /api/charts    200    json     45.6KB   520ms
```

你可以一眼看到：调了什么接口、是否成功、耗时多久。点击某一行可以看到请求详情。这种"概览 + 详情"的双层结构，正是工具调用可视化应该采用的模式。

### 详细原理

当 Agent 调用工具时，有四类信息需要展示：

**1. 工具名称和意图**

不是展示函数名 `searchDatabase`，而是展示用户能理解的描述 `搜索数据库`。更好的做法是展示意图：`正在查找你上个月的订单记录`。

**2. 关键参数（可选展示）**

有些参数用户会关心——比如"搜索了什么关键词"、"查询了哪个时间范围"。这些帮助用户验证 Agent 是否理解了他的需求。

**3. 执行状态**

进行中、成功、失败。失败时要展示友好的错误信息，不是 raw error stack。

**4. 结果摘要**

工具返回的结果可能很大（一个数据库查询返回 1000 条记录），展示摘要而不是全部数据：`找到 1,243 条记录，时间范围 2024-10-01 ~ 2024-10-31`。

**展开/折叠设计**

```
🔧 查询销售数据                          ✅ 完成 · 2.1s
   └─ 查询了 2024年10月 的全部销售记录
      找到 1,243 条，总金额 ¥458,000
      [展开详情 ▸]

🔧 生成趋势图表                          ✅ 完成 · 1.5s
   └─ 按"日期"和"品类"两个维度生成折线图
      [展开详情 ▸]

🔧 调用分析模型                          🔄 进行中...
   └─ 正在分析销售趋势和异常点
```

**交互细节**：

- 默认折叠，只展示一行摘要
- 鼠标 hover 或点击展开详情
- 详情中可以看到原始的输入参数和返回数据（JSON 格式，带语法高亮）
- 失败的工具调用用红色标记，展示错误原因和可能的解决方案
- 考虑添加"复制参数"和"复制结果"按钮——这在开发调试时非常有用

### 深层追问

**工具调用失败时怎么展示？**

这是经常被忽略的场景。Agent 调用工具失败是常见的——API 超时、权限不足、参数错误都可能发生。

差的做法：展示一个红色错误图标，然后什么都不说。
一般的做法：展示错误信息，如"数据库查询失败"。
好的做法：展示错误原因 + Agent 的应对策略。

```
🔧 查询销售数据                          ❌ 失败
   └─ 数据库连接超时（15秒无响应）
      Agent 正在重试... (第 2/3 次)

🔧 查询销售数据 (重试)                    ✅ 完成 · 3.2s
   └─ 重试成功，找到 1,243 条记录
```

让用户看到"Agent 自己处理了错误"，这对建立信任非常有帮助。就像你看到一个成熟的监控系统自动做了故障转移——你会更信任这个系统。

---

## 17.5 进度展示（Progress Indicator）

### 一句话直觉

Agent 执行多步任务时，用户需要一个"GPS 导航"——不只是知道"还在开"，而是知道"开到哪了、还有多远"。

### 前端类比

想想文件上传的进度条设计：

```
❌ 坏的设计：一个不确定的 spinner，不知道传了多少
⚠️ 中等设计：一个进度条 65%，但不知道还要多久
✅ 好的设计：上传中 65% · 已上传 6.5MB / 10MB · 预计剩余 12 秒
```

Agent 的进度展示也遵循同样的层次：从"在做了"到"做到哪了"到"还要多久"。

### 详细原理

Agent 的进度展示比文件上传复杂得多，因为文件上传的总量是已知的（文件大小），但 Agent 的总步骤数在执行前可能是未知的。

**场景一：步骤已知（规划型 Agent）**

如果 Agent 在执行前生成了一个计划（比如 ReAct 模式中的 Planning 阶段），那步骤数是已知的：

```
执行计划：分析销售数据并生成报告

Step 1/5  ✅ 获取销售数据            已完成
Step 2/5  ✅ 数据清洗和预处理          已完成
Step 3/5  🔄 趋势分析                进行中...
Step 4/5  ⬜ 生成可视化图表           等待中
Step 5/5  ⬜ 撰写分析报告            等待中

━━━━━━━━━━━━━━━━━━━░░░░░░░░░  60%
预计剩余时间：约 20 秒
```

这种情况下，步骤条（Stepper）是最佳选择。它同时传达了三个信息：
1. 总共要做几步
2. 现在在第几步
3. 已经完成了什么

**场景二：步骤未知（自主型 Agent）**

如果 Agent 是完全自主的（每一步根据上一步的结果决定下一步做什么），你在执行前不知道总共要几步。这种情况下，步骤条不适用，改用**时间线**（Timeline）设计：

```
┌─ 12:30:01  理解任务                    ✅ 0.5s
├─ 12:30:02  查询数据库                   ✅ 2.1s
├─ 12:30:04  发现数据异常，决定深入分析     ✅ 1.2s
├─ 12:30:05  调用异常检测工具              ✅ 3.5s
├─ 12:30:09  分析异常原因                 🔄 进行中...
│
│  已执行 5 步 · 已用时 8.3 秒
└─ ···
```

**感知性能优化**

当 Agent 执行时间较长时（超过 10 秒），有几个 UX 技巧可以降低用户的等待焦虑：

1. **微动画**：每个步骤切换时有平滑的过渡动画，让用户感觉事情在推进
2. **已完成信息即时展示**：不要等所有步骤都完成才展示结果。第一步的结果出来了就先展示。这和流式渲染的道理一样——部分信息 > 完全等待
3. **预期管理**：在任务开始时，给出一个大致的时间预估。"这个分析预计需要 20-30 秒" 比什么都不说好得多。即使预估不准确，用户也有了心理预期
4. **可取消**：长时间任务必须支持取消。没有取消按钮的长任务让用户有一种被"绑架"的感觉

### 深层追问

**Agent 执行 30 秒的任务时，如何让用户不觉得慢？（不是技术优化，是 UX 设计）**

这是一个纯 UX 问题，技术手段（让模型更快）不在讨论范围内。答案在心理学里：

1. **有反馈的等待感觉更短**。经典研究：排队时看到前面还有几个人，感觉比看不到快 36%。Agent 的步骤展示就是"让用户看到前面还有几个人"。

2. **有解释的等待更能被接受**。当你告诉用户"正在分析 1,243 条数据"时，用户会想"哦，数据量挺大的，难怪要等"。但如果你只显示一个 spinner，用户会想"为什么这么慢？是不是出 bug 了？"。

3. **早期反馈比最终结果更重要**。前 3 秒给出第一个可见的变化（比如展示第一步的结果），用户会觉得"好，在工作了"。然后即使后面要等 27 秒，焦虑感也大大降低。这和首屏渲染优化的道理完全一样——FCP（First Contentful Paint）比完整加载更影响用户感知。

4. **让用户在等待期间能做别的事**。如果 Agent 在后台执行、完成后通知用户，用户甚至不会觉得"慢"——因为他在干别的事。这就是 macOS 通知中心的设计哲学。

---

## 17.6 审批流（Approval Flow）

### 一句话直觉

审批流让用户觉得"我在掌控 AI"，而不是"AI 在操控我"。

### 前端类比

你一定用过 `rm -rf` 之前的确认提示，或者 Git force push 前的警告。这些都是"危险操作确认"模式。但 Agent 的审批流比一个 `confirm('确定要删除吗？')` 复杂得多——因为 Agent 想做的事可能很复杂，你需要让用户理解 AI 想做什么、为什么要做、影响是什么，然后再决定是否批准。

```typescript
// 传统的确认框——太简单了
if (confirm('确定要发送这封邮件吗？')) {
  sendEmail();
}

// Agent 审批流需要的信息量
<ApprovalDialog
  action="发送邮件"
  reason="根据你的要求，我为客户A草拟了一封跟进邮件"
  details={{
    to: 'client-a@example.com',
    subject: 'Q3 合作方案跟进',
    preview: '邮件正文前200字...',
  }}
  impact="这封邮件将从你的工作邮箱发出，客户会看到"
  alternatives={['修改后发送', '保存为草稿', '取消']}
/>
```

### 详细原理

审批流设计的核心挑战是：**在"安全"和"效率"之间找到平衡**。

每一步都确认 → 安全但用户觉得烦，Agent 没有自主性
完全不确认 → 效率高但用户不放心，出了问题无法挽回

好的审批流设计需要回答三个问题：

**1. 什么操作需要审批？**

不是所有操作都需要审批。判断标准：

| 是否需要审批 | 操作特征 | 示例 |
|------------|---------|------|
| 不需要 | 只读、可撤回、低影响 | 查询数据、生成摘要、翻译文本 |
| 需要 | 不可逆、涉及外部系统、涉及金钱 | 发送邮件、删除数据、下单支付 |
| 可配置 | 因用户/场景而异 | 创建文件、修改配置、发送消息 |

前端类比：这就像 ESLint 的规则级别——有些是 `error`（必须确认），有些是 `warn`（建议确认），有些是 `off`（不需要确认）。让用户自定义这些级别是高级功能。

**2. 审批界面展示什么信息？**

一个好的审批对话框应该包含：

- **要做什么**（What）：用清晰的自然语言描述动作
- **为什么**（Why）：AI 为什么决定要做这件事
- **影响范围**（Impact）：这个操作会产生什么影响
- **可预览的结果**（Preview）：如果可能，展示操作结果的预览
- **替代方案**（Alternatives）：除了同意/拒绝，还有没有其他选项

**3. 批量操作的审批粒度？**

当 Agent 需要执行 10 个操作时，用户不想一个一个确认。这时需要**批量审批**设计：

```
Agent 计划执行以下 8 个操作：

✅ 查询10月销售数据          [自动执行·只读操作]
✅ 查询10月库存数据          [自动执行·只读操作]
✅ 生成对比分析              [自动执行·只读操作]
⚠️ 更新销售预测表            [需要确认·会修改数据]
⚠️ 发送报告给团队            [需要确认·会发送邮件]
✅ 生成下月采购建议           [自动执行·只读操作]
⚠️ 创建采购申请单            [需要确认·会创建单据]
✅ 汇总分析报告              [自动执行·只读操作]

[全部批准] [逐个审批] [只执行自动项]
```

### 深层追问

**如何设计审批流让用户觉得"我在掌控局面"而不是"这个 AI 老来烦我"？**

关键在于**渐进式信任**。

新用户或新功能 → 默认什么都确认，让用户建立对 AI 的了解
使用一段时间后 → 提供"信任此类操作"选项，减少同类确认
高级用户 → 允许设置"自动执行规则"，只在异常时中断

这和操作系统的权限模型一样。macOS 第一次运行新应用会问你"是否允许访问相册"，但不会每次打开都问。用户授权一次，系统记住，以后自动放行——但用户随时可以在设置里收回权限。

具体的设计模式：

```
首次使用：  每步确认  → 用户了解 Agent 能做什么
建立信任：  提供"记住我的选择"复选框
成熟阶段：  只在异常操作时中断
随时可控：  设置页面可以调整每类操作的审批级别
```

另一个技巧是**异步审批**。Agent 不需要在审批时"暂停一切"——它可以先执行不需要审批的步骤，把需要审批的步骤"挂起"，在后台继续其他工作。用户在方便的时候再处理审批。这就像 Code Review 的模式——你不需要实时 review 每一行代码，可以在合适的时候批量处理。

---

## 17.7 Generative UI：AI 不只返回文本，还能生成界面

### 一句话直觉

让 AI 根据上下文动态生成最合适的 UI 组件，而不是把所有信息都塞进文本消息里。

### 前端类比

你写过"根据后端返回的数据类型动态渲染不同组件"的代码吗？

```tsx
// 传统的动态渲染——手动映射
function renderData(data: ApiResponse) {
  switch (data.type) {
    case 'table': return <DataTable data={data.rows} />;
    case 'chart': return <LineChart data={data.points} />;
    case 'form':  return <DynamicForm fields={data.fields} />;
    default:      return <p>{data.text}</p>;
  }
}
```

Generative UI 把这个模式推向了极致——AI 不只是返回数据，它直接"决定"应该渲染什么组件，并提供组件需要的 props。

### 详细原理

Generative UI 有两种实现方式：

**方式一：模型选择预定义组件（推荐）**

你预先定义一组 UI 组件，AI 根据上下文选择最合适的组件和参数。这是 Vercel AI SDK 的 RSC（React Server Components）方案的核心思路。

```
用户："帮我看看上个月的销售趋势"

传统方式：AI 返回一段文字描述趋势
Generative UI：AI 返回一个 <TrendChart> 组件，
              数据已经填好了，用户直接看到交互式图表
```

本质上，Agent 的工具不只是"后端工具"（查数据库、调 API），还包括"UI 工具"（生成图表、展示表格、创建表单）。当你把 UI 组件也注册为工具时，Agent 就能根据需要"调用"最合适的可视化方式。

**方式二：模型生成原始 HTML/代码（不推荐）**

让 AI 直接生成 HTML 或 React 代码，然后动态渲染。这在技术上可行（比如 Vercel 的 v0 就是这么做的），但在产品级应用中风险很大——XSS 攻击、样式冲突、渲染性能都是问题。

除非你在做一个开发者工具或原型生成器，否则不建议这种方式。

**Vercel AI SDK 的 Generative UI 方案**

Vercel AI SDK 通过 React Server Components 提供了一种优雅的 Generative UI 实现。核心思路是：AI 在服务端选择并渲染 React 组件，然后流式传输到客户端。

```typescript
// 在工具定义中返回 React 组件
const tools = {
  showWeather: {
    description: '展示天气信息',
    parameters: z.object({
      city: z.string(),
    }),
    // generate 返回的是 React 组件，不是纯数据
    generate: async function* ({ city }) {
      yield <WeatherSkeleton />; // 先展示骨架屏
      const weather = await getWeather(city);
      return <WeatherCard data={weather} />; // 再展示完整卡片
    },
  },
  showStockChart: {
    description: '展示股票走势图',
    parameters: z.object({
      symbol: z.string(),
      period: z.enum(['1d', '1w', '1m', '1y']),
    }),
    generate: async function* ({ symbol, period }) {
      yield <ChartSkeleton />;
      const data = await getStockData(symbol, period);
      return <InteractiveChart data={data} />;
    },
  },
};
```

这种设计的精妙之处：

1. AI 只需要决定"展示天气还是展示股票"，以及提供参数——不需要生成任何 UI 代码
2. 你（前端开发者）完全控制组件的实现——样式、交互、动画都由你决定
3. 通过 `yield` 支持骨架屏过渡——用户先看到占位 UI，再看到真实数据
4. 类型安全——工具参数用 Zod 定义，组件 props 也有类型

### 深层追问

**Generative UI 的安全风险是什么？如何防止 XSS？**

风险主要集中在"方式二"（AI 直接生成代码）。当你让 AI 输出 HTML/JSX 并动态渲染时，这本质上和 `dangerouslySetInnerHTML` 一样危险。

但即使是"方式一"（选择预定义组件），也有安全考虑：

1. **AI 选择的参数可能包含恶意内容**：如果 AI 被 Prompt 注入，它可能返回包含 `<script>` 标签的参数。你在组件中渲染这些参数时必须做转义。

2. **AI 可能被诱导调用不该调用的 UI 组件**：比如 AI 可能被诱导展示一个伪造的登录表单。你需要在 system prompt 和工具定义中做好限制。

3. **数据泄露风险**：AI 选择展示的数据可能包含敏感信息。你需要在组件层面做权限校验，不能完全信任 AI 的决策。

防御策略：

```typescript
// 永远不要直接渲染 AI 返回的原始字符串
<div dangerouslySetInnerHTML={{ __html: aiResponse }} /> // 危险！

// 应该通过预定义的组件来渲染
<WeatherCard city={sanitize(aiParams.city)} /> // 安全

// 关键数据在组件内部重新获取，不信任 AI 传过来的
function WeatherCard({ city }: { city: string }) {
  const weather = useQuery(['weather', city]); // 组件自己查
  // 而不是用 AI 传过来的天气数据
}
```

核心原则：**AI 决定"展示什么"，但数据由组件自己获取和校验**。把 AI 当成一个不完全可信的"路由器"——它推荐方向，但你自己走路。

---

## 17.8 流式渲染优化

### 一句话直觉

流式渲染是 Agent UI 的"首屏性能优化"——不是让 AI 更快，而是让用户更早看到内容。

### 前端类比

你一定做过 SSR（Server-Side Rendering）和流式 HTML。流式 AI 输出和流式 SSR 的理念完全一致：

```
传统 SSR：等页面全部渲染完 → 一次性发给浏览器
流式 SSR：渲染一点发一点 → 浏览器逐步呈现

传统 AI：等 AI 想完所有内容 → 一次性返回
流式 AI：AI 生成一个 Token 发一个 → 前端逐步呈现
```

### 详细原理

流式渲染面临几个前端特有的挑战：

**挑战一：Markdown 实时渲染**

AI 输出的 Markdown 是逐字符到达的。当你收到 `## 标` 这三个字符时，你不知道后面是 `题` 还是 `签`——也就是说，你不知道这是一个 H2 标题还是普通文本。

解决方案是**宽松解析 + 延迟确认**：

```typescript
// 核心思路：对不完整的 Markdown 采用"乐观解析"
// 如果看到 ## 开头，先假设它是标题来渲染
// 如果后续内容表明它不是标题，再回退

// 推荐使用专为流式设计的 Markdown 渲染库
// 如 react-markdown 配合自定义的流式处理逻辑
```

实际中，大多数情况下你可以用成熟的库来处理：`react-markdown` 对不完整的 Markdown 有一定的容错能力。更好的方案是使用专为 AI 流式输出设计的渲染组件。

**挑战二：代码块高亮**

代码块在流式过程中特别麻烦。当你收到 ` ```typescript ` 时，你知道一个代码块开始了，但你不知道什么时候结束。在代码块"开放"期间，你需要对逐步到达的代码做实时语法高亮。

关键优化：

```typescript
// 方案一：等代码块完整后再高亮（简单但体验差——代码块区域长时间无高亮）
// 方案二：对不完整的代码做增量高亮（复杂但体验好）

// 实际推荐：用 Shiki 或 Prism 做增量高亮
// 每收到新行时，只对新增的行做高亮，不重新处理整个代码块
```

**挑战三：布局抖动**

流式内容不断增长，导致页面高度持续变化。如果用户在阅读中间的内容，新内容把他正在看的内容往上推——这就是"布局抖动"（Layout Shift），和 Web Vitals 中的 CLS（Cumulative Layout Shift）是同一个问题。

解决方案：

```
1. 自动滚动追踪：新内容到达时自动滚动到底部
2. 智能中断：如果检测到用户向上滚动了（说明在回看），停止自动滚动
3. "新内容"提示：当自动滚动停止后，底部显示一个"↓ 有新内容"按钮
```

这和聊天应用的设计模式完全一样——你在看历史消息时新消息来了，不应该把你强制拉到底部。

**挑战四：渲染性能**

如果 AI 输出一篇长文（几千字），每收到一个 Token 就触发一次 React re-render，性能会很差。

优化策略：

```typescript
// 不要每个 Token 都触发渲染
// 使用 requestAnimationFrame 做批量更新
// 或者用 React 18 的自动批处理

// 对于长文本，考虑虚拟化——只渲染可视区域内的内容
// react-virtuoso 是个好选择
```

### 深层追问

**LaTeX 公式的流式渲染怎么处理？**

LaTeX 公式（如 `$E = mc^2$`）在流式中特别棘手。当你收到 `$E = m` 时，你知道一个行内公式开始了，但它还不完整，KaTeX 无法渲染不完整的公式。

实践中的方案：

1. 检测到 `$` 开始但还没有结束的 `$` 时，先以等宽字体展示原始 LaTeX 源码
2. 一旦检测到公式闭合，立即用 KaTeX 渲染
3. 渲染后如果字号变化可能导致布局抖动，考虑预留公式的高度空间

---

## 17.9 错误状态设计

### 一句话直觉

AI 的"错误"不只是 500 报错，还包括"回答不确定"、"工具调用失败"、"超时"——每种状态需要不同的视觉和交互设计。

### 前端类比

传统 Web 应用的错误状态你一定处理过：

```
网络错误    → "网络连接异常，请检查网络后重试"  [重试]
服务器错误  → "服务繁忙，请稍后再试"            [重试]
权限错误    → "您没有权限，请联系管理员"        [返回]
404         → "页面不存在"                      [回首页]
```

Agent 的错误状态更丰富，也更微妙。

### 详细原理

**1. 不确定性提示**

AI 有时候会"不太确定"自己的回答。好的 UI 应该让这种不确定性可见：

```
┌──────────────────────────────────────────────┐
│  关于这个问题，我找到了以下信息，但不太确定    │
│  是否完全准确：                               │
│                                              │
│  ⚠️ 该 API 在 v3.2 之后似乎已经被废弃...     │
│                                              │
│  [查看相关文档] [我来验证] [再问一遍]         │
└──────────────────────────────────────────────┘
```

视觉上的区分：确定的回答用正常样式，不确定的回答用虚线边框、浅色背景、或加上"仅供参考"标签。

**2. 工具调用失败**

```
┌──────────────────────────────────────────────┐
│  🔧 查询天气 ❌                               │
│                                              │
│  天气服务暂时不可用                            │
│  已自动重试 2 次，仍然失败                     │
│                                              │
│  不过别担心，我可以：                          │
│  • 根据历史数据给你一个大致参考                │
│  • 等一会儿再试                               │
│  • 你也可以直接查看 weather.com                │
│                                              │
│  [用历史数据] [稍后重试] [跳过这个]            │
└──────────────────────────────────────────────┘
```

关键点：**不只是告诉用户"出错了"，还要告诉用户"接下来可以怎么做"**。

**3. 超时处理**

```
┌──────────────────────────────────────────────┐
│  ⏱️ 这个分析比预期花费更长时间                 │
│                                              │
│  已执行 45 秒，正在处理大量数据...             │
│                                              │
│  [继续等待] [获取已有部分结果] [取消]          │
└──────────────────────────────────────────────┘
```

超时不应该是一个突兀的错误弹窗，而应该是一个渐进的提醒。先让用户知道"有点久了"，然后给选项，而不是直接断掉。

**4. 幻觉提示**

如果你的系统有幻觉检测机制（我们在下一章会详细讲），可以在 UI 上标记可能的幻觉：

```
上个月的销售额是 ¥458,000[1]，同比增长了 12%[2]。
其中电子产品贡献了最大份额[来源不确定]。

[1] 数据来源：销售数据库查询结果
[2] 数据来源：销售数据库查询结果
[来源不确定] 未找到支持此说法的数据来源，可能为推测
```

给 AI 的每个关键论断标注来源，没有来源的论断标记为"不确定"。这和学术论文的引用机制一样——有引用的结论比没引用的结论更可信。

---

## 17.10 移动端适配与可访问性

### 一句话直觉

移动端不是"把桌面版缩小"，Agent 在手机上需要完全不同的交互策略。

### 前端类比

你做响应式设计时，不会简单地给桌面版加一个 `max-width: 100%` 就算适配了移动端。移动端需要重新考虑信息层级、交互手势和屏幕空间利用。Agent UI 也一样——甚至更甚。

### 详细原理

**移动端的特殊挑战**

1. **屏幕空间极其有限**：桌面端可以同时展示思维链、工具调用和结果。移动端必须取舍——默认只展示最终结果，详情放在可展开的面板或下拉抽屉中。

2. **输入成本更高**：在手机上打字比桌面慢得多。考虑提供快捷回复按钮、语音输入、预设操作等方式来减少打字。

3. **长时间运行任务**：手机用户不会盯着屏幕等 30 秒。应该支持推送通知——Agent 完成后推送一条通知，用户点进来直接看结果。

4. **手势交互**：移动端特有的手势可以用于 Agent 交互——左滑撤回、长按查看详情、下拉刷新重新生成。

```
桌面端布局：
┌──────────────────────────────────────┐
│  侧边栏    │    主内容区     │ 详情面板 │
│  对话列表  │   Agent 回复    │ 工具调用  │
│            │   思维链展示    │ 参数详情  │
└──────────────────────────────────────┘

移动端布局：
┌──────────────────┐
│  Agent 回复（主）  │   ← 全屏展示最重要的内容
│                   │
│  [展开详情 ▸]     │   ← 次要信息放在可展开面板
│                   │
│  ┌──────────────┐ │
│  │ 快捷回复按钮  │ │   ← 减少打字
│  │ [同意] [修改] │ │
│  └──────────────┘ │
└──────────────────┘
```

**可访问性（A11y）**

这是大多数 Agent 产品都忽略的领域，但作为前端开发者，你应该关注：

1. **流式输出的屏幕阅读器处理**：屏幕阅读器怎么处理每秒更新数十次的文本？不能每个 Token 都朗读一次，那用户会疯掉。解决方案是使用 `aria-live="polite"`，让屏幕阅读器在"方便的时候"朗读更新内容，而不是每次更新都中断。更好的做法是在生成完成后一次性朗读完整回复。

2. **键盘导航**：审批流弹窗要支持 Tab 键切换焦点、Enter 确认、Escape 取消。思维链的展开/折叠要能用键盘操作。

3. **颜色以外的状态标识**：不要只用颜色区分成功（绿）和失败（红）——色盲用户看不出来。同时使用图标（对号/叉号）和文字（成功/失败）。

4. **减少动画**：支持 `prefers-reduced-motion` 媒体查询。对于有动画敏感的用户，关闭流式文字的打字机效果，直接展示完整内容。

```css
@media (prefers-reduced-motion: reduce) {
  .typewriter-effect {
    animation: none;
    /* 直接展示完整文本 */
  }
  .step-transition {
    transition: none;
  }
}
```

---

## 概念辨析

### Generative UI vs Dynamic Form

| 维度 | Generative UI | Dynamic Form |
|------|-------------|-------------|
| 决策者 | AI 决定渲染什么 | 后端配置决定渲染什么 |
| 灵活度 | 高——每次对话可能不同 | 中——配置决定后相对固定 |
| 安全性 | 需要额外防护 | 相对安全（预定义结构） |
| 适用场景 | 开放式对话中的动态展示 | 表单流程、配置界面 |

### 思维链可视化 vs 日志输出

| 维度 | 思维链可视化 | 日志输出 |
|------|-----------|---------|
| 目标受众 | 终端用户 | 开发者 |
| 信息粒度 | 摘要级 | 详细级 |
| 语言风格 | 自然语言 | 技术术语 |
| 设计目标 | 建立信任 | 调试排错 |

### 审批流 vs 确认弹窗

| 维度 | Agent 审批流 | 传统确认弹窗 |
|------|-----------|-------------|
| 信息量 | 包含原因、影响、替代方案 | 通常只有一句确认文案 |
| 粒度控制 | 可按操作类型配置 | 通常全有或全无 |
| 学习能力 | 可以记住用户偏好 | 每次都弹 |
| 操作选项 | 多个（同意/修改/跳过/...） | 通常只有确定/取消 |

---

## 灵魂拷问

> **Q1：为什么说"把 ChatGPT 的界面抄一遍"是最差的 Agent UI 方案？**

A：因为 ChatGPT 解决的是**通用对话**问题——它不知道用户要做什么，所以用最通用的聊天框。但你做的是**特定领域的 Agent**——你知道用户要做什么（分析数据、管理任务、写代码...），应该为这个特定场景设计最优的交互方式。

抄 ChatGPT 的界面等于放弃了你最大的优势——对业务场景的理解。这就像你要做一个音乐播放器，不去设计播放控制、歌词显示、播放列表，而是做了一个命令行让用户输入"播放下一首"——技术上能用，但用户体验灾难。

更深层的问题是：聊天框的线性结构天然不适合展示 Agent 的非线性工作过程。Agent 可能并行调用工具、在多个分支间决策、产生结构化的输出——这些塞进聊天泡泡里，就像用 Excel 来写小说。

---

> **Q2：用户真的需要看到 Agent 的思维链吗？什么时候该展示，什么时候该隐藏？**

A：取决于两个因素——**风险等级**和**等待时间**。

高风险场景（Agent 要帮你发邮件、改数据、下单）→ 必须展示思维链。用户需要验证 AI 的推理是否正确，因为错误的代价很大。

低风险场景（翻译文本、回答知识问题）→ 默认隐藏。用户只关心结果，不关心推理过程。

等待时间短（< 3秒）→ 不需要展示，结果直接出来了。
等待时间长（> 10秒）→ 必须展示，否则用户会觉得系统卡死。
中间地带（3-10秒）→ 展示简要进度指示即可。

还有一个被忽略的维度：**用户的技术水平**。开发者类用户可能喜欢看到 Agent 的推理过程（"哦，它决定用 SQL 而不是 API 来查数据，有意思"），而非技术用户只想要结果。提供一个"开发者模式"开关是不错的做法。

---

> **Q3：Generative UI（AI 生成 UI 组件）的安全风险是什么？如何防止 XSS？**

A：安全风险分三个层面：

**XSS 风险**：如果 AI 直接生成 HTML 并渲染，攻击者可以通过 Prompt 注入让 AI 生成 `<script>alert('hacked')</script>`。防御方法：永远不要直接渲染 AI 生成的 HTML。使用预定义组件 + 参数传递的方式——AI 只选择组件和提供参数，组件本身由你控制。

**数据泄露风险**：AI 可能被诱导在 UI 中展示不该展示的数据。比如一个多租户系统中，AI 可能展示其他租户的数据。防御方法：组件自己做数据获取和权限校验，不信任 AI 传过来的数据。

**社会工程风险**：AI 可能被诱导生成一个伪造的登录表单或支付页面。防御方法：限制 AI 可选择的组件集合，敏感操作（登录、支付）只能由系统触发，不能由 AI 触发。

核心原则：**把 AI 当成一个不完全可信的"建议者"——它建议展示什么，但实际展示什么由你的代码决定**。

---

> **Q4：Agent 执行 30 秒的任务时，如何让用户不觉得慢？（不是技术优化，是 UX 设计）**

A：这是一个纯粹的心理学问题，有四个经典策略：

1. **不确定等待 → 确定等待**：告诉用户"预计需要 20-30 秒"。人类对确定的等待耐受度远高于不确定的等待。排队时看到"前方还有 3 人"比"请等待"焦虑感低很多。

2. **消极等待 → 积极等待**：展示 Agent 的工作过程。每隔几秒展示一个新的进展，让用户觉得"事情在推进"。这和游戏加载页面展示"小提示"是同一个原理——让等待时间变成有内容的时间。

3. **后台执行 + 通知**：最激进的方案——不让用户等。Agent 在后台执行，用户去做别的事。完成后弹一个通知。等待时间为零（感知上）。

4. **渐进式结果**：不等全部完成才展示。执行到第 2 步时就把第 1 步的结果先展示出来。用户开始阅读第 1 步的结果时，第 3 步可能就完成了。这就是流式渲染的哲学——让内容"像水一样流出来"，而不是"像炸弹一样一次性炸出来"。

---

> **Q5：如何设计审批流让用户觉得"我在掌控局面"而不是"这个 AI 老来烦我"？**

A：关键在于**频率控制**和**渐进式信任**。

频率控制：
- 把操作分为"自动执行"（只读操作）和"需要审批"（写操作）两类
- 合并审批——如果 Agent 要执行 5 个写操作，不要弹 5 次对话框，一次批量展示让用户统一审批
- 智能静默——同类操作用户连续批准了 5 次，提示"是否自动批准此类操作？"

渐进式信任：
- 新用户默认严格模式（多确认）
- 用户手动调低确认级别（而不是系统自动降低）
- 随时可以回到严格模式

差的设计让用户觉得"AI 要做什么都得经过我同意，好烦"。好的设计让用户觉得"AI 在独立工作，重要的事会来征求我意见"。区别在于：前者是"每件事都打断你"，后者是"只在关键时刻打断你"。

---

> **Q6：移动端的 Agent 界面和桌面端应该有什么区别？不只是响应式那么简单**

A：移动端 Agent UI 需要在三个维度上做根本性的重新设计：

**信息架构**：桌面端可以并排展示对话、思维链和工具详情。移动端必须分层——主层只展示核心结果，详情层通过底部抽屉或下钻页面展示。这不是 `display: none` 在小屏幕上的切换，而是信息优先级的重新排列。

**交互模式**：桌面端以键盘输入为主，移动端应该最大限度减少打字。提供预设的快捷操作按钮（"同意"、"修改"、"查看更多"）、语音输入、甚至拍照输入（拍一张报表照片让 Agent 分析）。审批流在移动端可以做成类似 Tinder 的左滑拒绝、右滑同意——快速、直觉。

**注意力模式**：桌面端用户可能会盯着 Agent 执行 30 秒。移动端用户不会——他们会切出应用。所以移动端必须支持：后台执行 + 推送通知完成结果 + 离线查看历史。Agent 的执行和结果呈现必须是异步解耦的。

还有一点常被忽略：**移动端的 Agent 可以利用手机特有的能力**——GPS 定位、相机、通讯录、陀螺仪。桌面端做不到的场景（"帮我分析我现在所在位置附近的餐厅"），移动端可以做。

---

## 最佳实践

### DO

- **DO 根据业务场景选择 UI 形态**，而不是默认做聊天框。数据分析用仪表盘，工作流用步骤面板，写作辅助用内联编辑。

- **DO 展示 Agent 的工作过程**，尤其是任务执行超过 5 秒时。透明度是信任的基础。

- **DO 使用预定义组件实现 Generative UI**。让 AI 选择组件而不是生成代码。安全、可控、可维护。

- **DO 为不同风险级别的操作设置不同的审批策略**。只读操作自动执行，写操作需要确认，高危操作需要详细审批。

- **DO 在流式渲染中处理好边界情况**：不完整的 Markdown、开放的代码块、未闭合的 LaTeX 公式。

- **DO 实现"智能滚动"**：新内容到达时自动滚动到底部，但用户向上翻看时停止自动滚动。

- **DO 考虑可访问性**：`aria-live` 处理流式输出、键盘导航、色盲友好的状态标识、`prefers-reduced-motion` 支持。

### DON'T

- **DON'T 把原始的 thinking tokens 或工具调用参数直接展示给用户**。用户不需要看 JSON payload，他们需要看到人类语言的摘要。

- **DON'T 用一个不确定的 spinner 来代替进度展示**。一个转了 20 秒的 spinner 会让用户以为系统崩了。

- **DON'T 让 AI 直接生成 HTML 并用 `dangerouslySetInnerHTML` 渲染**。这是 XSS 的高速公路。

- **DON'T 对所有操作都弹审批框**。这会训练用户"无脑点确认"，反而降低了安全性（就像你在安装软件时连续点"下一步"一样）。

- **DON'T 在流式渲染中每个 Token 都触发 React re-render**。使用 `requestAnimationFrame` 或 React 18 的批量更新来优化。

- **DON'T 忽略移动端**。Agent 在移动端不是"缩小版桌面端"，需要重新设计信息架构和交互模式。

- **DON'T 假设用户会一直盯着屏幕等 Agent**。长任务应该支持后台执行和通知回调。

---

## 代码实战

### 实战1：思维链与工具调用可视化组件

一个完整的 Agent 执行过程展示组件，包含思维链、工具调用和进度指示：

```typescript
// types/agent-ui.ts
// Agent 执行过程中的事件类型
export type AgentEvent =
  | { type: 'thinking'; content: string }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolName: string; result: unknown; duration: number }
  | { type: 'tool-error'; toolName: string; error: string }
  | { type: 'text-delta'; content: string }
  | { type: 'finish'; totalDuration: number };

// 工具调用的展示状态
export interface ToolCallDisplay {
  id: string;
  name: string;
  displayName: string;        // 用户友好的名称
  args: Record<string, unknown>;
  status: 'calling' | 'success' | 'error';
  result?: unknown;
  error?: string;
  duration?: number;
}

// 思维链步骤
export interface ThoughtStep {
  id: string;
  content: string;
  timestamp: number;
  status: 'thinking' | 'done';
}
```

```tsx
// components/AgentThoughtChain.tsx
'use client';
import { useState } from 'react';
import type { ThoughtStep, ToolCallDisplay } from '@/types/agent-ui';

// 工具名称的友好映射
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  searchDatabase: '查询数据库',
  sendEmail: '发送邮件',
  generateChart: '生成图表',
  webSearch: '搜索网页',
};

// 单个工具调用的展示组件
function ToolCallCard({ tool }: { tool: ToolCallDisplay }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    calling: '🔄',
    success: '✅',
    error: '❌',
  }[tool.status];

  const statusLabel = {
    calling: '执行中...',
    success: `完成 · ${tool.duration ? (tool.duration / 1000).toFixed(1) + 's' : ''}`,
    error: '失败',
  }[tool.status];

  return (
    <div
      className={`border rounded-lg p-3 my-2 transition-colors ${
        tool.status === 'error'
          ? 'border-red-200 bg-red-50'
          : tool.status === 'calling'
          ? 'border-blue-200 bg-blue-50'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      {/* 摘要行 */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span>{statusIcon}</span>
          <span className="font-medium">
            {tool.displayName || TOOL_DISPLAY_NAMES[tool.name] || tool.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{statusLabel}</span>
          <span className="text-xs">{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {/* 展开的详情 */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 text-sm">
          <div className="mb-2">
            <span className="text-gray-500 font-medium">输入参数：</span>
            <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto">
              {JSON.stringify(tool.args, null, 2)}
            </pre>
          </div>

          {tool.result && (
            <div className="mb-2">
              <span className="text-gray-500 font-medium">返回结果：</span>
              <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">
                {JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}

          {tool.error && (
            <div className="text-red-600">
              <span className="font-medium">错误信息：</span>
              <p className="mt-1">{tool.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 思维链主组件
export function AgentThoughtChain({
  steps,
  toolCalls,
  isRunning,
}: {
  steps: ThoughtStep[];
  toolCalls: ToolCallDisplay[];
  isRunning: boolean;
}) {
  const [showDetails, setShowDetails] = useState(true);

  return (
    <div className="my-4">
      {/* 折叠控制 */}
      <button
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        onClick={() => setShowDetails(!showDetails)}
        aria-label={showDetails ? '隐藏执行过程' : '展示执行过程'}
      >
        <span>{showDetails ? '▾' : '▸'}</span>
        <span>{isRunning ? '执行中...' : `执行完成 · ${steps.length} 个步骤`}</span>
      </button>

      {showDetails && (
        <div className="pl-4 border-l-2 border-gray-200">
          {steps.map((step) => (
            <div key={step.id} className="mb-2">
              <div className="flex items-center gap-2 text-sm">
                <span>{step.status === 'thinking' ? '💭' : '✅'}</span>
                <span className={step.status === 'thinking' ? 'text-gray-600 animate-pulse' : 'text-gray-700'}>
                  {step.content}
                </span>
              </div>

              {/* 这个步骤关联的工具调用 */}
              {toolCalls
                .filter((tc) => tc.id.startsWith(step.id))
                .map((tc) => (
                  <ToolCallCard key={tc.id} tool={tc} />
                ))}
            </div>
          ))}

          {isRunning && (
            <div className="flex items-center gap-2 text-sm text-gray-400 animate-pulse">
              <span>⏳</span>
              <span>正在思考下一步...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 实战2：审批流组件

一个支持单个审批和批量审批的组件：

```tsx
// components/ApprovalFlow.tsx
'use client';
import { useState } from 'react';

interface PendingAction {
  id: string;
  type: 'read' | 'write' | 'dangerous';
  title: string;           // 要做什么
  reason: string;          // 为什么要做
  impact: string;          // 影响是什么
  preview?: React.ReactNode; // 结果预览
  autoApprove: boolean;    // 是否可以自动执行
}

interface ApprovalResult {
  actionId: string;
  decision: 'approve' | 'reject' | 'modify';
  modification?: string;
}

export function ApprovalFlow({
  actions,
  onComplete,
}: {
  actions: PendingAction[];
  onComplete: (results: ApprovalResult[]) => void;
}) {
  const [results, setResults] = useState<Map<string, ApprovalResult>>(new Map());
  const [rememberChoices, setRememberChoices] = useState(false);

  const needsApproval = actions.filter((a) => !a.autoApprove);
  const autoActions = actions.filter((a) => a.autoApprove);
  const allDecided = needsApproval.every((a) => results.has(a.id));

  function handleDecision(actionId: string, decision: ApprovalResult['decision']) {
    setResults((prev) => {
      const next = new Map(prev);
      next.set(actionId, { actionId, decision });
      return next;
    });
  }

  function handleSubmit() {
    const allResults: ApprovalResult[] = [
      // 自动批准的
      ...autoActions.map((a) => ({ actionId: a.id, decision: 'approve' as const })),
      // 用户决定的
      ...Array.from(results.values()),
    ];
    onComplete(allResults);
  }

  return (
    <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
      <h3 className="font-semibold text-lg mb-1">Agent 需要你的确认</h3>
      <p className="text-sm text-gray-600 mb-4">
        以下操作需要你审批后才会执行
      </p>

      {/* 自动执行的操作（只读） */}
      {autoActions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">
            以下 {autoActions.length} 个只读操作将自动执行：
          </p>
          {autoActions.map((action) => (
            <div key={action.id} className="flex items-center gap-2 text-sm text-gray-600 py-1">
              <span className="text-green-500">✓</span>
              <span>{action.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* 需要审批的操作 */}
      <div className="space-y-3">
        {needsApproval.map((action) => {
          const decision = results.get(action.id);
          return (
            <div
              key={action.id}
              className={`border rounded-lg p-3 bg-white transition-colors ${
                decision?.decision === 'approve'
                  ? 'border-green-300'
                  : decision?.decision === 'reject'
                  ? 'border-red-300'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        action.type === 'dangerous'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {action.type === 'dangerous' ? '高风险' : '需确认'}
                    </span>
                    <span className="font-medium">{action.title}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{action.reason}</p>
                  <p className="text-xs text-gray-400 mt-1">影响：{action.impact}</p>
                </div>
              </div>

              {/* 预览 */}
              {action.preview && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                  {action.preview}
                </div>
              )}

              {/* 决策按钮 */}
              <div className="flex gap-2 mt-3">
                <button
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    decision?.decision === 'approve'
                      ? 'bg-green-500 text-white'
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                  onClick={() => handleDecision(action.id, 'approve')}
                >
                  批准
                </button>
                <button
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    decision?.decision === 'reject'
                      ? 'bg-red-500 text-white'
                      : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                  onClick={() => handleDecision(action.id, 'reject')}
                >
                  拒绝
                </button>
                <button
                  className="px-3 py-1 rounded text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                  onClick={() => handleDecision(action.id, 'modify')}
                >
                  修改后执行
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部操作栏 */}
      <div className="mt-4 pt-4 border-t border-amber-200 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={rememberChoices}
            onChange={(e) => setRememberChoices(e.target.checked)}
            className="rounded"
          />
          记住同类操作的选择
        </label>

        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded text-sm font-medium bg-gray-100 hover:bg-gray-200"
            onClick={() => needsApproval.forEach((a) => handleDecision(a.id, 'approve'))}
          >
            全部批准
          </button>
          <button
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              allDecided
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!allDecided}
            onClick={handleSubmit}
          >
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 实战3：Generative UI 与流式渲染集成

使用 Vercel AI SDK 的 `useChat` 配合自定义工具 UI 的完整示例：

```typescript
// app/api/agent-chat/route.ts
import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    system: `你是一个数据分析助手。当用户需要查看数据时，
调用合适的工具来获取和展示数据。`,
    messages,
    tools: {
      queryData: tool({
        description: '查询业务数据',
        parameters: z.object({
          metric: z.string().describe('要查询的指标名称'),
          timeRange: z.enum(['7d', '30d', '90d']).describe('时间范围'),
        }),
        execute: async ({ metric, timeRange }) => {
          // 模拟数据查询
          const data = Array.from({ length: timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90 }, (_, i) => ({
            date: new Date(Date.now() - (i * 86400000)).toISOString().split('T')[0],
            value: Math.floor(Math.random() * 1000) + 500,
          })).reverse();
          return { metric, timeRange, data, total: data.reduce((s, d) => s + d.value, 0) };
        },
      }),
      showConfirmation: tool({
        description: '当需要执行敏感操作时，展示确认对话框',
        parameters: z.object({
          action: z.string().describe('要执行的操作'),
          reason: z.string().describe('为什么要执行'),
          impact: z.string().describe('可能的影响'),
        }),
        // 这里不执行，只返回需要确认的信息
        // 前端会根据这个工具调用渲染审批组件
        execute: async (params) => params,
      }),
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
```

```tsx
// components/AgentChat.tsx
'use client';
import { useChat } from '@ai-sdk/react';

// 根据工具名渲染不同的 UI 组件
function ToolResultRenderer({
  toolName,
  result,
}: {
  toolName: string;
  result: unknown;
}) {
  const data = result as Record<string, unknown>;

  switch (toolName) {
    case 'queryData': {
      const queryResult = data as {
        metric: string;
        timeRange: string;
        data: { date: string; value: number }[];
        total: number;
      };
      return (
        <div className="border rounded-lg p-4 my-2 bg-white">
          <h4 className="font-medium mb-2">
            {queryResult.metric} · 最近{queryResult.timeRange}
          </h4>
          <div className="text-2xl font-bold text-blue-600 mb-2">
            {queryResult.total.toLocaleString()}
          </div>
          {/* 简易柱状图 */}
          <div className="flex items-end gap-1 h-24">
            {queryResult.data.slice(-14).map((d, i) => {
              const maxVal = Math.max(...queryResult.data.map(d => d.value));
              const height = (d.value / maxVal) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-blue-400 rounded-t hover:bg-blue-500 transition-colors"
                  style={{ height: `${height}%` }}
                  title={`${d.date}: ${d.value}`}
                />
              );
            })}
          </div>
        </div>
      );
    }
    case 'showConfirmation': {
      const confirmation = data as { action: string; reason: string; impact: string };
      return (
        <div className="border-l-4 border-amber-400 bg-amber-50 p-3 my-2 rounded">
          <p className="font-medium">{confirmation.action}</p>
          <p className="text-sm text-gray-600 mt-1">原因：{confirmation.reason}</p>
          <p className="text-sm text-gray-500 mt-1">影响：{confirmation.impact}</p>
          <div className="flex gap-2 mt-3">
            <button className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600">
              确认执行
            </button>
            <button className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300">
              取消
            </button>
          </div>
        </div>
      );
    }
    default:
      return (
        <pre className="text-xs bg-gray-100 p-2 rounded my-2 overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}

export function AgentChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/agent-chat',
    maxSteps: 5,
  });

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            {/* 普通文本消息 */}
            {message.content && (
              <div
                className={`p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white ml-auto max-w-[80%]'
                    : 'bg-gray-100 text-gray-800 max-w-[80%]'
                }`}
              >
                {message.content}
              </div>
            )}

            {/* 工具调用结果 */}
            {message.toolInvocations?.map((invocation) => (
              <div key={invocation.toolCallId}>
                {/* 工具调用中 */}
                {invocation.state === 'call' && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 my-2 animate-pulse">
                    <span>🔧</span>
                    <span>正在执行：{invocation.toolName}...</span>
                  </div>
                )}

                {/* 工具调用完成，渲染自定义 UI */}
                {invocation.state === 'result' && (
                  <ToolResultRenderer
                    toolName={invocation.toolName}
                    result={invocation.result}
                  />
                )}
              </div>
            ))}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="输入你的问题..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

## 实操练习

### 目标

为"AI 智能工作助手"项目添加专业级的 Agent UI 组件，让助手从一个简单的聊天框升级为拥有思维链展示、工具可视化和审批流的完整 Agent 体验。

### 步骤

**Step 1：实现思维链可视化组件（40 分钟）**

- 创建 `AgentThoughtChain` 组件，能展示 Agent 的推理步骤
- 每个步骤有状态图标（进行中/完成/失败）
- 支持折叠/展开详情
- 在步骤进行中时有动画效果

**Step 2：实现工具调用卡片组件（30 分钟）**

- 创建 `ToolCallCard` 组件，展示工具名称、状态、耗时
- 点击展开可以看到输入参数和返回结果
- 为不同状态（成功/失败/进行中）设计不同的视觉样式
- 失败状态展示错误信息和 Agent 的应对策略

**Step 3：实现审批流组件（40 分钟）**

- 创建 `ApprovalFlow` 组件
- 区分自动执行（只读）和需要审批（写操作）的操作
- 支持批量审批和逐个审批
- 实现"记住同类操作的选择"功能

**Step 4：集成流式渲染（30 分钟）**

- 使用 `useChat` 或 `useObject` 集成流式 AI 输出
- 实现智能滚动（新内容自动滚动，用户回看时停止）
- 处理 Markdown 实时渲染
- 代码块的语法高亮

**Step 5：移动端适配（20 分钟）**

- 为思维链和审批流组件做移动端适配
- 在小屏幕上默认折叠详情，使用底部抽屉展示
- 添加快捷操作按钮

### 验收标准

- [ ] 思维链组件能实时展示 Agent 的执行步骤，带动画效果
- [ ] 工具调用卡片展示名称、状态、耗时，支持展开详情
- [ ] 审批流支持单个审批和批量审批
- [ ] 流式渲染无明显卡顿，智能滚动工作正常
- [ ] 移动端布局合理，不出现信息溢出
- [ ] 所有交互支持键盘导航

### 挑战加分项

- [ ] 实现 Generative UI：Agent 能根据上下文选择渲染不同组件（图表/表格/表单）
- [ ] 实现"开发者模式"切换：展示原始的工具调用参数和模型思考过程
- [ ] 添加可访问性支持：`aria-live` 处理流式输出、色盲友好的状态标识
- [ ] 实现审批的"渐进式信任"：用户连续批准同类操作 3 次后，提示是否自动批准

---

## 本章小结

这一章我们系统地学习了 Agent UI/UX 的核心设计模式。作为前端开发者，这是你在 AI 时代最重要的差异化能力。

**核心要点**：

1. **Agent UI 不等于聊天框**。根据业务场景选择最合适的 UI 形态——仪表盘、步骤面板、内联编辑……聊天框只是选项之一，且在大多数场景下不是最佳选择。

2. **四大特殊挑战**：时间不确定、内容不确定、过程不透明、信任不确定。每个挑战都需要专门的 UI 策略来应对。

3. **思维链可视化**的核心原则是"摘要优先、详情按需"。用户语言而非技术术语，给用户透明感但不要信息过载。

4. **工具调用展示**采用"概览 + 详情"的双层结构，像 Chrome DevTools 的 Network Tab 一样——一眼看全局，点击看详情。

5. **审批流设计**的关键是**渐进式信任**——新用户多确认、老用户少打断、用户始终可控。频率太高用户烦，频率太低不安全。

6. **Generative UI** 让 AI 不只返回文本，还能选择最合适的 UI 组件来展示结果。核心安全原则是"AI 选择组件，数据由组件自己获取"。

7. **流式渲染**面临 Markdown 实时解析、代码块高亮、布局抖动和渲染性能四个挑战。每个都有成熟的解决方案。

**一句话总结**：Agent UI 的终极目标不是展示 AI 有多厉害，而是让用户觉得"这个工具用起来很顺手、很安心"。技术上最强的 Agent，如果 UI 让用户困惑和焦虑，就是一个失败的产品。

下一章，我们聊一个关系到 Agent 生死的话题——错误处理与容错。一个没有健壮错误处理的 Agent，就像一辆没有安全气囊的赛车，平时跑得很快，出了事就是灾难。
