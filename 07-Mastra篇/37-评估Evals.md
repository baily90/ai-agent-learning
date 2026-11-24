# 第37章：评估 Evals — 把「跑通了」升级成「质量打几分」

## 引言

第 21 章你手写过评测脚本：准备测试集、逐条跑、打分、算通过率。那段经历让你明白：**AI 应用没有「跑通了」这回事，只有「能持续度量」才算靠谱**。

Mastra 把评测做成了一套完整体系：Scorer（打分器）+ Dataset（测试集）+ Experiment（评测实验）。这一章讲透。

---

## 37.1 心智转变：从「通过/失败」到「0~1 打分」

传统测试是布尔值（通过/失败）；AI 输出是**不确定的**，同一条输入每次可能不一样。所以 Mastra 用 **Scorer** 量化质量，返回 0~1 的分数（不是布尔值）。

### 前端类比

- 单元测试（断言通过/失败）≈ 传统软件测试
- Mastra Scorer ≈ **代码覆盖率 / Lighthouse 评分**——不是「过没过」，而是「质量打几分」

---

## 37.2 Scorer 是什么

Scorer 是「给 agent 输出打分的自动化测试」。三种实现方式：

| 类型 | 原理 | 例子 |
|---|---|---|
| **model-graded** | 用一个模型给输出打分 | 「这个回答切题吗？打几分」 |
| **rule-based** | 用规则判断 | 「是否包含关键词」 |
| **statistical** | 用统计方法 | 文本相似度 |

> 这呼应第 21 章：你手写的评测脚本本质就是在做 Scorer 的活，Mastra 把它抽象成了标准组件。

---

## 37.3 内置 Scorer 一览

Mastra 提供一整套内置 scorer，分三大类：

### 准确度与可靠性（答案对不对）

| scorer | 测什么 | 方向 |
|---|---|---|
| answer-relevancy | 回答是否切题 | 越高越好 |
| answer-similarity | 和标准答案的语义相似度 | 越高越好 |
| faithfulness | 回答是否忠于提供的上下文 | 越高越好 |
| hallucination | 检测幻觉/无依据断言 | **越低越好** |
| completeness | 是否包含所有必要信息 | 越高越好 |
| tool-call-accuracy | 是否选了正确的工具 | 越高越好 |
| prompt-alignment | 是否对齐用户意图/格式 | 越高越好 |

### 上下文质量（RAG 检索质量）

| scorer | 测什么 |
|---|---|
| context-precision | 相关上下文是否排在前面（RAG 排序评估） |
| context-relevance | 上下文是否有用、是否缺上下文 |

### 输出质量（格式/风格/安全）

| scorer | 测什么 | 方向 |
|---|---|---|
| tone-consistency | 语气/风格是否一致 | 越高越好 |
| toxicity | 是否有害内容 | **越低越好** |
| bias | 是否有偏见 | **越低越好** |
| keyword-coverage | 关键词覆盖 | 越高越好 |

> 注意方向：大部分 scorer 越高越好，但 hallucination / toxicity / bias 是**越低越好**。

---

## 37.4 挂到 agent / workflow step

### 给 agent 挂 scorer

```typescript
import { Agent } from '@mastra/core/agent';
import { createAnswerRelevancyScorer, createToxicityScorer } from '@mastra/evals/scorers/prebuilt';

const supportAgent = new Agent({
  id: 'support',
  name: 'support',
  model: 'deepseek/deepseek-chat',
  instructions: '你是客服。',
  scorers: {
    relevancy: {
      scorer: createAnswerRelevancyScorer({ model: 'deepseek/deepseek-chat' }),
      sampling: { type: 'ratio', rate: 0.5 },   // 抽样 50% 打分
    },
    safety: {
      scorer: createToxicityScorer({ model: 'deepseek/deepseek-chat' }),
      sampling: { type: 'ratio', rate: 1 },     // 全量打分
    },
  },
});
```

### 给 workflow step 挂 scorer

```typescript
const contentStep = createStep({
  id: 'content-step',
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({ content: z.string() }),
  scorers: {
    quality: {
      scorer: createAnswerRelevancyScorer({ model: 'deepseek/deepseek-chat' }),
      sampling: { type: 'ratio', rate: 1 },
    },
  },
  execute: async ({ inputData }) => ({ content: '...' }),
});
```

给单个 step 挂 scorer，能定位「是哪个 step 出了问题」，而不是只看最终答案。

### sampling 抽样

scorer 本身也要调模型，**打分有成本**。所以用 sampling 抽样控制成本：

- `{ type: 'ratio', rate: 0.5 }` = 按比例抽 50%

---

## 37.5 自定义 Scorer

内置不够用时，写自己的 scorer（用自己的 prompt 和打分函数）。核心是「输入一条输出，返回一个 0~1 分数」。

（具体 API 见官方 [Custom Scorers](https://mastra.ai/docs/evals/custom-scorers)，核心心智和第 21 章手写评测脚本一致。）

---

## 37.6 Dataset：版本化的测试集

单个 scorer 只能测一条输出。要系统改进 agent，需要**测试集**：

```typescript
const datasets = mastra.datasets;

// 创建
const dataset = await datasets.create({ name: 'my-dataset' });

// 获取 / 列表
const existing = await datasets.get({ id: 'dataset-id' });
const { datasets: all } = await datasets.list();
```

Dataset 是「测试用例的集合」，每次修改生成新版本（可复现历史实验）。每条用例包含「输入 + 标准答案（ground truth）」。

---

## 37.7 Experiment：评测循环

Experiment 把 dataset 跑一遍（目标可以是 agent / workflow / scorer），逐条打分，保留结果供对比：

```typescript
const dataset = await mastra.datasets.get({ id: 'translation-dataset-id' });

const summary = await dataset.startExperiment({
  name: 'gpt-baseline',
  targetType: 'agent',
  targetId: 'translation-agent',
  scorers: ['accuracy', 'fluency'],
});

console.log(summary.status);           // 'completed' | 'failed'
console.log(summary.succeededCount);   // 成功条数
console.log(summary.failedCount);      // 失败条数
```

**评测循环**就是：改 prompt / 换模型 → 重跑 experiment → 对比分数 → 再改。和第 21 章手写的那套流程一样，只是标准化了。

---

## 37.8 Live Evals 与 CI/CD

- **Live evals**：scorer 在运行时实时打分（sampling 控制成本），持续监控质量。
- **CI/CD**：scorer + dataset + experiment 可以进流水线，改代码自动跑评测。

---

## 概念辨析

**Q：Evals（scorer）和 Observability（trace，第 38 章）有什么区别？**

Evals 回答「质量打几分」（主动打分）；Observability 回答「运行时发生了什么」（被动记录）。两者互补：trace 告诉你「哪一步慢了/贵了」，scorer 告诉你「这一步答得好不好」。

---

## 灵魂拷问

**Q1：为什么 AI 评测用 0~1 分数而不是布尔值？**

因为 AI 输出是概率性的，同一个 prompt 两次回答可能都不错、只是措辞不同。布尔值会把「都算对」粗暴二值化。分数能表达「这次 0.9、那次 0.7」的**质量梯度**，让你能追踪「改了什么之后质量升还是降」。

**Q2：为什么要有 sampling 抽样？全量打分不行吗？**

因为 scorer 也要调模型，全量打分 = 每个输出额外跑一次模型（额外 token + 延迟）。抽样是「用 50% 成本覆盖 95% 质量信号」的工程权衡（呼应第 23 章成本控制）。

**Q3：为什么 scorer 要挂到单个 workflow step，而不只挂最终输出？**

因为「最终答案差」往往源于「中间某一步差」。只测最终输出，你只知道「有问题」却不知道「哪里有问题」。挂到 step 级，能定位到具体步骤。

---

## 最佳实践

**✅ DO：**

- 核心 agent 至少挂一个「相关性」+ 一个「安全性」scorer。
- 用 sampling 控制成本，别默认全量。
- 建立 dataset + experiment，每次改 prompt 都重跑对比。
- 注意 scorer 方向（hallucination/toxicity 越低越好）。

**❌ DON'T：**

- 别只测最终输出——给关键 step 也挂 scorer。
- 别把 scorer 分数当唯一真理——model-graded 也有偏差，要结合人工抽检。

---

## 代码实战：带评测的客服 agent

```typescript
import { Agent } from '@mastra/core/agent';
import { createAnswerRelevancyScorer, createToxicityScorer, createHallucinationScorer } from '@mastra/evals/scorers/prebuilt';

const supportAgent = new Agent({
  id: 'support',
  name: 'support',
  model: 'deepseek/deepseek-chat',
  instructions: '你是电商售后客服，如实回答。',
  tools: { getOrder },
  scorers: {
    relevancy: {
      scorer: createAnswerRelevancyScorer({ model: 'deepseek/deepseek-chat' }),
      sampling: { type: 'ratio', rate: 0.5 },
    },
    hallucination: {
      scorer: createHallucinationScorer({ model: 'deepseek/deepseek-chat' }),
      sampling: { type: 'ratio', rate: 1 },
    },
    safety: {
      scorer: createToxicityScorer({ model: 'deepseek/deepseek-chat' }),
      sampling: { type: 'ratio', rate: 1 },
    },
  },
});
```

---

## 实操练习（工单客服 Agent · 第 7 步）

**练习 1**：给客服 agent 挂 relevancy + toxicity + hallucination 三个 scorer。

**验收标准**：Studio 里能看到每次运行的三项分数。

**练习 2**：建一个 5 条用例的 dataset，跑一次 experiment。

**验收标准**：能看到每条分数和汇总（succeeded/failed）。

**练习 3（进阶）**：改 instructions，重跑 experiment，对比分数变化。

**验收标准**：能说出「这次改动让相关性涨/跌了 X」。

---

## 本章小结

- Scorer 用 0~1 分数量化质量（model-graded / rule-based / statistical）。
- 内置 scorer 三大类：准确度（relevancy/faithfulness/hallucination）、上下文（context-precision）、输出质量（toxicity/bias/tone）。
- 挂到 agent 或单个 workflow step，用 sampling 控制成本。
- Dataset 是版本化测试集，Experiment 是评测循环，二者配合持续改进。
- Live evals + CI/CD 让评测进生产流水线。

下一章讲 **可观测性 Observability**——trace/span 的完整能力，呼应第 22/29 章 Langfuse。
