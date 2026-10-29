// Lab 19 · 成本优化
// 目标：理解 token 就是钱，学会精简 prompt 控制成本
import "dotenv/config";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

// 冗长的 system prompt（很多废话）
const verboseSystem =
  "你是一个非常非常专业、经验丰富、认真负责、热情友好的电商客服助手，你的主要职责就是帮助用户解决他们在购物过程中遇到的各种各样的问题，包括但不限于退款、退货、物流、优惠券、发票等等等等，请务必用礼貌、耐心、细致、周到的方式回答用户的问题。";

// 精简的 system prompt（同样意思，少很多字）
const conciseSystem = "你是电商客服，回答准确简洁。";

async function run(label: string, system: string, question: string) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system,
    prompt: question,
  });
  const usage = result.usage as { inputTokens?: number; outputTokens?: number } | undefined;
  console.log(`\n【${label}】`);
  console.log(`  system 长度：${system.length} 字`);
  console.log(`  输入 token：${usage?.inputTokens ?? "N/A"} | 输出 token：${usage?.outputTokens ?? "N/A"}`);
  return result.text;
}

async function main() {
  const question = process.argv[2] ?? "怎么退款？";

  console.log("对比同一个问题，两种 system prompt 的成本差异：");
  await run("冗长 prompt", verboseSystem, question);
  await run("精简 prompt", conciseSystem, question);

  console.log("\n💡 结论：输入 token 直接决定成本。system prompt 越精简，每次调用越省钱。");
  console.log("   多轮对话里，冗长的 system 会被重复计费——这就是为什么生产环境要精心打磨 prompt。");
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
