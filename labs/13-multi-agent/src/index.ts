// Lab 13 · Multi-Agent 协作
// 目标：理解"多个 agent 分工 + 路由"——售前 agent 和售后 agent 各管一摊
import "dotenv/config";
import { generateText, Output } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

// ① 路由 agent：判断问题属于售前还是售后
async function route(question: string): Promise<"presale" | "aftersale" | "urgency"> {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    prompt: `判断下面这个问题属于"售前"、"售后"、"工单"（售前(presale)=商品咨询/价格/库存/推荐，售后(aftersale)=退款/物流/投诉/维修，工单(urgency)=处理严重投诉提交工单、升级人工）：\n${question}`,
    output: Output.object({
      schema: z.object({ category: z.enum(["presale", "aftersale", "urgency"]) }),
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


// 4 工单agent：处理严重投诉提交工单、升级人工
const urgencyAgent = async (question: string) => {
  const result = await generateText({
    model: deepseek('deepseek-chat'),
    instructions: '你是一名资深的严重投诉的解决方案专家，你要针对用户的提问进行回复，并引导升级人工',
    prompt: question,
  })
  
  return result.text
}

// 5 审查agent： 针对给出的答复进行审查，检查是否合理或者是否需要补充
const verifyAgent = async(question: string, draftAnswer: string) => {
  const result  = await generateText({
    model: deepseek('deepseek-chat'),
    instructions: '你是一名资深的客服审查专家，你需要针对用户的提问和客服回复的内容进行审查，审查是否准确、专业以及有没有需要补充的，请优化并直接输出修正后的最终回复',
    prompt: `用户输入的问题：${question}\n 客服回复的内容：${draftAnswer}`
  })
  return result.text
}

const routeAgent = {
  presale: presaleAgent,
  aftersale: aftersaleAgent,
  urgency: urgencyAgent
}

async function main() {
  const question = process.argv[2] ?? "我买的商品坏了，想退款怎么办？";

  // 路由 → 分工
  const category = await route(question);
  console.log(`🎯 路由结果：交给【${category}】agent 处理\n`);

  const answer = await routeAgent[category]?.(question)

  console.log(`🤖 【${category} agent】回答：\n` + answer);

  const verify = await verifyAgent(question, answer)
  console.log(`🤖 【verifyAgent】审查：\n` + verify);

}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
