import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { ExportButton, KpiCard } from "@/components/ModulePage";
import { NGN } from "@/lib/format";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listProducts, deliveryAgentStockAll, profitOrders, listOrders,
  type ApiProduct, type DeliveryAgentStockRow, type ProfitOrderRow, type ApiOrder,
} from "@/lib/api";

export const Route = createFileRoute("/_app/product-analytics")({
  head: () => ({ meta: [{ title: "Product Analytics — Glowbalmart CRM" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [agentRows, setAgentRows] = useState<DeliveryAgentStockRow[]>([]);
  const [profits, setProfits] = useState<ProfitOrderRow[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, a, po, o] = await Promise.all([
        listProducts().catch(() => []),
        deliveryAgentStockAll().catch(() => []),
        profitOrders().catch(() => []),
        listOrders().catch(() => []),
      ]);
      setProducts(p); setAgentRows(a); setProfits(po); setOrders(o);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setLoadedOnce(true); }
  };
  useEffect(() => { load(); }, []);

  // Delivered orders only — same rule as the Profit Dashboard.
  const deliveredOrders = useMemo(
    () => orders.filter((o) => (o.deliveryStatus || o.status || "").toUpperCase() === "DELIVERED"),
    [orders],
  );
  const profitByOrderId = useMemo(() => new Map(profits.map((r) => [r.orderId, r])), [profits]);

  const cards = useMemo(() => products.map((p) => {
    const agent = agentRows
      .filter((r) => r.productId === p.id)
      .reduce((s, r) => s + (r.quantityRemaining ?? 0), 0);
    const office = p.stockQuantity ?? 0;

    // Match delivered orders to this product via the package's linked inventory product.
    const mine = deliveredOrders.filter((o) =>
      o.inventoryProductId
        ? o.inventoryProductId === p.id
        : (o.inventoryProductName || o.packageName || "").toLowerCase().includes((p.name || "").toLowerCase()),
    );

    // Units sold = stock units deducted after delivery.
    const sold = mine.reduce((s, o) => s + (o.inventoryQuantity ?? 1), 0);
    // Revenue = delivered package selling price (prefer the profit report figure).
    const revenue = mine.reduce((s, o) => s + (profitByOrderId.get(o.id)?.revenue ?? o.price ?? 0), 0);
    // Cost = product cost per unit × units sold.
    const cost = sold * (p.costPrice || 0);
    const profit = revenue - cost;

    const total = office + agent;
    const healthy = office > (p.lowStockThreshold || 0);
    return { p, office, agent, total, sold, revenue, cost, profit, healthy };
  }), [products, agentRows, deliveredOrders, profitByOrderId]);


  return (
    <>
      <PageHeader title="Product Analytics" subtitle="Performance metrics for your real products" actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <ExportButton filename="product-analytics.csv" rows={cards.map((c) => ({ Product: c.p.name, Category: c.p.category || "—", Status: c.p.active ? "Active" : "Inactive", Office: c.office, Agents: c.agent, Total: c.total, Sold: c.sold, Revenue: c.revenue, Selling: c.p.sellingPrice || 0, Cost: c.p.costPrice || 0, GrossProfit: c.profit }))} />
        </div>
      } />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Products" value={products.length} />
        <KpiCard label="Total Stock" value={cards.reduce((s, c) => s + c.total, 0).toLocaleString()} />
        <KpiCard label="Units Sold" value={cards.reduce((s, c) => s + c.sold, 0)} />
        <KpiCard label="Revenue" value={NGN(cards.reduce((s, c) => s + c.revenue, 0))} accent="var(--electric)" />
      </div>

      {loading && cards.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</Card>
      ) : loadedOnce && cards.length === 0 ? (
        <Card><Empty title="No product analytics yet." hint="Add products and delivered orders first." /></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {cards.map(({ p, sold, revenue, cost, agent, office, total, healthy, profit }) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.category || "—"} · {p.active ? "Active" : "Inactive"}</div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${healthy ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700"}`}>{healthy ? "Stock healthy" : "Low stock"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
                <Mini label="Office stock" value={office.toLocaleString()} />
                <Mini label="Agent stock" value={agent.toLocaleString()} />
                <Mini label="Total stock" value={total.toLocaleString()} />
                <Mini label="Units sold" value={sold.toLocaleString()} />
                <Mini label="Revenue" value={NGN(revenue)} />
                <Mini label="Cost" value={NGN(cost)} />
                <Mini label="Selling / unit" value={NGN(p.sellingPrice || 0)} />
                <Mini label="Cost / unit" value={NGN(p.costPrice || 0)} />
                <Mini label="Gross profit" value={NGN(profit)} accent />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border p-2.5 bg-muted/20">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5" style={accent ? { color: "var(--electric)" } : undefined}>{value}</div>
    </div>
  );
}
