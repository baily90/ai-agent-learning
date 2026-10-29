// 工具定义：查订单。execute 返回结构化数据，前端会把它渲染成「订单卡片」组件
import { tool } from "ai";
import { z } from "zod";

// 模拟订单数据
const orders: Record<string, { status: string; logistics: string; totalAmount: number; items: string[] }> = {
  "20231001001": {
    status: "已发货",
    logistics: "顺丰 SF1234567890",
    totalAmount: 299,
    items: ["iPhone 手机壳 x1", "钢化膜 x2"],
  },
  "20231002002": {
    status: "待支付",
    logistics: "—",
    totalAmount: 129,
    items: ["Type-C 数据线 x1"],
  },
};

export const orderTool = tool({
  description: "查询订单。用户问订单状态、物流、金额时使用。",
  inputSchema: z.object({
    orderNo: z.string().describe("订单号，例如 20231001001"),
  }),
  execute: async ({ orderNo }) => {
    const order = orders[orderNo];
    if (!order) return { orderNo, status: "订单不存在", logistics: "—", totalAmount: 0, items: [] };
    return { orderNo, ...order };
  },
});

export const tools = { getOrder: orderTool };
