# Lab 20 · 提示词管理

> 补充章节。目标：把 prompt 从代码里抽出来，交给 Langfuse 版本化管理。

## 跑起来

```bash
# 先起 Langfuse（复用 18-observability 的 docker compose）
cd ../18-observability && docker compose up -d && cd ../20-prompt-management

cp .env.example .env      # 填 DeepSeek key（Langfuse key 用默认）
npm install
npm run ask "我买的商品怎么退款？"
```

## 学什么

- **Prompt 管理**：prompt 不再硬编码在代码里，而是存 Langfuse，版本化、可回滚
- **`{{变量}}` 占位**：prompt 写成模板，运行时 `compile({...})` 填变量
- 为什么重要：改 prompt 不用改代码、不用重新部署，还能做 A/B 测试

## 练什么（挑战）

**挑战 1：A/B 测试**

去 Langfuse UI 里把 prompt 改成一个新版本（比如更详细的客服话术），代码里指定 `prompt.get("customer-service", { label: "production" })` 获取，对比效果。

**挑战 2：多环境 label**

想想：开发/测试/生产三个环境的 prompt 怎么用 label 区分（`dev` / `staging` / `production`），避免改错环境。

**挑战 3：对应客服项目**

客服系统的 system prompt 会频繁调优。用 Langfuse 管理后，运营人员改 prompt 不用动代码——这是"提示词管理"最实际的工程价值。
