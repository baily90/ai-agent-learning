// Lab 01 · 第一次调用 LLM
// 目标：跑通 AI SDK 7 第一次调用 DeepSeek，看懂 generateText 和 token 统计
import "dotenv/config";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

// 用法：
//   npm run ask                      → 用默认问题
//   npm run ask "什么是大模型"        → 自定义问题
//   npm run ask "什么是大模型" 0      → 自定义问题 + temperature=0（最稳定）
//   npm run ask "什么是大模型" 1.5    → 自定义问题 + temperature=1.5（更有创意）
const question = process.argv[2] ?? "用一句话介绍你自己";
const temperatureArg = process.argv[3];

async function main() {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    prompt: question,
    // temperature：0 最稳定，值越大输出越随机。不传则用模型默认值
    temperature: temperatureArg ? Number(temperatureArg) : undefined,
  });

  console.log("\n🤖 回答：");
  console.log(result.text);

  console.log("\n📊 本次调用统计（usage 字段）：");
  console.log(result.usage);
  console.log(`   finishReason: ${result.finishReason}`);
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
