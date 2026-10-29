// Lab 10 · 多模态（图片理解）
// 目标：让 AI "看图说话"。注意 DeepSeek 不支持视觉，这里用千问 qwen-vl-max
import "dotenv/config";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { readFileSync } from "node:fs";

const dashscope = createOpenAICompatible({
  name: "dashscope",
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.DASHSCOPE_API_KEY,
});
const vlModel = dashscope("qwen3-vl-plus");

// 图片可以是 URL 或本地路径（本地路径会转成 base64）
function buildImagePart(input: string) {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return { type: "image" as const, image: input };
  }
  const base64 = readFileSync(input).toString("base64");
  return { type: "image" as const, image: `data:image/jpeg;base64,${base64}` };
}

async function main() {
  const image = process.argv[2] ?? "https://fastly.picsum.photos/id/960/400/300.jpg?hmac=6v7ZLRWQnQZXJbJKUxtLpwmxCPwkPzew-dSB-wQU9G8";
  const question = process.argv[3] ?? "详细描述这张图片的内容";

  const result = await generateText({
    model: vlModel,
    // 多模态输入：content 是一个 parts 数组（文本 + 图片）
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: question },
          buildImagePart(image),
        ],
      },
    ],
  });

  console.log("🤖 回答：\n" + result.text);
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
