// Lab 13 · Multi-Agent 协作
// 目标：理解"多个 agent 分工 + 路由"——售前 agent 和售后 agent 各管一摊
import "dotenv/config";
import { generateText, Output } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

// ① 路由 agent：判断问题属于售前还是售后
async function route(question: string): Promise<"售前" | "售后"> {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    prompt: `判断下面这个问题属于"售前"还是"售后"（售前=商品咨询/价格/库存/推荐，售后=退款/物流/投诉/维修）：\n${question}`,
    output: Output.object({
      schema: z.object({ category: z.enum(["售前", "售后"]) }),
    }),
  });
  return result.output.category;
}

// ② 售前 agent：专注商品咨询
async function presaleAgent(question: string) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是售前客服，负责商品咨询、价格、库存、推荐。回答要专业、有推荐性。",
    prompt: question,
  });
  return result.text;
}

// ③ 售后 agent：专注退款物流
async function aftersaleAgent(question: string) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是售后客服，负责退款、物流、投诉、维修。回答要安抚情绪、给出可执行步骤。",
    prompt: question,
  });
  return result.text;
}

async function main() {
  const question = process.argv[2] ?? "我买的商品坏了，想退款怎么办？";

  // 路由 → 分工
  const category = await route(question);
  console.log(`🎯 路由结果：交给【${category}】agent 处理\n`);

  const answer =
    category === "售前" ? await presaleAgent(question) : await aftersaleAgent(question);

  console.log(`🤖 【${category} agent】回答：\n` + answer);
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
