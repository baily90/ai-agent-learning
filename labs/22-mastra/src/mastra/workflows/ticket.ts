import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

// step 1：分类意图
const classifyIntent = createStep({
  id: 'classify-intent',
  inputSchema: z.object({ userMessage: z.string() }),
  outputSchema: z.object({
    intent: z.enum(['退款', '物流', '咨询']),
    orderId: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { userMessage } = inputData;
    const orderId = userMessage.match(/ORD-\d+/)?.[0] ?? 'ORD-1001';
    const intent = userMessage.includes('退款') ? '退款'
      : userMessage.includes('物流') || userMessage.includes('到哪') ? '物流'
      : '咨询';
    return { intent, orderId };
  },
});

// step 2：查订单（纯逻辑，演示 schema 咬合数据流）
const fetchOrder = createStep({
  id: 'fetch-order',
  inputSchema: z.object({
    intent: z.enum(['退款', '物流', '咨询']),
    orderId: z.string(),
  }),
  outputSchema: z.object({
    intent: z.enum(['退款', '物流', '咨询']),
    orderId: z.string(),
    status: z.string(),
    amount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { intent, orderId } = inputData;
    return {
      intent,
      orderId,
      status: '已发货',
      amount: intent === '退款' ? 800 : 299,   // 退款金额 800 用于演示审批
    };
  },
});

// step 3：退款审批（suspend/resume，第33章核心）
const refundApproval = createStep({
  id: 'refund-approval',
  inputSchema: z.object({
    intent: z.enum(['退款', '物流', '咨询']),
    orderId: z.string(),
    status: z.string(),
    amount: z.number(),
  }),
  outputSchema: z.object({ decision: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { intent, amount } = inputData;
    if (intent !== '退款') {
      return { decision: '非退款，直接回复' };
    }
    const { approved } = resumeData ?? {};
    if (approved === undefined) {
      // 第一次执行：金额超阈值，暂停等人工审批
      return await suspend({ reason: `退款金额 ${amount} 元超过 500，需人工审批` });
    }
    return { decision: approved ? '退款通过' : '退款驳回' };
  },
});

// step 4：生成回复
const generateReply = createStep({
  id: 'generate-reply',
  inputSchema: z.object({ decision: z.string() }),
  outputSchema: z.object({ reply: z.string() }),
  execute: async ({ inputData }) => {
    return { reply: `客服回复：${inputData.decision}` };
  },
});

export const ticketWorkflow = createWorkflow({
  id: 'ticket-workflow',
  inputSchema: z.object({ userMessage: z.string() }),
  outputSchema: z.object({ reply: z.string() }),
})
  .then(classifyIntent)
  .then(fetchOrder)
  .then(refundApproval)
  .then(generateReply)
  .commit();
