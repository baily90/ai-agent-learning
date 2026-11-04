# 第30章：LiteLLM 与模型网关 — 多模型统一接入

## 引言

到现在为止，你的 agent 可能只接了一个模型（DeepSeek）。但真实项目里，你很快会面临这些需求：

- DeepSeek 挂了，自动切到通义千问
- 简单任务用便宜模型，复杂任务用贵模型（成本优化）
- 多个模型都想要统一的限流、成本统计、密钥管理

如果你在每个调模型的地方都写 `if (provider === 'deepseek') {...} else if (...) {...}`，代码会烂成一团。正确的做法是**加一层"模型网关"**——所有请求都经过它，由它统一路由、切换、记账。LiteLLM 就是干这个的开源工具。

> **🏭 实际项目怎么做**：LiteLLM 是**开源模型网关的事实标准**——一个配置统一接 100+ 模型（OpenAI、Claude、DeepSeek、通义、本地 Ollama…），提供 OpenAI 兼容接口、统一限流/成本追踪/密钥管理。生产里很多团队用它在"多模型 + 多环境"之间做统一调度。注意：**LiteLLM 本身是 Python 写的**（一个代理服务），但你不需要写 Python——它是独立服务，你的 TS 代码通过 HTTP（OpenAI 兼容接口）调用它。这正是"最佳实践受限时标注实际做法"的典型：网关是 Python 服务，但前端代码保持 TS，两者用 HTTP 解耦。

---

## 30.1 为什么需要模型网关

### 一句话直觉

模型网关之于多模型，就像**反向代理（Nginx）之于多服务器**——客户端只认一个入口，后面的路由、切换、负载均衡都交给它。

### 详细原理

没有网关时，你的代码直接和各家模型 API 耦合：

```
你的代码 ──→ DeepSeek API
你的代码 ──→ 通义 API
你的代码 ──→ OpenAI API   （三套不同的 key、baseURL、请求格式）
```

加了 LiteLLM 网关后：

```
你的代码 ──→ LiteLLM（唯一入口，OpenAI 兼容接口）──→ DeepSeek / 通义 / OpenAI / ...
```

你的代码永远只调**一个 baseURL**（网关地址），具体用哪个模型，是网关配置里的事。

### 前端类比

这就像你前端项目里的 **API 网关 / BFF 层**——前端只调 `/api`，后面路由到哪个微服务，前端不关心。好处是：**换后端、加服务、做降级，前端一行不用改**。模型网关对模型做的事，一模一样。

---

## 30.2 LiteLLM 是什么

### 一句话直觉

LiteLLM 是一个**跑在服务器上的代理**，对外暴露 OpenAI 兼容接口，对内用一份配置文件管理所有模型。

### 详细原理

它提供的能力：

1. **统一入口**：一个 baseURL + 一个 key，接所有模型
2. **统一密钥管理**：各家的 API key 只存在网关配置里，业务代码只拿网关的 key
3. **统一限流/成本追踪**：所有请求的 token、成本、QPS 在网关处统一统计
4. **自动 fallback**：主模型挂了自动切备用模型
5. **负载均衡**：多个 key / 多个模型之间分流
6. **OpenAI 兼容**：任何支持 OpenAI 接口的 SDK（包括 AI SDK）都能直接接它

---

## 30.3 配置与启动

### 一句话直觉

LiteLLM 的核心就是一份 `config.yaml`——你告诉它"有哪些模型、各自的 key 是什么、怎么路由"，然后起一个代理服务。

### 详细原理

**1. 写配置**

```yaml
# config.yaml
model_list:
  - model_name: gpt-4o                # 对外暴露的名字
    litellm_params:
      model: openai/gpt-4o            # 实际调用的模型
      api_key: sk-openai-xxx

  - model_name: deepseek-chat
    litellm_params:
      model: deepseek/deepseek-chat
      api_key: sk-deepseek-xxx

  - model_name: qwen-plus
    litellm_params:
      model: dashscope/qwen-plus
      api_key: sk-qwen-xxx

# 备用：主模型挂了自动切
router_settings:
  fallbacks:
    - {"deepseek-chat": ["qwen-plus"]}
```

**2. 用 Docker 起代理**

```bash
docker run -d \
  --name litellm \
  -p 4000:4000 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:main-latest \
  --config /app/config.yaml
```

起好后，网关就监听在 `http://localhost:4000`，对外提供 OpenAI 兼容接口。

> **坑点提醒**：LiteLLM 的镜像较大（因为要装各种 SDK），第一次拉取会久一点。配置里的 `model_name`（对外的名字）和 `model`（实际的 `provider/模型`）是两回事，别搞混。

---

## 30.4 接入 Vercel AI SDK：改一行 baseURL

### 一句话直觉

因为 LiteLLM 暴露的是 OpenAI 兼容接口，你的 AI SDK 代码几乎不用改——把 baseURL 指向网关，模型名换成配置里的 `model_name` 即可。

### 详细原理

```typescript
// 接入 LiteLLM 网关
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

// 网关地址（不再是 DeepSeek 官网，而是你的 LiteLLM）
const gateway = createOpenAICompatible({
  name: 'litellm',
  baseURL: 'http://localhost:4000/v1',   // LiteLLM 的 OpenAI 兼容接口
  apiKey: 'sk-litellm-master-key',        // 网关的 key，不是模型厂商的 key
});

const { text } = await generateText({
  model: gateway('deepseek-chat'),        // 用配置里的 model_name
  prompt: '你好',
});
```

**关键变化**：`apiKey` 从"各家模型厂商的 key"换成了"网关的 key"，`model` 从"真实模型"换成了"网关配置里的别名"。你的业务代码从此**和具体模型解耦**——切模型、加 fallback，都改配置，不碰代码。

### 深层追问

**这样加一层代理，会不会变慢？**

会有一点点额外延迟（多一跳网络，通常几毫秒到十几毫秒），但换来的收益（统一管理、自动降级、成本追踪）远超这点代价。就像你用 Nginx 加了一层反向代理——多一跳，但换来了负载均衡和统一入口。生产里这是标准做法。

---

## 30.5 统一成本追踪与密钥管理

### 一句话直觉

所有请求都经过网关，意味着**网关是所有模型流量的"收费站"**——token、成本、用量，一处看清。

### 详细原理

LiteLLM 的内置能力：

- **成本追踪**：每个请求按模型定价自动算成本，可在配置里接 Prometheus 等监控
- **密钥管理**：可以给不同团队/环境发不同的**虚拟 key**（`/key/generate`），每个 key 有自己的额度和权限，业务方永远接触不到厂商真实 key
- **限流**：按 key / 模型 / 时间窗口限流

这些能力对生产项目至关重要——**模型 API 的 key 一旦泄露，别人能刷爆你的账单**。网关把真实 key 锁在后端，只发虚拟 key，风险大大降低。

---

## 概念辨析

### LiteLLM vs 直接调模型

| | 直接调 | LiteLLM 网关 |
|---|---|---|
| 接多模型 | 各写各的 | 一份配置统一 |
| 密钥管理 | 散落在各服务 | 网关统一管理 + 虚拟 key |
| fallback/降级 | 自己写 if-else | 配置里声明 |
| 成本追踪 | 各算各的 | 统一统计 |
| 部署复杂度 | 无 | 多一个服务 |

### LiteLLM vs Portkey

| | LiteLLM | Portkey |
|---|---|---|
| 开源 | ✅ 开源自托管 | ❌ 商业 SaaS |
| 定位 | 开源网关 | 托管网关 + 更多企业功能 |
| 适合 | 想自己掌控、免费 | 不想运维、预算充足 |

---

## 灵魂拷问

> **Q1：我就用一个模型（DeepSeek），也需要网关吗？**

> **A：** 短期不用，长期值得。单模型时，网关的价值不明显——你的代码直接调 DeepSeek 就行。但一旦出现：**要接第二个模型**（比如换更强的模型做复杂任务）、**要防止单点故障**（DeepSeek 挂了要有兜底）、**要统一成本追踪和密钥管理**——网关的价值立刻显现。建议：**先直接调，等真的需要多模型/降级时再引入**，别为了"架构先进"提前上。

> **Q2：LiteLLM 是 Python 写的，我是前端，是不是就学不了了？**

> **A：** 完全学得了。记住关键认知：**LiteLLM 是一个独立服务，不是 Python 库**。你不需要写 Python 代码——用 Docker 起服务、写 YAML 配置、用 TS 代码通过 HTTP 调用它。这就像你用 Nginx（C 写的）做反向代理，你不需要会 C。**网关是基础设施，语言无关**，你的业务代码保持 TS 就行。

> **Q3：网关的 OpenAI 兼容接口，和直接调 DeepSeek 的接口有什么区别？**

> **A：** 对你（业务代码）来说，几乎没区别——都是 OpenAI 格式的 `/v1/chat/completions`，AI SDK 都能接。区别在于：**baseURL 指向网关**（而非厂商）、**key 是网关的虚拟 key**（而非厂商 key）、**model 是别名**（而非真实模型名）。这三处一改，你就从"绑定单个厂商"变成了"通过网关调度任意模型"。

> **Q4：fallback 是怎么工作的？DeepSeek 挂了会自动切吗？**

> **A：** 会。在 `router_settings.fallbacks` 里声明了 `{"deepseek-chat": ["qwen-plus"]}`，当 DeepSeek 请求失败（超时、报错、限流）时，LiteLLM 会自动把请求路由到 `qwen-plus`。你的业务代码无感知——请求照样成功返回，只是背后换了个模型。这正是网关相对"直接调"最实在的价值：**容灾能力是配置出来的，不是代码写出来的**。

---

## 最佳实践

### DO

- **DO** 需要多模型/降级/统一密钥管理时，引入 LiteLLM 网关
- **DO** 把真实厂商 key 只存在网关配置里，业务方只拿虚拟 key
- **DO** 在配置里声明 fallback，关键模型要有兜底
- **DO** 用网关统一做成本追踪，模型开销一处看清
- **DO** 业务代码保持 OpenAI 兼容调用，和具体模型解耦

### DON'T

- **DON'T** 单模型、无降级需求时，为了"架构先进"提前上网关
- **DON'T** 把厂商真实 key 散落在各个服务的代码/环境变量里
- **DON'T** 把 `model_name`（别名）和 `model`（真实模型）搞混
- **DON'T** 期望网关零延迟——多一跳有代价，但生产里值得
- **DON'T** 为了用 LiteLLM 去写 Python——它是服务不是库，YAML 配置 + HTTP 调用即可

---

## 代码实战

> **项目归属**：独立 demo。依赖：`ai`、`@ai-sdk/openai-compatible`、`dotenv`。先按 30.3 用 Docker 起 LiteLLM，`.env` 配 `LITELLM_BASEURL`、`LITELLM_KEY`。

### 一：网关配置（config.yaml）

```yaml
# config.yaml
model_list:
  - model_name: deepseek-chat
    litellm_params:
      model: deepseek/deepseek-chat
      api_key: sk-deepseek-xxx
  - model_name: qwen-plus
    litellm_params:
      model: dashscope/qwen-plus
      api_key: sk-qwen-xxx

router_settings:
  fallbacks:
    - {"deepseek-chat": ["qwen-plus"]}
```

### 二：TS 接入网关

```typescript
// 30-gateway.ts
import 'dotenv/config';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

// 唯一的入口：LiteLLM 网关
const gateway = createOpenAICompatible({
  name: 'litellm',
  baseURL: process.env.LITELLM_BASEURL!,   // http://localhost:4000/v1
  apiKey: process.env.LITELLM_KEY!,        // 网关虚拟 key
});

async function ask(modelName: string, prompt: string) {
  const { text } = await generateText({
    model: gateway(modelName),             // 用配置里的 model_name 别名
    prompt,
  });
  console.log(`[${modelName}] ${text}`);
  return text;
}

// 业务代码完全不关心背后是哪个厂商
await ask('deepseek-chat', '用一句话介绍你自己');
await ask('qwen-plus', '用一句话介绍你自己');
```

### 三：验证 fallback（可选）

把 `config.yaml` 里 deepseek 的 key 故意写错，再调 `ask('deepseek-chat', ...)`——LiteLLM 会自动 fallback 到 `qwen-plus`，你的代码无感知，请求照样成功。

---

## 实操练习

### 目标

起一个 LiteLLM 网关，让你的 agent 通过它接入至少两个模型，并验证 fallback。

### 步骤

1. 用 Docker 起 LiteLLM，配置 DeepSeek + 通义两个模型
2. 写 `30-gateway.ts`，通过网关分别调两个模型
3. 在配置里声明 fallback，故意让主模型失败，验证自动切换
4. 用 `curl http://localhost:4000/v1/models` 查看网关暴露的模型列表

### 验收标准

- [ ] 网关成功启动，`/v1/models` 能看到配置的模型
- [ ] TS 代码通过网关调通两个模型
- [ ] fallback 生效：主模型失败后自动切备用，代码无感知
- [ ] 业务代码里没有任何厂商真实 key

### 挑战加分项

- [ ] 给不同环境生成不同的虚拟 key（`/key/generate`），验证额度隔离
- [ ] 在配置里加一个本地 Ollama 模型，验证"云端 + 本地"混合调度

---

## 本章小结

1. **模型网关 = 多模型的统一入口**，客户端只认一个 baseURL，路由/切换/记账交给网关。

2. **LiteLLM 是开源网关事实标准**：一份 config 接 100+ 模型，OpenAI 兼容接口，统一限流/成本/密钥管理。

3. **它是服务不是库**：Python 实现，但你是前端也完全能用——Docker 起服务 + YAML 配置 + TS 通过 HTTP 调用，语言无关。

4. **接入 AI SDK 只改三处**：baseURL 指向网关、key 换成虚拟 key、model 换成别名，业务代码与具体模型解耦。

5. **fallback 是配置出来的**：主模型挂了自动切备用，业务无感知。

6. **别提前上**：单模型、无降级需求时直接调即可，需要多模型/容灾/统一管理时再引入网关。
