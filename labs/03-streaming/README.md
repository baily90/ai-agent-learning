# Lab 03 · 流式输出

> 配套第 04 章。目标：体验 `streamText` 的打字机效果，理解 TTFB。

## 跑起来

```bash
cp .env.example .env      # 填 DeepSeek key
npm install
npm run ask "用 100 个字讲一个小故事"
```

你会看到文字**一个字一个字往外蹦**（而不是等几秒一次性出来），最后打印 TTFB 和总耗时。

## 学什么

- `streamText`：流式生成（vs Lab 01 的 `generateText` 一次性返回）
- `textStream`：异步迭代器，逐块读文本
- **TTFB（Time to First Byte）**：用户看到第一个字要等多久，前端体验的关键指标

## 练什么（挑战）

**挑战 1：感受 TTFB**

多跑几次同一个问题，观察 TTFB 波动。再换成 `deepseek-reasoner`（推理模型），看 TTFB 是不是明显变长（因为它在"思考"）。

**挑战 2：流式 vs 非流式**

把 `streamText` 改成 `generateText`（Lab 01 那个），对比"等待体验"的差别——这就是为什么所有聊天产品都用流式。
