// Lab 06 · Function Calling / 工具调用
// 目标：让 AI 从"只会聊天"升级为"能查数据、能干活"
import "dotenv/config";
import { generateText, isStepCount, tool } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

// 模拟的订单数据（真实项目里这里调数据库）
const orders: Record<string, { status: string; logistics: string | null; refundProcess: string }> = {
  "20231001001": { status: "已发货", logistics: "顺丰 SF1234567890", refundProcess: '待审核'},
  "20231002002": { status: "待支付", logistics: null, refundProcess: '已退款' },
};

// 工具：查订单。description 是给 AI 看的"使用说明书"
const getOrder = tool({
  description: "根据订单号查询订单状态和物流信息。用户问'我的订单到哪了/什么状态'时使用。",
  inputSchema: z.object({
    orderNo: z.string().describe("订单号，例如 20231001001"),
  }),
  execute: async ({ orderNo }) => {
    const order = orders[orderNo];
    if (!order) return { error: "未找到该订单" };
    return order;
  },
});

// 工具：查退款进度
const getRefundStatus = tool({
  description: '根据订单号查询订单退款状态',
  inputSchema: z.object({orderNo: z.string().describe('订单号')}),
  async execute({orderNo}) {
    const order = orders[orderNo]
    if (!order) return { error: "未找到该订单" };
    return order;
  }
})

async function main() {
  const question = process.argv[2] ?? "我的订单 20231001001 到哪了？";

  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是电商客服。用户询问订单时，用 getOrder 工具查询后回答。当用户询问退款信息是调用getRefundStatus 工具后回答",
    prompt: question,
    tools: { getOrder, getRefundStatus },
    // 最多允许 5 步工具调用循环，防止死循环
    stopWhen: isStepCount(5),
  });

  console.log("🤖 回答：\n" + result.text);
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
