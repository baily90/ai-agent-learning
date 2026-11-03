// instrumentation.ts
// 只注册 Langfuse 的 OpenTelemetry SpanProcessor，让 startActiveObservation
// 创建的 trace 能上报到 Langfuse（在线打分需要）。
//
// 注意：这里刻意不注册 AI SDK 的 telemetry 集成——
// 离线实验的记录由 LangfuseClient 走 REST 完成，避免 task 里的
// generateText 再额外生成一条和实验 item 重复的根 trace。
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

// 导出 sdk，供入口在进程退出前调用 shutdown() 强制 flush span
export { sdk };
