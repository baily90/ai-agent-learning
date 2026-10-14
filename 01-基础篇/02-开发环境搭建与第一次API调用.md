# 第2章：开发环境搭建 & 第一次 API 调用

## 引言

还记得你第一次运行 `create-react-app`，在浏览器里看到那个旋转的 React logo 时的感觉吗？那个瞬间，你从"了解 React 概念"跨越到了"能用 React 做东西"。

这一章就是那个时刻。我们要从零搭建一个 TypeScript + Vercel AI SDK 的开发环境，然后跑通第一次 LLM API 调用。当你在终端里看到 AI 回复的第一段文字时，你就正式从"AI 概念学习者"变成了"AI 应用开发者"。

但这一章不只是"跟着敲命令"。我会深入讲解每一个选择背后的设计哲学——为什么用 Vercel AI SDK 而不是直接发 HTTP 请求？Provider 模式解决了什么问题？API 调用的生命周期里到底发生了什么？理解这些"为什么"，会让你在后续开发 Agent 时做出更好的架构决策。

---

## 2.1 为什么选 Vercel AI SDK

### 直觉理解

**Vercel AI SDK 是一个把各种 LLM API 统一成一套接口的 TypeScript 库。就像 jQuery 抹平了浏览器差异一样，AI SDK 抹平了不同 AI 模型提供商的接口差异。**

### 前端类比

这个类比非常精确：**Vercel AI SDK 之于 LLM API，就像 React 之于浏览器 DOM API。**

让我们展开这个类比：

| 层面 | 浏览器世界 | AI 世界 |
|------|-----------|---------|
| 底层 API | DOM API（`document.createElement`） | 各家 LLM 的 REST API |
| 问题 | 不同浏览器 API 有差异 | 不同 LLM 提供商接口格式不同 |
| 抽象层 | React（虚拟 DOM 统一抽象） | Vercel AI SDK（Provider 统一抽象） |
| 收益 | 写一次代码，全浏览器运行 | 写一次代码，切换任意模型 |

你当然可以直接用 `fetch` 调用 OpenAI 的 REST API。就像你当然可以用原生 DOM API 操作页面。但你会很快发现这些痛点：

**痛点 1：每家 API 格式不同**

OpenAI 的请求格式是一种 JSON 结构，Anthropic 的是另一种，Google 的又是一种。如果你想在项目中支持多个模型（实际项目中这很常见——不同任务用不同模型），你就得写大量的适配代码。

```typescript
// 没有 SDK 时的噩梦——每个提供商一套接口
// OpenAI
const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-5', messages: [...], temperature: 0.7 })
});

// Anthropic - 完全不同的格式
const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 1024, messages: [...] })
});

// DeepSeek - 又一种格式
const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'deepseek-flash', messages: [...] })
});
```

光是维护这些不同的请求格式、响应解析、错误处理，就够你头疼的了。

**痛点 2：流式响应处理复杂**

现代 LLM 应用几乎都用流式响应（像 ChatGPT 那样一个字一个字地"打"出来）。但不同提供商的 SSE（Server-Sent Events）格式、分隔符、结束信号都不一样。自己处理这些非常容易出 bug。

**痛点 3：类型安全缺失**

直接调 REST API 返回的是 `any` 类型的 JSON。没有 TypeScript 类型提示，没有自动补全，你得不断翻文档确认字段名。

**Vercel AI SDK 如何解决这些问题？**

```typescript
// 有了 AI SDK，同一套代码切换任意模型
import { generateText } from 'ai';

// 换模型？改一行字符串就行
const { text } = await generateText({
  model: 'deepseek/deepseek-flash',       // 换模型只需改这一行
  // model: 'openai/gpt-5',               // 切到 OpenAI
  // model: 'anthropic/claude-sonnet-5-5', // 切到 Anthropic
  prompt: '你好，请介绍一下自己',
});
```

一套代码，通过切换 provider 就能使用不同的模型。请求格式、响应解析、流式处理、错误处理——全部由 SDK 在内部搞定。

### 深入原理

**AI SDK 的分层架构**

Vercel AI SDK 的架构设计非常清晰，分为三层：

```
┌─────────────────────────────────────────┐
│           AI SDK Core (ai)              │  ← 你调用的 API
│   generateText / streamText / ...       │
├─────────────────────────────────────────┤
│       Provider Interface                │  ← 统一抽象层
│   LanguageModel / EmbeddingModel        │
├─────────┬──────────┬──────────┬─────────┤
│ OpenAI  │Anthropic │ Google   │DeepSeek │  ← Provider 实现
│Provider │Provider  │Provider  │Provider │
└─────────┴──────────┴──────────┴─────────┘
```

- **顶层（Core）**：提供 `generateText`、`streamText` 等函数（结构化输出通过 `generateText` 的 `output` 参数实现）。这是你日常调用的 API。
- **中间层（Provider Interface）**：定义了"一个 LLM 应该具备什么能力"的接口规范。这是抽象层。
- **底层（Provider 实现）**：每个模型提供商一个 provider 包，负责把统一接口翻译成该提供商的具体 API 格式。

这种三层架构你一定很熟悉——**这不就是前端中的"适配器模式"吗？** 或者更准确地说，是"依赖倒置原则"的典型应用：上层不依赖下层的具体实现，而是依赖抽象接口。

### 深层追问

**为什么不直接用各家的官方 SDK？**

比如 OpenAI 有官方的 `openai` npm 包，Anthropic 有 `@anthropic-ai/sdk`。用它们不好吗？

答案是：如果你只用一个模型提供商，用官方 SDK 完全没问题。但实际项目中，你大概率会遇到这些场景：

1. **成本优化**：简单任务用便宜模型（DeepSeek），复杂任务用贵模型（GPT-5 / Claude）
2. **容灾切换**：主力模型 API 挂了，自动切换到备用模型
3. **A/B 测试**：对比不同模型在你的业务场景下的表现
4. **模型升级**：新模型发布了，你想快速切换试试效果

这些场景下，统一抽象层的价值就体现出来了。

---

## 2.2 Provider 模式详解

### 直觉理解

**Provider 就是一个"翻译器"——它知道如何把 AI SDK 的统一格式翻译成特定模型提供商的 API 格式。每切换一个提供商，只需要换一个 Provider，其他代码完全不用改。**

### 前端类比

**Provider 模式之于 AI SDK，就像数据库 ORM 的驱动之于数据库操作。**

用过 Prisma 吗？你写的 Prisma 查询代码是这样的：

```typescript
const users = await prisma.user.findMany({
  where: { age: { gt: 18 } }
});
```

这段代码不关心底层是 PostgreSQL、MySQL 还是 MongoDB。你只需要在配置文件里指定用哪个数据库驱动，Prisma 就帮你把统一的查询语法翻译成对应数据库的 SQL/查询语言。

AI SDK 的 Provider 做的是完全相同的事情——你写统一的 `generateText` 调用，Provider 负责翻译成 OpenAI、Anthropic 或 DeepSeek 的 API 格式。

### 深入原理

**字符串 model 背后的 Provider 机制**

在 AI SDK 5 里，你通常用字符串直接指定模型，例如 `model: 'deepseek/deepseek-flash'`。这个字符串其实包含两部分信息：

```
'deepseek/deepseek-flash'
  ↑         ↑
  Provider  模型 ID
```

SDK 看到 `deepseek` 这个 Provider 名，会自动加载对应的 provider（`@ai-sdk/deepseek`），把它翻译成 DeepSeek 的 API 格式。所以：

- **换 Provider = 改字符串里的 Provider 名**：`deepseek/deepseek-flash` → `openai/gpt-5`，一行搞定
- **换模型 = 改字符串里的模型 ID**：`deepseek/deepseek-flash` → `deepseek/deepseek-v4-pro`

```typescript
import { generateText } from 'ai';

// 换模型？改字符串就行
const { text } = await generateText({
  model: 'deepseek/deepseek-flash',   // 换成 'openai/gpt-5' 就切到 OpenAI
  prompt: '你好，请介绍一下自己',
});
```

**如果你需要显式配置 Provider**

大多数时候你不需要手动创建 Provider。但有些场景（自定义 baseURL、自定义 headers、代理）需要显式配置。这时用 `createDeepSeek` 等工厂函数：

```typescript
import { createDeepSeek } from '@ai-sdk/deepseek';

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
  // baseURL 默认就是 https://api.deepseek.com，一般不用改
  // 需要代理时：baseURL: 'https://your-proxy.com/v1',
});

const { text } = await generateText({
  model: deepseek('deepseek-v4-pro'),
  prompt: '你好',
});
```

> 补充：早期（AI SDK 4 及以前）的做法是用 `createOpenAI({ baseURL: 'https://api.deepseek.com' })` 来复用 OpenAI 兼容接口。现在 DeepSeek 有了官方 provider（`@ai-sdk/deepseek`），这个"兼容 hack"已经没必要了。

**Provider 模式的 Trade-off**

任何抽象都有代价。Provider 模式的 trade-off 是：

1. **功能交集问题**：不同模型有不同的特殊能力（比如 Claude 的长上下文、GPT-5 的多模态）。统一接口只能暴露所有模型的"公共能力子集"。如果你要用某个模型的独有功能，可能需要绕过 SDK 直接调用。

2. **版本滞后**：当模型提供商推出新功能时，SDK 的 provider 需要更新才能支持。这中间可能有几天到几周的延迟。

3. **抽象泄漏**：某些场景下，不同模型对同一参数的解释不完全相同。比如同样传 `temperature: 0.7`，不同模型的实际表现可能差异不小。

我的经验是：**这些 trade-off 在 90% 的场景下都不构成问题。** 先用 SDK 快速开发，碰到确实需要 provider 特殊功能的场景再单独处理。

---

## 2.3 项目初始化

### 完整搭建过程

我们的贯穿项目叫"AI 智能工作助手"。这一章的目标是初始化项目并跑通第一次 API 调用。

**Step 1：创建项目目录并初始化**

```bash
# 创建项目目录
mkdir ai-work-assistant
cd ai-work-assistant

# 初始化 Node.js 项目
npm init -y

# 安装 TypeScript 和运行工具
npm install -D typescript tsx @types/node

# 初始化 TypeScript 配置
npx tsc --init
```

**Step 2：配置 TypeScript**

打开生成的 `tsconfig.json`，关键配置修改如下：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3：安装 Vercel AI SDK 和 Provider**

```bash
# 核心包（字符串 model 方式无需单独安装 provider 包）
npm install ai

# 环境变量管理
npm install dotenv
```

**Step 4：配置环境变量**

```bash
# 创建 .env 文件
touch .env

# 创建 .env.example（给其他开发者参考，不含真实密钥）
touch .env.example
```

**Step 5：创建项目结构**

```
ai-work-assistant/
├── src/
│   ├── 01-hello-ai.ts          # 第一次 API 调用
│   ├── 02-system-prompt.ts      # 带 system prompt 的调用
│   ├── 03-switch-provider.ts    # 切换 Provider 示例
│   └── 04-error-handling.ts     # 错误处理示例
├── .env                         # 环境变量（不提交到 git）
├── .env.example                 # 环境变量模板
├── .gitignore
├── package.json
└── tsconfig.json
```

`.gitignore` 中务必包含：

```
node_modules/
dist/
.env
```

---

## 2.4 DeepSeek API Key 配置

### 获取 API Key

1. 访问 DeepSeek 开放平台：https://platform.deepseek.com
2. 注册/登录账号
3. 进入"API Keys"页面
4. 点击"创建 API Key"
5. 复制生成的 Key（格式类似 `sk-xxxxxxxxxxxx`）

**注意：API Key 只在创建时显示一次，之后无法查看。请立即保存到安全的地方。**

### 配置环境变量

在 `.env` 文件中写入：

```
DEEPSEEK_API_KEY=sk-你的实际key
```

在 `.env.example` 中写入（给团队其他人参考）：

```
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
```

### 安全管理的重要性

这里需要特别强调一下 API Key 的安全管理。我在实际项目中见过太多人犯这个错误——把 API Key 直接硬编码在代码里，然后提交到 GitHub。后果是：有人用爬虫扫描 GitHub 上的 Key，然后用你的账号疯狂调用 API，你一觉醒来发现账单几千美元。

安全管理的核心原则：

1. **永远不要把 Key 写在代码里**：用环境变量
2. **永远不要把 `.env` 提交到 git**：`.gitignore` 里必须有 `.env`
3. **团队项目用密钥管理服务**：如 Vault、AWS Secrets Manager
4. **设置用量上限**：在 DeepSeek 平台设置每日/每月消费限额
5. **不同环境用不同的 Key**：开发、测试、生产各用独立的 Key

这和前端保护各种密钥（Firebase config、第三方 API token）的逻辑完全一致。**秘钥管理不是可选项，是必选项。**

---

## 2.5 第一次 API 调用：generateText

### 直觉理解

**`generateText` 是最基础的 API 调用方式——你发一段文字给模型，模型想好之后一次性把完整回复返回给你。就像发一封邮件，等对方回复完整的一封信。**

### 深入原理

让我们写第一个文件 `src/01-hello-ai.ts`：

```typescript
// src/01-hello-ai.ts
// 你的第一次 AI API 调用

import 'dotenv/config';
import { generateText } from 'ai';

async function main() {
  console.log('正在调用 DeepSeek API...\n');

  // 用字符串直接指定模型（provider/modelId 格式），无需单独安装 provider 包
  const result = await generateText({
    model: 'deepseek/deepseek-flash',
    prompt: '请用一句话介绍你自己，然后给前端开发者一个学习 AI 的建议。',
  });

  console.log('=== AI 的回复 ===');
  console.log(result.text);
  console.log('\n=== 使用统计 ===');
  console.log(`输入 Token: ${result.usage?.inputTokens}`);
  console.log(`输出 Token: ${result.usage?.outputTokens}`);
  console.log(`总计 Token: ${result.usage?.totalTokens}`);
}

main().catch(console.error);
```

运行它：

```bash
npx tsx src/01-hello-ai.ts
```

如果一切正常，你会看到 AI 的回复和 token 使用统计。恭喜你，你刚完成了第一次 LLM API 调用！

### generateText 的参数详解

```typescript
const result = await generateText({
  // 必需参数
  model: 'deepseek/deepseek-flash',  // 字符串指定模型（provider/modelId）
  prompt: '介绍一下 React',           // 用户输入（简单字符串形式）

  // 系统提示词用 instructions（不再是 messages 里的 role: 'system'）
  instructions: '你是一个有帮助的助手',

  // 或者用 messages 格式（更灵活，支持多轮对话）
  messages: [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '你好！有什么可以帮你的？' },
    { role: 'user', content: '介绍一下 React' },
  ],

  // 可选参数
  maxOutputTokens: 1000,  // 限制输出的最大 token 数
  temperature: 0.7,       // 控制随机性（0-2，部分推理模型不支持）
  topP: 0.9,              // 核采样参数
  seed: 42,               // 随机种子（部分模型支持，提高可复现性）
});
```

**`prompt` vs `messages`**

这两种传参方式不能同时使用。区别是：

- `prompt`：就是一个简单字符串，适合单轮对话或简单任务
- `messages`：一个消息数组，支持 `user`、`assistant` 等角色，适合多轮对话
- `instructions`：系统提示词（设定人设和规则），独立于 `messages`，不再是 `role: 'system'` 的消息

实际开发中你大部分时间会同时用 `instructions`（设人设）+ `messages`（传对话历史），因为几乎所有 Agent 都需要 system prompt 和对话历史。

### 返回值详解

```typescript
interface GenerateTextResult {
  text: string;           // 模型的回复文本——这是你最关心的

  usage: {
    inputTokens: number;     // 输入消耗的 token 数
    outputTokens: number;    // 输出消耗的 token 数
    totalTokens: number;     // 总 token 数
  };

  finishReason: string;  // 结束原因：'stop'（正常结束）、'length'（达到 maxOutputTokens）等
}
```

**`finishReason` 字段值得特别关注：**

| 值 | 含义 | 你应该做什么 |
|---|------|------------|
| `stop` | 模型自然结束了回复 | 正常处理 |
| `length` | 达到了 maxOutputTokens 限制，回复被截断了 | 考虑增大 maxOutputTokens 或分段处理 |
| `content-filter` | 内容被安全过滤了 | 检查输入是否触发了安全策略 |
| `tool-calls` | 模型请求调用工具（后面章节讲） | 执行工具调用 |

这就像 HTTP 响应的 status code——`200` 表示成功，`206` 表示部分内容，`403` 表示被拒绝。`finishReason` 告诉你模型的回复处于什么状态。

---

## 2.6 带 System Prompt 的调用

System Prompt 是给模型设定"人设"和"规则"的指令。它是 Agent 开发中最重要的工具之一。

```typescript
// src/02-system-prompt.ts
import 'dotenv/config';
import { generateText } from 'ai';

async function main() {
  // 示例 1：没有 system prompt 的"裸调用"
  const withoutSystem = await generateText({
    model: 'deepseek/deepseek-flash',
    prompt: '帮我写一个按钮组件',
  });

  console.log('=== 没有 System Prompt ===');
  console.log(withoutSystem.text);
  console.log(`Token: ${withoutSystem.usage?.totalTokens}\n`);

  // 示例 2：用 instructions 设定人设和规则
  const withSystem = await generateText({
    model: 'deepseek/deepseek-flash',
    instructions: `You are a senior frontend developer specializing in React and TypeScript.
Rules:
- Always use TypeScript with proper type annotations
- Use functional components with hooks
- Follow the project's coding conventions: named exports, Props interface suffix
- Include brief JSDoc comments for the component
- Do not include CSS/styling unless specifically asked
- Respond in Chinese`,
    prompt: '帮我写一个按钮组件',
  });

  console.log('=== 有 System Prompt ===');
  console.log(withSystem.text);
  console.log(`Token: ${withSystem.usage?.totalTokens}\n`);
}

main().catch(console.error);
```

**System Prompt 的设计原则**

1. **角色设定放最前面**："你是一个资深前端开发者"——这让模型立即进入对应的"模式"
2. **规则要具体**：不要说"写好的代码"，要说"使用 TypeScript，命名导出，函数式组件"
3. **约束要明确**：告诉模型什么不该做，和什么该做同样重要
4. **用英文写（如果用户不会直接看到）**：节省 token，且大部分模型对英文指令的遵循度更高
5. **格式化输出要求**：如果需要 JSON 输出，在 system prompt 中明确 schema

注意到一个细节了吗？System Prompt 用英文写，但最后加了 "Respond in Chinese"。这样既节省了 token，又保证了输出语言正确。这是实践中非常有效的小技巧。

---

## 2.7 切换 Provider 的威力

这是 Vercel AI SDK 最让人舒服的地方——切换模型提供商只需要改一两行代码。

```typescript
// src/03-switch-provider.ts
import 'dotenv/config';
import { generateText } from 'ai';

// ============================================
// 模型注册表——集中管理所有可用模型
// ============================================

// 字符串 model 时代，模型就是一行字符串，注册表更简单了
interface ModelConfig {
  model: string;   // 字符串 model（provider/modelId）
  name: string;
  costTier: 'low' | 'medium' | 'high';
}

const modelRegistry: Record<string, ModelConfig> = {
  'deepseek-flash': {
    model: 'deepseek/deepseek-flash',
    name: 'DeepSeek V4 Flash',
    costTier: 'low',
  },
  'deepseek-pro': {
    model: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    costTier: 'medium',
  },
  // 按需添加更多模型...
  // 'gpt-5': { model: 'openai/gpt-5', name: 'GPT-5', costTier: 'high' },
};

// ============================================
// 统一的调用函数
// ============================================

async function askAI(
  modelKey: string,
  question: string,
  systemPrompt?: string
) {
  const config = modelRegistry[modelKey];
  if (!config) {
    throw new Error(`Unknown model: ${modelKey}. Available: ${Object.keys(modelRegistry).join(', ')}`);
  }

  console.log(`\n🤖 使用模型: ${config.name} (成本: ${config.costTier})`);
  const startTime = Date.now();

  const result = await generateText({
    model: config.model,
    instructions: systemPrompt,
    prompt: question,
  });

  const duration = Date.now() - startTime;

  console.log(`回复: ${result.text}`);
  console.log(`耗时: ${duration}ms | Token: ${result.usage?.totalTokens}`);

  return result;
}

// ============================================
// 演示：同一问题，不同模型
// ============================================

async function main() {
  const question = '用 TypeScript 写一个防抖函数，附上类型注解。';
  const systemPrompt = 'You are a TypeScript expert. Write concise, well-typed code. Respond in Chinese.';

  // 用 DeepSeek Flash 回答
  await askAI('deepseek-flash', question, systemPrompt);

  // 有 key 的话，可以对比其他模型
  // await askAI('gpt-5', question, systemPrompt);
}

main().catch(console.error);
```

**模型注册表模式**

上面代码中的 `modelRegistry` 是我在实际项目中总结出的一个模式。它的好处：

1. **集中管理**：所有可用模型在一个地方定义，方便查看和维护
2. **元数据附加**：除了模型字符串，还能附加成本等级、用途标签等元信息
3. **运行时切换**：根据任务类型、成本预算、用户偏好动态选择模型
4. **配置外置**：后期可以把 modelKey 放到配置文件或数据库里，实现无需重启的模型切换

这就像前端的主题系统——你定义了一组主题变量，在运行时通过 CSS 变量或 Context 切换主题，而不是在每个组件里硬编码颜色值。

---

## 2.8 API 调用的生命周期

### 直觉理解

**每一次 `generateText` 调用，从你按下回车到拿到结果，中间经历了一条复杂的链路。理解这条链路，你才能有效地调试问题和优化性能。**

### 深入原理

```
你的代码 → AI SDK → HTTP 请求 → 网络传输 → API 服务器
   ↓                                            ↓
拿到结果 ← AI SDK 解析 ← HTTP 响应 ← 模型推理 ← 请求排队
```

**完整的生命周期：**

**阶段 1：请求构建（客户端，< 1ms）**

AI SDK 把你传入的参数（model、messages、temperature 等）翻译成目标 API 的请求格式。对于 DeepSeek（OpenAI 兼容格式），最终构建的 HTTP 请求大致是：

```json
POST https://api.deepseek.com/chat/completions
Headers: {
  "Authorization": "Bearer sk-xxx",
  "Content-Type": "application/json"
}
Body: {
  "model": "deepseek-flash",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "thinking": {"type": "enabled"},
  "max_tokens": 1000
}
```

**阶段 2：网络传输（变化大，10ms - 2000ms）**

请求通过网络发送到 API 服务器。延迟取决于：
- 你的网络环境（公司网络、家庭宽带、代理节点）
- API 服务器的地理位置（DeepSeek 服务器在国内，延迟较低）
- 是否有网络代理或防火墙

对于国内开发者，调用 DeepSeek 的延迟通常比调用 OpenAI 低很多——这是选择 DeepSeek 的一个重要实际原因。

**阶段 3：请求排队（变化大，0ms - 数秒）**

API 服务器收到请求后，不一定立即处理。如果当前负载高，你的请求会被放入队列等待。这就是为什么同样的请求，有时候快有时候慢。高峰期（比如工作日的上午）延迟通常更高。

**阶段 4：模型推理（主要耗时，数百ms - 数十秒）**

这是最耗时的阶段。模型一个 token 一个 token 地生成回复。耗时和输出长度成正比——回复 100 个 token 比回复 1000 个 token 快得多。

有个关键点：**输入 token 的处理是并行的（Prefill 阶段），但输出 token 必须逐个生成（Decode 阶段）**。这就是为什么长输入不一定让响应变慢多少，但长输出一定会。

用前端来类比：Prefill 阶段像 `Promise.all()`——并行处理所有输入。Decode 阶段像 `for...of` + `await`——必须一个接一个。

**阶段 5：响应返回和解析（客户端，< 10ms）**

API 返回 JSON 响应，AI SDK 把它解析成类型安全的 TypeScript 对象。

**总延迟 = 网络传输 + 排队等待 + 模型推理**

对于 DeepSeek 的普通请求，总延迟通常在 1-10 秒。

---

## 2.9 错误处理基础

API 调用一定会遇到错误。不处理错误的代码不是"乐观"，是"天真"。

```typescript
// src/04-error-handling.ts
import 'dotenv/config';
import { generateText } from 'ai';

// ============================================
// 错误分类和处理策略
// ============================================

interface AICallOptions {
  prompt: string;
  systemPrompt?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

async function safeGenerateText(options: AICallOptions): Promise<string> {
  const { prompt, systemPrompt, maxRetries = 3, retryDelayMs = 1000 } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateText({
        model: 'deepseek/deepseek-flash',
        instructions: systemPrompt,
        prompt,
        maxOutputTokens: 1000,
      });

      // 检查 finishReason
      if (result.finishReason === 'length') {
        console.warn('警告: 输出被截断，考虑增大 maxOutputTokens');
      }

      return result.text;

    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 解析错误类型
      const statusCode = extractStatusCode(error);

      switch (statusCode) {
        case 401:
          // 认证错误——不用重试，Key 有问题
          throw new Error(
            'API Key 无效或已过期。请检查 .env 中的 DEEPSEEK_API_KEY 配置。'
          );

        case 429:
          // 限流——需要等待后重试
          const waitTime = retryDelayMs * Math.pow(2, attempt - 1); // 指数退避
          console.warn(
            `限流 (429): 第 ${attempt}/${maxRetries} 次重试，等待 ${waitTime}ms...`
          );
          await sleep(waitTime);
          break;

        case 400:
          // 请求格式错误——不用重试，代码有问题
          throw new Error(
            `请求格式错误 (400): ${lastError.message}。请检查参数。`
          );

        case 500:
        case 502:
        case 503:
          // 服务器错误——可以重试
          console.warn(
            `服务器错误 (${statusCode}): 第 ${attempt}/${maxRetries} 次重试...`
          );
          await sleep(retryDelayMs * attempt);
          break;

        default:
          // 未知错误
          if (attempt < maxRetries) {
            console.warn(
              `未知错误: 第 ${attempt}/${maxRetries} 次重试...`
            );
            await sleep(retryDelayMs);
          }
      }
    }
  }

  throw new Error(`${maxRetries} 次重试后仍然失败: ${lastError?.message}`);
}

// 辅助函数
function extractStatusCode(error: unknown): number | null {
  if (error && typeof error === 'object') {
    // AI SDK 的错误通常包含 statusCode 或 status
    if ('statusCode' in error) return (error as any).statusCode;
    if ('status' in error) return (error as any).status;
    // 有些错误包含 response 对象
    if ('response' in error && (error as any).response?.status) {
      return (error as any).response.status;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 演示
// ============================================

async function main() {
  try {
    const result = await safeGenerateText({
      prompt: '用三句话解释什么是 React hooks',
      systemPrompt: 'You are a concise technical writer. Respond in Chinese.',
      maxRetries: 3,
    });
    console.log('成功:', result);
  } catch (error) {
    console.error('最终失败:', error instanceof Error ? error.message : error);
  }
}

main();
```

### 常见错误码速查表

| 状态码 | 含义 | 可重试？ | 处理策略 |
|-------|------|---------|---------|
| 400 | 请求格式错误 | 否 | 检查参数（messages 格式、model 名称等） |
| 401 | API Key 无效 | 否 | 检查 Key 是否正确、是否过期 |
| 403 | 权限不足 | 否 | 检查账户权限、是否欠费 |
| 429 | 请求太频繁（限流） | 是 | 指数退避重试（1s → 2s → 4s） |
| 500 | 服务器内部错误 | 是 | 稍后重试 |
| 502 | 网关错误 | 是 | 稍后重试 |
| 503 | 服务不可用 | 是 | 稍后重试，可能在维护 |

### 指数退避（Exponential Backoff）

你注意到上面的重试策略用了指数退避——第一次等 1 秒，第二次等 2 秒，第三次等 4 秒。这不是随意设计的，而是分布式系统的标准做法。

为什么？因为如果 API 因为负载过高而返回 429，所有客户端同时在 1 秒后重试会造成更大的负载（惊群效应，Thundering Herd）。指数退避让不同客户端在不同时间点重试，分散了压力。

这和前端做轮询（polling）时的策略是一样的——如果服务暂时不可用，你不会每 100ms 疯狂重试，而是逐渐增大间隔。

实际中还可以加入**随机抖动（jitter）**——在退避时间上加一个小的随机偏移，进一步分散重试的时间点：

```typescript
const waitTime = retryDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
```

---

## 2.10 计费理解：输入 Token vs 输出 Token

### 直觉理解

**LLM API 按 token 计费，而且输出 token 比输入 token 贵 2-5 倍。这意味着：让 AI 少说废话，就是在省钱。**

### 深入原理

**为什么输出比输入贵？**

这涉及到 LLM 的计算特性：

- **处理输入（Prefill）**：所有输入 token 可以**并行**处理。就像 `Promise.all([token1, token2, ..., tokenN])`——GPU 可以同时计算所有 token 的注意力。
- **生成输出（Decode）**：输出 token 必须**逐个**生成。每生成一个 token，都需要"看到"前面所有已生成的 token。就像 `for` 循环——必须等上一个完成才能开始下一个。

逐个生成意味着 GPU 利用率低（大量算力在等待），而提供商的计费模型需要覆盖这个低效率的成本。

**实际价格对比**

| 模型 | 输入价格 ($/百万token) | 输出价格 ($/百万token) | 输出/输入 比率 |
|------|---------------------|---------------------|--------------|
| DeepSeek-V4-Flash（off-peak） | $0.15 | $0.60 | 4.0x |
| DeepSeek-V4-Pro（off-peak） | $0.66 | $1.98 | 3.0x |
| GPT-5.x | ~$1.25 | ~$10.00 | ~8.0x |
| Claude Sonnet 4/5 | ~$3.00 | ~$15.00 | 5.0x |

> 注：价格变化极快，上表为撰写时（2026-10）的参考值。DeepSeek 现采用「缓存命中/未命中 + 峰谷（off-peak/peak）」定价，这里取 off-peak 未命中缓存价；GPT / Claude 为近似值。实际请以各厂商官方定价页为准。

**成本优化的实际策略**

1. **控制输出长度**：使用 `maxOutputTokens` 限制输出，在 system prompt 中要求"简洁回答"
2. **精炼输入**：删掉 system prompt 中的废话，用简洁的表达
3. **对话历史管理**：不要每次都把完整历史发过去，实现滑动窗口或摘要机制
4. **分级模型策略**：简单任务用便宜模型，复杂任务才用贵的
5. **缓存常见问题**：对于重复的常见问题，缓存模型的回答而不是每次都调 API

**成本估算实例**

假设你做一个内部知识库问答 Agent：

```
场景：每天 200 次查询，每次查询包含：
- System prompt: 200 tokens（固定）
- 检索到的文档片段: 800 tokens（动态）
- 用户问题: 50 tokens
- 历史对话（最近 3 轮）: 300 tokens
- AI 回复: 约 200 tokens

每次调用：
  输入 = 200 + 800 + 50 + 300 = 1,350 tokens
  输出 = 200 tokens

使用 DeepSeek-V4-Flash（off-peak）：
  单次成本 = 1,350 × $0.15/M + 200 × $0.60/M = $0.0003225
  日成本 = $0.0003225 × 200 = $0.0645
  月成本 = $0.0645 × 22 (工作日) = $1.42

使用 GPT-5.x：
  单次成本 = 1,350 × $1.25/M + 200 × $10.00/M = $0.0036875
  日成本 = $0.0036875 × 200 = $0.7375
  月成本 = $0.7375 × 22 = $16.23
```

DeepSeek 月成本不到 1.5 美元，GPT-5.x 约 16 美元——差了 10 倍以上。对于一个内部工具来说，除非 GPT-5.x 的回答质量显著更好，否则 DeepSeek 是更明智的选择。

---

## 概念辨析

| 易混概念 | 概念 A | 概念 B | 核心区别 |
|---------|--------|--------|---------|
| prompt vs messages | `prompt` 参数 | `messages` 参数 | prompt 是单个字符串；messages 是带角色的消息数组，支持对话历史 |
| generateText vs streamText | `generateText` | `streamText` | generateText 一次性返回完整结果；streamText 逐步返回（流式），用户体验更好 |
| instructions vs user 消息 | `instructions` 参数 | `role: 'user'` | instructions 设定 AI 的"人设"和规则；user 是实际的用户输入 |
| API Key vs Model | API Key | Model 名称 | Key 是认证凭据（谁在调用）；Model 是选择哪个模型（用什么回答） |
| Provider vs Model | Provider 实例 | Model 实例 | Provider 是"提供商配置"；Model 是"具体模型"。一个 Provider 可以创建多个 Model |
| 输入 Token vs 输出 Token | Prompt Tokens | Completion Tokens | 输入是你发的，并行处理，便宜；输出是 AI 生成的，串行处理，更贵 |

---

## 灵魂拷问

> **Q1: 为什么 Vercel AI SDK 不直接内置所有 Provider，而是让你单独安装？**

> A: 这是一个优秀的软件设计决策，遵循了"只为你使用的功能付费"原则。
>
> 如果把所有 Provider 内置在核心包里：
> 1. `node_modules` 会臃肿——你只用 DeepSeek，却装了 OpenAI、Anthropic、Google、Cohere 等十几个 Provider 的代码
> 2. 更新一个 Provider 需要更新整个 SDK——假设 OpenAI 改了 API 格式，就算你不用 OpenAI，也得跟着升级
> 3. 安全性降低——每个 Provider 可能引入自己的依赖链
>
> 分离安装的好处恰好解决了这些问题——这在前端世界里叫"Tree Shakeable"设计，或者说"微内核 + 插件"架构。和 Babel 的 plugin 模式、ESLint 的 rule 模式完全一致。

> **Q2: 为什么 DeepSeek 选择兼容 OpenAI 的 API 格式，而不是设计自己的格式？**

> A: 这是一个精明的商业和技术决策。
>
> OpenAI 的 API 格式已经成为事实标准（de facto standard）。大量的工具、SDK、教程都基于这个格式。兼容 OpenAI 格式意味着：
> 1. 用户几乎零成本迁移——换个 baseURL 和 API Key 就行
> 2. 所有支持 OpenAI 的工具自动支持 DeepSeek
> 3. 节省了设计和维护独立 API 规范的成本
>
> 这在软件行业是常见策略——就像很多数据库兼容 PostgreSQL 的 wire protocol，很多对象存储兼容 S3 的 API。**标准不一定是"最好"的设计，但"兼容标准"几乎总是正确的选择。**

> **Q3: 如果 API Key 泄露了，应该怎么办？**

> A: 这是一个需要当成安全事件来处理的场景，不是"改个密码"那么简单。
>
> 立即行动：
> 1. **立刻吊销泄露的 Key**：在 DeepSeek 平台上删除这个 Key，生成新 Key
> 2. **检查用量异常**：查看 API 调用日志，确认是否已被盗用
> 3. **排查泄露途径**：是提交到了 GitHub？是写在了前端代码里？还是通过日志暴露的？
> 4. **修复泄露源头**：从 git 历史中清除 Key（注意：仅仅删除文件不够，git 历史里仍然有）
> 5. **设置消费限额**：在平台上设置每日/每月最大消费额度，做"损失兜底"
>
> 前端开发者特别容易犯的错误：把 API Key 写在前端代码里。**永远不要这样做。** LLM API 调用应该通过你的后端服务代理，前端只和你的后端通信。

> **Q4: generateText 和 streamText 应该在什么场景下分别使用？**

> A: 简单的判断标准：**如果用户能"看到"回复过程，用 streamText；如果是后台处理，用 generateText。**
>
> `generateText` 适用于：
> - 后台批处理任务（分析、分类、提取）
> - 结果需要完整拿到后才能处理的场景（JSON 解析）
> - 非面向用户的内部逻辑
>
> `streamText` 适用于：
> - 聊天界面（用户期望看到逐字输出）
> - 长内容生成（文章、报告）
> - 需要快速首字节时间（TTFB）的场景
>
> 从用户体验角度看，streamText 的优势是巨大的。假设一次回复需要 5 秒生成完毕：
> - `generateText`：用户等 5 秒看到完整回复（感觉很慢）
> - `streamText`：0.5 秒后开始逐字显示（感觉很快，虽然总时间一样）
>
> 这和前端的"骨架屏"是同一个思路——实际加载时间没变，但感知速度大幅提升。我们会在下一章详细讲流式响应。

> **Q5: 同一个 prompt 用不同模型调用，结果差异大吗？**

> A: **差异可能非常大，而且差异的方向不可预测。**
>
> 不同模型在不同类型任务上各有所长。比如：
> - 同一个数学推理问题，DeepSeek V4 Pro 可能对了，GPT-5 可能错了
> - 同一个创意写作任务，Claude 的输出风格可能更好
> - 同一个代码生成任务，结果的风格、长度、正确性都可能不同
>
> 这就是为什么我建议在你的具体业务场景下做对比测试，而不是只看公开 benchmark。benchmark 衡量的是通用能力，但你的业务场景可能有特殊要求。
>
> 实践中的做法：准备一组你的业务中的典型问题（20-50 个），分别用几个候选模型跑一遍，人工评估结果质量。这比看任何排行榜都靠谱。

---

## 最佳实践

### DO（推荐做法）

- **DO 用环境变量管理 API Key**：`.env` + `dotenv` 是最基本的安全实践。永远不要硬编码 Key。

- **DO 实现重试和错误处理**：API 调用必然会失败。指数退避 + 重试是你的第一道防线。把错误处理代码写在"快乐路径"之前，而不是"之后才加"。

- **DO 记录每次调用的 token 消耗**：建立成本监控意识。在开发阶段就记录 `usage` 数据，这样上线前你能准确预估成本。

- **DO 使用 TypeScript 严格模式**：AI SDK 有完善的类型定义。`strict: true` 能帮你在编译期捕获很多参数错误。

- **DO 为不同任务选择合适的模型**：建立模型注册表，根据任务复杂度和成本预算选择模型。

- **DO 给 system prompt 写清楚输出要求**：不要让模型"自由发挥"。你想要 JSON 就说 JSON，想要简洁就说简洁。

### DON'T（避免做法）

- **DON'T 在前端代码中直接调用 LLM API**：API Key 会暴露在浏览器中。始终通过后端代理。

- **DON'T 忽略 finishReason**：如果 `finishReason` 是 `length`，你的回复被截断了。不检查这个字段会导致静默的数据丢失。

- **DON'T 把完整对话历史无脑发送**：每一轮对话都发完整历史会导致 token 成本指数增长。设计记忆管理策略。

- **DON'T 只在 catch 里打印 `error`**：解析错误的 statusCode 和 message，给出具体的修复指引。一个好的错误消息能节省一小时的调试时间。

- **DON'T 在没有超时设置的情况下调用 API**：网络可能挂起。设置合理的超时时间（比如 30 秒），避免请求永远挂着。

- **DON'T 上来就追求"最优方案"**：先跑通最简单的调用，确认 API 可用、Key 正确、网络通畅，然后再一步步优化。

---

## 代码实战：完整的 "Hello AI" 贯穿项目

把前面所有知识点整合起来，这是我们贯穿项目的第一个版本：

```typescript
// src/index.ts
// AI 智能工作助手 v0.1 - Hello AI

import 'dotenv/config';
import { generateText } from 'ai';
import * as readline from 'readline';

// ============================================
// 配置
// ============================================

const MODEL = 'deepseek/deepseek-flash';

const SYSTEM_PROMPT = `You are an intelligent work assistant for frontend developers.
Your capabilities:
- Answer technical questions about JavaScript, TypeScript, React, Vue, Node.js
- Help with code review and debugging
- Explain AI/LLM concepts in frontend-friendly terms
- Provide practical advice for integrating AI features into web applications

Rules:
- Be concise but thorough
- Use code examples when helpful
- If you're not sure about something, say so honestly
- Respond in the same language the user uses (Chinese or English)`;

// ============================================
// 对话历史管理
// ============================================

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const conversationHistory: Message[] = [];

// 限制历史长度，避免 token 爆炸
const MAX_HISTORY_LENGTH = 10; // 最多保留最近 10 轮对话

function addToHistory(role: 'user' | 'assistant', content: string) {
  conversationHistory.push({ role, content });

  // 超出限制时，删除最早的一轮（user + assistant）
  while (conversationHistory.length > MAX_HISTORY_LENGTH * 2) {
    conversationHistory.splice(0, 2);
  }
}

// ============================================
// AI 调用（带错误处理和重试）
// ============================================

async function chat(userInput: string): Promise<string> {
  addToHistory('user', userInput);

  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateText({
        model: MODEL,
        instructions: SYSTEM_PROMPT,
        messages: conversationHistory,
        maxOutputTokens: 2000,
      });

      const assistantReply = result.text;
      addToHistory('assistant', assistantReply);

      // 打印 token 使用情况（开发阶段的好习惯）
      const usage = result.usage;
      if (usage) {
        console.log(
          `\n[Token 使用] 输入: ${usage.inputTokens} | 输出: ${usage.outputTokens} | 总计: ${usage.totalTokens}`
        );
      }

      if (result.finishReason === 'length') {
        console.log('[警告] 回复被截断，可能不完整');
      }

      return assistantReply;

    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const waitTime = 1000 * Math.pow(2, attempt - 1) + Math.random() * 500;
        console.log(`[重试 ${attempt}/${maxRetries}] ${waitTime.toFixed(0)}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // 重试用尽，从历史中移除这次失败的 user 消息
  conversationHistory.pop();
  throw new Error(`AI 调用失败: ${lastError?.message}`);
}

// ============================================
// 交互式命令行界面
// ============================================

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('==================================');
  console.log('  AI 智能工作助手 v0.1');
  console.log('  输入问题开始对话，输入 exit 退出');
  console.log('==================================\n');

  const askQuestion = () => {
    rl.question('你: ', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed.toLowerCase() === 'exit') {
        console.log('\n再见！');
        rl.close();
        return;
      }

      if (trimmed === '/history') {
        console.log(`\n[对话历史] ${conversationHistory.length} 条消息`);
        for (const msg of conversationHistory) {
          console.log(`  [${msg.role}] ${msg.content.slice(0, 50)}...`);
        }
        console.log();
        askQuestion();
        return;
      }

      if (trimmed === '/clear') {
        conversationHistory.length = 0; // 清空对话历史
        console.log('\n[已清空对话历史]\n');
        askQuestion();
        return;
      }

      try {
        console.log('\nAI: 思考中...');
        const reply = await chat(trimmed);
        console.log(`\nAI: ${reply}\n`);
      } catch (error) {
        console.error(`\n[错误] ${error instanceof Error ? error.message : error}\n`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main();
```

运行方式：

```bash
npx tsx src/index.ts
```

**这个 v0.1 版本已经包含了：**
- 字符串模型选择
- System Prompt 设定
- 对话历史管理（带滑动窗口）
- 错误处理和重试（指数退避 + 随机抖动）
- Token 使用监控
- finishReason 检查
- 基本的命令系统（`/history`、`/clear`、`exit`）

在后续章节中，我们会逐步给它加上流式输出、Tool Use（工具调用）、RAG（知识库检索）等 Agent 能力。

---

## 实操练习

### 练习目标
独立搭建开发环境，完成第一次 API 调用，并理解调用过程中的每个环节。

### 具体步骤

**练习 1：基础搭建**
1. 按照本章步骤创建项目、安装依赖、配置 API Key
2. 运行 `01-hello-ai.ts`，确认能收到 AI 的回复
3. 故意把 API Key 改错，观察错误信息
4. 故意把 model 名称改错，观察错误信息

**练习 2：System Prompt 实验**
1. 运行 `02-system-prompt.ts`，对比有无 system prompt 的输出差异
2. 修改 system prompt，让 AI 扮演一个"代码审查员"角色
3. 尝试用中文和英文分别写 system prompt，对比 token 消耗
4. 写一个 system prompt 让 AI 只用 JSON 格式回复，测试结构化输出

**练习 3：多模型对比**
1. 在 `03-switch-provider.ts` 的基础上，至少配置 2 个不同的模型
2. 用同一组问题（至少 5 个问题）分别测试两个模型
3. 对比回复质量、token 消耗、响应速度
4. 记录你的观察结果，形成你自己的"模型选择指南"

**练习 4：完善错误处理**
1. 在 `04-error-handling.ts` 的基础上，添加超时处理
2. 实现一个"熔断器"模式：连续失败 5 次后暂停调用 60 秒
3. 添加详细的错误日志（时间戳、错误类型、重试次数）

**练习 5：运行贯穿项目**
1. 运行 `src/index.ts`，进行一段至少 5 轮的对话
2. 使用 `/history` 命令查看对话历史的增长
3. 观察 token 消耗随对话轮次的变化趋势
4. 尝试 `/clear` 清空历史后重新对话，感受区别

### 验收标准
- 能独立从零搭建 TypeScript + AI SDK 项目
- 能成功调用 DeepSeek API 并拿到回复
- 能解释 Provider 模式的原理和好处
- 能实现带重试的错误处理
- 能计算一次 API 调用的成本

### 挑战加分项
- 实现一个简单的"会话摘要"功能：当对话超过 10 轮时，自动用 LLM 总结前面的对话，替换掉原始历史
- 添加 `/cost` 命令，累计显示当前会话总共消耗了多少 token 和对应的美元成本
- 用 `streamText` 替换 `generateText`，实现逐字打印效果（预习下一章内容）
- 实现模型热切换：在对话中输入 `/model deepseek-flash` 切换模型

---

## 本章小结

1. **Vercel AI SDK 的核心价值是统一抽象**。它让你写一次代码就能切换任意模型提供商，就像 React 抹平了浏览器差异一样。在实际项目中，这种灵活性是必须的——你几乎不可能只用一个模型走天下。

2. **Provider 模式是优雅的适配器设计**。理解 Provider 的三层架构（Core → Interface → Implementation），能帮你在后续设计 Agent 架构时做出更好的决策。DeepSeek 兼容 OpenAI 格式这一点，也展示了"兼容标准"的实用价值。

3. **API 调用不只是"发请求拿回复"**。从请求构建、网络传输、排队等待、模型推理到响应解析，每个环节都可能出问题。完善的错误处理和重试机制不是"锦上添花"，而是生产级代码的基本要求。

4. **计费意识要从第一天建立**。输出 token 比输入贵 4-5 倍、中文比英文多消耗 50% token、对话历史会让成本指数增长——这些事实直接影响你的架构设计。

5. **从最简单的调用开始，逐步增加复杂度**。这一章我们从 `generateText` + 一句 prompt 开始，逐步加上了 system prompt、对话历史、错误处理、成本监控。下一章我们将加入流式响应，让用户体验从"等半天出结果"升级为"实时看到 AI 在打字"。
