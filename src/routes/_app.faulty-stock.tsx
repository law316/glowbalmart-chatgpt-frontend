import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { ExportButton } from "@/components/ModulePage";
import { fmtDateTime, today } from "@/lib/format";
import { Plus, X, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  listProducts, listMovements, adjustStock,
  type ApiProduct, type InventoryMove,
} from "@/lib/api";

export const Route = createFileRoute("/_app/faulty-stock")({
  head: () => ({ meta: [{ title: "Faulty Stock — Glowbalmart CRM" }] }),
  component: FaultyPage,
});

function FaultyPage() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [endpointMissing, setEndpointMissing] = useState(false);
  const [form, setForm] = useState({ productId: "", qty: 0, location: "Office", reason: "", date: today(), notes: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [p, m] = await Promise.all([
        listProducts().catch(() => []),
        listMovements().catch(() => []),
      ]);
      setProducts(p); setMovements(m);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setLoadedOnce(true); }
  };
  useEffect(() => { load(); }, []);

  const faulty = movements.filter((m) => {
    const r = (m.reason || "").toUpperCase();
    return r === "DAMAGE" || r === "DAMAGED" || r === "FAULTY" || r.includes("DAMAGE") || r.includes("FAULT");
  });

  const save = async () => {
    const p = products.find((x) => x.id === form.productId);
    if (!p) return toast.error("Please pick a product.");
    if (!form.qty || form.qty <= 0) return toast.error("Quantity must be greater than 0.");
    setSaving(true);
    try {
      const note = [
        `Faulty stock reported at ${form.location}.`,
        form.reason ? `Reason: ${form.reason}.` : "",
        form.notes ? `Notes: ${form.notes}` : "",
        `Date ${form.date}.`,
      ].filter(Boolean).join(" ");
      // Use inventory adjust-stock with negative quantity + DAMAGE reason
      await adjustStock(p.id, { quantityChange: -Math.abs(Number(form.qty)), reason: "DAMAGE", note });
      toast.success("Faulty stock recorded");
      setOpen(false);
      setForm({ productId: "", qty: 0, location: "Office", reason: "", date: today(), notes: "" });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/404|not\s?found|no such/i.test(msg)) {
        setEndpointMissing(true);
        toast.error("Faulty stock backend endpoint required.");
      } else {
        toast.error(msg);
      }
    } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Faulty Stock" subtitle="Record and track faulty or damaged stock" actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <ExportButton filename="faulty-stock.csv" rows={faulty.map((m) => ({ Date: m.createdAt, Product: m.productName || m.productId, Qty: Math.abs(m.quantityChange), Reason: m.reason || "DAMAGE", Note: m.note || "" }))} />
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}>
            <Plus size={14} /> Report Faulty Stock
          </button>
        </div>
      } />

      {endpointMissing && (
        <Card className="p-4 mb-4 border-amber-500/40 bg-amber-50/30 dark:bg-amber-500/5">
          <div className="flex items-center gap-2 font-semibold text-amber-700"><AlertTriangle size={16} /> Faulty stock backend endpoint required.</div>
          <div className="text-xs text-muted-foreground mt-1">The inventory adjust endpoint did not accept the DAMAGE reason.</div>
        </Card>
      )}

      <Card>
        {loading && faulty.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : loadedOnce && faulty.length === 0 ? (
          <Empty title="No faulty stock reported yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Date","Product","Qty","Reason","Note"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {faulty.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2 text-xs">{fmtDateTime(m.createdAt)}</td>
                    <td className="px-3 py-2 font-medium">{m.productName || m.productId}</td>
                    <td className="px-3 py-2 text-rose-600">{Math.abs(m.quantityChange)}</td>
                    <td className="px-3 py-2 text-xs">{m.reason || "DAMAGE"}</td>
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
            <div className="flex justify-between mb-3"><div className="font-semibold">Report Faulty Stock</div><button onClick={() => setOpen(false)}><X size={16} /></button></div>
            <div className="space-y-2 text-sm">
              <select className="w-full px-3 py-2 rounded border bg-background" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                <option value="">Select product *</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
              </select>
              {products.length === 0 && <div className="text-xs text-amber-600">No products yet. Add inventory products first.</div>}
              <input type="number" placeholder="Quantity *" className="w-full px-3 py-2 rounded border bg-background" value={form.qty || ""} onChange={(e) => setForm({ ...form, qty: +e.target.value })} />
              <input placeholder="Location" className="w-full px-3 py-2 rounded border bg-background" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <input placeholder="Reason (broken, expired…)" className="w-full px-3 py-2 rounded border bg-background" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              <input type="date" className="w-full px-3 py-2 rounded border bg-background" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <textarea rows={2} placeholder="Notes" className="w-full px-3 py-2 rounded border bg-background" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={saving} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !form.productId || form.qty <= 0} className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Save Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
