// Lab 05 · 模型选择与 fallback
// 目标：理解「路由」（按任务选模型）和「fallback」（失败自动切换）
import "dotenv/config";
import { generateText, Output } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

// 两个模型：chat 快而便宜，reasoner 慢但推理更强
const fastModel = deepseek("deepseek-chat");
const reasonModel = deepseek("deepseek-reasoner");

async function main() {
  const question = process.argv[2] ?? "计算 1+2+3+...+100 的和";

  // ① 手动路由：根据问题特征选模型
  const routeQuery = await generateText({
    model: fastModel,
    instructions: `
      你是一个意图识别专家，负责识别用户的意图。
      按一下json结构输出：
      {
        "type": "reasoner",
        "reason": "解释选择reasoner的原因"
      }
    `,
    prompt: question,
    output:  Output.object({
      schema: z.object({
                type: z.enum(['reasoner', 'normal']).describe('意图的类别，是否需要推理能力，需要推理能力-reasoner，不需要推理能力-normal'),
                reason: z.string().describe('一句话解释为什么是这个意图类别')
              })
    })
    
  }) 

 
   const route = JSON.parse(routeQuery.text)
  
  // const needReasoning = /计算|推理|为什么|证明|数学/.test(question);
  
  console.log(`🎯 路由选择：${route.type}，原因：${route.reason}`);
  
  const primary = route.type === 'reasoner' ? reasonModel : fastModel;

  // ② fallback：主模型失败时，自动切到备用模型
  try {
    const result = await generateText({ model: primary, prompt: question });
    console.log("🤖 回答：\n" + result.text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ 主模型调用失败：${message}`);
    console.warn("→ 自动切换到备用模型重试…\n");

    const backup = primary === fastModel ? reasonModel : fastModel;
    const result = await generateText({ model: backup, prompt: question });
    console.log("🤖 回答（备用模型）：\n" + result.text);
  }
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
