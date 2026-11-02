// 示例 3：多 agent 协作（规划 → 执行 → 评审 → 不通过回头改）
// 图：START → planner → executor → reviewer ─┬─ 不通过 → 回到 executor
//                                              └─ 通过 → END
import "dotenv/config";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

const State = Annotation.Root({
  task: Annotation<string>,
  plan: Annotation<string>,
  draft: Annotation<string>,
  feedback: Annotation<string>,
  approved: Annotation<boolean>,
  revision: Annotation<number>,
});

async function plannerNode(state: typeof State.State) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是规划师，把任务拆成清晰的执行步骤（1、2、3…），不要动手写正文。",
    prompt: state.task,
  });
  console.log("🗺️  规划师已出方案");
  return { plan: result.text };
}

async function executorNode(state: typeof State.State) {
  const feedback = state.feedback
    ? `\n\n（评审反馈：${state.feedback}，请据此修改）`
    : "";
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是执行者，严格按规划完成任务。",
    prompt: `任务：${state.task}\n规划：\n${state.plan}${feedback}`,
  });
  console.log(`🔨 执行者出稿（第 ${state.revision + 1} 版）`);
  return { draft: result.text, revision: state.revision + 1 };
}

async function reviewerNode(state: typeof State.State) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: `你是评审，检查稿子是否达标。只输出 JSON：{"approved": true/false, "feedback": "若不通过，写具体修改意见"}`,
    prompt: `任务：${state.task}\n稿子：\n${state.draft}`,
  });
  const approved = result.text.includes('"approved": true') || result.text.includes('"approved":true');
  console.log(`🔍 评审结论：${approved ? "通过" : "不通过"}`);
  return { approved, feedback: result.text };
}

const MAX_REVISION = 3;
const route = (state: typeof State.State) =>
  state.approved || state.revision >= MAX_REVISION ? "done" : "executor";

const graph = new StateGraph(State)
  .addNode("planner", plannerNode)
  .addNode("executor", executorNode)
  .addNode("reviewer", reviewerNode)
  .addEdge(START, "planner")
  .addEdge("planner", "executor")
  .addEdge("executor", "reviewer")
  .addConditionalEdges("reviewer", route, { done: END, executor: "executor" })
  .compile();

const result = await graph.invoke({ task: "写一段 100 字的 iPhone 15 Pro 评测", revision: 0 });
console.log("🏁 最终稿：\n", result.draft);
