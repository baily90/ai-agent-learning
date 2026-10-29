// Lab 12 · MCP 客户端（AI SDK 连接 MCP server）
// 目标：用 AI SDK 的 createMCPClient 连接 stdio MCP server，把它的工具拿来用
import "dotenv/config";
import { generateText, isStepCount } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { createMCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  // ① 启动并连接 MCP server（stdio 模式：spawn `npx tsx src/server.ts`）
  const mcpClient = await createMCPClient({
    transport: new StdioClientTransport({
      command: "npx",
      args: ["--no-install", "tsx", "src/server.ts"],
    }),
  });

  // ② 把 MCP server 暴露的工具，转成 AI SDK 能用的 tool
  const tools = await mcpClient.tools();
  console.log("🔌 已连接 MCP server，可用工具：", Object.keys(tools));

  // ③ 正常使用这些工具
  const question = process.argv[2] ?? "北京天气怎么样？";
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是助手，用户问天气时用 getWeather 工具。",
    prompt: question,
    tools,
    stopWhen: isStepCount(5),
  });

  console.log("\n🤖 回答：\n" + result.text);

  await mcpClient.close();
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
