# 第14章：MCP 协议 — Agent 的 USB 接口

## 引言

还记得 2000 年代初的电脑接口吗？打印机用并口，键盘用 PS/2，手机数据线每个品牌不一样，移动硬盘用 FireWire，摄像头用专有接口……每买一个新设备，就要祈祷电脑上有对应的插口。

然后 USB 来了。一个接口统一所有设备。你不需要知道 U 盘内部用什么芯片、打印机走什么通信协议——插上就能用。

AI Agent 领域正在经历类似的混乱期。每个 Agent 框架有自己的工具定义方式，每个模型提供商有自己的 Function Calling 格式，你在 LangChain 里写的工具不能直接给 Vercel AI SDK 用，你给 ChatGPT 定义的 Function 不能直接搬到 Claude 上。

**MCP（Model Context Protocol）就是 AI Agent 领域的 USB 接口**。它定义了一套标准协议，让 AI 模型和外部工具/数据源之间的通信有了统一的语言。写一个 MCP Server，就能被任何支持 MCP 的 Agent 调用——不管这个 Agent 用的是什么框架、什么模型。

本章将从 MCP 的设计动机讲起，带你理解它的架构和核心概念，然后动手用 TypeScript 写一个 MCP Server，最后集成到你的 Agent 应用中。

---

## 14.1 为什么需要 MCP

### 一句话直觉

MCP 解决的不是"能不能连工具"的问题，而是"连接方式能不能标准化"的问题。

### 前端类比

想想 REST API 出现之前的世界。每个后端框架定义 API 的方式不同：有的用 XML-RPC，有的用 SOAP，有的是自定义二进制协议。前端要对接不同的后端，得学不同的协议、用不同的客户端库。

REST 做了什么？它说：**资源用 URL 表示，操作用 HTTP 方法表示（GET/POST/PUT/DELETE），数据用 JSON 传输**。从此，不管后端用 Java、Python 还是 Node.js 写的，前端用同一套方式就能对接。

MCP 对 AI Agent 做了完全相同的事。它说：**工具用 Tool Schema 描述，数据用 Resource 提供，交互用 JSON-RPC 通信**。从此，不管 Agent 用什么框架、连什么模型，对接外部工具的方式都是统一的。

### 没有 MCP 之前：碎片化的工具生态

看看现在的混乱局面：

```
Vercel AI SDK 的工具定义：
tool('getWeather', {
  description: '...',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => { ... }
})

LangChain.js 的工具定义：
new DynamicTool({
  name: 'getWeather',
  description: '...',
  func: async (city) => { ... }
})

OpenAI 的 Function Calling：
{
  "name": "getWeather",
  "description": "...",
  "parameters": { "type": "object", "properties": { "city": { "type": "string" } } }
}
```

同样是"获取天气"这个工具，三种框架三种写法。你在 Vercel AI SDK 里写好的工具，想搬到 LangChain 上？重写。想同时给 ChatGPT 和 Claude 用？分别适配。

这不仅浪费开发时间，更大的问题是**阻碍了工具生态的形成**。如果有人写了一个很棒的"数据库查询工具"，它只能在特定框架下使用。其他框架的用户想用？要么等作者适配，要么自己重写一遍。

### 有了 MCP 之后：一次开发，到处使用

MCP 让工具提供方只需要写一次代码，发布为一个 MCP Server，就能被所有支持 MCP 的 Agent 使用。

```
MCP Server: "数据库查询工具"
   ↓ 标准 MCP 协议
可以被以下客户端调用：
- Claude Desktop
- Cursor
- Windsurf
- 你自己写的 Agent 应用
- 任何支持 MCP 的工具
```

这就像你写了一个 USB 设备——不管插在什么品牌的电脑上都能工作。

### 深层追问

MCP 的价值不仅在于"统一接口"。它还解决了一个更深层的问题：**工具的发现和信任**。

以前，Agent 能用什么工具完全取决于开发者在代码里硬编码了什么。有了 MCP，Agent 可以动态发现和连接新工具——就像你的电脑可以随时插上新的 USB 设备，不需要重启、不需要改代码。

---

## 14.2 MCP 架构详解

### 一句话直觉

MCP 的架构就是"客户端-服务器"模式，但加了一个"宿主"的概念来管理安全和权限。

### 前端类比

如果你用过微前端或 Chrome 扩展，MCP 的架构模型会很眼熟：

```
Chrome 浏览器（Host）
  ├── 扩展 A（Client）→ 连接 → 天气 API（Server）
  ├── 扩展 B（Client）→ 连接 → 翻译 API（Server）
  └── 扩展 C（Client）→ 连接 → GitHub API（Server）

Chrome 负责：
- 管理扩展的生命周期
- 控制扩展的权限（能不能访问某个网站）
- 在扩展和网页之间传递消息
```

MCP 的架构几乎一模一样：

```
AI 应用（MCP Host）
  ├── MCP Client A → 连接 → 文件系统 MCP Server
  ├── MCP Client B → 连接 → 数据库 MCP Server
  └── MCP Client C → 连接 → GitHub MCP Server

Host 负责：
- 管理 MCP 连接的生命周期
- 控制每个 Server 的权限
- 在 AI 模型和 MCP Server 之间传递消息
```

### 三个核心角色

#### MCP Host（宿主）

MCP Host 是运行 AI 模型的应用程序。它是用户直接交互的对象，也是整个 MCP 架构的"大管家"。

常见的 MCP Host：
- Claude Desktop 应用
- Cursor / Windsurf 等 AI 编辑器
- 你自己写的 AI Agent 应用

Host 的核心职责：
1. 运行 AI 模型（或调用模型 API）
2. 创建和管理 MCP Client 实例
3. 控制安全策略和权限
4. 管理多个 MCP 连接的生命周期

#### MCP Client（客户端）

MCP Client 是 Host 中负责与单个 MCP Server 通信的组件。**每个 MCP Server 对应一个 MCP Client 实例**。

Client 的职责：
1. 与 MCP Server 建立连接
2. 发现 Server 提供了哪些工具、资源和提示模板
3. 转发 AI 模型的工具调用请求
4. 接收 Server 的响应并传回给 Host

#### MCP Server（服务器）

MCP Server 是真正"干活"的角色。它暴露工具和数据，等待 Client 来调用。

Server 的特点：
- **无状态或轻量级**：每个 Server 专注于一个领域（文件操作、数据库查询、API 调用等）
- **可独立运行**：作为独立进程运行，通过标准 I/O 或网络和 Client 通信
- **可复用**：一个 Server 可以被多个不同的 Host 使用

### 完整通信流程

让我们用一个具体场景来走通整个流程：

```
用户对 AI 说："帮我查一下 GitHub 上 vercel/ai 仓库的最新 issues"

1. Host（你的 AI 应用）收到用户消息
2. Host 将消息 + 可用工具列表 发送给 AI 模型
   （可用工具来自所有已连接的 MCP Server）
3. AI 模型决定调用 "github_list_issues" 工具
4. Host 找到这个工具属于 GitHub MCP Server
5. Host 通过对应的 MCP Client 发送调用请求给 GitHub MCP Server
6. GitHub MCP Server 执行操作（调用 GitHub API）
7. Server 返回结果给 Client
8. Client 将结果传回 Host
9. Host 将结果放入上下文，再次调用 AI 模型
10. AI 模型基于结果生成自然语言回答
11. Host 将回答展示给用户

整个过程对用户来说是透明的 —— 用户只看到问了一个问题，得到了答案。
```

```
┌─────────────────────────────────────────────────┐
│                   MCP Host                       │
│  ┌───────────┐                                   │
│  │  AI 模型   │ ←→ 工具列表 + 调用结果             │
│  └───────────┘                                   │
│       ↕                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Client A │  │ Client B │  │ Client C │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
└───────┼──────────────┼──────────────┼────────────┘
        │              │              │
   JSON-RPC       JSON-RPC       JSON-RPC
   (stdio)        (stdio)         (SSE)
        │              │              │
  ┌─────┴─────┐ ┌─────┴─────┐ ┌─────┴──────┐
  │ 文件系统   │ │  数据库    │ │  GitHub    │
  │ MCP Server│ │ MCP Server│ │ MCP Server │
  └───────────┘ └───────────┘ └────────────┘
```

---

## 14.3 MCP 的三大核心能力

### 一句话直觉

MCP Server 能做三件事：提供工具让 AI 执行操作，提供资源让 AI 读取数据，提供提示模板让交互更高效。

### 前端类比

把 MCP Server 想象成一个 RESTful API：

| MCP 概念 | REST 类比 | 说明 |
|---------|---------|------|
| Tools（工具） | POST/PUT/DELETE | 执行操作、修改状态 |
| Resources（资源） | GET | 读取数据、获取信息 |
| Prompts（提示模板） | API 文档里的请求示例 | 预定义好的交互模板 |

### 能力一：Tools（工具）

Tools 是 MCP 最核心的能力——让 AI 能"做事情"。

一个 Tool 的定义包含：
- **名称**（name）：工具的唯一标识
- **描述**（description）：告诉 AI 这个工具能干什么、什么时候应该用它
- **输入参数**（inputSchema）：JSON Schema 格式的参数定义
- **执行逻辑**：收到调用后实际做什么

```
Tool 示例：
名称：create_github_issue
描述：在指定的 GitHub 仓库中创建一个 issue
输入：{ repo: string, title: string, body: string, labels?: string[] }
执行：调用 GitHub API 创建 issue，返回 issue URL
```

重要原则：**Tools 是"模型控制的"**——AI 模型决定什么时候调用、传什么参数。Host 和用户可以在上层做审批控制，但调用的发起方是 AI。

### 能力二：Resources（资源）

Resources 让 AI 能"读取信息"——类似于给 AI 一个只读的数据访问通道。

Resources 和 Tools 的关键区别：
- **Tools** 是 AI 主动调用的——AI 说"我要查天气"，然后调用 weather tool
- **Resources** 是 Host 或用户提供给 AI 的上下文——"这是一些背景信息，你可以参考"

```
Resource 示例：
URI：file:///project/README.md
名称：项目说明文档
MIME 类型：text/markdown
内容：（README.md 的实际内容）
```

Resources 的典型用途：
- 把文件内容提供给 AI 参考
- 把数据库查询结果作为上下文
- 把实时数据（如股票价格、服务器状态）注入对话

Resources 支持两种访问方式：
- **直接获取**：Client 请求特定 URI 的资源内容
- **订阅更新**：Client 订阅某个资源，当内容变化时收到通知（适用于实时数据）

### 能力三：Prompts（提示模板）

Prompts 是预定义好的交互模板——告诉 AI "遇到某种任务，应该用什么方式处理"。

```
Prompt 模板示例：
名称：code_review
描述：对一段代码进行 review
参数：{ code: string, language: string }
模板：
  "你是一个资深的 {language} 开发者。请对以下代码进行 review，关注：
   1. 代码质量和可维护性
   2. 潜在的 bug
   3. 性能问题
   4. 安全隐患
   
   代码：
   {code}"
```

Prompts 的价值在于**标准化交互方式**。MCP Server 的开发者对自己的领域最了解，他知道"用这个工具时应该怎么问才能得到最好的结果"。把这个知识打包成 Prompt 模板，用户就不需要自己摸索最佳 prompt 了。

**Prompts 是"用户控制的"**——它们通常以菜单或快捷命令的形式展示给用户，由用户选择使用哪个模板。这和 Tools（AI 控制）形成了互补。

---

## 14.4 MCP 的通信机制

### 一句话直觉

MCP 用 JSON-RPC 2.0 协议通信，传输层支持两种方式：本地进程用标准 I/O（stdio），远程服务用 HTTP + SSE。

### 前端类比

JSON-RPC 就是把函数调用序列化成 JSON 的一种标准格式。如果你用过 tRPC，概念非常类似：

```typescript
// tRPC 风格（前端熟悉的）
const result = await trpc.weather.getTemperature.query({ city: 'Beijing' });

// JSON-RPC 风格（MCP 使用的）
// 请求：
{ "jsonrpc": "2.0", "method": "tools/call", "params": { "name": "getTemperature", "arguments": { "city": "Beijing" } }, "id": 1 }
// 响应：
{ "jsonrpc": "2.0", "result": { "content": [{ "type": "text", "text": "25°C" }] }, "id": 1 }
```

### 两种传输方式

#### stdio（标准输入/输出）

MCP Server 作为子进程运行，通过 stdin/stdout 和 Client 通信。

```
MCP Client                    MCP Server（子进程）
    │                              │
    ├── stdin: JSON-RPC 请求 ──→   │
    │                              │ 执行操作
    ├── ←── stdout: JSON-RPC 响应 ─┤
    │                              │
```

**优点**：
- 简单直接，不需要网络配置
- 安全，只在本机通信
- 启动快，进程间通信开销小

**缺点**：
- 只能在本机使用
- Server 和 Client 必须在同一台机器上

**适用场景**：本地开发工具、桌面应用（Claude Desktop、Cursor 等）

#### HTTP + SSE（Streamable HTTP）

MCP Server 作为 HTTP 服务运行，Client 通过 HTTP 请求调用。服务器到客户端的推送使用 Server-Sent Events。

```
MCP Client                         MCP Server（HTTP 服务）
    │                                    │
    ├── HTTP POST: JSON-RPC 请求 ──→     │
    │                                    │ 执行操作
    ├── ←── SSE: JSON-RPC 响应/通知 ─────┤
    │                                    │
```

**优点**：
- 支持远程连接
- 可以部署在云端，多个 Client 共享
- 支持服务端主动推送（通过 SSE）

**缺点**：
- 需要网络配置和安全考虑
- 延迟相对 stdio 更高

**适用场景**：团队共享的 MCP Server、云端部署的工具服务

### 为什么选 JSON-RPC 而不是 gRPC 或 GraphQL？

这是一个有意思的设计决策。

**JSON-RPC 的优势**：
- 极其简单——请求就是一个 JSON 对象，包含 method 和 params，完事
- 无需代码生成——不像 gRPC 需要 protobuf 编译
- 语言无关——任何能处理 JSON 的语言都能实现
- 可以跑在任何传输层上（stdio、HTTP、WebSocket 都行）

**gRPC 为什么不合适**：
- 需要 Protocol Buffers 定义和编译步骤，增加了工具开发的门槛
- 浏览器支持不友好（需要 gRPC-Web 代理）
- 对于 AI 工具调用这个场景来说，gRPC 的高性能优势用不上（瓶颈在 AI 推理，不在通信）

**GraphQL 为什么不合适**：
- 太复杂了。AI 工具调用本质是"调用一个函数，传参，拿结果"，不需要 GraphQL 的查询灵活性
- 引入不必要的概念（schema 定义、resolver、query vs mutation）

MCP 选择 JSON-RPC 是典型的"奥卡姆剃刀"——用最简单的方案解决问题。

---

## 14.5 MCP Server 开发实战

### 一句话直觉

写一个 MCP Server 就像写一个 Express API —— 定义路由（工具），实现处理函数，启动服务。

### 前端类比

```
Express API Server               MCP Server
─────────────────               ──────────
app.get('/users', ...)     →    server.tool('list_users', ...)
app.post('/users', ...)    →    server.tool('create_user', ...)
app.listen(3000)           →    server.connect(transport)
```

### 实战：写一个笔记管理 MCP Server

我们来写一个管理笔记的 MCP Server，支持创建、查询、搜索笔记。这个 Server 写好之后，可以被 Claude Desktop、Cursor 或你自己的 Agent 应用调用。

首先，初始化项目：

```bash
mkdir mcp-notes-server
cd mcp-notes-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node
npx tsc --init
```

`tsconfig.json` 关键配置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  }
}
```

接下来，实现 Server：

```typescript
// src/index.ts
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ========== 数据存储（简化版，用内存存储） ==========

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const notes: Map<string, Note> = new Map();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ========== 创建 MCP Server ==========

const server = new McpServer({
  name: 'notes-manager',
  version: '1.0.0',
});

// ========== 定义 Tools ==========

// 工具1：创建笔记
server.tool(
  'create_note',
  '创建一条新笔记。当用户说"记一下"、"帮我记录"、"新建笔记"时使用此工具。',
  {
    title: z.string().describe('笔记标题'),
    content: z.string().describe('笔记正文内容'),
    tags: z.array(z.string()).optional().describe('标签列表，用于分类和搜索'),
  },
  async ({ title, content, tags = [] }) => {
    const note: Note = {
      id: generateId(),
      title,
      content,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notes.set(note.id, note);

    return {
      content: [
        {
          type: 'text' as const,
          text: `笔记创建成功！\nID: ${note.id}\n标题: ${note.title}\n标签: ${note.tags.join(', ') || '无'}`,
        },
      ],
    };
  }
);

// 工具2：搜索笔记
server.tool(
  'search_notes',
  '按关键词或标签搜索笔记。当用户说"查找笔记"、"搜索"、"有没有关于...的笔记"时使用。',
  {
    query: z.string().optional().describe('搜索关键词，在标题和内容中匹配'),
    tag: z.string().optional().describe('按标签筛选'),
  },
  async ({ query, tag }) => {
    let results = Array.from(notes.values());

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );
    }

    if (tag) {
      results = results.filter(n => n.tags.includes(tag));
    }

    if (results.length === 0) {
      return {
        content: [{ type: 'text' as const, text: '没有找到匹配的笔记。' }],
      };
    }

    const summary = results
      .map(n => `- [${n.id}] ${n.title} (标签: ${n.tags.join(', ') || '无'})`)
      .join('\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `找到 ${results.length} 条笔记：\n${summary}`,
        },
      ],
    };
  }
);

// 工具3：获取笔记详情
server.tool(
  'get_note',
  '获取指定 ID 的笔记完整内容。当需要查看某条具体笔记时使用。',
  {
    id: z.string().describe('笔记的唯一 ID'),
  },
  async ({ id }) => {
    const note = notes.get(id);
    if (!note) {
      return {
        content: [{ type: 'text' as const, text: `未找到 ID 为 "${id}" 的笔记。` }],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `标题: ${note.title}\n标签: ${note.tags.join(', ') || '无'}\n创建时间: ${note.createdAt}\n更新时间: ${note.updatedAt}\n\n${note.content}`,
        },
      ],
    };
  }
);

// 工具4：删除笔记
server.tool(
  'delete_note',
  '删除指定 ID 的笔记。这是不可逆操作，请谨慎使用。',
  {
    id: z.string().describe('要删除的笔记 ID'),
  },
  async ({ id }) => {
    const note = notes.get(id);
    if (!note) {
      return {
        content: [{ type: 'text' as const, text: `未找到 ID 为 "${id}" 的笔记。` }],
      };
    }

    notes.delete(id);
    return {
      content: [
        { type: 'text' as const, text: `笔记 "${note.title}" (${id}) 已删除。` },
      ],
    };
  }
);

// ========== 定义 Resources ==========

// 资源1：所有笔记的概览
server.resource(
  'notes_overview',
  'notes://overview',
  { description: '所有笔记的概览信息，包括总数和标签统计' },
  async () => {
    const allNotes = Array.from(notes.values());
    const tagCounts: Record<string, number> = {};
    allNotes.forEach(n => n.tags.forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }));

    const overview = {
      totalNotes: allNotes.length,
      tagStatistics: tagCounts,
      recentNotes: allNotes.slice(-5).map(n => ({ id: n.id, title: n.title })),
    };

    return {
      contents: [
        {
          uri: 'notes://overview',
          mimeType: 'application/json',
          text: JSON.stringify(overview, null, 2),
        },
      ],
    };
  }
);

// 资源2：单条笔记（动态资源模板）
server.resource(
  'note_detail',
  new ResourceTemplate('notes://note/{id}', { list: undefined }),
  { description: '获取指定 ID 笔记的完整内容' },
  async (uri, { id }) => {
    const note = notes.get(id as string);
    if (!note) {
      return { contents: [] };
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(note, null, 2),
        },
      ],
    };
  }
);

// ========== 定义 Prompts ==========

server.prompt(
  'summarize_notes',
  '总结笔记内容：生成所有笔记（或指定标签的笔记）的摘要',
  { tag: z.string().optional().describe('可选：只总结特定标签的笔记') },
  async ({ tag }) => {
    let targetNotes = Array.from(notes.values());
    if (tag) {
      targetNotes = targetNotes.filter(n => n.tags.includes(tag));
    }

    const noteTexts = targetNotes
      .map(n => `## ${n.title}\n${n.content}`)
      .join('\n\n---\n\n');

    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `请对以下${tag ? `标签为"${tag}"的` : '所有'}笔记进行总结，提取关键信息和主题：\n\n${noteTexts || '（暂无笔记）'}`,
          },
        },
      ],
    };
  }
);

// ========== 启动 Server ==========

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Notes MCP Server 已启动（stdio 模式）');
}

main().catch(console.error);
```

### 本地测试

MCP 提供了一个命令行检查工具，可以用来测试你的 Server：

```bash
# 安装 MCP Inspector
npx @modelcontextprotocol/inspector dist/index.js
```

Inspector 会启动一个本地 Web 界面，你可以：
- 查看 Server 提供了哪些 Tools、Resources、Prompts
- 手动调用 Tool，查看输入和输出
- 读取 Resource 内容
- 测试 Prompt 模板

### 在 Claude Desktop 中使用

编辑 Claude Desktop 的配置文件，添加你的 MCP Server：

```json
// macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
// Windows: %APPDATA%\Claude\claude_desktop_config.json
{
  "mcpServers": {
    "notes": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-notes-server/dist/index.js"]
    }
  }
}
```

重启 Claude Desktop，你的笔记管理工具就可以用了。试试对 Claude 说"帮我记一条笔记"。

---

## 14.6 MCP Client 集成

### 一句话直觉

写完 Server 是"发布一个 USB 设备"，集成 Client 是"让你的电脑识别这个 USB 设备"。

### 在你的 Agent 应用中连接 MCP Server

如果你不用 Claude Desktop，而是要在自己的 Agent 应用里连接 MCP Server，需要使用 MCP Client SDK：

```typescript
// lib/mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function createMcpClient(serverCommand: string, serverArgs: string[]) {
  const client = new Client(
    { name: 'my-agent-app', version: '1.0.0' },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: serverCommand,
    args: serverArgs,
  });

  await client.connect(transport);
  return client;
}

// 发现 Server 提供的工具
export async function discoverTools(client: Client) {
  const { tools } = await client.listTools();
  return tools;
  // 返回类似：
  // [
  //   { name: 'create_note', description: '创建一条新笔记...', inputSchema: {...} },
  //   { name: 'search_notes', description: '搜索笔记...', inputSchema: {...} },
  //   ...
  // ]
}

// 调用工具
export async function callTool(client: Client, toolName: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name: toolName, arguments: args });
  return result;
}
```

### 将 MCP Tools 接入 Vercel AI SDK

关键一步：把 MCP Server 的工具转换成 Vercel AI SDK 的工具格式，这样 AI 模型就能自动发现和调用它们。

```typescript
// lib/mcp-to-ai-sdk.ts
import { tool } from 'ai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { jsonSchema } from 'ai';

// 将 MCP Server 的工具转换为 Vercel AI SDK 格式
export async function mcpToolsToAiSdkTools(client: Client) {
  const { tools: mcpTools } = await client.listTools();

  const aiSdkTools: Record<string, ReturnType<typeof tool>> = {};

  for (const mcpTool of mcpTools) {
    aiSdkTools[mcpTool.name] = tool({
      description: mcpTool.description || '',
      inputSchema: jsonSchema(mcpTool.inputSchema),
      execute: async (args) => {
        const result = await client.callTool({
          name: mcpTool.name,
          arguments: args,
        });
        // 提取文本内容
        const textContent = result.content
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        return textContent;
      },
    });
  }

  return aiSdkTools;
}
```

```typescript
// app/api/chat/route.ts — 在 API 路由中使用
import { deepseek } from '@ai-sdk/deepseek';
import { streamText, convertToModelMessages, isStepCount, toUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { createMcpClient } from '@/lib/mcp-client';
import { mcpToolsToAiSdkTools } from '@/lib/mcp-to-ai-sdk';

// 应用启动时连接 MCP Server
let mcpTools: Record<string, any> = {};

async function initMcp() {
  const client = await createMcpClient('node', [
    '/path/to/mcp-notes-server/dist/index.js',
  ]);
  mcpTools = await mcpToolsToAiSdkTools(client);
  console.log('MCP 工具已加载:', Object.keys(mcpTools));
}

// 初始化
initMcp().catch(console.error);

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: deepseek('deepseek-chat'),
    messages: await convertToModelMessages(messages),
    tools: {
      // MCP Server 提供的工具（动态加载）
      ...mcpTools,
    },
    stopWhen: isStepCount(5),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

这就是"热插拔"的含义——你不需要改 Agent 的代码，只需要配置连接新的 MCP Server，AI 就能自动发现和使用新工具。

### 动态管理多个 MCP Server

实际应用中，你可能需要连接多个 MCP Server。需要一个管理器来统一管理这些连接：

```typescript
// lib/mcp-manager.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export class McpManager {
  private clients: Map<string, Client> = new Map();

  // 连接一个 MCP Server
  async connect(config: McpServerConfig): Promise<void> {
    const client = new Client(
      { name: 'my-agent', version: '1.0.0' },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
    });

    await client.connect(transport);
    this.clients.set(config.name, client);
    console.log(`已连接 MCP Server: ${config.name}`);
  }

  // 断开连接
  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.close();
      this.clients.delete(name);
      console.log(`已断开 MCP Server: ${name}`);
    }
  }

  // 获取所有可用工具（合并所有 Server 的工具）
  async getAllTools() {
    const allTools: Record<string, any> = {};

    for (const [serverName, client] of this.clients) {
      const { tools } = await client.listTools();
      for (const t of tools) {
        // 用 server名_工具名 避免命名冲突
        const qualifiedName = `${serverName}__${t.name}`;
        allTools[qualifiedName] = {
          ...t,
          serverName,
          client,
        };
      }
    }

    return allTools;
  }

  // 获取所有 Server 的状态
  getStatus() {
    const status: Record<string, 'connected' | 'disconnected'> = {};
    for (const [name] of this.clients) {
      status[name] = 'connected';
    }
    return status;
  }
}
```

---

## 14.7 MCP 生态

### 已有的 MCP Server

MCP 的价值很大程度上取决于生态的丰富程度。目前社区已经有不少可用的 MCP Server：

**官方维护的**：
- **Filesystem**：文件读写操作
- **GitHub**：仓库管理、issue 操作、PR 管理
- **GitLab**：类似 GitHub，面向 GitLab 用户
- **Slack**：消息发送、频道管理
- **Google Drive**：文件搜索和读取
- **PostgreSQL / SQLite**：数据库查询

**社区贡献的**：
- **Docker**：容器管理
- **Kubernetes**：集群操作
- **Notion**：笔记和数据库操作
- **Linear**：项目管理
- **Sentry**：错误监控
- 还有数百个，覆盖各种 SaaS 服务和本地工具

### MCP 生态的网络效应

MCP 的厉害之处在于它创造了一个正向循环：

```
更多 MCP Server 被开发
      ↓
更多 Agent 应用支持 MCP
      ↓
更多用户使用 MCP
      ↓
更多开发者有动力写 MCP Server
      ↓
更多 MCP Server 被开发
      ... 循环加速
```

这和 npm 包生态、Chrome 扩展生态、App Store 的增长逻辑完全一样。一旦生态建立起来，就会形成强大的护城河。

---

## 14.8 MCP vs 直接写 Tool：什么时候该用哪个？

这是一个实际开发中必须面对的决策。

### 直接在代码里写 Tool

```typescript
// 直接定义在 Agent 代码里
const tools = {
  getWeather: tool({
    description: '获取天气',
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }) => {
      const res = await fetch(`https://api.weather.com/${city}`);
      return res.json();
    },
  }),
};
```

**适用场景**：
- 工具只在你的应用内部使用，不需要给其他应用用
- 工具逻辑简单，几行代码搞定
- 工具和你的业务逻辑强耦合（需要访问应用的数据库、状态等）
- 团队小，不需要工具的标准化

### 写成 MCP Server

**适用场景**：
- 工具有复用价值——其他团队、其他应用也可能需要
- 工具连接的是通用服务（GitHub、数据库、SaaS 产品）
- 你希望非开发人员也能通过 Claude Desktop 等工具使用它
- 你想把工具的开发和 Agent 的开发解耦——两者可以独立迭代

### 决策树

```
这个工具只有你的应用在用？
├── 是 → 直接写 Tool（简单直接）
└── 否 → 其他人/应用也会用？
    ├── 是 → 写成 MCP Server（一次开发，到处使用）
    └── 不确定 → 先写成 Tool，有复用需求时再重构为 MCP Server
```

经验法则：**如果你发现自己在不同项目里复制粘贴同一个 Tool 的代码，那它就应该变成 MCP Server。**

---

## 概念辨析

### MCP vs Function Calling

| 维度 | Function Calling | MCP |
|------|---------|-----|
| 定义层级 | 模型级别（告诉模型有哪些函数） | 协议级别（定义工具的通信标准） |
| 工具注册 | 硬编码在应用中 | 通过协议动态发现 |
| 复用性 | 不可跨应用复用 | 一次开发，到处使用 |
| 生态 | 每个应用各写各的 | 共享的工具市场 |
| 运行位置 | 在应用进程内 | 独立进程或远程服务 |

核心区别：Function Calling 是 AI 模型的一个能力特性（"AI 会调函数"），而 MCP 是一个通信协议（"怎么标准化地定义和调用这些函数"）。它们不是替代关系，而是互补——AI 通过 Function Calling 机制来调用 MCP Server 提供的工具。

### MCP vs REST API

| 维度 | REST API | MCP |
|------|----------|-----|
| 消费者 | 人写的代码 | AI 模型 |
| 发现方式 | 阅读文档 | 协议内置的工具发现 |
| 描述方式 | OpenAPI/Swagger | Tool Schema + description |
| 调用方式 | HTTP 请求 | JSON-RPC（可以走 stdio 或 HTTP） |
| 优化方向 | 对开发者友好 | 对 AI 友好 |

REST API 是给人读的，MCP 是给 AI 读的。MCP 的 description 字段不仅要描述工具做什么，还要告诉 AI "什么时候应该用它"——这是 REST API 不需要考虑的。

### MCP Server vs 微服务

MCP Server 和微服务在形式上很像（独立进程、通过协议通信、职责单一），但本质目的不同：

- **微服务**：解决业务系统的可伸缩性和独立部署
- **MCP Server**：解决 AI 工具的标准化和可复用

MCP Server 可以是一个微服务的"AI 适配层"——在已有的微服务前面套一个 MCP 接口，让 AI 能调用它。

---

## 灵魂拷问

> **Q: MCP 和传统的 Function Calling 有什么本质区别？MCP 解决了什么 Function Calling 解决不了的问题？**

A: Function Calling 解决的是"AI 能不能调函数"——答案是能。但它没解决三个问题：

1. **工具的标准化**：每个框架的工具定义格式不同，你在 LangChain 写的工具搬不到 Vercel AI SDK 上。MCP 统一了格式。

2. **工具的发现**：Function Calling 的工具是硬编码在代码里的。MCP 允许动态发现——Agent 可以在运行时连接新的 MCP Server，自动获取它提供的工具。

3. **工具的生态**：Function Calling 的工具是"自产自销"的，每个开发者为自己的应用写。MCP 创造了一个共享的工具市场——写一次，所有人都能用。

打个比方：Function Calling 是"我家自己装了个水龙头"，MCP 是"接入了城市供水系统"。前者能用但孤立，后者接入了整个生态。

---

> **Q: 为什么是 Anthropic 而不是 OpenAI 提出了 MCP？这反映了什么战略差异？**

A: 这个问题值得深入思考。

Anthropic 的策略可以概括为"**生态开放**"：我不一定要做最强的模型，但我要做最好用的基础设施。MCP 就是这个策略的体现——创建一个开放标准，让所有人围绕它建设生态。即使用户用的不是 Claude，只要用了 MCP 生态的工具，Anthropic 就有影响力。

OpenAI 的策略更偏向"**能力封闭**"：通过不断提升模型能力来吸引用户。工具调用的方式我自己定义就行，不需要统一标准，因为用户会为了模型能力选择我。

两种策略没有绝对的对错。但从历史经验看：**开放标准往往能打赢封闭生态**。HTTP 打赢了各种私有协议，USB 打赢了各种专有接口，Android 凭借开放生态在全球市场份额上远超 iOS。MCP 如果真的成为行业标准，Anthropic 就获得了"基础设施级别"的影响力——这比模型能力的领先更持久。

当然，OpenAI 也在跟进。标准之争还没有定论，但目前 MCP 的生态先发优势已经很明显。

---

> **Q: MCP Server 需要一直运行吗？如果 Server 挂了怎么办？**

A: 这取决于传输方式。

**stdio 模式**：MCP Server 作为子进程运行，由 MCP Client（即你的应用）启动和管理。Server 的生命周期和 Client 绑定——Client 启动时拉起 Server，Client 退出时 Server 也跟着退出。如果 Server 挂了，Client 可以检测到并重启它。

**HTTP 模式**：MCP Server 作为独立的网络服务运行，需要像管理普通后端服务一样保证其可用性——健康检查、自动重启、负载均衡、监控告警。

如果 Server 挂了但 Client 没有处理，Agent 在调用工具时会收到错误。好的实践是：

1. Client 维护连接健康状态，定期 ping
2. 发现断连时自动尝试重连（指数退避）
3. 如果重连失败，将该 Server 的工具标记为不可用，告诉 AI "这些工具暂时用不了"
4. AI 应该能 gracefully handle——如果搜索工具挂了，不要让整个任务失败，而是告诉用户"搜索服务暂时不可用"

---

> **Q: MCP 会成为 AI 领域的 HTTP 吗？还是会像其他标准一样昙花一现？**

A: 坦率地说，还不确定。但有几个有利信号：

**有利因素**：
- 生态增长很快，数百个社区 MCP Server 已经被开发出来
- 主流 AI 编辑器（Cursor、Windsurf）和工具都在集成 MCP 支持
- 设计上足够简单，降低了采用门槛
- Anthropic 把它作为开放标准发布，不是私有协议

**不利因素**：
- 如果 OpenAI 推出自己的标准并利用其市场地位推广，可能导致标准分裂
- AI Agent 领域还在快速变化，今天的需求和一年后可能很不一样
- 协议本身还在演进，还没完全稳定

我的判断：MCP 至少会成为一个非常重要的标准，可能不会是唯一的标准（就像 REST 没有完全取代 GraphQL），但很可能是最广泛使用的那个。对于开发者来说，**学习 MCP 的风险很低**——即使它最终不是"唯一标准"，它教给你的"标准化工具协议"的思维方式也是可迁移的。

---

> **Q: 安全性：你的 Agent 连接了一个第三方 MCP Server，如何确保它不会做恶意操作？**

A: 这是 MCP 目前最需要关注的安全问题。一个恶意的 MCP Server 可能：

1. **窃取数据**：在 Tool 执行时将用户的输入数据发送到外部服务器
2. **Prompt 注入**：在 Tool 返回结果中嵌入恶意指令，操纵 AI 的行为
3. **越权操作**：声称自己是"查询工具"，实际执行了删除或修改操作
4. **信息泄露**：通过 Resource 暴露敏感文件

防护措施：

**第一层：来源审核**
- 只使用可信来源的 MCP Server（官方维护的、知名组织发布的）
- 审查 MCP Server 的源代码，特别是 Tool 的 execute 逻辑
- 类比：就像你不会随便安装 npm 包一样，不要随便信任 MCP Server

**第二层：权限控制**
- MCP Host 应该实现权限策略：哪些 Server 能访问文件系统、哪些能发网络请求
- 工具调用前可以加一层审批——AI 想调用 "delete_database" 时必须弹出确认框

**第三层：沙箱隔离**
- MCP Server 以最小权限运行（不给 root 权限、限制网络访问、限制文件系统访问范围）
- 对 Server 的返回值做安全过滤，防止 prompt 注入

**第四层：监控审计**
- 记录所有工具调用的日志
- 设置异常检测（某个 Server 突然开始大量读取文件、发送网络请求）
- 定期审查

---

> **Q: MCP 的通信用的是 JSON-RPC over stdio/SSE，为什么选这个而不是 gRPC 或 GraphQL？**

A: 这在 14.4 节已经部分回答了，这里从更深的角度分析。

MCP 的核心用户是想给 AI 写工具的开发者——他们可能是全栈开发者、可能是数据科学家、可能是 DevOps 工程师。他们不一定是协议专家。

**JSON-RPC 的核心优势是"零门槛"**：

```javascript
// 收到的请求就是一个 JSON 对象
const request = {
  jsonrpc: '2.0',
  method: 'tools/call',
  params: { name: 'search', arguments: { query: 'MCP' } },
  id: 1,
};

// 返回的也是一个 JSON 对象
const response = {
  jsonrpc: '2.0',
  result: { content: [{ type: 'text', text: '...' }] },
  id: 1,
};
```

任何会写 JSON 的开发者，看一眼就懂了。不需要安装 protoc 编译器，不需要学 GraphQL schema 语言，不需要理解 HTTP/2 多路复用。

这种"极致的简单性"对于一个想要快速建立生态的协议来说至关重要。协议越简单，越多人愿意写 MCP Server，生态就越快成长。

至于 stdio 作为传输层——这是一个天才般的设计选择。stdio 是**所有操作系统、所有编程语言都原生支持的**最基础的 I/O 方式。用 stdio 意味着你可以用任何语言写 MCP Server（Python、Go、Rust、Bash 都行），不需要引入任何额外的依赖。

---

## 最佳实践

### DO

- **DO 为 Tool 写好 description**：description 不仅给人看，更重要的是给 AI 看。要清楚地说明这个工具做什么、什么时候该用它、什么时候不该用它。好的 description 是 AI 正确使用工具的关键。
- **DO 从简单开始**：第一个 MCP Server 不要试图覆盖所有功能。先做 2-3 个核心工具，验证可行性后再扩展。
- **DO 处理错误情况**：Tool 执行失败时返回有意义的错误信息，而不是抛出异常让整个 Server 挂掉。AI 需要根据错误信息做出判断。
- **DO 记录日志**：在 MCP Server 中加入详细的日志记录。调试 MCP 问题时，日志是最有用的手段。注意：stdio 模式下日志要输出到 stderr（`console.error`），因为 stdout 被 JSON-RPC 占用了。
- **DO 使用 MCP Inspector 测试**：在集成到 Agent 之前，先用 Inspector 测试每个工具是否正常工作。
- **DO 版本管理**：在 MCP Server 的 metadata 中标注版本号。当 Server 升级 API 时，Client 可以根据版本做兼容处理。

### DON'T

- **DON'T 在 Tool 里做过于复杂的操作**：一个 Tool 应该做一件事。如果一个 Tool 又查数据又写数据又发通知，拆成三个 Tool。AI 更容易理解和正确使用职责单一的工具。
- **DON'T 忽视安全**：不要在 MCP Server 中硬编码 API Key 或密码。使用环境变量传入敏感信息。不要信任来自 AI 的输入——做参数校验，就像处理用户输入一样。
- **DON'T 让 Tool 返回过长的内容**：AI 的上下文窗口有限。如果工具返回的数据量很大（比如一个 1000 行的文件），做摘要或分页，而不是把整个内容塞进去。
- **DON'T 混淆 stdout 和 stderr**：stdio 模式下，stdout 是 JSON-RPC 的通信通道，任何非 JSON-RPC 的输出都会导致协议解析错误。调试信息用 `console.error`（输出到 stderr）。这是新手最容易踩的坑。
- **DON'T 忘记处理 Server 的生命周期**：连接建立、断开、重连都需要处理。特别是在长时间运行的应用中，网络抖动或 Server 重启是常态。
- **DON'T 给每个 Tool 起相似的名字**：AI 靠名字和描述来区分工具。`search_notes` 和 `find_notes` 会让 AI 困惑。名称要有区分度。

---

## 代码实战

### 实战：为 Agent 助手添加 MCP 热插拔能力

我们来完善上面的代码，实现一个完整的 MCP 集成方案：用户可以在 UI 上添加、移除 MCP Server，Agent 会自动获取新工具。

> **项目归属**：本节代码分两部分。14.5 里的笔记 MCP Server 是**独立的 `mcp-notes-server` 项目**，先 `npx tsc` 编译成 `dist/index.js`。下面从 `lib/mcp-manager.ts` 开始的代码都在**主线 Next.js 项目**里——`lib/mcp-manager.ts`、`app/api/mcp/route.ts`、`app/api/chat/route.ts`、`components/McpServerPanel.tsx` 各自放在对应目录。想接入刚写的笔记 Server，把它加进面板的 `PRESET_SERVERS`（`command: 'node'`，`args: ['<绝对路径>/mcp-notes-server/dist/index.js']`）即可；面板里预置的 filesystem / github 只是两个示例。

```typescript
// lib/mcp-manager.ts — 完整的 MCP 管理器
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tool } from 'ai';
import { jsonSchema } from 'ai';

interface ServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ServerState {
  config: ServerConfig;
  client: Client;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  tools: string[];       // 工具名列表
  error?: string;
}

export class McpManager {
  private servers: Map<string, ServerState> = new Map();
  private onChangeCallbacks: Array<() => void> = [];

  // 注册变更监听（当工具列表变化时通知）
  onChange(callback: () => void) {
    this.onChangeCallbacks.push(callback);
    return () => {
      this.onChangeCallbacks = this.onChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyChange() {
    this.onChangeCallbacks.forEach(cb => cb());
  }

  // 添加并连接一个 MCP Server
  async addServer(config: ServerConfig): Promise<void> {
    if (this.servers.has(config.id)) {
      throw new Error(`Server "${config.id}" 已存在`);
    }

    const client = new Client(
      { name: 'ai-assistant', version: '1.0.0' },
      { capabilities: {} }
    );

    const state: ServerState = {
      config,
      client,
      status: 'connecting',
      tools: [],
    };

    this.servers.set(config.id, state);

    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });

      await client.connect(transport);
      state.status = 'connected';

      // 发现工具
      const { tools } = await client.listTools();
      state.tools = tools.map(t => t.name);

      console.log(`MCP Server "${config.name}" 已连接，提供 ${tools.length} 个工具`);
      this.notifyChange();
    } catch (error) {
      state.status = 'error';
      state.error = error instanceof Error ? error.message : String(error);
      console.error(`MCP Server "${config.name}" 连接失败:`, state.error);
      throw error;
    }
  }

  // 移除一个 MCP Server
  async removeServer(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) return;

    try {
      await state.client.close();
    } catch {
      // 忽略关闭错误
    }

    this.servers.delete(serverId);
    console.log(`MCP Server "${state.config.name}" 已断开`);
    this.notifyChange();
  }

  // 获取所有 Server 的状态（给 UI 展示）
  getServerStatuses(): Array<{
    id: string;
    name: string;
    status: string;
    tools: string[];
    error?: string;
  }> {
    return Array.from(this.servers.values()).map(state => ({
      id: state.config.id,
      name: state.config.name,
      status: state.status,
      tools: state.tools,
      error: state.error,
    }));
  }

  // 将所有已连接 Server 的工具转换为 Vercel AI SDK 格式
  async getAiSdkTools(): Promise<Record<string, ReturnType<typeof tool>>> {
    const allTools: Record<string, ReturnType<typeof tool>> = {};

    for (const [serverId, state] of this.servers) {
      if (state.status !== 'connected') continue;

      try {
        const { tools: mcpTools } = await state.client.listTools();

        for (const mcpTool of mcpTools) {
          const toolName = `${serverId}__${mcpTool.name}`;

          allTools[toolName] = tool({
            description: `[${state.config.name}] ${mcpTool.description || ''}`,
            inputSchema: jsonSchema(mcpTool.inputSchema),
            execute: async (args) => {
              try {
                const result = await state.client.callTool({
                  name: mcpTool.name,
                  arguments: args,
                });

                return result.content
                  .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
                  .map(c => c.text)
                  .join('\n');
              } catch (error) {
                return `工具调用失败: ${error instanceof Error ? error.message : String(error)}`;
              }
            },
          });
        }
      } catch (error) {
        console.error(`获取 Server "${serverId}" 的工具失败:`, error);
      }
    }

    return allTools;
  }
}

// 全局单例
export const mcpManager = new McpManager();
```

```typescript
// app/api/mcp/route.ts — MCP Server 管理 API
import { mcpManager } from '@/lib/mcp-manager';

// 获取所有 MCP Server 状态
export async function GET() {
  const statuses = mcpManager.getServerStatuses();
  return Response.json({ servers: statuses });
}

// 添加新的 MCP Server
export async function POST(req: Request) {
  const config = await req.json();

  try {
    await mcpManager.addServer(config);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// 移除 MCP Server
export async function DELETE(req: Request) {
  const { serverId } = await req.json();
  await mcpManager.removeServer(serverId);
  return Response.json({ success: true });
}
```

```typescript
// app/api/chat/route.ts — 集成 MCP 工具的聊天 API
import { deepseek } from '@ai-sdk/deepseek';
import { streamText, convertToModelMessages, isStepCount, toUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { mcpManager } from '@/lib/mcp-manager';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // 动态获取所有 MCP 工具
  const mcpTools = await mcpManager.getAiSdkTools();

  const result = streamText({
    model: deepseek('deepseek-chat'),
    instructions: `你是一个智能工作助手。你可以使用以下工具来帮助用户完成任务。
工具名格式为"server名__工具名"，调用时选择最合适的工具。`,
    messages: await convertToModelMessages(messages),
    tools: {
      ...mcpTools,
      // 你也可以保留一些内置工具
    },
    stopWhen: isStepCount(10),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

```tsx
// components/McpServerPanel.tsx — MCP Server 管理面板
'use client';

import { useState, useEffect } from 'react';

interface ServerStatus {
  id: string;
  name: string;
  status: string;
  tools: string[];
  error?: string;
}

// 预置的 MCP Server 列表
const PRESET_SERVERS = [
  {
    id: 'filesystem',
    name: '文件系统',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/workspace'],
    description: '读写文件',
  },
  {
    id: 'github',
    name: 'GitHub',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
    description: '操作 GitHub 仓库和 issues',
  },
];

export function McpServerPanel() {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // 加载 Server 状态
  const refreshServers = async () => {
    const res = await fetch('/api/mcp');
    const data = await res.json();
    setServers(data.servers);
  };

  useEffect(() => {
    refreshServers();
    const interval = setInterval(refreshServers, 5000);
    return () => clearInterval(interval);
  }, []);

  // 连接 Server
  const connectServer = async (preset: typeof PRESET_SERVERS[0]) => {
    setLoading(prev => ({ ...prev, [preset.id]: true }));
    try {
      await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
      });
      await refreshServers();
    } catch (error) {
      console.error('连接失败:', error);
    }
    setLoading(prev => ({ ...prev, [preset.id]: false }));
  };

  // 断开 Server
  const disconnectServer = async (serverId: string) => {
    await fetch('/api/mcp', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId }),
    });
    await refreshServers();
  };

  const connectedIds = new Set(servers.map(s => s.id));

  return (
    <div className="p-4 border rounded-lg bg-white">
      <h3 className="font-bold text-lg mb-4">MCP 工具连接</h3>

      {/* 已连接的 Server */}
      {servers.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-600 mb-2">已连接</h4>
          {servers.map(server => (
            <div
              key={server.id}
              className="flex items-center justify-between p-3 mb-2 bg-green-50 rounded"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="font-medium">{server.name}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {server.tools.length} 个工具: {server.tools.join(', ')}
                </div>
              </div>
              <button
                onClick={() => disconnectServer(server.id)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                断开
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 可用的 Server */}
      <div>
        <h4 className="text-sm font-medium text-gray-600 mb-2">可用工具</h4>
        {PRESET_SERVERS.filter(p => !connectedIds.has(p.id)).map(preset => (
          <div
            key={preset.id}
            className="flex items-center justify-between p-3 mb-2 bg-gray-50 rounded"
          >
            <div>
              <span className="font-medium">{preset.name}</span>
              <div className="text-xs text-gray-500">{preset.description}</div>
            </div>
            <button
              onClick={() => connectServer(preset)}
              disabled={loading[preset.id]}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {loading[preset.id] ? '连接中...' : '连接'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 实操练习

### 目标

为你的 AI 工作助手实现 MCP 热插拔能力。用户可以在界面上连接/断开 MCP Server，连接后 Agent 自动获得新工具。

### 步骤

1. **创建 MCP Server**：用 `@modelcontextprotocol/sdk` 开发一个笔记管理的 MCP Server，包含 create、search、get、delete 四个工具
2. **本地测试**：用 MCP Inspector 测试所有工具是否正常
3. **实现 MCP Manager**：在你的 Next.js 应用中实现 MCP 连接管理器，支持动态添加/移除 Server
4. **工具转换**：将 MCP 工具自动转换为 Vercel AI SDK 格式
5. **集成到聊天 API**：修改聊天 API，动态加载所有已连接 MCP Server 的工具
6. **管理面板 UI**：实现 MCP Server 管理面板，支持一键连接/断开
7. **端到端测试**：连接笔记 MCP Server → 对 AI 说"帮我记一条笔记" → 验证笔记被创建

### 验收标准

- MCP Server 能独立运行，通过 Inspector 测试全部通过
- 在 UI 上能看到可用的 MCP Server 列表
- 点击"连接"后，Server 状态变为"已连接"，显示可用工具列表
- 连接 Server 后，AI 能自动使用该 Server 提供的工具
- 断开 Server 后，AI 不再使用该 Server 的工具
- 全程不需要重启应用（热插拔）

### 挑战加分项

- **自定义 MCP Server 配置**：允许用户在 UI 上填写任意 MCP Server 的命令和参数，连接社区的 MCP Server
- **连接状态监控**：实现心跳检测，Server 断连时自动标记为不可用并提示用户
- **多 Server 协同**：连接文件系统 Server 和笔记 Server，让 AI 能把文件内容自动保存为笔记
- **Resource 集成**：不仅使用 MCP Server 的 Tools，还读取它的 Resources 作为 AI 的上下文
- **安全控制**：实现工具调用前的审批机制——危险操作（删除、修改）需要用户在 UI 上确认

---

## 本章小结

本章我们系统学习了 MCP 协议——AI Agent 领域的标准化工具接口。核心知识点回顾：

1. **MCP 的价值**在于标准化。没有 MCP，每个框架各写各的工具格式；有了 MCP，一次开发到处使用。这就像 USB 统一了设备接口，REST 统一了 API 设计。

2. **MCP 架构**由三个角色组成：Host（运行 AI 的应用）、Client（连接 Server 的组件）、Server（提供工具和数据的服务）。它们通过 JSON-RPC 协议通信，传输层支持 stdio（本地）和 HTTP+SSE（远程）。

3. **MCP 的三大能力**：Tools（让 AI 执行操作）、Resources（让 AI 读取数据）、Prompts（预定义交互模板）。Tools 是 AI 控制的，Prompts 是用户控制的，Resources 两者都可以。

4. **开发 MCP Server** 的体验类似于写 Express API——定义工具（路由）、实现执行逻辑（处理函数）、启动服务。`@modelcontextprotocol/sdk` 提供了完整的 TypeScript 支持。

5. **集成 MCP Client** 的关键是将 MCP 工具转换为你的 Agent 框架的格式。对于 Vercel AI SDK，核心是把 MCP 的 Tool Schema 转成 `tool()` 函数。

6. **MCP vs 直接写 Tool**：工具只在内部用就直接写，有复用价值就做成 MCP Server。经验法则：如果你在不同项目里复制粘贴同一个工具的代码，它就该变成 MCP Server。

7. **安全是重中之重**：不要随便信任第三方 MCP Server，做好来源审核、权限控制、沙箱隔离和监控审计。

通过本章的学习，你的 AI 助手已经具备了"热插拔"工具的能力——不需要改代码，只需配置连接新的 MCP Server，就能获得新的能力。下一章我们将进入 Multi-Agent 协作的世界，让多个专业 Agent 像团队一样分工合作。
