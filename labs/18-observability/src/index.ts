// index.ts
// 入口：加载环境变量 → 注册观测 → 跑一次 Agent。
// 注意顺序：dotenv 必须先加载，才能让 instrumentation 读到 Langfuse 配置。
import "dotenv/config";
import { sdk } from "./instrumentation.js";
import { runAgent } from "./agent.js";

const question = process.argv[2] ?? "北京今天天气怎么样？适合出门吗？";

console.log(`\n❓ 提问：${question}\n`);

try {
  const answer = await runAgent(question);
  console.log(`🤖 回答：${answer}\n`);
} finally {
  // 关键：强制把 span flush 到 Langfuse 再退出，否则 trace 会丢
  await sdk.shutdown();
}

console.log("✅ 完成。打开 Langfuse UI 查看本次 trace：");
console.log("   http://localhost:3000\n");
