// 示例 2：循环/重试（生成 → 评估 → 不满意 → 重生成）
// 图：START → generate → evaluate ─┬─ 不合格 → 回到 generate
//                                   └─ 合格 → END
import "dotenv/config";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

const State = Annotation.Root({
  task: Annotation<string>,
  draft: Annotation<string>,
  score: Annotation<number>,
  attempt: Annotation<number>,
});

async function generateNode(state: typeof State.State) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是严谨的写作助手，认真完成任务。",
    prompt: state.task,
  });
  console.log(`✍️  第 ${state.attempt + 1} 次生成`);
  return { draft: result.text, attempt: state.attempt + 1 };
}

async function evaluateNode(state: typeof State.State) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是评审，给文本打 0-100 分，只输出数字。",
    prompt: state.draft,
  });
  const score = Number(result.text.trim());
  console.log(`📊 评分：${score}`);
  return { score };
}

const PASS = 90;
const MAX_ATTEMPT = 3;
const route = (state: typeof State.State) =>
  state.score >= PASS || state.attempt >= MAX_ATTEMPT ? "done" : "generate";

const graph = new StateGraph(State)
  .addNode("generate", generateNode)
  .addNode("evaluate", evaluateNode)
  .addEdge(START, "generate")
  .addEdge("generate", "evaluate")
  .addConditionalEdges("evaluate", route, { done: END, generate: "generate" })
  .compile();

const result = await graph.invoke({ task: "写一句关于秋天的诗", attempt: 0 });
console.log("🏁 最终稿：", result.draft, "\n📊 最终评分：", result.score);
