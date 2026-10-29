// Lab 14 · LangGraph 编排
// 目标：用 LangGraph 把"确定性步骤 + LLM 步骤"组成一张有向图
import "dotenv/config";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

// ① 定义状态：图里节点之间流转的共享数据
const StateAnnotation = Annotation.Root({
  userInput: Annotation<string>,
  classification: Annotation<string>,
  answer: Annotation<string>,
});

// ② 节点 1：确定性分类（纯代码，不调 LLM，可预测可审计）
async function classifyNode(state: typeof StateAnnotation.State) {
  const hasComplaint = /退款|退货|投诉|坏|质量问题/.test(state.userInput);
  return { classification: hasComplaint ? "投诉" : "普通咨询" };
}

// ③ 节点 2：LLM 生成回答（模型驱动，灵活）
async function answerNode(state: typeof StateAnnotation.State) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: `你是电商客服。用户问题属于「${state.classification}」类，请相应回答。`,
    prompt: state.userInput,
  });
  return { answer: result.text };
}

// ④ 组装图：START → classify → answer → END
const graph = new StateGraph(StateAnnotation)
  .addNode("classify", classifyNode)
  .addNode("answer", answerNode)
  .addEdge(START, "classify")
  .addEdge("classify", "answer")
  .addEdge("answer", END)
  .compile();

async function main() {
  const userInput = process.argv[2] ?? "我买的商品坏了，我要退款";
  console.log(`❓ 输入：${userInput}\n`);

  const result = await graph.invoke({ userInput });

  console.log(`🏷️  分类结果：${result.classification}`);
  console.log(`🤖 回答：${result.answer}`);
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
