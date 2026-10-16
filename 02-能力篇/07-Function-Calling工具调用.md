# 第7章：Function Calling / Tool Use — Agent 的核心：让 AI 调用工具

## 引言

想象你雇了一个绝顶聪明的顾问。他读过所有的书，能写出精彩的分析报告，能用十种语言对话。但有个问题——他被锁在一个没有窗户的房间里。你问他"现在外面几度"，他只能说"根据这个季节，大概 15-20 度吧"。你让他帮你订个会议室，他只能说"你应该发一封邮件给行政部"。

这就是纯粹的 LLM——一个极其聪明，但**只能动嘴、不能动手**的存在。

现在，假设你在房间墙上开了几个洞，每个洞后面连着一个功能：一个连温度计，一个连日历系统，一个连数据库。顾问不需要自己去操作这些系统，他只需要把手伸进正确的洞里，告诉外面的人"帮我查一下北京的温度"，然后等结果传回来。

这就是 **Function Calling / Tool Use**。它不是让 AI 变得万能，而是给 AI 开了几个**标准化的接口**，让它能和外部世界交互。

这一章，是从"聊天机器人"走向"AI Agent"的**分水岭**。如果你只能深入理解一章，就是这一章。

---

## 7.1 为什么 AI 需要工具

**一句话直觉**：LLM 只会生成文字，工具让它能"做事"。

### LLM 的能力边界

让我们先冷静审视一下 LLM 到底能做什么、不能做什么：

| 能做 | 不能做 |
|------|--------|
| 理解自然语言 | 访问实时数据（天气、股价、新闻） |
| 生成文本、代码 | 执行代码或操作 |
| 推理和分析 | 读写数据库 |
| 翻译和总结 | 发送邮件、消息 |
| 基于训练数据回答问题 | 访问你的私有数据 |

关键在于：LLM 的训练数据有截止日期，而且它**没有任何执行能力**。它生成的所有内容都是"文本"——即使看起来像代码，那也只是文本，不是程序在执行。

### 前端类比：浏览器的 JavaScript 引擎

这个限制，前端开发者应该非常熟悉。

浏览器里的 JavaScript 引擎（V8）本身能做什么？它能执行计算、操作数据结构、运行逻辑。但它**不能**直接发网络请求、**不能**操作文件系统、**不能**访问摄像头。

这些能力是怎么来的？是浏览器提供的 **Web API**：

```
JavaScript 引擎自身能力        浏览器提供的"工具"
├── 变量和计算                ├── fetch() → 网络请求
├── 函数和闭包                ├── DOM API → 操作页面
├── Promise 和异步            ├── localStorage → 持久化
├── 数组和对象操作             ├── navigator.geolocation → 定位
└── 字符串处理                └── WebSocket → 实时通信
```

LLM 和 JavaScript 引擎的处境一模一样：**核心引擎很强大，但需要"宿主环境"提供额外能力**。Tool Use 就是 LLM 的 Web API。

### 没有工具的 AI 只能是什么？

没有工具的 AI，本质上是一个**只读的、有截止日期的知识库**，加上一个**文本生成器**。你可以和它聊天、让它写文案、做翻译、分析文本。但它做不了任何需要和外部世界交互的事情。

这就是为什么说 Tool Use 是 Agent 的核心——**Agent 的定义就是能感知环境并采取行动的系统**。没有工具，AI 既不能感知实时环境，也不能采取行动。它只是一个聊天机器人（Chatbot），而不是 Agent。

---

## 7.2 Function Calling 的本质：AI 不是在"调用"函数

**一句话直觉**：AI 只是说了一句"我想调这个函数"，真正动手的是你的代码。

这个理解**至关重要**，是很多初学者的认知盲区。

### AI 到底做了什么？

当我们说"AI 调用了一个工具"时，实际发生的事情是：

1. AI 分析用户的问题
2. AI 决定需要使用某个工具
3. AI **生成了一段结构化数据**，表达"我想调用 `getWeather` 函数，参数是 `{ city: '北京' }`"
4. **完了，AI 的工作到此结束**

真正执行 `getWeather('北京')` 的是**你的代码**。AI 只是一个"决策者"，它决定调什么、传什么参数，但它**一行代码都不会执行**。

这就像一个产品经理写了一个需求文档："用户点击按钮后，调用 `/api/weather` 接口，传入城市参数"。产品经理自己不会写代码，但他准确地描述了**要做什么**。而你（开发者），才是真正实现这个需求的人。

### 前端类比：React 的事件系统

这个模式前端开发者太熟悉了——React 的合成事件（SyntheticEvent）。

当你写 `<button onClick={handleClick}>` 时，点击按钮后：

1. 浏览器捕获到原生 click 事件
2. React **拦截**了这个事件（事件代理）
3. React 创建一个 SyntheticEvent 对象
4. React **调用你注册的 handleClick**
5. 你的代码执行实际逻辑

用户的点击并不是直接触发了 `handleClick`。中间有 React 这一层在做调度。

Function Calling 完全一样：

```
React 事件系统                    Function Calling
用户点击按钮                      用户发送消息
  ↓                               ↓
React 拦截事件                    AI 分析后决定调用工具
  ↓                               ↓
创建 SyntheticEvent              生成 tool_call 结构化数据
  ↓                               ↓
调用你的 handleClick              你的代码执行对应函数
  ↓                               ↓
处理结果，更新 UI                 把结果传回 AI，生成回复
```

**核心思想**：AI 是调度者，不是执行者。你的代码才是执行者。这意味着：

- **安全可控**：所有实际操作都经过你的代码，你可以加任何验证和权限检查
- **灵活实现**：AI 只关心接口定义，你可以随意更换底层实现
- **可靠执行**：不用担心 AI "跑飞了"去执行危险操作——因为它根本不能执行

---

## 7.3 Tool 定义详解：告诉 AI "你有哪些工具可用"

**一句话直觉**：Tool 定义就是给 AI 看的"API 文档"。

### 工具定义的三要素

在 Vercel AI SDK 中，定义一个工具需要三个核心要素：

| 要素 | 作用 | 类比 |
|------|------|------|
| `name` | 工具的唯一标识符 | REST API 的路由路径 `/api/weather` |
| `description` | 告诉 AI 这个工具做什么、什么时候该用 | API 文档里的接口说明 |
| `parameters` | 工具需要什么输入参数 | 请求参数的 Schema（类似 Swagger） |

Vercel AI SDK 使用 **Zod** 来定义参数 Schema，这对 TypeScript 开发者来说再自然不过了——我们已经习惯用 Zod 做表单验证、API 参数校验了。

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: '根据城市名获取该城市当前的天气信息，返回温度、湿度和天气状况',
  inputSchema: z.object({
    city: z.string().describe('要查询天气的城市名称，例如：北京、上海、广州'),
    unit: z.enum(['celsius', 'fahrenheit']).optional()
      .describe('温度单位，默认摄氏度'),
  }),
  execute: async ({ city, unit }) => {
    // 这里是你的代码，调用真正的天气 API
    const response = await fetch(
      `https://api.weather.com/current?city=${city}&unit=${unit ?? 'celsius'}`
    );
    return response.json();
  },
});
```

### description 为什么如此重要？

这里有一个关键认知：**description 不是给人看的文档，是给 AI 看的"使用说明书"**。AI 完全根据 description 来决定：

1. **什么时候**该使用这个工具（而不是自己回答）
2. **怎么**传递参数
3. **期望**得到什么结果

来看两个 description 的对比：

```typescript
// 差的 description
const badTool = tool({
  description: '获取天气',
  inputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ city }) => { /* ... */ },
});

// 好的 description
const goodTool = tool({
  description: '根据城市名获取该城市当前的实时天气信息。返回数据包括：温度（摄氏度）、湿度（百分比）、天气状况描述（如晴、多云、雨等）和风速。当用户询问任何与天气、气温、穿衣建议相关的问题时，应使用此工具获取实时数据，而不是依赖训练数据中的过时信息。',
  inputSchema: z.object({
    city: z.string().describe('要查询天气的城市名称，例如：北京、上海、广州。支持中文城市名。'),
  }),
  execute: async ({ city }) => { /* ... */ },
});
```

差的 description 会导致什么问题？

- 用户说"北京冷不冷"，AI 可能不知道该调工具（因为 description 没提到温度相关场景）
- AI 不知道返回值是什么格式，可能错误地解读结果
- AI 不知道传什么参数（"北京"还是"Beijing"？"北京市"可以吗？）

好的 description 就像一份完善的 API 文档：描述了功能、入参、出参、适用场景，甚至给出了参数示例。

### 参数的 describe 也很关键

不只是工具整体需要 description，**每个参数也需要**。Zod 的 `.describe()` 方法就是为这个场景设计的：

```typescript
inputSchema: z.object({
  query: z.string().describe('搜索关键词，支持自然语言'),
  maxResults: z.number().min(1).max(50).optional()
    .describe('返回结果的最大数量，默认10，最大50'),
  category: z.enum(['tech', 'business', 'science'])
    .describe('搜索的领域分类'),
})
```

类比：这就像 TypeScript 的 JSDoc 注释。虽然类型定义已经约束了参数格式，但注释让使用者（这里是 AI）更精确地理解每个参数的含义和用法。

---

## 7.4 调用循环（Tool Call Loop）：Agent 的心跳

**一句话直觉**：工具调用不是一次性的请求-响应，而是一个多轮的循环对话。

### 完整的调用流程

这是 Function Calling 最核心的流程，理解了它，你就理解了 Agent 的运作机制。我们一步步来看：

```
┌──────────────────────────────────────────────────────────┐
│                    Tool Call Loop                         │
│                                                          │
│   用户: "北京今天天气怎么样？"                              │
│     │                                                    │
│     ▼                                                    │
│   ┌─────────────┐                                        │
│   │  AI 模型思考  │ ← "用户问天气，我有 getWeather 工具"     │
│   └─────┬───────┘                                        │
│         │ 返回 tool_call                                  │
│         ▼                                                │
│   ┌─────────────────────────────────┐                    │
│   │ tool_call: {                    │                    │
│   │   name: "getWeather",           │                    │
│   │   arguments: { city: "北京" }    │                    │
│   │ }                               │                    │
│   └─────────────┬───────────────────┘                    │
│                 │ 你的代码接收并执行                        │
│                 ▼                                        │
│   ┌─────────────────────────────────┐                    │
│   │ 执行 getWeather("北京")          │                    │
│   │ → 调用天气 API                   │                    │
│   │ → 得到结果: { temp: 22, ... }    │                    │
│   └─────────────┬───────────────────┘                    │
│                 │ 把结果传回给 AI                          │
│                 ▼                                        │
│   ┌─────────────┐                                        │
│   │  AI 模型思考  │ ← "有了天气数据，现在可以回答了"          │
│   └─────┬───────┘                                        │
│         │ 生成最终文本回复                                  │
│         ▼                                                │
│   AI: "北京今天22°C，晴天，湿度45%，                       │
│        很适合户外活动！"                                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 前端类比：React 的 useEffect 数据获取模式

这个循环，和 React 中一个经典模式惊人地相似：

```typescript
// React 组件的数据获取循环
function WeatherPage({ city }) {
  const [weather, setWeather] = useState(null);  // 初始没有数据
  
  useEffect(() => {
    // 1. 组件"决定"需要获取数据（类似 AI 决定调用工具）
    fetch(`/api/weather?city=${city}`)          
      // 2. 执行实际的 API 调用（类似你的代码执行工具）
      .then(res => res.json())                  
      // 3. 数据回来了，更新状态（类似结果传回 AI）
      .then(data => setWeather(data));           
    // 4. 组件重新渲染，展示数据（类似 AI 基于结果生成回复）
  }, [city]);
  
  return weather ? <WeatherCard data={weather} /> : <Loading />;
}
```

对比一下：

| React useEffect | Tool Call Loop |
|----------------|----------------|
| 组件渲染，发现需要数据 | AI 分析用户消息，发现需要工具 |
| 发起 fetch 请求 | AI 返回 tool_call |
| 后端处理请求，返回数据 | 你的代码执行工具，得到结果 |
| 数据回来，setState 触发重渲染 | 结果传回 AI，AI 生成最终回复 |

### 循环不只一轮

关键点来了：这个循环**可以重复多次**。AI 可能在一次对话中调用多个工具，或者根据第一个工具的结果决定再调用另一个工具。

```
用户: "帮我安排明天下午的行程，考虑天气情况"

AI 思考 → 调用 getWeather("北京", "明天")
         ↓ 得到结果：明天有雨
AI 思考 → 调用 getCalendar("明天下午")
         ↓ 得到结果：14:00 有会议，其他时间空闲
AI 思考 → 调用 searchIndoorActivities("北京")
         ↓ 得到结果：附近有展览、电影等
AI 最终回复: "明天北京有雨，你下午14:00有会议。建议会议结束后
             去国家博物馆看新展览，室内活动不受天气影响。"
```

AI 自主决定了需要三个工具、调用顺序是什么、每次用什么参数。这就是 **Agent 的自主决策能力**。

### 底层的消息格式

了解底层发生了什么有助于深入理解。在 API 层面，Tool Call Loop 本质上是多轮消息交换：

```typescript
// 第一轮：用户提问
messages: [
  { role: 'user', content: '北京今天天气怎么样？' }
]

// AI 返回的不是 text，而是 tool_call
// response.choices[0].message:
{
  role: 'assistant',
  content: null,  // 注意：没有文本内容！
  tool_calls: [{
    id: 'call_abc123',
    type: 'function',
    function: {
      name: 'getWeather',
      arguments: '{"city": "北京"}'  // JSON 字符串
    }
  }]
}

// 第二轮：把工具结果传回去
messages: [
  { role: 'user', content: '北京今天天气怎么样？' },
  { role: 'assistant', tool_calls: [/* 上面的 tool_call */] },
  { role: 'tool', tool_call_id: 'call_abc123', 
    content: '{"temp": 22, "humidity": 45, "condition": "晴"}' }
]

// AI 最终返回文本回复
// response.choices[0].message:
{
  role: 'assistant',
  content: '北京今天22°C，晴天，湿度45%...'
}
```

注意那个 `tool_call_id`——它用来**匹配请求和响应**。如果 AI 同时调用了多个工具，每个工具结果需要通过 ID 和对应的 tool_call 关联起来。

### Vercel AI SDK 帮你封装了循环

好消息是，Vercel AI SDK 的 `generateText` 和 `streamText` 帮你处理了整个循环，你不需要手动管理消息来回传递：

```typescript
import { generateText, isStepCount } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';

const result = await generateText({
  model: deepseek('deepseek-chat'),
  tools: { getWeather: weatherTool },
  stopWhen: isStepCount(5),  // 最多循环 5 次
  prompt: '北京今天天气怎么样？',
});

// result.text 已经是最终的文本回复
// result.steps 包含了每一步的详细信息（调了什么工具、结果是什么）
console.log(result.text);
console.log(result.steps); // 调试用：查看完整的调用链
```

`stopWhen` 是一个重要参数。SDK 会自动执行循环：AI 返回 tool_call → 执行工具 → 结果传回 → AI 继续思考。每个来回算一个 step。当 AI 最终返回文本而不是 tool_call，或者达到 `stopWhen` 限制，循环结束。

---

## 7.5 多工具注册：AI 自主选择工具

**一句话直觉**：给 AI 一个工具箱，它自己决定用哪把螺丝刀。

### 从单工具到多工具

当你注册多个工具时，AI 会根据用户的问题**自主决定**：
- 用哪个工具（或哪几个）
- 不用任何工具（直接用知识回答）
- 工具的调用顺序

这就是从"聊天机器人"到"Agent"的**关键跨越**。聊天机器人只能被动回答问题；而拥有多个工具的 AI，能够**主动选择行动方案**。

```typescript
import { generateText, tool, isStepCount } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { z } from 'zod';

const result = await generateText({
  model: deepseek('deepseek-chat'),
  tools: {
    // 工具 1：查天气
    getWeather: tool({
      description: '获取指定城市的实时天气信息',
      inputSchema: z.object({
        city: z.string().describe('城市名称'),
      }),
      execute: async ({ city }) => {
        return await fetchWeather(city);
      },
    }),

    // 工具 2：查日程
    getCalendar: tool({
      description: '获取用户在指定日期的日程安排',
      inputSchema: z.object({
        date: z.string().describe('日期，格式 YYYY-MM-DD'),
      }),
      execute: async ({ date }) => {
        return await fetchCalendar(date);
      },
    }),

    // 工具 3：搜索
    search: tool({
      description: '搜索互联网上的实时信息，当其他工具无法满足需求时使用',
      inputSchema: z.object({
        query: z.string().describe('搜索关键词'),
      }),
      execute: async ({ query }) => {
        return await webSearch(query);
      },
    }),

    // 工具 4：发送消息
    sendMessage: tool({
      description: '向指定用户发送消息通知',
      inputSchema: z.object({
        to: z.string().describe('接收者的用户名或邮箱'),
        content: z.string().describe('消息内容'),
      }),
      execute: async ({ to, content }) => {
        return await sendNotification(to, content);
      },
    }),
  },
  stopWhen: isStepCount(10),
  prompt: userMessage,
});
```

不同的用户消息，AI 会做出不同的工具选择：

| 用户消息 | AI 的决策 |
|---------|----------|
| "你好" | 不调用任何工具，直接回复 |
| "北京天气怎么样" | 调用 getWeather |
| "我明天有什么安排" | 调用 getCalendar |
| "明天去北京出差，帮我看看天气和日程" | 先调 getWeather，再调 getCalendar |
| "查下最新的 React 19 特性" | 调用 search |
| "告诉小王明天会议改到下午3点" | 调用 sendMessage |

### 前端类比：路由匹配

AI 选择工具的过程，很像前端框架的路由匹配：

```typescript
// Next.js App Router
app/
├── api/weather/route.ts     // 匹配 /api/weather
├── api/calendar/route.ts    // 匹配 /api/calendar
├── api/search/route.ts      // 匹配 /api/search
└── api/message/route.ts     // 匹配 /api/message
```

请求进来时，路由系统根据 URL pattern 决定交给哪个 handler。AI 根据用户意图 + 工具 description "路由"到正确的工具。区别在于：路由匹配是精确的模式匹配，而 AI 的工具选择是**语义理解**。用户不需要说"调用 getWeather 函数"，只需要说"北京冷不冷"。

---

## 7.6 并行工具调用

**一句话直觉**：AI 说"我同时需要这两个结果"，你的代码用 `Promise.all` 并行执行。

有些场景下，AI 在一次回复中会返回**多个** tool_call。比如用户说"帮我查北京和上海的天气"，AI 可能同时发出两个 `getWeather` 调用：

```typescript
// AI 返回的 tool_calls 数组可能包含多个调用
tool_calls: [
  { id: 'call_1', function: { name: 'getWeather', arguments: '{"city":"北京"}' } },
  { id: 'call_2', function: { name: 'getWeather', arguments: '{"city":"上海"}' } },
]
```

在 Vercel AI SDK 中，SDK 会自动并行执行这些工具调用，你不需要手动处理。但理解背后发生了什么很重要：

```typescript
// SDK 内部大致的处理逻辑
const toolResults = await Promise.all(
  toolCalls.map(async (tc) => {
    const tool = tools[tc.function.name];
    const args = JSON.parse(tc.function.arguments);
    const result = await tool.execute(args);
    return { toolCallId: tc.id, result };
  })
);
```

这就是标准的前端并发模式。多个独立的异步操作，用 `Promise.all` 并行执行，比串行快得多。

### 什么时候会触发并行调用？

通常在以下场景：

1. **相同工具，不同参数**："查北京和上海的天气" → 两次 getWeather
2. **不同工具，相互独立**："查明天天气和日程" → getWeather + getCalendar
3. **批量操作**："帮我给小王、小李、小张都发消息" → 三次 sendMessage

AI 会自行判断哪些调用可以并行（互不依赖），哪些必须串行（后一个依赖前一个的结果）。

---

## 7.7 工具结果的处理：成功、失败和异常

**一句话直觉**：工具返回值就是 AI 的"眼睛看到的东西"，格式和错误处理直接影响 AI 的判断。

### 返回格式

工具的 `execute` 函数返回的值会被序列化为字符串传回给 AI。AI 会基于这个返回值来生成回复。所以返回什么、怎么返回，直接影响 AI 的回答质量。

```typescript
// 好的返回格式：结构清晰，包含足够信息
execute: async ({ city }) => {
  const data = await fetchWeather(city);
  return {
    city: data.city,
    temperature: data.temp,
    unit: 'celsius',
    humidity: data.humidity,
    condition: data.condition,
    updatedAt: data.timestamp,
  };
}

// 差的返回格式：信息不足，AI 无法给出好的回答
execute: async ({ city }) => {
  const data = await fetchWeather(city);
  return data.temp;  // 只返回一个数字，AI 不知道单位、不知道其他信息
}
```

### 错误处理：让 AI 知道工具"失败了"

这是很多教程忽略的关键点。工具调用可能失败——网络错误、参数无效、权限不足。**你需要让 AI 知道发生了错误**，这样它才能正确应对。

```typescript
execute: async ({ city }) => {
  try {
    const data = await fetchWeather(city);
    return {
      success: true,
      data: {
        temperature: data.temp,
        condition: data.condition,
      },
    };
  } catch (error) {
    // 不要抛出异常，而是返回错误信息
    // 这样 AI 可以基于错误信息做出决策
    return {
      success: false,
      error: `无法获取 ${city} 的天气数据：${error.message}`,
      suggestion: '可以尝试检查城市名是否正确，或稍后重试',
    };
  }
}
```

为什么不直接 throw？因为如果你的工具函数抛出异常，取决于 SDK 的处理方式，AI 可能收到一个含义不明的错误信息，或者循环直接中断。**主动返回结构化的错误信息**，让 AI 有能力：

1. 向用户解释发生了什么
2. 决定是否重试
3. 尝试换一种方式解决问题

```
用户: "查一下 Gotham City 的天气"

AI 调用: getWeather({ city: "Gotham City" })
工具返回: { success: false, error: "找不到城市：Gotham City" }

AI 回复: "抱歉，没有找到 Gotham City 的天气数据。
         这可能是因为城市名不在数据库中。
         您想查询哪个真实城市的天气呢？"
```

如果工具直接 throw，AI 可能只能说"发生了错误"。但通过结构化的错误返回，AI 能给出有意义的回复。

### 前端类比：API 错误处理的最佳实践

这和前端处理后端 API 错误是一个道理：

```typescript
// 差的做法：只靠 HTTP 状态码
try {
  const res = await fetch('/api/weather');
  const data = await res.json();
} catch (e) {
  showToast('出错了');  // 用户不知道怎么回事
}

// 好的做法：后端返回结构化错误，前端精确处理
const res = await fetch('/api/weather');
const data = await res.json();
if (!data.success) {
  switch (data.errorCode) {
    case 'CITY_NOT_FOUND': showToast('找不到该城市'); break;
    case 'RATE_LIMITED': showToast('请求太频繁，请稍后重试'); break;
    default: showToast(data.message);
  }
}
```

给 AI 的工具错误处理也是一样的——**结构化、有意义、可操作**。

---

## 7.8 stopWhen：防止无限循环

**一句话直觉**：就像 React 的 `useEffect` 需要依赖数组来防止无限循环，Tool Call 需要 `stopWhen` 来设定上限。

### 为什么需要限制？

Tool Call Loop 可以多轮执行——AI 调工具 → 看结果 → 再调工具。但如果没有限制，理论上可能出现：

1. **AI 陷入循环**：工具返回的结果让 AI 觉得需要再调一次，无限往复
2. **成本失控**：每一轮都是一次 API 调用（消耗 Token），无限循环意味着无限费用
3. **响应时间爆炸**：每轮都有网络延迟，10 轮循环可能让用户等 30 秒以上

```typescript
import { deepseek } from '@ai-sdk/deepseek';

const result = await generateText({
  model: deepseek('deepseek-chat'),
  tools: { /* ... */ },
  stopWhen: isStepCount(5),  // 最多 5 个步骤（包括工具调用和最终回复）
  prompt: '...',
});
```

### stopWhen 的含义

`stopWhen` 限制的是整个交互中的**步骤数**。一个步骤可以是：
- AI 做出一次工具调用（可能包含多个并行调用）
- AI 生成最终的文本回复

所以 `stopWhen: isStepCount(5)` 意味着 AI 最多可以进行 4 次工具调用 + 1 次最终回复，或者更少的工具调用。

### 如何设定合理的 stopWhen？

| 场景 | 推荐 stopWhen | 原因 |
|------|---------------|------|
| 简单查询（查天气、查汇率） | 2-3 | 一次工具调用 + 回复就够了 |
| 多步查询（查天气+查日程+建议） | 5-8 | 需要调用多个工具并综合 |
| 复杂 Agent 任务（规划+执行+验证） | 10-15 | 需要多轮决策和执行 |
| 自动化工作流 | 15-25 | 可能涉及很多步骤 |

原则：**够用就行，宁少勿多**。可以在测试中观察实际需要的步骤数，然后设定一个合理的上限加上缓冲。

```typescript
// 还可以监听每一步的执行，做日志或中断
import { deepseek } from '@ai-sdk/deepseek';

const result = await generateText({
  model: deepseek('deepseek-chat'),
  tools: { /* ... */ },
  stopWhen: isStepCount(10),
  onStepEnd: ({ text, toolCalls, toolResults, finishReason, usage }) => {
    console.log('Step completed:', {
      hasToolCalls: toolCalls.length > 0,
      toolNames: toolCalls.map(tc => tc.toolName),
      tokensUsed: usage.totalTokens,
    });
  },
  prompt: '...',
});
```

---

## 7.9 工具设计原则：像设计 REST API 一样设计工具

**一句话直觉**：好的工具设计和好的 API 设计遵循完全相同的原则。

### 七大设计原则

**1. 单一职责 — 一个工具做一件事**

```typescript
// 差：一个工具做太多事
const superTool = tool({
  description: '查天气、查日程、发消息、搜索',
  // AI 不知道什么时候该用这个工具的哪个功能
});

// 好：拆分为独立的工具
const getWeather = tool({ description: '获取天气', /* ... */ });
const getCalendar = tool({ description: '获取日程', /* ... */ });
const sendMessage = tool({ description: '发送消息', /* ... */ });
```

类比：这就是 Unix 哲学——每个命令做一件事，通过管道组合。也是 React 组件的"单一职责原则"。

**2. 命名要语义化**

```typescript
// 差
tools: { fn1: ..., fn2: ..., doStuff: ... }

// 好
tools: { getWeather: ..., searchDocuments: ..., sendEmail: ... }
```

工具名是 AI 选择工具的第一线索。就像好的函数命名一样，应该一眼看出是做什么的。推荐使用 `动词 + 名词` 的模式：`getWeather`、`createTask`、`searchDocuments`、`sendMessage`。

**3. 参数设计要严格**

利用 Zod 的全部能力来约束参数：

```typescript
inputSchema: z.object({
  // 用 enum 限制可选值
  priority: z.enum(['low', 'medium', 'high']),
  // 用 min/max 限制范围
  limit: z.number().min(1).max(100),
  // 用 optional 标明可选参数
  category: z.string().optional(),
  // 用 default 提供默认值
  format: z.enum(['json', 'text']).default('json'),
})
```

**4. 返回值要结构化且一致**

所有工具采用一致的返回格式：

```typescript
// 统一的返回格式
type ToolResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    source: string;
    timestamp: string;
    cached: boolean;
  };
};
```

**5. 幂等性 — 相同输入，相同输出**

查询类工具天然幂等。操作类工具要特别注意：

```typescript
// 非幂等：每次调用都发一封邮件（可能重复发送）
const sendEmail = tool({
  execute: async ({ to, subject, body }) => {
    await emailService.send(to, subject, body);
  },
});

// 幂等：先检查是否已发送
const sendEmail = tool({
  execute: async ({ to, subject, body, idempotencyKey }) => {
    const existing = await db.findEmail(idempotencyKey);
    if (existing) return { success: true, message: '邮件已发送过', id: existing.id };
    const result = await emailService.send(to, subject, body);
    await db.saveEmail(idempotencyKey, result);
    return { success: true, id: result.id };
  },
});
```

类比：REST API 中 GET 是幂等的，POST 不是。PUT 设计为幂等的。工具设计也要考虑这个问题，因为 AI 可能因为各种原因重复调用同一个工具。

**6. 工具数量要克制**

工具数量和 AI 选择准确率的关系大致如下：

```
工具数量    选择准确率    类比
1-5 个     非常高       一个小工具箱，一眼找到需要的
6-15 个    比较高       一个工具架，稍微找找就行
16-30 个   开始下降     一个大工具房，偶尔拿错
30-100 个  明显下降     一个仓库，经常找不到或拿错
100+ 个    不可靠       一个垃圾场
```

当工具太多时，应该考虑**分层架构**：

```typescript
// 方案 1：按场景动态加载工具
function getToolsForContext(userMessage: string): Record<string, Tool> {
  if (isWeatherRelated(userMessage)) return weatherTools;
  if (isCalendarRelated(userMessage)) return calendarTools;
  return defaultTools;
}

// 方案 2：元工具（Meta Tool）
const selectToolCategory = tool({
  description: '根据用户需求选择合适的工具类别',
  inputSchema: z.object({
    category: z.enum(['weather', 'calendar', 'search', 'communication']),
  }),
  execute: async ({ category }) => {
    // 返回该类别下的可用工具列表
    return getToolsByCategory(category);
  },
});
```

类比：这就像大型前端项目的代码分割（Code Splitting）——不是一次性加载所有路由，而是按需加载。

**7. 提供充分的上下文**

工具执行时，可能需要一些"全局上下文"（比如当前用户是谁、时区是什么）：

```typescript
// 通过闭包注入上下文
function createTools(userId: string, timezone: string) {
  return {
    getCalendar: tool({
      description: '获取当前用户的日程',
      inputSchema: z.object({
        date: z.string().describe('日期，格式 YYYY-MM-DD'),
      }),
      execute: async ({ date }) => {
        // userId 和 timezone 通过闭包获取，不需要 AI 传递
        return await fetchCalendar(userId, date, timezone);
      },
    }),
  };
}

const tools = createTools(currentUser.id, currentUser.timezone);
```

这避免了让 AI 传递它不应该知道的参数（比如用户 ID），同时保证了工具有足够的上下文来正确执行。

---

## 概念辨析

### Tool Use vs 直接在 Prompt 中提供数据

| 维度 | Tool Use | 数据塞 Prompt |
|------|----------|---------------|
| 实时性 | 每次调用获取最新数据 | 数据在发送时就固定了 |
| Token 消耗 | 按需获取，不浪费 | 数据可能很大，全部占用上下文 |
| 灵活性 | AI 自主决定是否需要数据 | 不管需不需要都塞进去了 |
| 适用场景 | 实时数据、大量可选数据 | 少量的、每次都需要的背景信息 |
| 复杂度 | 需要定义工具、处理循环 | 只需要拼接字符串 |

**经验法则**：如果数据很少（几百 token）且每次都需要，塞 Prompt 更简单。如果数据量大、不一定需要、或需要实时获取，用 Tool Use。

### Function Calling vs Tool Use

这两个术语经常混用。严格来说：

- **Function Calling** 是 OpenAI 最初使用的术语，强调"调用函数"
- **Tool Use** 是更通用的术语（Anthropic 使用这个），强调"使用工具"

在概念上完全一样。Vercel AI SDK 统一使用 `tool` 这个概念。本章中两个术语可互换。

### Tool Use vs Plugin / Extension

| 维度 | Tool Use | Plugin / Extension |
|------|----------|--------------------|
| 定义者 | 开发者在代码中定义 | 通常是第三方提供 |
| 运行时 | 在你的服务器上执行 | 可能在第三方服务器上 |
| 标准化 | 各 SDK 有自己的接口 | 通常有标准化协议（如 MCP） |
| 灵活性 | 完全控制 | 受限于插件接口 |

MCP（Model Context Protocol）就是试图标准化 Tool Use 的协议，我们会在第 14 章详细讲解。

---

## 灵魂拷问

> **Q1: AI 是怎么"决定"要不要调用工具的？它的决策过程是什么？**

> A: 这是一个非常好的问题。AI 的工具选择不是基于规则匹配（不是 if-else），而是基于**训练时习得的模式**。
>
> 模型在训练阶段见过海量的"用户问题 → 应该调用工具"的示例对，学会了一种"直觉"：当用户的问题涉及实时数据、外部操作、或者超出自身知识范围时，应该调用相应的工具。
>
> 具体来说，AI 在生成下一个 token 时，会在"生成文本 token"和"生成 tool_call 特殊标记"之间做概率选择。如果问题明显需要外部数据（比如"今天天气"），生成 tool_call 的概率会很高。如果问题可以靠自身知识回答（比如"JavaScript 和 TypeScript 的区别"），生成文本的概率更高。
>
> 但这个决策不是 100% 可靠的。AI 有时候会在不需要工具时调用工具（过度使用），有时候会在需要时不调用（遗漏）。这就是为什么 **description 写得好**非常重要——它直接影响 AI 的决策概率。一个模糊的 description 让 AI "看不清"什么时候该用这个工具。

> **Q2: 如果 AI 调用了一个不存在的工具怎么办？如果传了错误的参数呢？**

> A: 在 Vercel AI SDK 中，AI 只能调用你**注册过的**工具。SDK 在将工具定义发送给模型时，已经限定了工具列表。如果模型尝试调用未注册的工具（极端情况下可能发生），SDK 会抛出错误。
>
> 参数错误更常见也更需要关注。Zod schema 会在执行前验证参数，如果 AI 传了不符合 schema 的参数，Zod 验证会失败。你应该在 `execute` 函数中做额外的防御性编程：
>
> ```typescript
> execute: async ({ city }) => {
>   if (!city || city.trim() === '') {
>     return { success: false, error: '城市名不能为空' };
>   }
>   // ...
> }
> ```
>
> 更重要的是，通过好的参数 description 和 Zod schema 约束（enum、min、max 等），从源头减少 AI 传错参数的概率。

> **Q3: Tool Use 和直接把数据塞到 Prompt 里有什么区别？各自什么场景更好？**

> A: 核心区别是**主动权在谁手里**。
>
> 把数据塞 Prompt，是你（开发者）决定 AI 需要什么数据。你必须事先知道用户会问什么，提前准备好数据。这对于"用户偏好"、"系统规则"等固定信息很好。
>
> Tool Use，是让 AI 自己决定需要什么数据。用户可能问天气，也可能问日程，也可能不问任何需要工具的问题。AI 按需调用，不浪费 Token。
>
> 另一个关键区别是**实时性**。Prompt 中的数据在请求发出时就固定了；而工具可以在对话中途获取最新数据。
>
> 经验法则：静态、少量、必需的上下文 → 塞 Prompt。动态、大量、可选的数据 → Tool Use。

> **Q4: 为什么说 Tool Use 是 Agent 的核心？没有 Tool Use 的 AI 只能是什么？**

> A: Agent 的经典定义是"能感知环境并采取行动的自主系统"。这里有两个关键词：**感知**和**行动**。
>
> 没有 Tool Use 的 LLM：
> - 不能感知实时环境（不知道现在几点、天气如何、数据库里有什么）
> - 不能采取行动（不能发邮件、不能创建记录、不能调用 API）
>
> 它只能基于历史训练数据和当前对话上下文来生成文本。这使它成为一个"chatbot"——一个文本生成工具，不是 Agent。
>
> Tool Use 赋予了 AI 两种能力：
> - 读取类工具 → 感知（查天气、查数据库、搜索网页）
> - 写入类工具 → 行动（发消息、创建记录、触发工作流）
>
> 有了这两种能力，AI 才能形成"感知 → 思考 → 行动"的循环，这正是 Agent 的核心模式。

> **Q5: 工具的 description 写"获取天气"和写"根据城市名获取该城市当前的天气信息，返回温度、湿度和天气状况"，效果差多少？为什么？**

> A: 差异巨大，远超大多数人的直觉。
>
> 简短的"获取天气"存在几个问题：
> 1. **触发歧义**：用户说"今天穿什么合适"，AI 不确定这和"天气"有关，可能不会调用工具
> 2. **参数模糊**：AI 不知道需要传什么——城市名？坐标？日期？
> 3. **结果预期不明**：AI 不知道会返回什么格式，可能错误解读结果
>
> 详细的 description 给 AI 提供了完整的 "API 文档"：什么时候用、怎么传参、返回什么。这就像你给新同事的对接文档——你写"调 XXX 接口"和写一份完整的接口文档，对方的理解和使用效果完全不同。
>
> 一个实用技巧：**在 description 中包含触发场景**。不只说"这个工具做什么"，还要说"什么时候应该用这个工具"。比如："当用户询问天气、温度、穿衣建议、出行建议等与气象相关的问题时，使用此工具获取实时天气数据。"

> **Q6: 10 个工具和 100 个工具，AI 的选择准确率会怎么变化？这意味着什么架构决策？**

> A: 工具数量增加时，AI 面临的"选择困难"会指数级增长。
>
> 10 个工具时，AI 就像在一个小工具箱里找工具——每个工具的 description 都能仔细"看"一遍，选择通常很准确。
>
> 100 个工具时，问题来了：
> 1. 工具定义本身占用大量 token（每个工具的 name + description + parameters），可能消耗数千 token
> 2. 工具之间可能有功能重叠，AI 不确定该用哪个
> 3. AI 的"注意力"被分散，可能遗漏最合适的工具
>
> 架构决策：
> - **少量工具**（< 15）：直接全部注册，简单有效
> - **中等数量**（15-50）：按场景分组，动态加载。先分析用户意图，再加载对应的工具集
> - **大量工具**（50+）：引入"工具路由层"，或使用 MCP 协议动态注册。类似微服务架构——不是一个单体应用包含所有功能，而是按域拆分
>
> 这个问题在前端也有对应：一个 200 个路由的 SPA 不会一次性注册所有路由组件，而是用代码分割和动态导入。工具管理也需要类似的策略。

> **Q7: AI 连续调用工具时，每一轮的"上下文"是怎么传递的？**

> A: 每一轮工具调用的结果都会被追加到消息历史中。当 AI 进行第二轮思考时，它能"看到"之前所有的对话内容，包括：
>
> 1. 用户的原始消息
> 2. 自己第一次决定调用的工具及参数
> 3. 第一次工具的返回结果
> 4. （如果有第二次调用）第二次的工具和参数
> 5. 第二次工具的结果
> 6. ...以此类推
>
> 这意味着 AI 的每一步决策都是基于**完整的历史信息**。它不会"忘记"之前调了什么工具、得到了什么结果。这也是为什么多步工具调用消耗 token 更多——历史信息越来越长。
>
> 类比：这就像 Redux 的 action 历史。每个 dispatch 的 action 和产生的 state 变化都被记录，reducer 处理新 action 时能看到完整的状态。

> **Q8: 如果工具执行时间很长（比如 30 秒），用户体验怎么处理？**

> A: 这在流式输出场景中尤为重要。Vercel AI SDK 的 `streamText` 支持在工具执行期间保持流式连接：
>
> 1. AI 决定调用工具时，前端能收到"AI 正在调用 xxx 工具"的信号
> 2. 工具执行期间，前端可以展示加载状态
> 3. 工具返回结果后，AI 继续流式输出最终回复
>
> 实际做法：
> - 前端展示工具调用的进度指示器（"正在查询天气..."）
> - 设置合理的超时时间，超时后返回友好错误
> - 对耗时操作考虑异步化——工具立即返回"任务已提交"，后续通过推送通知结果
>
> 我们会在第 17 章（Agent UI/UX 设计模式）中详细探讨这些交互方案。

---

## 最佳实践

### DO

- **DO** 为每个工具写详细、清晰的 description，包括功能描述、适用场景、参数说明和返回值格式
- **DO** 为每个参数加上 `.describe()`，帮助 AI 理解参数的含义和预期格式
- **DO** 在工具的 execute 函数中做完善的错误处理，返回结构化的错误信息而非抛出异常
- **DO** 设定合理的 `stopWhen`，并根据实际使用情况调优
- **DO** 保持工具的单一职责，一个工具只做一件事
- **DO** 用 Zod 的能力（enum、min、max、regex 等）严格约束参数
- **DO** 通过闭包注入敏感上下文（userId、apiKey），不要让 AI 传递它不应该知道的参数
- **DO** 对写入类工具（发邮件、删除数据）添加确认机制，防止 AI 误操作

### DON'T

- **DON'T** 写一句话的 description（如"获取天气"），这会严重影响 AI 的工具选择准确率
- **DON'T** 注册太多工具而不做分组管理——超过 15-20 个工具就需要考虑动态加载策略
- **DON'T** 让工具的 execute 函数抛出未处理的异常，这会导致 AI 无法给出有意义的回复
- **DON'T** 不设 `stopWhen` 或设太大的值——这可能导致无限循环和成本失控
- **DON'T** 把多个不相关的功能塞进一个工具——AI 会搞不清楚什么时候该用
- **DON'T** 在工具中做需要用户确认的危险操作而不加保护（如删除数据、发送邮件）
- **DON'T** 让工具返回过多无关信息——AI 需要处理所有返回内容，信息过载会降低回复质量
- **DON'T** 忽视工具的幂等性设计——AI 可能因为各种原因重复调用同一工具

---

## 代码实战

### 实战 1：完整的多工具 Agent

我们来构建一个拥有多个工具的完整 Agent，展示 Tool Use 的完整流程。

```typescript
// tools.ts — 工具定义
import { tool } from 'ai';
import { z } from 'zod';

// 工具 1：天气查询
export const getWeather = tool({
  description: `获取指定城市的实时天气信息。
    返回温度（摄氏度）、湿度（百分比）、天气状况和风速。
    当用户询问天气、气温、穿衣建议、出行建议等气象相关问题时使用。`,
  inputSchema: z.object({
    city: z.string().describe('城市名称，如：北京、上海、广州'),
  }),
  execute: async ({ city }) => {
    try {
      // 实际项目中调用真实的天气 API
      // 这里用模拟数据演示
      const mockData: Record<string, any> = {
        '北京': { temp: 22, humidity: 45, condition: '晴', wind: '北风3级' },
        '上海': { temp: 26, humidity: 72, condition: '多云', wind: '东南风2级' },
        '广州': { temp: 30, humidity: 80, condition: '雷阵雨', wind: '南风4级' },
      };

      const data = mockData[city];
      if (!data) {
        return {
          success: false,
          error: `未找到城市"${city}"的天气数据，请确认城市名称是否正确`,
        };
      }

      return {
        success: true,
        data: { city, ...data, unit: 'celsius', updatedAt: new Date().toISOString() },
      };
    } catch (error) {
      return {
        success: false,
        error: `天气查询失败：${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  },
});

// 工具 2：日程查询
export const getCalendar = tool({
  description: `获取用户在指定日期的日程安排列表。
    返回该日期所有事件的时间、标题和地点。
    当用户询问某天的安排、计划、会议时使用。`,
  inputSchema: z.object({
    date: z.string().describe('查询日期，格式为 YYYY-MM-DD，如：2025-06-15'),
  }),
  execute: async ({ date }) => {
    try {
      // 模拟日程数据
      return {
        success: true,
        data: {
          date,
          events: [
            { time: '09:00-10:00', title: '团队站会', location: '会议室A' },
            { time: '14:00-15:30', title: '项目评审', location: '线上会议' },
            { time: '16:00-17:00', title: '1对1 周会', location: '会议室B' },
          ],
        },
      };
    } catch (error) {
      return { success: false, error: `日程查询失败：${error instanceof Error ? error.message : '未知错误'}` };
    }
  },
});

// 工具 3：创建待办事项
export const createTodo = tool({
  description: `创建一个新的待办事项。
    当用户明确要求创建任务、添加待办、记录事项时使用。
    不要在用户只是"提到"某件事时自动创建待办。`,
  inputSchema: z.object({
    title: z.string().describe('待办事项的标题'),
    priority: z.enum(['low', 'medium', 'high']).optional()
      .describe('优先级，默认 medium'),
    dueDate: z.string().optional()
      .describe('截止日期，格式 YYYY-MM-DD'),
  }),
  execute: async ({ title, priority = 'medium', dueDate }) => {
    // 模拟创建待办
    const id = `todo_${Date.now()}`;
    return {
      success: true,
      data: { id, title, priority, dueDate: dueDate ?? null, createdAt: new Date().toISOString() },
      message: `待办事项"${title}"已创建`,
    };
  },
});

// 工具 4：网页搜索
export const webSearch = tool({
  description: `搜索互联网获取实时信息。
    当用户询问最新新闻、实时数据、或者其他工具无法满足的信息需求时使用。
    其他专用工具（天气、日程等）能满足需求时，优先使用专用工具。`,
  inputSchema: z.object({
    query: z.string().describe('搜索关键词，建议使用简洁准确的关键词'),
    maxResults: z.number().min(1).max(10).optional()
      .describe('返回结果数量，默认5'),
  }),
  execute: async ({ query, maxResults = 5 }) => {
    // 模拟搜索结果
    return {
      success: true,
      data: {
        query,
        results: [
          { title: `关于"${query}"的最新报道`, url: 'https://example.com/1', snippet: '...' },
          { title: `${query} - 深度分析`, url: 'https://example.com/2', snippet: '...' },
        ],
      },
    };
  },
});
```

```typescript
// agent.ts — 主程序
import { generateText, isStepCount } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { getWeather, getCalendar, createTodo, webSearch } from './tools';

async function chat(userMessage: string) {
  console.log(`\n用户: ${userMessage}`);
  console.log('---');

  const result = await generateText({
    model: deepseek('deepseek-chat'),
    instructions: `你是一个智能工作助手，可以帮用户查天气、查日程、创建待办和搜索信息。
请根据用户需求选择合适的工具，不需要工具时直接回答。
回答要简洁实用，不要啰嗦。`,
    tools: { getWeather, getCalendar, createTodo, webSearch },
    stopWhen: isStepCount(5),
    onStepEnd: ({ toolCalls, toolResults }) => {
      if (toolCalls.length > 0) {
        toolCalls.forEach((tc, i) => {
          console.log(`  [工具调用] ${tc.toolName}(${JSON.stringify(tc.args)})`);
          if (toolResults[i]) {
            console.log(`  [工具结果] ${JSON.stringify(toolResults[i].result).slice(0, 100)}...`);
          }
        });
      }
    },
    prompt: userMessage,
  });

  console.log(`\n助手: ${result.text}`);
  console.log(`\n[统计] 总步骤: ${result.steps.length}, Token: ${result.usage.totalTokens}`);

  return result;
}

// 测试不同场景
async function main() {
  // 场景 1：简单问题，不需要工具
  await chat('你好，你能做什么？');

  // 场景 2：单工具调用
  await chat('北京今天天气怎么样？');

  // 场景 3：多工具调用
  await chat('帮我看看明天的日程，还有北京的天气如何');

  // 场景 4：写入操作
  await chat('帮我创建一个高优先级待办：准备周五的技术分享');

  // 场景 5：工具错误处理
  await chat('查一下纽约的天气');
}

main();
```

### 实战 2：流式输出 + Tool Use（前端集成）

```typescript
// app/api/chat/route.ts — Next.js API Route
import { streamText, convertToModelMessages, isStepCount, toUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { getWeather, getCalendar, createTodo, webSearch } from '@/lib/tools';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: deepseek('deepseek-chat'),
    instructions: '你是一个智能工作助手...',
    tools: { getWeather, getCalendar, createTodo, webSearch },
    stopWhen: isStepCount(5),
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

```typescript
// app/page.tsx — React 前端
'use client';

import { useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';

// 从 v7 的 parts 数组中提取纯文本
function messageText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');
}

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput('');
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="space-y-4 mb-4">
        {messages.map((message) => (
          <div key={message.id} className="flex flex-col gap-2">
            <div className="font-bold">
              {message.role === 'user' ? '你' : '助手'}
            </div>

            {/* 展示文本内容 */}
            {messageText(message) && (
              <div className="whitespace-pre-wrap">{messageText(message)}</div>
            )}

            {/* 展示工具调用状态（v7 中工具调用位于 message.parts，类型为 dynamic-tool） */}
            {message.parts.map((part) => {
              if (part.type !== 'dynamic-tool') return null;
              return (
                <div key={part.toolCallId} className="bg-gray-100 rounded p-3 text-sm">
                  <div className="font-medium text-gray-600">
                    调用工具: {part.toolName}
                  </div>

                  {/* 工具已完成，展示结果 */}
                  {part.state === 'output-available' ? (
                    <div className="mt-1 text-green-700">
                      结果: {JSON.stringify(part.output, null, 2)}
                    </div>
                  ) : (
                    <div className="mt-1 text-yellow-600 animate-pulse">
                      执行中...
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="问我任何事情..."
          className="flex-1 border rounded px-3 py-2"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isLoading ? '思考中...' : '发送'}
        </button>
      </form>
    </div>
  );
}
```

### 实战 3：带确认机制的危险操作

```typescript
// 对于写入类工具，可以要求 AI 在执行前先"请求确认"
// 这通过 tool 的 execute 和前端交互来实现

import { tool } from 'ai';
import { z } from 'zod';

// 方案：将工具分为"查询"和"确认执行"两步
export const deleteFile = tool({
  description: `删除指定文件。这是一个危险操作，只有用户明确要求删除时才使用。
    工具会先返回文件信息让用户确认，不会直接删除。`,
  inputSchema: z.object({
    filePath: z.string().describe('要删除的文件路径'),
    confirmed: z.boolean().optional()
      .describe('是否已确认删除。首次调用设为 false 或不传，确认后设为 true'),
  }),
  execute: async ({ filePath, confirmed }) => {
    // 第一次调用：返回文件信息，等待确认
    if (!confirmed) {
      const fileInfo = await getFileInfo(filePath);
      return {
        success: true,
        needsConfirmation: true,
        message: `即将删除文件: ${filePath} (${fileInfo.size} bytes, 最后修改: ${fileInfo.modifiedAt})，请确认是否继续`,
      };
    }

    // 确认后执行删除
    await fs.unlink(filePath);
    return {
      success: true,
      needsConfirmation: false,
      message: `文件 ${filePath} 已成功删除`,
    };
  },
});
```

---

## 实操练习

### 目标

为你的 AI 工作助手添加 Tool Use 能力，让它能执行真实操作，从"聊天机器人"升级为"Agent"。

### 步骤

1. **创建项目结构**
   ```
   my-agent/
   ├── src/
   │   ├── tools/
   │   │   ├── weather.ts      # 天气工具
   │   │   ├── calculator.ts   # 计算器工具
   │   │   ├── datetime.ts     # 日期时间工具
   │   │   └── index.ts        # 统一导出
   │   ├── agent.ts            # Agent 主程序
   │   └── index.ts            # 入口
   ├── package.json
   └── tsconfig.json
   ```

2. **实现三个基础工具**
   - `getWeather`：查询天气（可用模拟数据，或接入真实 API）
   - `calculate`：数学计算（解决 LLM 数学能力差的问题）
   - `getCurrentDateTime`：获取当前日期时间（LLM 不知道"现在"是什么时候）

3. **集成到 Agent 中**
   - 使用 `generateText` + `tools` + `stopWhen`
   - 添加 system prompt 指导 AI 正确使用工具

4. **测试以下场景**
   - "你好" → 不调用工具，正常对话
   - "北京天气怎么样" → 调用 getWeather
   - "123.45 乘以 67.89 等于多少" → 调用 calculate
   - "今天是几号" → 调用 getCurrentDateTime
   - "北京今天适合户外活动吗" → 先查天气，再基于结果给建议

5. **添加 `onStepEnd` 日志，观察 AI 的决策过程**

### 验收标准

- AI 能正确选择工具（不该调的不调，该调的调）
- 工具有完善的错误处理（返回结构化错误，不抛异常）
- 每个工具的 description 详细清晰
- 设定了合理的 stopWhen 并理解其含义
- 能解释 Tool Call Loop 的完整流程

### 挑战加分项

1. 添加一个 `translateText` 翻译工具，接入真实的翻译 API（如 DeepL 免费版）
2. 实现并行工具调用场景：让 AI 同时查询多个城市的天气
3. 将 Agent 集成到 Next.js 前端，用 `useChat` 展示工具调用状态
4. 实现一个"元工具"：让 AI 先选择工具类别，再使用具体工具

---

## 本章小结

这一章，我们系统地学习了 AI Agent 最核心的能力——Tool Use / Function Calling。回顾关键要点：

1. **LLM 的本质局限**：只能生成文本，不能访问实时数据或执行操作。Tool Use 让 AI 能和外部世界交互，是从 Chatbot 到 Agent 的分水岭。

2. **Function Calling 的真相**：AI 不是在"调用"函数，它只是生成了"我想调什么函数"的结构化数据。真正执行的是你的代码。这意味着一切都在你的控制之下。

3. **Tool Call Loop 是 Agent 的心跳**：用户消息 → AI 决定调用工具 → 你的代码执行 → 结果传回 AI → AI 生成回复。这个循环可以多轮执行，每一轮 AI 都基于完整历史做决策。

4. **Description 决定成败**：工具的 description 不是给人看的注释，是给 AI 看的"使用说明书"。它直接影响 AI 是否能正确选择和使用工具。

5. **工具设计 = API 设计**：单一职责、语义化命名、严格参数校验、一致的返回格式、幂等性、数量克制——好的工具设计原则和好的 REST API 设计原则完全一致。

6. **stopWhen 是安全阀**：合理的步骤限制防止无限循环和成本失控，但太小会限制 AI 的能力。根据场景调优。

下一章，我们将解决另一个关键问题：**AI 的记忆**。目前每次 API 调用都是无状态的——AI 不记得上一轮对话说了什么。如何让 AI "记住"对话历史，甚至跨会话记住用户的偏好？这就是上下文管理的艺术。
