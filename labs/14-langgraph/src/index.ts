// Lab 14 · LangGraph 编排
// 目标：用 LangGraph 把"确定性步骤 + LLM 步骤"组成一张有向图
import "dotenv/config";
import { Annotation, StateGraph, START, END, MemorySaver, interrupt, Command, isInterrupted, INTERRUPT } from "@langchain/langgraph";
import { createInterface } from "node:readline/promises";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

const checkpointer = new MemorySaver()

async function auditNode(state: typeof StateAnnotation.State) {
  console.log("🛑 进入人工审核");
  const decision = interrupt("请人工审核：是否批准退款？"); // 暂停，resume 后返回人工输入
  return { approval: decision };
}

// ① 定义状态：图里节点之间流转的共享数据
const StateAnnotation = Annotation.Root({
  userInput: Annotation<string>,
  classification: Annotation<string>,
  answer: Annotation<string>,
  approval: Annotation<string>
});

// ② 节点 1：确定性分类（纯代码，不调 LLM，可预测可审计）
async function classifyNode(state: typeof StateAnnotation.State) {
  const hasComplaint = /退款|退货|投诉|坏|质量问题/.test(state.userInput);
  return { classification: hasComplaint ? "投诉" : "普通咨询" };
}

// ③ 节点 2：LLM 生成回答（模型驱动，灵活）
async function beforeNode(state: typeof StateAnnotation.State) {
  console.log('beforeNode');
  
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: `你是高级电商售前客服。请回答用户问题`,
    prompt: state.userInput,
  });
  return { answer: result.text };
}

async function afterNode(state: typeof StateAnnotation.State) {
  console.log('afterNode');
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: `你是高级电商售后客服。请回答用户问题`,
    prompt: state.userInput,
  });
  return { answer: result.text };
}



const routeFn = (state: typeof StateAnnotation.State) => {
  return state.classification === '投诉' ? 'after' : 'before'
}

// ④ 组装图：START → classify → generate → END
const graph = new StateGraph(StateAnnotation)
  .addNode("classify", classifyNode)
  .addNode('audit', auditNode) 
  .addNode('after', afterNode)
  .addNode('before', beforeNode)
  // .addNode("generate", answerNode)
  .addEdge(START, "classify")
  // .addEdge("classify", "generate")
  .addConditionalEdges('classify', routeFn, {before: 'before', after: 'audit'})
  .addEdge("audit", "after")
  .addEdge("before", END)
  .addEdge("after", END)
  .compile({checkpointer});

async function main() {
  const userInput = process.argv[2] ?? "我买的商品坏了，我要退款";
  console.log(`❓ 输入：${userInput}\n`);

  const config = { configurable: { thread_id: "user-123" }}

  const result = await graph.invoke({ userInput }, config);

  if (isInterrupted(result)) {
    console.log("⏸️  已暂停，等待人工审核：", result[INTERRUPT][0].value);

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const decision = await rl.question("请输入审核结果（批准/拒绝）：");
    rl.close();
    // const decision = "批准";   // 模拟人工决定

    const finalResult = await graph.invoke(new Command({ resume: decision }), config);
    console.log(`✅ 审核结果：${finalResult.approval}`);
    console.log(`🤖 回答：${finalResult.answer}`);
  }else {
    // 普通咨询分支：没有 interrupt，直接走完
    console.log(`🏷️  分类结果：${result.classification}`);
    console.log(`🤖 回答：${result.answer}`);
  }


}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
