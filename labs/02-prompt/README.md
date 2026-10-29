# Lab 02 · Prompt 工程

> 配套第 03 章。目标：直观感受 system prompt、few-shot 对回答质量的影响。

## 跑起来

```bash
cp .env.example .env      # 填 DeepSeek key
npm install
npm run ask "我的订单超过 7 天了，还能退货吗？"
```

一次会跑 3 种 prompt 并打印对比，你直接看差异。

## 学什么

- **裸 prompt**：不给任何约束，AI 自由发挥
- **system prompt**：设定角色和行为规范（`system` 参数）
- **few-shot**：给 1~2 个示例，让 AI 模仿格式（最稳定）

## 练什么（挑战）

**挑战 1：CoT（思维链）**

在 system 里加一句 `"先分析问题，再给出答案"`，对比 AI 是不是答得更准（尤其数学/逻辑题）。

```bash
npm run ask "买 3 件 99 元的商品，满 200 减 30，一共多少钱？"
```

先跑不加 CoT 的，再改 system 加 CoT 重跑，看区别。

**挑战 2：你自己的业务 prompt**

把问题换成你电商里真实的客服问题（比如"优惠券过期了能用吗"），写一个你觉得最好的 system prompt，反复调到满意。
