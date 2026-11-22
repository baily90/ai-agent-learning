import 'dotenv/config';
import { supportAgent } from '../mastra/agents/support';

async function main() {
  const q = process.argv[2] ?? '帮我查一下订单 ORD-1001 到哪了';
  console.log('👤 用户：', q);
  console.log('---');
  const r = await supportAgent.generate(q, {
    memory: { resource: 'demo-user', thread: 'demo-thread' },
  });
  console.log('🤖 客服：', r.text);
}

main().catch((e) => {
  console.error('运行失败。请确认已 cp .env.example .env 并填入 DEEPSEEK_API_KEY');
  console.error(e);
});
