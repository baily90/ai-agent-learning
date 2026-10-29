// agent.ts
// 核心 Agent：用 AI SDK 7 + DeepSeek 跑一次带工具调用的多步生成。
import { generateText, isStepCount } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { getWeather, getCurrentDateTime } from "./tools.js";

export async function runAgent(question: string): Promise<string> {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system:
      "你是一个乐于助人的中文助手。当用户询问天气时使用 getWeather 工具，询问日期时间时使用 getCurrentDateTime 工具。其他问题直接回答。",
    prompt: question,
    tools: {
      getWeather,
      getCurrentDateTime,
    },
    // 最多允许 5 步工具调用循环，防止无限循环、控制成本（AI SDK 7 用 stopWhen）
    stopWhen: isStepCount(5),
    // functionId 会作为本次调用的标识出现在 Langfuse 里
    telemetry: {
      functionId: "weather-assistant",
    },
  });

  return result.text;
}
