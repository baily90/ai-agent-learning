import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { createAnswerRelevancyScorer, createToxicityScorer } from '@mastra/evals/scorers/prebuilt';
import { getOrder, checkLogistics, applyRefund } from '../tools/order';

// 子 agent 1：查单专家（第36章 · subagents）
const orderExpert = new Agent({
  id: 'order-expert',
  name: 'Order Expert',
  description: '查询订单状态、物流信息、退款金额的专家。',
  model: 'deepseek/deepseek-chat',
  tools: { getOrder, checkLogistics, applyRefund },
});

// 子 agent 2：话术润色专家
const toneExpert = new Agent({
  id: 'tone-expert',
  name: 'Tone Expert',
  description: '把结论改写成温柔、安抚的客服话术。',
  model: 'deepseek/deepseek-chat',
});

// 主管 agent：协调子 agent + 带记忆 + 带评测（第32/34/35/36章）
export const supportAgent = new Agent({
  id: 'support',
  name: 'Support Supervisor',
  model: 'deepseek/deepseek-chat',
  instructions: `你是"云上商城"的售后客服主管。

规则：
1. 用户问订单/物流/退款，委托 order-expert 查询
2. 最终回复前委托 tone-expert 润色语气（先安抚再解决）
3. 不知道的信息不要编造，如实说明`,
  tools: { getOrder, checkLogistics, applyRefund },
  agents: { orderExpert, toneExpert },
  memory: new Memory({
    storage: new LibSQLStore({ id: 'support-storage', url: 'file:./mastra.db' }),
    options: {
      lastMessages: 20,
      workingMemory: { enabled: true },  // 记住用户偏好（第34章）
    },
  }),
  scorers: {
    relevancy: {
      scorer: createAnswerRelevancyScorer({ model: 'deepseek/deepseek-chat' }),
      sampling: { type: 'ratio', rate: 0.5 },   // 抽样 50%（第35章）
    },
    safety: {
      scorer: createToxicityScorer({ model: 'deepseek/deepseek-chat' }),
      sampling: { type: 'ratio', rate: 1 },
    },
  },
});
