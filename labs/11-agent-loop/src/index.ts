// Lab 11 · Agent 核心循环
// 目标：观察 Agent 如何"自主规划多步任务"——先查数据，再查规则，最后综合回答
import "dotenv/config";
import { generateText, isStepCount, tool } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

// 模拟数据
const orders: Record<string, { status: string }> = {
  "20231001001": { status: "已发货" },
  "20231002002": { status: "待支付" },
};

const getOrder = tool({
  description: "查询订单状态。用户问'我的订单什么状态/到哪了'时使用。",
  inputSchema: z.object({ orderNo: z.string().describe("订单号") }),
  execute: async ({ orderNo }) => orders[orderNo] ?? { status: "订单不存在" },
});

const getRefundPolicy = tool({
  description: "查询退款规则。用户问'怎么退款/退款流程/能退吗'时使用。",
  inputSchema: z.object({ status: z.string().describe("订单当前状态") }),
  execute: async ({ status }) => {
    const rules: Record<string, string> = {
      已发货: "已发货订单：先申请退货退款 → 寄回商品 → 商家验货 → 退款到账（约 3-5 个工作日）",
      待支付: "待支付订单：直接取消即可，无需走退款流程",
      已完成: "已完成订单：签收超 7 天不支持退款",
    };
    return { rule: rules[status] ?? "未知状态，请转人工客服" };
  },
});

async function main() {
  const question =
    process.argv[2] ?? "我的订单 20231001001 想退款，告诉我具体怎么做？";

  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是电商客服。回答退款/订单问题前，先查订单状态，再查退款规则，最后综合回答。",
    prompt: question,
    tools: { getOrder, getRefundPolicy },
    // 允许最多 10 步工具调用（多步任务需要更多步数）
    stopWhen: isStepCount(10),
  });

  console.log("\n🔍 Agent 的工具调用过程：");
  for (const call of result.toolCalls) {
    console.log(`  1️⃣ ${call.toolName}(${JSON.stringify(call.input)})`);
  }

  console.log("\n🤖 最终回答：\n" + result.text);
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
