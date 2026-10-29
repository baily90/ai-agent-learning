# Lab 12 · MCP 协议

> 配套第 14 章。目标：理解 MCP 的"标准化工具接入"，跑通 stdio 模式。

## 跑起来

```bash
cp .env.example .env      # 填 DeepSeek key
npm install
npm run ask "北京天气怎么样？"
```

## 结构

```
src/
├── server.ts   # MCP server：暴露 getWeather 工具（stdio 模式）
└── index.ts    # 客户端：AI SDK 连接 server，把工具拿来用
```

## 学什么

- **MCP = 工具的标准化接口**：server 用统一协议暴露工具，client 用统一协议发现并调用
- **stdio 模式**：server 是子进程，客户端 `spawn` 它，通过 stdin/stdout 通信
- `createMCPClient` + `StdioClientTransport`：AI SDK 连 MCP 的标准姿势
- `mcpClient.tools()`：把 MCP 工具一键转成 AI SDK 的 tool

## 练什么（挑战）

**挑战 1：加第二个工具**

在 `server.ts` 里再注册一个工具（比如查订单），重新跑，看 AI 能否区分两个工具。

**挑战 2：感受"标准化"的价值**

想想：如果不用 MCP，每次接一个新工具源（天气 API、数据库、第三方服务）你都要写不同的胶水代码。MCP 把这件事标准化了——这正是它的价值。

**挑战 3：对应客服项目**

客服系统里，"查订单""查物流"这些工具可以用 MCP 暴露，未来还能接第三方（物流公司、支付平台）的 MCP server。
