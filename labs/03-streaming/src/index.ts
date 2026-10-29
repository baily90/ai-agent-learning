// Lab 03 · 流式输出
// 目标：体验 streamText 打字机效果，理解 TTFB（首字延迟）
import "dotenv/config";
import { streamText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

async function main() {
  const question = process.argv[2] ?? "用 100 个字讲一个小故事";

  const result = streamText({
    model: deepseek("deepseek-chat"),
    prompt: question,
    instructions: `
      你非常善于讲儿童故事。可以根据用户的需求编故事。
      故事情节要适合3-6岁小朋友。
      避免恐怖、血腥等负面的故事情节。
      篇幅不要太长 200字以内。
    `
  });

  const start = Date.now();
  let firstChunkAt: number | null = null;

  process.stdout.write("🤖 ");
  // textStream 是一个异步迭代器，逐块吐出文本（就像打字机）
  for await (const chunk of result.textStream) {
    if (firstChunkAt === null) firstChunkAt = Date.now();
    process.stdout.write(chunk);
  }
  const end = Date.now();

  console.log("\n\n📊 统计：");
  console.log(`  首字延迟 TTFB：${firstChunkAt ? firstChunkAt - start : 0} ms`);
  console.log(`  总耗时：${end - start} ms`);
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
