# Lab 20 · 成本优化

> 配套第 23 章。目标：理解 token 就是钱，学会控制成本。

## 跑起来

```bash
cp .env.example .env      # 填 DeepSeek key
npm install
npm run ask "怎么退款？"
```

会对比"冗长 system prompt"和"精简 system prompt"的 token 消耗差异。

## 学什么

- **token = 成本**：输入 token 直接决定每次调用花多少钱
- **prompt 精简**：system prompt 越短，每次调用越省（多轮对话里重复计费）
- `usage` 里的 `inputTokens` / `outputTokens`：看成本的窗口

## 练什么（挑战）

**挑战 1：算真实成本**

查 DeepSeek 的定价（每百万 token 多少钱），把 token 换算成钱，算一次调用花了多少分。

**挑战 2：prompt 缓存**

DeepSeek 支持 prompt 缓存（相同前缀的输入会缓存，命中后更便宜）。连续两次调同一个 system prompt，观察 usage 里的命中情况：`inputTokenDetails.cacheReadTokens`（命中）/ `noCacheTokens`（未命中），或原始字段 `raw.prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`。

⚠️ 限制：缓存按 64 token 一个存储单元落盘，**短 prompt 不触发**——实测几十到 200 token 连调两次命中仍为 0，拉长到 1500+ token 才命中。所以 system prompt 要写得足够长（或用 `.repeat()` 重复一段话），且两次调用间留几秒让缓存落盘。

来源：[DeepSeek 上下文缓存官方文档](https://api-docs.deepseek.com/zh-cn/guides/kv_cache/)

**挑战 3：对应客服项目**

客服系统每天几千次调用，token 成本会放大。想想：哪些优化能省钱（精简 prompt、缓存、限制历史长度——就是你 Lab 07 学的滑动窗口）。
