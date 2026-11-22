import { mastra } from '../mastra/index';

async function main() {
  const workflow = mastra.getWorkflow('ticket');
  const run = await workflow.createRun();

  // 退款场景：金额 800 > 500，会触发 suspend
  console.log('▶️  启动工单：我要退款，订单号 ORD-1001');
  const result = await run.start({
    inputData: { userMessage: '我要退款，订单号 ORD-1001' },
  });

  if (result.status === 'suspended') {
    console.log('⏸️  工单已暂停，等待人工审批');
    console.log('   挂起信息：', JSON.stringify(result.suspended));

    // 模拟人工点「通过」
    console.log('👩‍💼 人工审批：通过');
    const final = await run.resume({
      step: 'refund-approval',
      resumeData: { approved: true },
    });
    console.log('✅ 最终结果：', JSON.stringify(final, null, 2));
  } else {
    console.log('✅ 无需审批，直接完成：', JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
