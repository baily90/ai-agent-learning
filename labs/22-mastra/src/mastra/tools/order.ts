import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// 模拟订单数据（真实项目里换成数据库查询）
const ORDERS: Record<string, { status: string; logistics: string | null; amount: number }> = {
  'ORD-1001': { status: '已发货', logistics: '顺丰 SF1001', amount: 299 },
  'ORD-1002': { status: '待付款', logistics: null, amount: 1299 },
  'ORD-1003': { status: '已签收', logistics: '中通 ZT1003', amount: 699 },
};

// 工具一：查订单（第32章 · createTool）
export const getOrder = createTool({
  id: 'getOrder',
  description: '根据订单号查询订单状态与金额。用户询问订单进度、是否发货、金额时调用。',
  inputSchema: z.object({
    orderId: z.string().describe('订单号，如 ORD-1001'),
  }),
  execute: async ({ orderId }) => {
    const order = ORDERS[orderId];
    if (!order) return { error: '订单不存在，请核对订单号' };
    return { orderId, status: order.status, amount: order.amount };
  },
});

// 工具二：查物流
export const checkLogistics = createTool({
  id: 'checkLogistics',
  description: '查询订单的物流轨迹。用户询问"到哪了/物流/快递"时调用。',
  inputSchema: z.object({
    orderId: z.string().describe('订单号，如 ORD-1001'),
  }),
  execute: async ({ orderId }) => {
    const order = ORDERS[orderId];
    if (!order) return { error: '订单不存在' };
    if (!order.logistics) return { orderId, detail: '该订单暂无物流信息' };
    return { orderId, logistics: order.logistics, detail: '已到达本地分拨中心，预计今日送达' };
  },
});

// 工具三：申请退款（返回是否需要审批）
export const applyRefund = createTool({
  id: 'applyRefund',
  description: '为用户提交退款申请。用户明确要求退款时调用。',
  inputSchema: z.object({
    orderId: z.string().describe('订单号'),
    reason: z.string().describe('退款原因'),
  }),
  execute: async ({ orderId, reason }) => {
    const order = ORDERS[orderId];
    if (!order) return { error: '订单不存在' };
    return {
      orderId,
      reason,
      amount: order.amount,
      needApproval: order.amount > 500,   // 金额超 500 需人工审批
    };
  },
});
