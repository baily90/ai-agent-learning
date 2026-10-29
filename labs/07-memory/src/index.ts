// Lab 07 · 对话记忆
// 目标：让 AI "记住"多轮对话，理解短期记忆（消息历史）与滑动窗口
import "dotenv/config";
import { generateText, type ModelMessage } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const MAX_HISTORY = 10; // 最大轮次
const KEEP_RECENT = 6; // 超过阈值后，保留的最近消息数

async function main() {
  const rl = readline.createInterface({ input, output });
  let history: ModelMessage[] = [];

  let summary = ``

  console.log("💬 多轮对话开始（输入 exit 退出）。试试：先告诉我你的名字，再问我'我叫什么'");

  while (true) {
    const userInput = await rl.question("\n你：");
    if (userInput.toLowerCase() === "exit" || userInput === "退出") break;

    // 用户输入进来前判断是否达到MAX_HISTORY，达到history就保留最新的6条，前面的所有记录进行摘要存在summary中（如果已存在summary，就合并摘要）
    // 然后将用户输入push到history中
    
    if(history.length >= MAX_HISTORY) {
      const summaryQuery = await generateText({
        model: deepseek("deepseek-chat"),
        instructions: `你是一个信息摘要专家，负责将给定的信息进行压缩摘要。
          如果已存在摘要信息你可以合并一起进行摘要。
          摘要信息限制200字以内。
          ${summary ? `已经存在的摘要信息：${summary}` : ''}
        `,
        prompt: `会话记录：${history.slice(0, -KEEP_RECENT).map(item => `${item.role}: ${item.content}`).join(';\n')}`
      });
      history = Array.from(history.slice(-KEEP_RECENT))
      summary = summaryQuery.text
      console.log(`会话压缩：${summary}\n`);
    }

    history.push({ role: "user", content: userInput });

    const result = await generateText({
      model: deepseek("deepseek-chat"),
      instructions: `你是一个乐于助人的助手。
      ${summary ? `请参考会话摘要信息回答问题，摘要信息如下：${summary}` : ''}
      `,
      messages: history
    });

    history.push({ role: "assistant", content: result.text });
    console.log("AI：" + result.text);
    console.log(`   （当前上下文 ${Math.min(history.length, MAX_HISTORY)} 条消息）`);
  }

  rl.close();
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
