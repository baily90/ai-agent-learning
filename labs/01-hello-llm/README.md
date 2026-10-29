# Lab 01 · 第一次调用 LLM

> 配套第 02 章「开发环境搭建与第一次 API 调用」。目标：跑通 AI SDK 7 第一次调用 DeepSeek，看懂 `generateText` 和 token。

## 三步跑起来

```bash
cp .env.example .env      # ① 填你的 DeepSeek key
npm install
npm run ask               # ③ 用默认问题跑一次
```

跑通后你会看到：AI 的回答 + 本次调用的 `usage`（input/output token 数）。

## 学什么

- `generateText`：AI SDK 最核心的"一次文本生成"函数
- `deepseek("deepseek-chat")`：provider + 模型名
- `usage`：这次调用花了多少 input/output token（直接决定成本）
- `temperature`：控制输出随机性

## 练什么（挑战）

**挑战 1：感受 temperature**

```bash
npm run ask "写一首关于秋天的诗" 0      # 温度 0，几乎每次一样
npm run ask "写一首关于秋天的诗" 1.5    # 温度 1.5，每次都不一样
```

各跑 3 次，对比输出稳定性。你会直观理解"temperature 越高越随机"。

**挑战 2：算成本**

看 `usage` 里的 token 数，结合 DeepSeek 的计费（查官方定价），算一次调用花了多少钱。

**挑战 3：换个模型**

把 `deepseek("deepseek-chat")` 换成 `deepseek("deepseek-reasoner")`（DeepSeek 的推理模型 R1），跑同一个问题，感受区别。
