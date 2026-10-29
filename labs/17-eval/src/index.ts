// Lab 17 · 评估（LLM-as-judge）
// 目标：用"另一个 LLM"当裁判，自动评估客服回答的质量
import "dotenv/config";
import { generateText, Output } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

// 被评估的对象：一个客服 system prompt
const SYSTEM = "你是电商客服，回答要准确、简洁。";

// 评估数据集：一组（输入 + 评估标准）
const evalSet = [
  { input: "我买的商品怎么退款？", criteria: "回答包含退款流程和到账时间" },
  { input: "我的订单到哪了？", criteria: "回答说明如何查询物流" },
  { input: "优惠券过期了还能用吗？", criteria: "明确说明过期券不可用" },
];

// LLM-as-judge：用另一个 LLM 打分
async function judge(input: string, answer: string, criteria: string) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    prompt: `你是一个严格的评审。评估下面的客服回答质量。
用户问题：${input}
客服回答：${answer}
评估标准：${criteria}
请打 1-5 分并说明理由。`,
    output: Output.object({
      schema: z.object({
        score: z.number().min(1).max(5).describe("1-5 分"),
        reason: z.string().describe("评分理由"),
      }),
    }),
  });
  return result.output;
}

async function main() {
  let total = 0;

  for (const item of evalSet) {
    // ① 被评估对象生成回答
    const answer = await generateText({
      model: deepseek("deepseek-chat"),
      system: SYSTEM,
      prompt: item.input,
    });

    // ② LLM-as-judge 打分
    const verdict = await judge(item.input, answer.text, item.criteria);
    total += verdict.score;

    console.log(`\n❓ ${item.input}`);
    console.log(`💬 ${answer.text}`);
    console.log(`⭐ ${verdict.score}/5 —— ${verdict.reason}`);
  }

  console.log(`\n📊 平均分：${(total / evalSet.length).toFixed(2)} / 5`);
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
