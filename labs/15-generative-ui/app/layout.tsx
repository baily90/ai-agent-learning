import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "生成式 UI · 智能客服",
  description: "工具调用驱动组件渲染的示例",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
