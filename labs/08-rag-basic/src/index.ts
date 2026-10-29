// Lab 08 · RAG 基础
// 目标：跑通 RAG 完整流程：文档 → embedding → 向量检索 → 喂给 LLM 生成回答
import "dotenv/config";
import { embed, embedMany, generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// BGE embedding（硅基流动 SiliconFlow 的 OpenAI 兼容接口）
const siliconflow = createOpenAICompatible({
  name: "siliconflow",
  baseURL: "https://api.siliconflow.cn/v1",
  apiKey: process.env.SILICONFLOW_API_KEY,
});
const embeddingModel = siliconflow.embeddingModel("BAAI/bge-large-zh-v1.5");

// 相似度阈值：低于这个值就认为「没有相关文档」
const SIMILARITY_THRESHOLD = 0.5;

// FAQ 知识库（真实项目里从数据库/文档读）
const faqDocs = [
  "退款政策：未发货的订单可以直接申请退款，退款原路退回，1-3 个工作日到账。",
  "退货政策：已发货的订单，签收后 7 天内可以申请退货退款，需商品完好不影响二次销售。",
  "物流查询：发货后可在订单详情页查看物流单号和承运公司。",
  "优惠券规则：优惠券过期后无法使用，不可兑换现金。",
  "发票规则：仅支持开具个人抬头，不支持开具公司抬头。"
];

// 余弦相似度：衡量两个向量的"方向接近程度"
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  const question = process.argv[2] ?? "我买的东西已经发货了，还能退款吗？";

  // ① 把知识库转成向量
  const { embeddings: docEmbeddings } = await embedMany({
    model: embeddingModel,
    values: faqDocs,
  });

  // ② 把问题也转成向量
  const { embedding: qEmbedding } = await embed({
    model: embeddingModel,
    value: question,
  });

  // ③ 检索最相关的文档（top-2）
  const scored = faqDocs
    .map((doc, i) => ({ doc, score: cosineSimilarity(qEmbedding, docEmbeddings[i]) }))
    .filter(s => s.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  console.log("🔍 检索到的相关文档：");
  scored.forEach((s, i) => console.log(`  ${i + 1}. [相似度 ${s.score.toFixed(3)}] ${s.doc}`));

  // ④ 把检索结果当"背景知识"喂给 LLM 生成回答
  const context = scored.length > 0 ? scored.map((s) => s.doc).join("\n") : '（无相关内容）';
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: `你是电商客服。请严格根据下面的知识库内容回答；知识库里没有的，就诚实说不知道。\n\n知识库：\n${context}`,
    prompt: question,
  });

  console.log("\n🤖 回答：\n" + result.text);
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
