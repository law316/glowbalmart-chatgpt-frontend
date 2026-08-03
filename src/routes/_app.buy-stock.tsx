import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { ExportButton, PrimaryBtn, SearchInput } from "@/components/ModulePage";
import { NGN, fmtDate, fmtDateTime, today } from "@/lib/format";
import { Plus, X, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listProducts, inventorySummary, listMovements, adjustStock,
  type ApiProduct, type InventoryMove,
} from "@/lib/api";

export const Route = createFileRoute("/_app/buy-stock")({
  head: () => ({ meta: [{ title: "Buy Stock — Glowbalmart CRM" }] }),
  component: BuyStockPage,
});

function BuyStockPage() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ productId: "", qty: 0, unitCost: 0, supplier: "", date: today(), notes: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [p, m] = await Promise.all([
        listProducts().catch(() => []),
        listMovements().catch(() => []),
      ]);
      setProducts(p);
      setMovements(m);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setLoadedOnce(true); }
  };
  useEffect(() => { load(); }, []);

  // Show only PURCHASE-reason movements as purchases
  const purchases = movements.filter((m) => {
    const r = (m.reason || "").toUpperCase();
    return r === "PURCHASE" || r.includes("PURCHASE") || (m.movementType || "").toUpperCase() === "PURCHASE";
  });
  const filtered = purchases.filter((m) => !q ||
    (m.productName || "").toLowerCase().includes(q.toLowerCase()) ||
    (m.note || "").toLowerCase().includes(q.toLowerCase())
  );

  const save = async () => {
    const p = products.find((x) => x.id === form.productId);
    if (!p) return toast.error("Please pick a product.");
    if (!form.qty || form.qty <= 0) return toast.error("Quantity must be greater than 0.");
    if (form.unitCost < 0) return toast.error("Unit cost cannot be negative.");
    setSaving(true);
    try {
      const total = form.qty * form.unitCost;
      const note = [
        form.supplier ? `Purchase from ${form.supplier}.` : "Purchase.",
        `Unit cost ${NGN(form.unitCost)}.`,
        `Total cost ${NGN(total)}.`,
        `Date ${fmtDate(form.date)}.`,
        form.notes ? `Notes: ${form.notes}` : "",
      ].filter(Boolean).join(" ");
      await adjustStock(p.id, { quantityChange: Number(form.qty), reason: "PURCHASE", note });
      toast.success("Purchase recorded · stock updated");
      setOpen(false);
      setForm({ productId: "", qty: 0, unitCost: 0, supplier: "", date: today(), notes: "" });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/404|not\s?found|no such/i.test(msg)) {
        toast.error("Purchase backend endpoint not connected yet.");
      } else {
        toast.error(msg);
      }
    } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Buy Stock" subtitle="Record new stock purchases against real inventory" actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <ExportButton filename="buy-stock.csv" rows={filtered.map((m) => ({ Date: m.createdAt, Product: m.productName || m.productId, Qty: m.quantityChange, Reason: m.reason || "PURCHASE", Note: m.note || "" }))} />
          <PrimaryBtn onClick={() => setOpen(true)}><Plus size={14} /> New Purchase</PrimaryBtn>
        </div>
      } />

      <Card className="p-3 mb-4"><SearchInput value={q} onChange={setQ} placeholder="Search by product or note…" /></Card>

      <Card>
        {loading && filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : loadedOnce && filtered.length === 0 ? (
          <Empty title="No purchases yet." hint="Click New Purchase to record your first restock." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Date","Product","Quantity","Reason","Note"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2 text-xs">{fmtDateTime(m.createdAt)}</td>
                    <td className="px-3 py-2 font-medium">{m.productName || m.productId}</td>
                    <td className="px-3 py-2 text-emerald-600">+{m.quantityChange}</td>
                    <td className="px-3 py-2 text-xs">{m.reason || "PURCHASE"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{m.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-3"><div className="font-semibold">New Purchase</div><button onClick={() => setOpen(false)}><X size={16} /></button></div>
            <div className="space-y-2 text-sm">
              <select className="w-full px-3 py-2 rounded border bg-background" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                <option value="">Select product *</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
              </select>
              {products.length === 0 && <div className="text-xs text-amber-600">No products yet. Add inventory products first.</div>}
              <input type="number" placeholder="Quantity *" className="w-full px-3 py-2 rounded border bg-background" value={form.qty || ""} onChange={(e) => setForm({ ...form, qty: +e.target.value })} />
              <input type="number" placeholder="Unit cost per unit (₦) *" className="w-full px-3 py-2 rounded border bg-background" value={form.unitCost || ""} onChange={(e) => setForm({ ...form, unitCost: +e.target.value })} />
              <input placeholder="Supplier" className="w-full px-3 py-2 rounded border bg-background" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              <input type="date" className="w-full px-3 py-2 rounded border bg-background" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <textarea placeholder="Notes" rows={2} className="w-full px-3 py-2 rounded border bg-background" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <div className="text-xs text-muted-foreground">Total cost: {NGN((form.qty || 0) * (form.unitCost || 0))}</div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={saving} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !form.productId || form.qty <= 0} className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Save Purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
