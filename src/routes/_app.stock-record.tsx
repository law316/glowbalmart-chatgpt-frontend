import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { ExportButton, KpiCard } from "@/components/ModulePage";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listProducts, deliveryAgentStockAll,
  type ApiProduct, type DeliveryAgentStockRow,
} from "@/lib/api";

export const Route = createFileRoute("/_app/stock-record")({
  head: () => ({ meta: [{ title: "Stock Record — Glowbalmart CRM" }] }),
  component: StockRecordPage,
});

function StockRecordPage() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [agentRows, setAgentRows] = useState<DeliveryAgentStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        listProducts().catch(() => []),
        deliveryAgentStockAll().catch(() => []),
      ]);
      setProducts(p); setAgentRows(a);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setLoadedOnce(true); }
  };
  useEffect(() => { load(); }, []);

  const agentByProduct = new Map<string, number>();
  agentRows.forEach((r) => {
    agentByProduct.set(r.productId, (agentByProduct.get(r.productId) || 0) + (r.quantityRemaining ?? 0));
  });

  const rows = products.map((p) => {
    const agent = agentByProduct.get(p.id) || 0;
    return { p, office: p.stockQuantity ?? 0, agent, total: (p.stockQuantity ?? 0) + agent };
  });
  const office = rows.reduce((s, r) => s + r.office, 0);
  const withAgents = rows.reduce((s, r) => s + r.agent, 0);
  const grandTotal = office + withAgents;
  const low = rows.filter((r) => r.office <= (r.p.lowStockThreshold || 0)).length;

  return (
    <>
      <PageHeader title="Stock Record" subtitle="Live stock across office and delivery agents" actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <ExportButton filename="stock-record.csv" rows={rows.map((r) => ({ Product: r.p.name, SKU: r.p.sku || "—", Office: r.office, Agents: r.agent, Total: r.total, LowStock: r.office <= (r.p.lowStockThreshold || 0) ? "Yes" : "No" }))} />
        </div>
      } />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Grand Total" value={grandTotal.toLocaleString()} hint="units" />
        <KpiCard label="Office Stock" value={office.toLocaleString()} hint="units" />
        <KpiCard label="With Delivery Agents" value={withAgents.toLocaleString()} hint="units" />
        <KpiCard label="Low Stock Items" value={low} hint="products" accent={low > 0 ? "var(--destructive)" : undefined} />
      </div>

      <Card>
        {loading && rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : loadedOnce && rows.length === 0 ? (
          <Empty title="No stock records yet." hint="Add inventory products to start tracking stock." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Product","Office Stock","Delivery Agent Stock","Total Stock","Low Stock"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => {
                  const isLow = r.office <= (r.p.lowStockThreshold || 0);
                  return (
                    <tr key={r.p.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{r.p.name}<div className="text-[10px] text-muted-foreground">{r.p.sku}</div></td>
                      <td className={`px-3 py-2 ${isLow ? "text-rose-600 font-medium" : ""}`}>{r.office.toLocaleString()}</td>
                      <td className="px-3 py-2">{r.agent.toLocaleString()}</td>
                      <td className="px-3 py-2 font-semibold">{r.total.toLocaleString()}</td>
                      <td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${isLow ? "bg-rose-500/15 text-rose-700" : "bg-emerald-500/15 text-emerald-700"}`}>{isLow ? "Low" : "OK"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
