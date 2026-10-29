# Lab 13 · Multi-Agent 协作

> 配套第 15 章。目标：理解"多 agent 分工 + 路由"。

## 跑起来

```bash
cp .env.example .env      # 填 DeepSeek key
npm install
npm run ask "我买的商品坏了，想退款怎么办？"   # → 路由到售后 agent
npm run ask "有什么适合送女朋友的礼物？"        # → 路由到售前 agent
```

## 学什么

- **Multi-Agent 的本质是分工**：每个 agent 有专职（售前/售后），一个路由 agent 分发
- **路由**：用结构化输出（Lab 04 学的）让 LLM 判断问题归属
- 这是市面多 agent 系统最基础的"路由 + 分工"模式

## 练什么（挑战）

**挑战 1：加第三个 agent**

加一个"投诉/工单升级"agent（处理严重投诉、升级人工），让路由变成三选一。

**挑战 2：agent 之间通信**

现在的 agent 是"各答各的"。试试让售后 agent 的输出传给另一个"质检 agent"审查，再返回——这就是多 agent 的"链式协作"。

**挑战 3：对应客服项目**

这就是客服系统的"售前/售后分流"——第一版客服项目可以先用这个简单路由，后续再上更复杂的编排（Lab 14 LangGraph）。
