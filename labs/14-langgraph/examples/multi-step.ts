// 示例 1：多步 agent（查资料 → 反思 → 再查 → 回答）
// 图：START → research → reflect ─┬─ 不够 → 回到 research
//                                  └─ 够 → answer → END
import "dotenv/config";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

const State = Annotation.Root({
  question: Annotation<string>,
  notes: Annotation<string>,       // 累积的研究笔记
  sufficient: Annotation<boolean>, // 反思结论
  answer: Annotation<string>,
  rounds: Annotation<number>,      // 循环上限
});

// 模拟"查资料"——生产环境换成真实搜索工具（Tavily / SerpAPI）
function searchWeb(query: string) {
  return `[搜索结果] 关于「${query}」：LangGraph 是 LangChain 的图编排框架，支持状态、循环、checkpoint 与 human-in-the-loop。`;
}

async function researchNode(state: typeof State.State) {
  const info = searchWeb(state.question);
  console.log(`🔍 第 ${state.rounds + 1} 轮查资料`);
  return { notes: (state.notes ?? "") + info + "\n", rounds: state.rounds + 1 };
}

async function reflectNode(state: typeof State.State) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: `判断现有资料是否足够回答用户问题。只输出 JSON：{"sufficient": true 或 false}`,
    prompt: `问题：${state.question}\n现有资料：\n${state.notes}`,
  });
  return { sufficient: result.text.includes("true") };
}

async function replyNode(state: typeof State.State) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: "只根据给定资料回答，不要编造。",
    prompt: `问题：${state.question}\n资料：\n${state.notes}`,
  });
  return { answer: result.text };
}

const MAX_ROUNDS = 3;
const route = (state: typeof State.State) =>
  state.sufficient || state.rounds >= MAX_ROUNDS ? "reply" : "research";

const graph = new StateGraph(State)
  .addNode("research", researchNode)
  .addNode("reflect", reflectNode)
  .addNode("reply", replyNode)
  .addEdge(START, "research")
  .addEdge("research", "reflect")
  .addConditionalEdges("reflect", route, { reply: "reply", research: "research" })
  .addEdge("reply", END)
  .compile();

const result = await graph.invoke({ question: "什么是 LangGraph？", rounds: 0 });
console.log("🤖 回答：", result.answer);
