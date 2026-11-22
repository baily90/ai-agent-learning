import 'dotenv/config';
import { supportAgent } from '../mastra/agents/support';

async function main() {
  const thread = 'chat-demo';

  // 第一轮：告诉它一个信息
  await supportAgent.generate('我叫小明，我的订单经常用顺丰发货', {
    memory: { resource: 'user-100', thread },
  });

  // 第二轮：验证它记得（workingMemory 生效）
  const r = await supportAgent.generate('我叫什么名字？', {
    memory: { resource: 'user-100', thread },
  });

  console.log('👤 问：我叫什么名字？');
  console.log('🤖 答：', r.text);
}

main().catch((e) => {
  console.error('运行失败。请确认已 cp .env.example .env 并填入 DEEPSEEK_API_KEY');
  console.error(e);
});
