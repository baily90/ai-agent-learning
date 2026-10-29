// Lab 02 · Prompt 工程
// 目标：对比「裸 prompt / 加 system / system + few-shot」三种写法的效果差异
import "dotenv/config";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

async function main() {
  const question = process.argv[2] ?? "我的订单超过 7 天了，还能退货吗？";

  // ① 裸 prompt：不给任何角色设定，AI 只能"自由发挥"
  const bare = await generateText({
    model: deepseek("deepseek-chat"),
    prompt: question,
  });

  // ② 加 system prompt：设定角色和行为规范
  const withSystem = await generateText({
    model: deepseek("deepseek-chat"),
    system: "你是一名专业的电商客服。回答要礼貌、简洁，并给出可执行的具体建议。",
    prompt: question,
  });

  // ③ system + few-shot：再给一个示例，让 AI 模仿回答格式
  const withFewShot = await generateText({
    model: deepseek("deepseek-chat"),
    // system: [
    //   "你是一名专业的电商客服。回答要礼貌、简洁。",
    //   "参考以下示例的格式回答：",
    //   "问：我的订单还没发货，能取消吗？",
    //   "答：可以。未发货订单可直接取消，退款原路退回，1-3 个工作日到账。",
    // ].join("\n"),
    instructions: `
      你是一名专业的电商客服。
      负责回答用户的问题。
      回答要礼貌、简洁。
      不知道的或者没有事实依据的要说无法解答，不要编造。
      参考一下示例：
      "问：我的订单还没发货，能取消吗？",
      "答：可以。未发货订单可直接取消，退款原路退回，1-3 个工作日到账。",
    `,
    prompt: question,
  });

  console.log("【① 裸 prompt】\n" + bare.text + "\n");
  console.log("【② 加 system】\n" + withSystem.text + "\n");
  console.log("【③ system + few-shot】\n" + withFewShot.text + "\n");
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
