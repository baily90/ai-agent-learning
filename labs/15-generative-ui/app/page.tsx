"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { OrderCard } from "@/components/order-card";

export default function Page() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>🛍️ 智能客服（生成式 UI 示例）</h1>
      <p style={{ color: "#888" }}>
        试试问：<code>我的订单 20231001001 到哪了？</code>
      </p>

      <div style={{ minHeight: 300, marginBottom: 16 }}>
        {messages.map((message) => (
          <div key={message.id} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, color: message.role === "user" ? "#1677ff" : "#333" }}>
              {message.role === "user" ? "你" : "客服"}
            </div>
            <div>
              {message.parts.map((part, index) => {
                // 文本部分
                if (part.type === "text") {
                  return <span key={index}>{part.text}</span>;
                }

                // 工具调用部分：渲染成订单卡片
                if (part.type === "tool-getOrder") {
                  switch (part.state) {
                    case "input-available":
                      return <div key={index} style={{ color: "#aaa" }}>查询订单中…</div>;
                    case "output-available":
                      return <OrderCard key={index} {...(part.output as any)} />;
                    case "output-error":
                      return <div key={index} style={{ color: "#ff4d4f" }}>出错了：{part.errorText}</div>;
                    default:
                      return null;
                  }
                }

                return null;
              })}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== "ready"}
          placeholder="输入问题，比如：我的订单 20231001001 到哪了？"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <button
          type="submit"
          disabled={status !== "ready"}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#1677ff", color: "#fff", cursor: "pointer" }}
        >
          发送
        </button>
      </form>
    </div>
  );
}
