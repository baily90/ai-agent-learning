# Lab 19 · Langfuse 评估（LLM-as-judge + Dataset + Experiment）

> 配套第 21 章。目标：把 Lab 17 里"自己写的 LLM-as-judge"换成 Langfuse 的评估三件套，让评估从"一次性脚本"升级成"可持续运转的评测系统"。

## 这个 Lab 解决什么

Lab 17 用 `judge()` 自己当裁判、`writeFileSync` 落盘结果——逻辑没问题，但分数是孤岛数据、对比靠肉眼、线上没法持续跑。

这个 lab 用 Langfuse 补齐三件事：

- **Dataset（题库）**：把评估用例存成 Langfuse 数据集，可版本化、可共享
- **Experiment（离线回归）**：改 prompt / 换模型后跑一遍，自动对比分数
- **Score（在线打分）**：给真实 trace 挂分数，低分 trace 点进去能看到"为什么低分"

**评估逻辑（rubric、judge prompt）还是你自己的**——Langfuse 只帮你存、比、跑、看。

## 跑起来

```bash
# 先起 Langfuse（复用 18-observability 的 docker compose）
cd ../18-observability && docker compose up -d && cd ../19-langfuse-eval

cp .env.example .env      # 填 DeepSeek key（Langfuse key 用本地默认值）
npm install
npm run eval              # 离线回归：建数据集 + 跑实验 + LLM 裁判打分
```

跑完打开 <http://localhost:3000> → **Datasets & Experiments**，能看到「客服评估集」和「deepseek-chat-baseline」这次运行，每条 item 的分数、理由一目了然。

在线打分（给单条 trace 挂分）：

```bash
npm run online "我买的商品怎么退款？"
```

再去 **Tracing** 页，能看到 `customer-service` 这条 trace 上挂着 `length_ok`、`correctness` 两个分数。

## 学什么

- **评估三件套**：Score（分数挂 trace）、Dataset（题库）、Experiment（考试对比）
- **LLM-as-judge 标准化**：Lab 17 的 `judge()` 换成 `evaluator` 函数签名（`({ input, output, expectedOutput }) => 分数`），逻辑不变
- 为什么重要：改了 prompt，怎么知道"变好了还是变坏了"？靠离线回归；线上质量有没有崩？靠在线打分——两件事 Langfuse 一条龙

## 练什么（挑战）

**挑战 1：改 prompt 做 A/B 回归**

改 `src/index.ts` 里的 `SYSTEM`（比如换成更详细的客服话术），把 `runExperiment` 的 `name` 换成 `deepseek-chat-v2`，再跑一次 `npm run eval`。在 UI 里对比两次运行：哪些场景变好、哪些变差。

**挑战 2：扩充数据集**

把 `evalSet` 扩到 15+ 条（参考 Lab 17 的场景分组：退款/物流/优惠券/售前/售后/账号）。想想：怎么保证评测集"有代表性"、别过拟合。

**挑战 3：在线 LLM-as-judge 评估器**

去 Langfuse UI → Evaluators → LLM-as-a-Judge，配置一个评估器（裁判模型 + 评分 prompt，用 `{{input}}`/`{{output}}` 占位），设 10% 采样。之后线上 trace 会自动被打分——零代码实现持续评测。

**挑战 4：对应客服项目**

客服系统上线前，用 `npm run eval` 做回归（防止改坏已有能力）；上线后，用在线打分 + 评估器做持续监控。这和第 18 章 observability 里"改 description 实验"串起来：改了工具描述，评估集能自动量化影响。

## 关掉 Langfuse

```bash
cd ../18-observability && docker compose down   # 数据保留在 volume 里
```

## 想用 Langfuse Cloud 代替本地？

去 <https://cloud.langfuse.com> 注册（免费），在项目设置里拿 Public/Secret Key，填到 `.env` 的 `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`，并把 `LANGFUSE_BASEURL` 改成 `https://cloud.langfuse.com`。代码完全不用改。

## 关键文件速览

`src/index.ts` 就四块：

- `runAgent`：被评估的客服 agent（和 Lab 17 一样是 DeepSeek）
- `correctnessEvaluator` / `lengthEvaluator`：两个评估器，一个 LLM 裁判分、一个零成本规则分
- `seedDataset` + `runOfflineEval`：建题库 + 跑离线实验
- `runOnlineEval`：`startActiveObservation` 开 trace + `langfuse.score.activeTrace` 挂分

核心就一个心智模型：

```
Dataset 是试卷，Experiment 是某次考试，Score 是每道题的得分。
```
