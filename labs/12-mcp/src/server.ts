// Lab 12 · MCP server（stdio 模式）
// 一个最小的 MCP server：暴露一个查天气工具
// 注意：stdio 模式下绝不能 console.log（会破坏 JSON-RPC），日志走 stderr
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "mall-tools", version: "1.0.0" });

// 注册一个工具：getWeather
server.tool(
  "getWeather",
  "查询指定城市的天气",
  { city: z.string().describe("城市名称") },
  async ({ city }) => {
    // 演示用模拟数据；真实项目里这里调天气 API 或数据库
    const temp = Math.floor(Math.random() * 25) + 5;
    return {
      content: [{ type: "text" as const, text: `${city}：晴，${temp}℃` }],
    };
  },
);

// 通过 stdio 启动：由客户端（index.ts）spawn 这个进程
const transport = new StdioServerTransport();
await server.connect(transport);
