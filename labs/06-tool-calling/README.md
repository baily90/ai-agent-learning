# Lab 06 · Function Calling / 工具调用

> 配套第 07 章。目标：让 AI 从"只会聊天"升级为"能查数据、能干活"。这是从 Chatbot 到 Agent 的分水岭。

## 跑起来

```bash
cp .env.example .env      # 填 DeepSeek key
npm install
npm run ask "我的订单 20231001001 到哪了？"
npm run ask "订单 20231002002 什么状态？"
npm run ask "你好"           # 观察：不触发工具，正常聊天
```

## 学什么

- `tool()`：定义一个工具（description + 参数 schema + 执行函数）
- **工具调用循环**：AI 决定调工具 → 你的代码执行 → 结果传回 AI → AI 生成回答
- `isStepCount(5)`：限制循环步数，防止死循环

## 练什么（挑战）

**挑战 1：description 的重要性**

把 `getOrder` 的 `description` 改成 `"一个工具"`，重新跑，观察 AI 是否还能正确调用它。（这就是你在 18-observability lab 里做过的实验，这里再验证一次）

**挑战 2：加第二个工具**

给 `orders` 加更多数据，再写一个 `getRefundStatus` 工具（查退款进度），让 AI 能区分"查订单"和"查退款"两个工具。

**挑战 3：对应客服项目**

想想你电商项目里有哪些真实接口（查订单、查物流、查商品），这些就是客服系统要暴露给 AI 的工具。
