import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { NGN, fmtDateTime } from "@/lib/format";
import { AlertTriangle, Download, FileText, Loader2, Plus, RefreshCw, TrendingUp } from "lucide-react";
import { exportCSV, exportPDF } from "@/lib/export";
import {
  inventorySummary, listProducts, listMovements, adjustStock,
  deliveryAgentStockMovements, getProductEnhancement, productMovements, movementLabel,
  type ApiProduct, type InventoryMove, type InventorySummary, type DeliveryAgentMovement,
  type ProductEnhancement,
} from "@/lib/api";
import { toast } from "sonner";
import { ProductFormModal } from "@/components/ProductFormModal";


export const Route = createFileRoute("/_app/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Glowbalmart CRM" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMove[]>([]);
  const [agentMoves, setAgentMoves] = useState<DeliveryAgentMovement[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [openAdj, setOpenAdj] = useState<string | null>(null);
  const [adj, setAdj] = useState({ quantityChange: 0, reason: "PURCHASE", note: "", referenceType: "" });
  const [saving, setSaving] = useState(false);
  const [adjEnhancement, setAdjEnhancement] = useState<ProductEnhancement | null>(null);
  const [adjMovements, setAdjMovements] = useState<InventoryMove[]>([]);
  const [adjLoading, setAdjLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, m, s, am] = await Promise.all([
        listProducts().catch(() => []),
        listMovements().catch(() => []),
        inventorySummary().catch(() => null),
        deliveryAgentStockMovements().catch(() => [] as DeliveryAgentMovement[]),
      ]);
      setProducts(p); setMovements(m); setSummary(s); setAgentMoves(am);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Real backend flow numbers
  const flow = useMemo(() => {
    const warehouseOut = movements.filter((m) => (m.quantityChange || 0) < 0).reduce((s, m) => s + Math.abs(m.quantityChange || 0), 0);
    const warehouseIn = movements.filter((m) => (m.quantityChange || 0) > 0).reduce((s, m) => s + (m.quantityChange || 0), 0);
    const allocated = agentMoves.filter((m) => (m.movementType || "").toUpperCase().includes("ALLOC")).reduce((s, m) => s + Math.abs(m.quantityChange || m.quantity || 0), 0);
    const delivered = agentMoves.filter((m) => (m.movementType || "").toUpperCase().includes("DELIVER")).reduce((s, m) => s + Math.abs(m.quantityChange || m.quantity || 0), 0);
    const returned = agentMoves.filter((m) => (m.movementType || "").toUpperCase().includes("RETURN")).reduce((s, m) => s + Math.abs(m.quantityChange || m.quantity || 0), 0);
    return { warehouseIn, warehouseOut, allocated, delivered, returned };
  }, [movements, agentMoves]);



  const value = summary?.totalStockCostValue ?? products.reduce((s, p) => s + p.stockQuantity * (p.costPrice || 0), 0);
  const low = summary?.lowStockProducts ?? products.filter((p) => p.stockQuantity <= (p.lowStockThreshold || 0)).length;
  const rows = () => products.map((p) => ({ Product: p.name, SKU: p.sku || "—", Category: p.category || "—", Stock: p.stockQuantity, Threshold: p.lowStockThreshold || 0, Cost: p.costPrice || 0, Value: p.stockQuantity * (p.costPrice || 0) }));

  const openAdjustModal = async (p: ApiProduct) => {
    setOpenAdj(p.id);
    setAdj({ quantityChange: 0, reason: "PURCHASE", note: "", referenceType: "" });
    setAdjEnhancement(null);
    setAdjMovements([]);
    setAdjLoading(true);
    try {
      const [enh, moves] = await Promise.all([
        getProductEnhancement(p.id).catch(() => null),
        productMovements(p.id).catch(() => [] as InventoryMove[]),
      ]);
      setAdjEnhancement(enh);
      setAdjMovements(moves);
    } finally { setAdjLoading(false); }
  };

  const saveAdj = async () => {
    if (!openAdj || !adj.quantityChange) return toast.error("Quantity change required");
    setSaving(true);
    try {
      await adjustStock(openAdj, { quantityChange: adj.quantityChange, reason: adj.reason, note: adj.note, referenceType: adj.referenceType || undefined });
      toast.success("Stock adjusted");
      setAdj((a) => ({ ...a, quantityChange: 0 }));
      load();
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock levels, movements and alerts." actions={
        <>
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <button onClick={() => exportCSV("inventory.csv", rows())} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><Download size={14} /> Excel</button>
          <button onClick={() => exportPDF("inventory.pdf", "Inventory Report", rows())} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><FileText size={14} /> PDF</button>
          <button onClick={() => setOpenAdd(true)} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}><Plus size={14} /> Product</button>
        </>
      } />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Total Stock Value</div><div className="text-xl font-bold mt-1">{NGN(value)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Products</div><div className="text-xl font-bold mt-1">{summary?.totalProducts ?? products.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Low Stock</div><div className="text-xl font-bold mt-1 text-amber-600">{low}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Out of Stock</div><div className="text-xl font-bold mt-1 text-rose-600">{summary?.outOfStockProducts ?? products.filter((p) => p.stockQuantity === 0).length}</div></Card>
      </div>

      {low > 0 && (
        <Card className="p-4 mb-4 border-amber-500/40 bg-amber-50/30 dark:bg-amber-500/5">
          <div className="flex items-center gap-2 font-semibold text-amber-700"><AlertTriangle size={16} /> Low stock alerts</div>
          <ul className="mt-2 text-sm">
            {products.filter((p) => p.stockQuantity <= (p.lowStockThreshold || 0)).slice(0, 8).map((p) => (
              <li key={p.id}>• {p.name} — {p.stockQuantity} left (threshold {p.lowStockThreshold || 0})</li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4 mb-4">
        <div className="font-semibold mb-3 flex items-center gap-2"><TrendingUp size={16} /> Stock Flow (real backend movements)</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
          {[
            { label: "Warehouse In", value: flow.warehouseIn, color: "bg-emerald-500" },
            { label: "Allocated → Agent", value: flow.allocated, color: "bg-sky-500" },
            { label: "Delivered (agent stock ↓)", value: flow.delivered, color: "bg-indigo-500" },
            { label: "Returned → Warehouse", value: flow.returned, color: "bg-amber-500" },
            { label: "Warehouse Out (total)", value: flow.warehouseOut, color: "bg-rose-500" },
          ].map((row) => {
            const max = Math.max(flow.warehouseIn, flow.warehouseOut, flow.allocated, flow.delivered, flow.returned, 1);
            const pct = Math.round((row.value / max) * 100);
            return (
              <div key={row.label} className="rounded-lg border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">{row.label}</div>
                <div className="text-lg font-bold">{row.value.toLocaleString()}</div>
                <div className="mt-1 h-1.5 rounded bg-muted overflow-hidden"><div className={`h-full ${row.color}`} style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          Warehouse stock reduces when allocated to a delivery agent. Agent stock reduces only when the order is Delivered. Warehouse stock increases when agent stock is returned.
        </div>
      </Card>



      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="p-4 border-b font-semibold">Stock</div>
          {loading && products.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
            : products.length === 0 ? <Empty title="No products yet" hint="Add your first product to start tracking stock." />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left"><tr>{["Product","Stock","Threshold","Value",""].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-3 py-2">{p.name}<div className="text-[10px] text-muted-foreground">{p.sku}</div></td>
                        <td className={`px-3 py-2 ${p.stockQuantity <= (p.lowStockThreshold || 0) ? "text-rose-600 font-medium" : ""}`}>{p.stockQuantity}</td>
                        <td className="px-3 py-2">{p.lowStockThreshold || 0}</td>
                        <td className="px-3 py-2">{NGN(p.stockQuantity * (p.costPrice || 0))}</td>
                        <td className="px-3 py-2"><button onClick={() => openAdjustModal(p)} className="text-xs underline">Adjust</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>
        <Card>
          <div className="p-4 border-b font-semibold">Recent Movements</div>
          {movements.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No stock movements yet.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["When","Product","Movement","Qty","Details"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {movements.slice(0, 20).map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2 text-xs">{fmtDateTime(m.createdAt)}</td>
                    <td className="px-3 py-2">{m.productName || m.productId}</td>
                    <td className="px-3 py-2 text-xs">{movementLabel(m.movementType, m.reason, m.quantityChange)}</td>
                    <td className={`px-3 py-2 ${m.quantityChange > 0 ? "text-emerald-600" : "text-rose-600"}`}>{m.quantityChange > 0 ? "+" : ""}{m.quantityChange}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{m.note || m.reason || m.movementType || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <ProductFormModal open={openAdd} onClose={() => setOpenAdd(false)} onSaved={load} />


      {openAdj && (() => {
        const p = products.find((x) => x.id === openAdj);
        return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setOpenAdj(null)}>
          <div className="bg-card w-full max-w-3xl rounded-xl p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-3">Adjust Stock</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <div className="font-semibold">{p?.name}</div>
                {adjLoading && <div className="text-xs text-muted-foreground"><Loader2 className="inline animate-spin mr-1" size={12} /> Loading product details…</div>}
                <div className="text-xs text-muted-foreground">SKU: {p?.sku || "—"}</div>
                <div className="text-xs text-muted-foreground">Category: {p?.category || adjEnhancement?.productCategory || "—"}</div>
                {p?.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                <div className="text-xs text-muted-foreground">Country/Currency: {adjEnhancement?.countryName || "—"} {adjEnhancement?.currency ? `(${adjEnhancement.currency})` : ""}</div>
                <div className="grid grid-cols-2 gap-x-2 mt-2 text-xs">
                  <div>Current stock: <span className="font-medium">{p?.stockQuantity}</span></div>
                  <div>Low stock threshold: <span className="font-medium">{p?.lowStockThreshold ?? "—"}</span></div>
                  <div>Agent threshold: <span className="font-medium">{adjEnhancement?.lowStockThresholdAgents ?? "—"}</span></div>
                  <div>Cost price: <span className="font-medium">{NGN(p?.costPrice || 0)}</span></div>
                  <div>Selling price: <span className="font-medium">{NGN(p?.sellingPrice || 0)}</span></div>
                </div>
                {!!adjEnhancement?.priceTiers?.length && (
                  <div className="mt-2">
                    <div className="text-xs font-medium">Price tiers</div>
                    <ul className="text-xs text-muted-foreground">
                      {adjEnhancement.priceTiers.map((t, i) => (
                        <li key={i}>{t.quantity} {t.unitLabel} — cost {NGN(t.costPrice)} / sell {NGN(t.sellingPrice)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!adjMovements.length && (
                  <div className="mt-2">
                    <div className="text-xs font-medium">Recent movements</div>
                    <ul className="text-xs text-muted-foreground max-h-32 overflow-y-auto">
                      {adjMovements.slice(0, 8).map((m) => (
                        <li key={m.id}>{fmtDateTime(m.createdAt)} — {m.quantityChange > 0 ? "+" : ""}{m.quantityChange} ({m.reason || m.movementType || "—"})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Quantity change (use negative for out)<input type="number" value={adj.quantityChange} onChange={(e) => setAdj({ ...adj, quantityChange: +e.target.value })} className="mt-0.5 w-full px-3 py-2 rounded border bg-background text-sm" /></label>
                <label className="text-xs text-muted-foreground mt-2 block">Reason<select value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} className="mt-0.5 w-full px-3 py-2 rounded border bg-background text-sm">{["PURCHASE","RETURN","ADJUSTMENT","DAMAGE","LOSS","MANUAL"].map((r) => <option key={r}>{r}</option>)}</select></label>
                <label className="text-xs text-muted-foreground mt-2 block">Reference (optional)<input placeholder="e.g. invoice or PO number" value={adj.referenceType} onChange={(e) => setAdj({ ...adj, referenceType: e.target.value })} className="mt-0.5 w-full px-3 py-2 rounded border bg-background text-sm" /></label>
                <label className="text-xs text-muted-foreground mt-2 block">Note<textarea placeholder="Note" rows={2} value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} className="mt-0.5 w-full px-3 py-2 rounded border bg-background text-sm" /></label>
                <div className="mt-3 flex justify-end gap-2"><button onClick={() => setOpenAdj(null)} disabled={saving} className="px-3 py-2 text-sm rounded border">Close</button><button onClick={saveAdj} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>{saving && <Loader2 size={14} className="animate-spin" />} Adjust</button></div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </>
  );
}
