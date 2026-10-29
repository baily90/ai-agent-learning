# 可观测性实战 Lab：AI SDK 7 + DeepSeek → Langfuse

> 配套《第 22 章 · 可观测性与调试》。本章解决一个具体问题：**怎么把"观测"真正接进自己的 AI SDK 项目，看到一条真实的 trace，并学会对着它排查问题。**

概念在文档里读，代码在这里跑。

## 这个 Lab 解决什么

资料第 22 章把观测方式（Tracing / 日志 / 回放 / 工具平台）和工具优缺点都讲清楚了，但"怎么接进 AI SDK 7 项目"这一步断了。这个 lab 补齐它：

- 一个 AI SDK 7 + DeepSeek 的**最小 Agent**（带天气、日期两个工具）
- 用 `@langfuse/vercel-ai-sdk` **一行接入 Langfuse**，跑通后能看到真实 trace 树
- 附带一个"故意埋 bug 练排查"的挑战

## 目录结构

```
observability/
├── src/
│   ├── instrumentation.ts   # 注册 Langfuse 观测（核心，就十几行）
│   ├── tools.ts             # Agent 可调用的工具
│   ├── agent.ts             # AI SDK 7 + DeepSeek 的 Agent
│   └── index.ts             # 入口
├── docker-compose.yml       # Langfuse 本地自托管（官方完整版）
├── .env.example             # 配置模板（复制成 .env 填入你的 key）
├── package.json
└── tsconfig.json
```

## 前置要求

- Node.js ≥ 22（`node -v` 确认）
- Docker + Docker Compose（本地起 Langfuse 用）
- 一个 DeepSeek API Key

## 三步跑起来

### 第 1 步：配置密钥

```bash
cp .env.example .env
```

编辑 `.env`，填入你的 `DEEPSEEK_API_KEY`。

> `.env` 已被 `.gitignore` 排除，**不会提交到仓库**。Langfuse 的 key 是本地自托管的固定开发值，无需改动。

### 第 2 步：起本地 Langfuse

```bash
npm run langfuse:up        # 等价于 docker compose up -d
```

首次会拉取镜像（约几分钟），之后打开 <http://localhost:3000> 能看到 Langfuse UI。

> 首次启动时，`docker-compose.yml` 里的 `LANGFUSE_INIT_*` 会自动建好组织/项目/API key/用户，无需注册。登录账号就是 `.env` 里的 `dev@local.dev` / `dev-password-123`。

### 第 3 步：跑 Agent

```bash
npm install
npm run ask "北京今天天气怎么样？适合出门吗？"
```

控制台会打印 Agent 的回答。然后打开 Langfuse UI，点进这次 trace，你会看到：

- 一次完整的 **trace 树**：`generateText` → 第一次 LLM 调用（决定调工具）→ `getWeather` 工具执行 → 第二次 LLM 调用（基于结果回答）
- 每个 span 的**延迟、token 用量、成本、输入输出**

## 对着 trace 练排查（挑战）

1. 打开 `src/tools.ts`，把 `getWeather` 的 `description` 改成一个**含糊的描述**（比如只写 `"一个工具"`）
2. 重新跑 `npm run ask "北京今天天气怎么样？"`
3. 观察：AI 这次还会正确调用 `getWeather` 吗？
4. 回到 Langfuse，对比两次 trace，**看 AI 的决策差异体现在哪个 span**

这比读十遍"工具描述很重要"都管用——你亲眼看到了描述如何改变 AI 的行为。

## 关掉 Langfuse

```bash
npm run langfuse:down       # 停掉容器，数据保留在 volume 里
```

## 想用 Langfuse Cloud 代替本地？

不想跑 Docker 的话，去 <https://cloud.langfuse.com> 注册（免费），在项目设置里拿到 Public/Secret Key，填到 `.env` 的 `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`，并把 `LANGFUSE_BASEURL` 改成 `https://cloud.langfuse.com`。代码完全不用改。

## 关键文件速览

`instrumentation.ts` 是核心，全貌就这三件事：

```ts
const sdk = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
sdk.start();
registerTelemetry(new LangfuseVercelAiSdkIntegration());
```

注册完之后，`agent.ts` 里的 `generateText` **什么都不用改**，trace 自动上报——这正是 AI SDK 7 观测"零侵入"的地方。
