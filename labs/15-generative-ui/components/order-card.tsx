// 订单卡片组件：接收工具返回的结构化数据，渲染成好看的卡片
type OrderCardProps = {
  orderNo: string;
  status: string;
  logistics: string;
  totalAmount: number;
  items: string[];
};

export function OrderCard({ orderNo, status, logistics, totalAmount, items }: OrderCardProps) {
  const statusColor: Record<string, string> = {
    已发货: "#52c41a",
    待支付: "#faad14",
    订单不存在: "#ff4d4f",
  };

  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: 16,
        margin: "8px 0",
        background: "#fafafa",
        maxWidth: 360,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>订单 {orderNo}</strong>
        <span style={{ color: statusColor[status] ?? "#333" }}>{status}</span>
      </div>
      <div style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
        {items.map((item, i) => (
          <div key={i}>· {item}</div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>
        物流：{logistics}
      </div>
      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 600, color: "#ff4d4f" }}>
        ¥{totalAmount}
      </div>
    </div>
  );
}
