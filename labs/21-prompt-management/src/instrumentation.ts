// instrumentation.ts
// 在应用启动时注册 Langfuse 的 OpenTelemetry 集成。
// AI SDK 7 采用 callback-based telemetry：注册后，
// 所有 generateText / streamText 等调用会自动向 Langfuse 上报 span。
import { registerTelemetry } from "ai";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";
import { NodeSDK } from "@opentelemetry/sdk-node";

// LangfuseSpanProcessor 会自动读取环境变量：
//   LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASEURL
const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

registerTelemetry(new LangfuseVercelAiSdkIntegration());

// 导出 sdk，供入口在进程退出前调用 shutdown() 强制 flush span
// （短命 CLI 脚本若直接退出，OTel 的批量上报还没发出，trace 会丢）
export { sdk };
