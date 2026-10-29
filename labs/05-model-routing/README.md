# Lab 05 · 模型选择与 fallback

> 配套第 06 章。目标：理解「路由」和「fallback」两个核心概念。

## 跑起来

```bash
cp .env.example .env      # 填 DeepSeek key
npm install
npm run ask "计算 1+2+3+...+100 的和"        # 触发路由 → 用 reasoner
npm run ask "给我推荐三本书"                  # 不触发 → 用 chat
```

## 学什么

- **路由**：按任务特征选模型（简单任务用快模型，推理任务用强模型）
- **fallback**：主模型失败（网络/限流/报错）时，自动切备用模型
- 这是市面 AI Gateway（LiteLLM/Portkey）的核心能力，这里手动实现让你看清原理

## 练什么（挑战）

**挑战 1：触发真实 fallback**

把 `fastModel` 改成 `deepseek("deepseek-not-exist")`（不存在的模型），跑一次，看它如何自动切到备用模型。

**挑战 2：更聪明的路由**

现在的路由只是正则匹配关键词。想想能不能用**另一个 LLM** 来做路由判断（让 AI 决定"这个问题该用哪个模型"）——这就是很多 Agent 框架的"router"做法。
