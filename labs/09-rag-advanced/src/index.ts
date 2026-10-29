// Lab 09 · RAG 进阶
// 目标：理解三个进阶技巧——分块、混合检索（向量 + 关键词）、重排
import "dotenv/config";
import { embed, embedMany, generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const siliconflow = createOpenAICompatible({
  name: "siliconflow",
  baseURL: "https://api.siliconflow.cn/v1",
  apiKey: process.env.SILICONFLOW_API_KEY,
});
const embeddingModel = siliconflow.embeddingModel("BAAI/bge-large-zh-v1.5");

// 一篇较长的售后政策文档（真实项目里来自数据库/文件）
const policyDoc = `
【售后总则】本店支持 7 天无理由退货，商品需完好不影响二次销售。
【退款规则】未发货订单可直接申请仅退款，退款原路退回，1-3 个工作日到账。
【退货规则】已发货订单签收后 7 天内可申请退货退款，需先寄回商品，商家验货后退款。
【换货规则】商品质量问题支持换货，运费由商家承担，需提供问题照片。
【物流时效】现货商品 48 小时内发货，预售商品以页面标注为准，偏远地区加 2-3 天。
【发票规则】支持开具电子发票，下单时在备注填写抬头，发货后 15 天内可申请。
`;

async function rerank(query: string, documents: string[], topN: number = 1) {
  const res = await fetch("https://api.siliconflow.cn/v1/rerank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "BAAI/bge-reranker-v2-m3",
      query,
      documents,
      top_n: topN,
    }),
  });
  const data = await res.json();
  
  // data.results: [{ index, relevance_score }, ...]
  return data.results.map((r) => ({
    doc: documents[r.index],
    score: r.relevance_score,
  }));
}

// ① 分块：按段落切（真实项目里还会按固定长度、语义边界等策略）
function chunkByParagraph(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
// ① 分块：固定20字切块
function chunkByFixedLength(text: string, size = 20): string[] {
  const cleaned = text.replace(/\s+/g, ""); // 去掉换行和空格，只按「字」数
  const chunks: string[] = [];
  for (let i = 0; i < cleaned.length; i += size) {
    chunks.push(cleaned.slice(i, i + size));
  }
  return chunks;
}
// ① 分块：固定 20 字 + 5 字重叠（重叠让边界处的词不会被劈断）
function chunkByFixedLengthOverlap(text: string, size = 20, overlap = 5): string[] {
  const cleaned = text.replace(/\s+/g, "");
  const step = size - overlap; // 每块前进 15 字，相邻两块重叠 5 字（overlap 必须 < size）
  const chunks: string[] = [];
  for (let i = 0; i < cleaned.length; i += step) {
    chunks.push(cleaned.slice(i, i + size));
  }
  return chunks;
}

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

// ② 关键词命中打分（简化的 BM25 思想）
// 中文没有空格，用「2 字滑窗」提取候选词（无分词器的取巧做法，这是取巧，别当正解）
// 我买 / 买的 / 的东 / 东西 / 西有 / 有质 / 质量 / 量问 / 问题 / … / 换货 / 货怎 / 怎么 / 么办 / …
function keywordScore(question: string, chunk: string): number {
  const keywords = new Set<string>();
  for (let i = 0; i + 1 < question.length; i++) {
    keywords.add(question.slice(i, i + 2));
  }
  let score = 0;
  for (const kw of keywords) {
    if (chunk.includes(kw)) score += 1;
  }
  return score;
}

async function main() {
  const question = process.argv[2] ?? "我买的东西有质量问题，想换货怎么办？";
  const chunks = chunkByParagraph(policyDoc);

  const { embeddings } = await embedMany({ model: embeddingModel, values: chunks });
  const { embedding: q } = await embed({ model: embeddingModel, value: question });

  // ③ 混合检索 + 重排：向量分 + 关键词分，加权后重排
  const candidates = chunks
  .map((chunk, i) => ({
    chunk,
    total: cosineSimilarity(q, embeddings[i]) + keywordScore(question, chunk) * 0.15,
  }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 5)
  .map((s) => s.chunk);

  console.log("🔍 召回结果（按综合分排序）：");

  candidates.forEach((s, i) => {
    console.log(
      ` ${i + 1}.${s}`,
    );
  });

  const ranked = await rerank(question, candidates);
  console.log("🔍 rerank结果：");
  ranked.forEach((s, i) => {
    console.log(
      `[${s.score}] =》${s.doc}`,
    );
  });
  
  const top = ranked[0].doc; // rerank 给出的最相关文档

  
  // const scored = chunks
  //   .map((chunk, i) => ({
  //     chunk,
  //     vectorScore: cosineSimilarity(q, embeddings[i]),
  //     keywordScore: keywordScore(question, chunk),
  //   }))
  //   .map((s) => ({ ...s, total: s.vectorScore + s.keywordScore * 0.15 }))
  //   .sort((a, b) => b.total - a.total);

  // console.log("🔍 检索结果（按综合分排序）：");
  // scored.forEach((s, i) => {
  //   console.log(
  //     `  ${i + 1}. [向量 ${s.vectorScore.toFixed(3)} + 关键词 ${s.keywordScore} = ${s.total.toFixed(3)}] ${s.chunk.slice(0, 30)}…`,
  //   );
  // });
  
  // const top = scored[0].chunk;
  
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    system: `你是电商客服，严格根据下面的知识回答，不知道就说不知道。\n\n知识：${top}`,
    prompt: question,
  });

  console.log("\n🤖 回答：\n" + result.text);
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
