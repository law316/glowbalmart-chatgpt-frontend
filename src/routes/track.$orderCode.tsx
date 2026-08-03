import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/track/$orderCode")({
  component: TrackOrderPage,
});

type OrderTrack = {
  code: string;
  customerName?: string;
  customerEmail?: string;
  phone?: string;
  whatsappNumber?: string;
  deliveryAddress?: string;
  state?: string;
  packageName?: string;
  inventoryQuantity?: number;
  price?: number;
  currency?: string;
  status?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  deliveredAt?: string;
  createdAt?: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "https://glowbarlmart.fly.dev").replace(/\/+$/, "");

function money(value?: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function clean(value?: string) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replaceAll("-", " ").toUpperCase();
}

function TrackOrderPage() {
  const { orderCode } = Route.useParams();
  const [order, setOrder] = useState<OrderTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOrder() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/api/public/orders/track/${encodeURIComponent(orderCode)}`);

      if (!res.ok) {
        throw new Error("Order not found. Please check your order code.");
      }

      setOrder(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load order.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [orderCode]);

  const status = (order?.status || "").toLowerCase();
  const delivery = (order?.deliveryStatus || "").toLowerCase();

  const received = Boolean(order?.code);
  const confirmed = status.includes("assigned") || status.includes("confirmed");
  const outForDelivery = delivery.includes("out") || delivery.includes("dispatch") || delivery.includes("transit");
  const delivered = delivery.includes("delivered") || status.includes("delivered") || Boolean(order?.deliveredAt);

  const steps = [
    ["Order received", "Your order has been received by Glowbalmart.", received],
    ["Order confirmed", "The sales team has received your order for follow-up.", confirmed],
    ["Preparing order", "Your package is being prepared for dispatch.", confirmed || outForDelivery || delivered],
    ["Out for delivery", "Your package is on the way.", outForDelivery || delivered],
    ["Delivered", "Your package has been delivered successfully.", delivered],
  ] as const;

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <section style={{ background: "#111827", color: "white", padding: 28, borderRadius: 20, marginBottom: 20 }}>
          <div style={{ opacity: 0.8 }}>Glowbalmart Order Tracking</div>
          <h1 style={{ margin: "8px 0", fontSize: 32 }}>Track your order</h1>
          <p style={{ margin: 0 }}>Order code: <b>{orderCode}</b></p>
        </section>

        {loading && (
          <div style={{ background: "white", padding: 24, borderRadius: 16 }}>
            Loading order details...
          </div>
        )}

        {!loading && error && (
          <div style={{ background: "white", padding: 24, borderRadius: 16, color: "#991b1b" }}>
            <h2>Order not found</h2>
            <p>{error}</p>
            <button onClick={loadOrder}>Try again</button>
          </div>
        )}

        {!loading && order && (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
              <Card title="Order Status" value={clean(order.status)} />
              <Card title="Delivery Status" value={clean(order.deliveryStatus)} />
              <Card title="Payment Status" value={clean(order.paymentStatus)} />
              <Card title="Amount" value={money(order.price, order.currency || "NGN")} />
            </section>

            <section style={{ background: "white", padding: 24, borderRadius: 16, marginBottom: 20 }}>
              <h2 style={{ marginTop: 0 }}>Delivery progress</h2>

              <div style={{ display: "grid", gap: 12 }}>
                {steps.map(([title, desc, done]) => (
                  <div key={title} style={{ display: "flex", gap: 12, padding: 14, border: "1px solid #e5e7eb", borderRadius: 12, background: done ? "#f0fdf4" : "white" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 999, background: done ? "#16a34a" : "#e5e7eb", color: done ? "white" : "#111", display: "grid", placeItems: "center", fontWeight: 700 }}>
                      {done ? "?" : "•"}
                    </div>
                    <div>
                      <b>{title}</b>
                      <p style={{ margin: "4px 0 0", color: "#6b7280" }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ background: "white", padding: 24, borderRadius: 16 }}>
              <h2 style={{ marginTop: 0 }}>Order details</h2>

              <Detail label="Order Code" value={order.code} />
              <Detail label="Customer" value={order.customerName} />
              <Detail label="Phone" value={order.phone} />
              <Detail label="WhatsApp" value={order.whatsappNumber} />
              <Detail label="Email" value={order.customerEmail} />
              <Detail label="State" value={order.state} />
              <Detail label="Address" value={order.deliveryAddress} />
              <Detail label="Package" value={order.packageName} />
              <Detail label="Quantity" value={String(order.inventoryQuantity || 0)} />
              <Detail label="Date Ordered" value={order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"} />

              <button onClick={loadOrder} style={{ marginTop: 20, padding: "12px 18px", border: 0, borderRadius: 10, background: "#111827", color: "white", fontWeight: 700 }}>
                Refresh status
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18 }}>
      <div style={{ color: "#6b7280", fontSize: 13 }}>{title}</div>
      <div style={{ color: "#111827", fontWeight: 800, marginTop: 8 }}>{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
      <b style={{ color: "#6b7280" }}>{label}</b>
      <span>{value || "—"}</span>
    </div>
  );
}
