# 第29章：Langfuse — Agent 的可观测与评估

## 引言

第 22 章讲了可观测性的**概念**——为什么 agent 出问题很难找、Tracing/日志/回放是什么。这一章讲**落地**：用 Langfuse 这个工具，把那些概念真正装进你的项目。

回忆第 22 章的痛点：agent 的 bug 是"程序没崩但结果不对"，而且没有报错、没有堆栈。你唯一的希望是**记录每一次执行的完整链路，出问题时能回看它到底怎么想的**。Langfuse 就是干这个的开源工具。

> **🏭 实际项目怎么做**：Langfuse 是当前**开源可观测工具里增长最快**的一个，因为三点：**开源可自托管**（数据不出自己的服务器）、**免费额度够用**、**TS/Python SDK 都成熟**。它和 LangSmith（LangChain 官方、商业收费）是两大主流，但独立于任何框架（你用它接 AI SDK、LangChain、甚至裸 fetch 都行）。生产里，前端团队首选 Langfuse——既能看 trace，又能做评估，还能管理 prompt 版本。

---

## 29.1 Langfuse 是什么，解决什么

### 一句话直觉

Langfuse 是 agent 的"黑匣子 + 质检系统"——它记录每次执行的完整链路（黑匣子），还能对结果打分评估（质检）。

### 详细原理

Langfuse 的核心数据模型分三层：

```
Trace（一次完整的用户请求）
 ├── Generation（一次 LLM 调用）
 │     ├── input（prompt）
 │     ├── output（模型回答）
 │     ├── model / tokens / cost / latency
 │     └── usage
 ├── Span（一个中间步骤，如工具调用、RAG 检索）
 │     ├── input / output
 │     └── 元数据
 └── Score（对结果的质量评分）
       ├── 人工打分
       └── 自动评估（LLM-as-judge）
```

你打开一次 Trace，能看到：用户问了什么 → prompt 长啥样 → 模型调用了哪些工具 → 每个工具返回了什么 → 花了多少 token/钱 → 最终回答是什么 → 质量评分多少。**一条链路，全貌尽收。**

---

## 29.2 快速接入：两种方式

### 方式一：云端（最快，适合学习）

去 langfuse.com 注册，拿三个 key（`LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY`、`LANGFUSE_BASEURL`），配到 `.env` 即可。

### 方式二：自托管（生产推荐，数据不出门）

用 Docker 起一套 Langfuse：

```yaml
# docker-compose.yml
services:
  langfuse-server:
    image: langfuse/langfuse:2
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://agent:agent123@db:5432/langfuse
      NEXTAUTH_SECRET: mysecret
      SALT: mysalt
      NEXT_PUBLIC_SIGN_UP_DISABLED: "false"
    depends_on:
      - db
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: agent
      POSTGRES_PASSWORD: agent123
      POSTGRES_DB: langfuse
```

> **坑点提醒**：自托管 Langfuse 依赖 Postgres，别和你的业务库混用，单独起一个。完整配置项较多，第一次部署建议先看官方 docker-compose 示例。

---

## 29.3 接入 Vercel AI SDK：埋点

### 一句话直觉

Langfuse 提供了 AI SDK 的官方集成——你几乎不用改业务代码，加一个 `onFinish`/`experimental_onToolCall` 回调就把数据上报了。

### 详细原理

用 `@langfuse/tracing` 的 `Langfuse` 客户端 + AI SDK 的 `streamText` 回调：

```typescript
// lib/langfuse.ts
import { Langfuse } from '@langfuse/tracing';

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_BASEURL!,
});
```

```typescript
// 埋点：在 streamText 里上报
import { streamText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { langfuse } from './lib/langfuse';

const trace = langfuse.trace({
  name: 'chat',
  input: { question },
});

const result = streamText({
  model: deepseek('deepseek-chat'),
  prompt: question,
  onFinish({ text, usage, finishReason }) {
    trace.generation({
      name: 'deepseek-chat',
      model: 'deepseek-chat',
      input: { question },
      output: { text },
      usage: {
        input: usage.promptTokens,
        output: usage.completionTokens,
      },
    });
    trace.update({ output: { text } });
  },
});
```

上报后，打开 Langfuse 面板（`localhost:3000`），就能看到这次 Trace 的完整记录：耗时、token、成本、输入输出。

> **说明**：`@langfuse/tracing` 是较新的统一 SDK（也叫 Langfuse SDK v4）。老版本用 `langfuse` 包 + `CallbackHandler`，接入方式不同。**以你装到的版本官方文档为准**，但核心思路一致：**开 trace → 在关键点记录 generation/span → 结束上报**。

---

## 29.4 用 Langfuse 做评估（LLM-as-judge）

### 一句话直觉

光记录还不够，你得知道"回答好不好"。Langfuse 支持**用另一个模型给回答打分**（LLM-as-judge），这就把第 21 章"评估与测试"落地了。

### 详细原理

评估流程三步：

1. **准备测试数据集**：一组 `(输入, 期望答案)` 对
2. **跑 agent**：对每个输入生成回答
3. **LLM 打分**：用 judge 模型对回答打分（如"回答是否准确、是否相关"）

```typescript
// 用 LLM 给回答打分
import { generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';

async function judge(question: string, answer: string, expected: string) {
  const { text } = await generateText({
    model: deepseek('deepseek-chat'),
    system: `你是评估员。根据"参考答案"给"实际回答"打分（0-100），只输出数字。`,
    prompt: `问题：${question}\n参考答案：${expected}\n实际回答：${answer}`,
  });
  const score = parseInt(text.trim());
  return score;
}

// 把这个分数作为 score 上报到 Langfuse
trace.score({ name: 'accuracy', value: score });
```

这样，你的每个回答在 Langfuse 里都有质量分数，能看到"哪个 prompt 版本 / 哪类问题得分低"，针对性优化。

> **完整可运行代码**在 `labs/19-langfuse-eval`，配套第 21 章评估与测试。

---

## 29.5 Prompt 管理：把 prompt 当代码管

### 一句话直觉

Prompt 不是写死在代码里的字符串，而是**需要版本管理、A/B 测试、线上回滚**的东西。Langfuse 内置了这个能力。

### 详细原理

Langfuse 的 Prompt Management 让你：

- 在后台**可视化编辑** prompt，而不是改代码
- 保存**多个版本**，随时回滚
- 对不同版本做 **A/B 测试**（一部分流量用 v1，一部分用 v2，对比评分）

这解决了 agent 项目的一个核心痛点：**改 prompt 要重新发版**。有了 prompt 管理，改 prompt 不碰代码，线上即时生效。

### 前端类比

Prompt 版本管理就像前端配置中心（Feature Flag）——功能开关不改代码就能切换。你可以先给 10% 用户上新 prompt，数据好了再全量。

---

## 概念辨析

### Langfuse vs LangSmith vs 自建

| | Langfuse | LangSmith | 自建（OpenTelemetry） |
|---|---|---|---|
| 开源 | ✅ 开源可自托管 | ❌ 商业 | ✅（自己搭） |
| 框架绑定 | 无（任何框架） | 绑定 LangChain 生态 | 无 |
| 上手 | 快 | 中 | 慢（要自己搭全套） |
| 评估/Prompt 管理 | ✅ 内置 | ✅ 内置 | ❌ 要自己造 |
| 适合 | **前端/独立团队首选** | LangChain 深度用户 | 数据合规极端要求 |

---

## 灵魂拷问

> **Q1：Langfuse 会拖慢我的 agent 响应吗？**

> **A：** 基本不会。Langfuse 的上报是**异步**的——数据先进内存/本地缓冲，批量异步发送，不阻塞主流程。就像前端的埋点 SDK（Sentry、GA），采集数据不影响页面渲染。额外延迟通常在毫秒级，可忽略。**但要避免在 `onChunk`（每个字触发）里上报**，正确做法是在 `onFinish`（结束触发一次）里上报。

> **Q2：Langfuse 会上传我的 prompt 数据，有隐私风险吗？**

> **A：** 用云端（SaaS）确实有数据外传——prompt 里可能含用户隐私。所以：**生产项目、尤其处理敏感数据的，用自托管**（Docker 起一套，数据全在自己服务器）。自托管后，数据不出你的内网，隐私问题基本消除。这也是 Langfuse 开源自托管能力受欢迎的原因。

> **Q3：LLM-as-judge 用模型给模型打分，靠谱吗？会不会"自己人评自己人"？**

> **A：** 有偏差，但实用。用另一个模型（最好是更强的模型）当"裁判"评估回答质量，是当前业界的主流做法（因为人工评估太贵太慢）。它的局限：judge 模型也可能有偏见（比如偏爱冗长回答）。缓解手段：**评估标准写具体**（"是否准确、是否遗漏关键信息"，而不是笼统的"好不好"）、**用多个 judge 交叉验证**、**对关键决策保留人工抽检**。LLM-as-judge 不是绝对真理，但比"凭感觉"强一个量级。

> **Q4：我已经有第 22 章讲的"自建可观测"了，为什么还要 Langfuse？**

> **A：** 第 22 章教你**理解原理**（Trace/Span/日志/回放），Langfuse 是**别人做好的成品**。自建要自己实现：trace 树、可视化面板、评估框架、prompt 管理——工作量巨大且不是你的核心业务。**除非有极端的合规要求（数据连开源工具都不能用），否则用 Langfuse 是投入产出比最高的选择**。第 22 章的原理，让你能看懂 Langfuse 背后的机制，而不是黑盒使用。

---

## 最佳实践

### DO

- **DO** 从项目第一天就接入 Langfuse，别等出问题了才补
- **DO** 在 `onFinish` 里上报（而非 `onChunk`），避免拖慢流式
- **DO** 记录 model 版本 + token 用量 + 成本，这是排查"突然变差"的第一线索
- **DO** 用 LLM-as-judge 建立自动化评估，持续跟踪质量分数
- **DO** 生产项目用自托管，处理敏感数据尤其要自托管
- **DO** 把 prompt 放 Langfuse 管理，改 prompt 不碰代码、可回滚

### DON'T

- **DON'T** 把 Langfuse 当"事后补救"，上线前就该有
- **DON'T** 在 `onChunk` 里上报，每个字都触发会拖慢流
- **DON'T** 只记录不评估——记录是手段，评估（score）才是目的
- **DON'T** 盲目相信 LLM-as-judge，关键场景保留人工抽检
- **DON'T** 用云端 Langfuse 处理敏感数据，该自托管就自托管

---

## 代码实战

> **项目归属**：完整可运行代码在 `labs/19-langfuse-eval`（含评估流程）。本章给最小接入示例。依赖：`@langfuse/tracing`、`ai`、`@ai-sdk/deepseek`、`dotenv`。

### 最小接入：trace + generation + score

```typescript
// 29-langfuse.ts
import 'dotenv/config';
import { Langfuse } from '@langfuse/tracing';
import { generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_BASEURL!,
});

async function askWithTrace(question: string) {
  // ① 开一个 trace
  const trace = langfuse.trace({ name: 'chat', input: { question } });

  const { text, usage } = await generateText({
    model: deepseek('deepseek-chat'),
    system: '你是助手',
    prompt: question,
  });

  // ② 记录这次 LLM 调用
  trace.generation({
    name: 'deepseek-chat',
    model: 'deepseek-chat',
    input: { question },
    output: { text },
    usage: { input: usage.promptTokens, output: usage.completionTokens },
  });

  // ③ 给回答打一个质量分（示例用固定值，真实场景用 LLM-as-judge）
  trace.score({ name: 'quality', value: 85 });

  await trace.update({ output: { text } });
  return text;
}

await askWithTrace('什么是 MCP 协议？');
console.log('✅ 已上报 Langfuse，去面板查看 trace');
```

### LLM-as-judge 打分

```typescript
// 29-judge.ts
import 'dotenv/config';
import { generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';

export async function judge(question: string, answer: string, reference: string) {
  const { text } = await generateText({
    model: deepseek('deepseek-chat'),
    system: `你是严格的评估员。根据参考答案，给实际回答打分（0-100 的整数）。
评估维度：准确性（是否答对）、完整性（是否遗漏关键信息）、简洁性（是否啰嗦）。
只输出一个数字。`,
    prompt: `问题：${question}\n参考答案：${reference}\n实际回答：${answer}`,
  });
  return parseInt(text.trim());
}

const score = await judge(
  'RAG 是什么？',
  'RAG 是检索增强生成',
  'RAG 是检索增强生成，先检索相关资料再让模型基于资料回答'
);
console.log('评分：', score);
```

---

## 实操练习

### 目标

给你第 12 章的 agent 接上 Langfuse，实现"可追踪 + 可评估"。

### 步骤

1. 用 Docker 自托管 Langfuse（或注册云端），拿到三个 key
2. 写 `29-langfuse.ts`，跑一次，在面板看到 trace 和 generation
3. 记录 token 用量和成本，在面板确认能看到
4. 用 `29-judge.ts` 给几个回答打分，把分数作为 score 上报
5. 故意让 agent 回答一个错误问题，在面板里找到这条"低分 trace"

### 验收标准

- [ ] Langfuse 面板能看到完整的 trace 链路
- [ ] 能看到每次调用的 model、token、耗时、成本
- [ ] score 上报成功，能按分数筛选低质量回答
- [ ] 能定位到某次"答错了"的 trace 并回看输入输出

### 挑战加分项

- [ ] 给工具调用也加 span，让 trace 里能看到工具调用步骤
- [ ] 用 Langfuse 的 Prompt Management 管理一个 prompt，改版本后观察评分变化

---

## 本章小结

1. **Langfuse 是 agent 的"黑匣子 + 质检系统"**：记录完整执行链路，还能打分评估。

2. **核心数据模型**：Trace（请求）→ Generation/Span（调用/步骤）→ Score（评分）。

3. **接入极简**：AI SDK 的 `onFinish` 回调 + Langfuse SDK，几乎不改业务代码。

4. **评估靠 LLM-as-judge**：用另一个模型打分，把第 21 章的"评估"落地。

5. **Prompt 管理**：prompt 版本化、可回滚、可 A/B，改 prompt 不碰代码。

6. **选型**：开源自托管 + 框架无关 + 评估内置，是前端团队首选；敏感数据务必自托管。

下一章（最后一章），聊聊"多模型统一接入"——LiteLLM 与模型网关。
