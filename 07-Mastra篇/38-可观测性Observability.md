# 第38章：可观测性 Observability — 给 agent 装上黑匣子

## 引言

第 22 章你接 Langfuse 做追踪，要自己埋点、自己传 span、自己关联 trace。第 29 章你又专门学了 Langfuse 的 Tracing/Prompt 管理。那段经历让你明白：**没有可观测性的 agent 上线，等于开飞机不装仪表盘**。

Mastra 的可观测性是**自动的**——不需要你埋点。这一章讲透。

---

## 38.1 心智转变：从「手动埋点」到「自动 trace」

AI SDK 时代你要手动：调 API 前打日志、记录 token、关联请求。Mastra 里，**每个 agent 运行、workflow 步骤、工具调用、模型调用都自动产生 span，聚合成 trace**。你零埋点，Studio 里直接看。

---

## 38.2 span 与 trace

### 一次请求的完整轨迹

```
请求进来
└── trace
    ├── span: agent 调用
    │   ├── span: 模型调用（token 用量、耗时）
    │   └── span: 工具调用 getOrder
    ├── span: workflow step: extract-intent
    └── span: workflow step: refund-approval（status: suspended）
```

### 每个 span 记录什么

- **outcome**：执行结果（success / error / suspend / interrupted / blocked 等）
- **stopReason**：为什么停（正常结束 / 超长 / 要调工具）
- **耗时、token 用量、成本估算**（自动提取，不需要额外代码）

> 这些概念和第 22/29 章 Langfuse 的 span/trace 完全对齐——你学的「可观测性思维模型」全通用，只是 Mastra 换了个实现。

---

## 38.3 配置

```typescript
import { Mastra } from '@mastra/core';
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability';

export const mastra = new Mastra({
  storage: ...,   // 存储 trace 的 storage
  observability: new Observability({
    exporters: [
      new MastraStorageExporter(),
      // 可选：SensitiveDataFilter 脱敏敏感字段
      new SensitiveDataFilter({ keys: ['apiKey', 'password'] }),
    ],
  }),
});
```

核心配置：

| 配置 | 作用 |
|---|---|
| exporters | 把 trace 导出到哪里（存储 / Mastra 平台 / 第三方） |
| SensitiveDataFilter | 脱敏敏感字段（key、密码等） |
| sampling | 抽样（控制成本） |

---

## 38.4 看 trace

### Studio

`mastra dev` 起的 Studio 里，点开一次运行就能看到完整 trace——**不需要额外埋点，也不需要接 Langfuse**。

### CLI

```bash
npx mastra api trace list '{"page":0,"perPage":20}'
```

---

## 38.5 日志、反馈、指标

可观测性不止 trace，还有三个配套能力：

| 信号 | 作用 |
|---|---|
| **Logging** | 结构化日志，自动关联 trace/span ID（logger.info/warn/error） |
| **Feedback** | 存用户评分/评论/纠错，关联到 trace（人工反馈闭环） |
| **Metrics** | 聚合的用量/性能/成本指标（从 span 自动提取，无需埋点） |

三者的关联字段（trace ID / span ID / entity）相通，可以从「一个指标尖峰」跳到「对应的 trace、日志、反馈」。

---

## 38.6 导出第三方

公司已有 Langfuse / OpenTelemetry 体系？Mastra 支持把 trace 导出去对接，不用重造。

> 呼应第 29 章 Langfuse：概念全通用（span/trace/token/延迟/采样），Mastra 内置实现 + 可导出。

---

## 概念辨析

**Q：Observability（trace）和 Evals（scorer）区别？**

Observability 是被动记录「运行时发生了什么」（trace/日志/指标）；Evals 是主动打分「质量如何」（0~1 分数）。一个看过程，一个测质量。

---

## 灵魂拷问

**Q1：为什么 Mastra 能「零埋点」自动 trace，而 AI SDK 要手动？**

因为 AI SDK 只给你「调用函数」，调用之间发生了什么它不管；Mastra 是框架，**它自己就在调度 agent/tool/workflow**，所以能在调度点自动埋 span。这是「框架」相比「SDK」的结构性优势——控制流在框架手里，观测点就能自动插入。

**Q2：为什么要 SensitiveDataFilter 脱敏？**

trace 会记录输入输出，可能包含用户 PII、API key、密码。脱敏器在导出前把敏感字段打码，避免「可观测性」变成「数据泄露源」。

**Q3：sampling 在可观测性里也出现（Evals 里也有），为什么都要抽样？**

因为「记录」和「打分」都要额外资源（存储、计算）。全量记录 = 海量数据 + 成本。抽样是用「部分样本」代表「整体」的通用工程手段。

---

## 最佳实践

**✅ DO：**

- 生产环境配 SensitiveDataFilter 脱敏。
- 开发期常看 Studio 的 trace，定位慢 step 和贵 step。
- 关注 token 用量指标（既是质量线索，也是成本账单）。
- 接 Feedback，让人工反馈闭环。

**❌ DON'T：**

- 别忽视 trace 里的 token 用量——成本失控往往从这里发现。
- 别把 PII 明文存进 trace 不脱敏。

---

## 代码实战：配好可观测性的客服

```typescript
import { Mastra } from '@mastra/core';
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability';
import { LibSQLStore } from '@mastra/libsql';
import { supportAgent } from './agents/support';

export const mastra = new Mastra({
  storage: new LibSQLStore({ id: 'storage', url: 'file:./mastra.db' }),
  observability: new Observability({
    exporters: [
      new MastraStorageExporter(),
      new SensitiveDataFilter({ keys: ['apiKey', 'password', 'phone'] }),
    ],
  }),
  agents: { support: supportAgent },
});
```

`mastra dev` 后跑一次对话，在 Studio 里看完整 trace + token 用量 + 耗时。

---

## 实操练习（工单客服 Agent · 第 8 步）

**练习 1**：配 Observability + StorageExporter，跑一次对话。

**验收标准**：Studio 里能看到完整 trace（agent → 工具 → 模型）。

**练习 2**：加 SensitiveDataFilter，脱敏手机号字段。

**验收标准**：trace 里手机号被替换成 `***`。

**练习 3（进阶）**：接 Feedback，给一次运行打分。

**验收标准**：能查到关联到该 trace 的反馈。

---

## 本章小结

- 可观测性是自动的：agent/workflow/tool/model 调用自动产生 span → trace。
- span 记录 outcome、stopReason、耗时、token、成本。
- 四信号：trace / logging / feedback / metrics，字段关联互通。
- 配 exporters + SensitiveDataFilter；Studio 可视化；可导出 Langfuse/OTel。
- 概念和第 22/29 章 Langfuse 完全对齐。

下一章讲 **多 Agent 与 MCP**——subagents、delegation、多 agent 模式、MCP 协议、A2A/ACP，呼应第 14/15 章。
