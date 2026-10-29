// Lab 20 · 提示词管理（Langfuse Prompt Management）
// 目标：把 prompt 从代码里抽出来，交给 Langfuse 版本化管理，代码里按版本获取
import "dotenv/config";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_BASEURL,
});

async function main() {
  const userInput = process.argv[2] ?? "我买的商品怎么退款？";

  // ① 从 Langfuse 获取 prompt（第一次运行会自动创建）
  let prompt;
  try {
    prompt = await langfuse.prompt.get("customer-service");
  } catch {
    prompt = await langfuse.prompt.create({
      name: "customer-service",
      type: "text",
      prompt: "你是电商客服。用户问题：{{userInput}}。请礼貌、简洁地回答。",
      labels: ["production"],
    });
    console.log("✨ 已在 Langfuse 创建 prompt（v1）\n");
  }

  // ② 编译 prompt：用 {{变量}} 占位，运行时填入
  const compiled = prompt.compile({ userInput });
  console.log("📄 编译后的 prompt：\n" + compiled + "\n");

  // ③ 用编译后的 prompt 调 LLM
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    prompt: compiled,
  });

  console.log("🤖 回答：\n" + result.text);
  console.log("\n💡 现在打开 Langfuse UI (http://localhost:3000) → Prompts，");
  console.log("   你会看到这个 prompt 被版本化管理了。改它、发新版，代码不用动。");
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
