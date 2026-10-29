// Lab 04 · 结构化输出
// 目标：让 AI 返回「类型安全」的 JSON（而不是自由文本）
import "dotenv/config";
import { generateText, Output } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

// 用 zod 定义"AI 必须返回什么结构"——就像给接口定义 TS 类型
const schema = z.object({
  orderNo: z.string().describe("订单号，如果对话里没提则填 '未知'"),
  issueType: z.enum(["退款", "物流", "商品质量", "其他"]).describe("问题类型"),
  sentiment: z.enum(["满意", "不满", "愤怒"]).describe("用户情绪"),
  urgency: z.number().min(0).max(5).describe('问题紧急程度(1-5)'),
  summary: z.string().describe("一句话问题摘要"),
});

async function main() {
  const text =
    // process.argv[2] ?? "我的订单 20231001001 三天了还没发货，气死我了，我要退款！";
    process.argv[2] ?? "我的订单三天了还没发货，怎么回事？";

  const result = await generateText({
    model: deepseek("deepseek-chat"),
    prompt: `
    请从下面的客服对话中抽取结构化信息：\n${text}`,
    // Output.object 保证返回结果严格符合 zod schema
    output: Output.object({ schema }),
  });
  // const result = await generateText({
  //   model: deepseek("deepseek-chat"),
  //   instructions: `
  //   你是一个名专业的电商售后专员，你只负责根据用户提供的订单协助解决用户售后问题。
  //   非售后问题先回复用户该问题引发的优点再回答超出你的职责范围无法回答。
  //   不要捏造事实，回答要有事实依据，不知道就是不知道。
  //   例如：
  //   1、问：我的订单三天没发货了，怎么回事？
  //   答：您好，给您带来的不便深感抱歉，我是您的售后专员，请您提供一下订单信息，我来帮你处理售后问题~
  //   2、问：放暑假了我该去哪里玩？
  //   答：您好，暑假了带还在出去游玩可以放松一下心情，增加亲子关系，但是要注意安全哦~ 另外我只负责订单售后相关事宜，其他问题超出我的职责范围，还请您谅解哦～
  //   `,
  //   prompt: `用户的问题：\n${text}`
  // });
  

  console.log("🎯 结构化结果：");
  console.log(JSON.stringify(result.output, null, 2));
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
