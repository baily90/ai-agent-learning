# Lab 14 · LangGraph 编排

> 配套第 16 章。目标：用 LangGraph 把"确定性步骤 + LLM 步骤"组成一张有向图。

## 跑起来

```bash
cp .env.example .env      # 填 DeepSeek key
npm install
npm run ask "我买的商品坏了，我要退款"
npm run ask "有什么推荐的手机壳？"
```

## 学什么

- **LangGraph = 把 Agent/Workflow 画成一张图**：节点 = 步骤，边 = 流转关系
- **混合工作流**：`classify` 是确定性代码（可预测），`answer` 是 LLM（灵活）——两者放进同一张图
- **State（状态）**：节点之间传递的共享数据
- 核心 API：`Annotation.Root`（定义状态）、`StateGraph`（建图）、`addNode` / `addEdge`（加节点/边）

## 练什么（挑战）

**挑战 1：加条件边**

现在 classify → answer 是死路一条。试试 `addConditionalEdges`：投诉走"售后回答"，普通咨询走"售前回答"，让图根据分类走不同分支。

**挑战 2：checkpoint（断点续跑）**

LangGraph 内置 `MemorySaver` 可以做持久化。研究一下怎么给图加 checkpoint，让它在节点间可以"暂停恢复"。

**挑战 3：human-in-the-loop**

研究 `interrupt()`——在某个节点暂停，等人工审批后再继续。这就是客服里"退款申请需要人工审核"的实现方式。

> 说明：LangGraph JS 版成熟度不如 Python，作为前端"了解 + 跑通"即可，不必深钻。
