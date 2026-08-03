import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/store";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { NGN, fmtDate } from "@/lib/format";
import { Download, FileText, Loader2, RefreshCw, Truck, MapPin } from "lucide-react";
import { exportCSV, exportPDF } from "@/lib/export";
import {
  deliveryQueue, myDeliveryQueue, assignDeliveryToMe, deliveryUpdate,
  type ApiOrder, type DeliveryOutcome,
} from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/delivery")({
  head: () => ({ meta: [{ title: "Delivery — Glowbalmart CRM" }] }),
  component: DeliveryPage,
});

const OUTCOMES: { value: DeliveryOutcome; label: string }[] = [
  { value: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "DELIVERY_FAILED", label: "Delivery failed" },
  { value: "RETURNED", label: "Returned" },
];

type Tab = "mine" | "all";

function DeliveryPage() {
  const user = useCurrentUser()!;
  const isAgent = user.role === "delivery";
  const [tab, setTab] = useState<Tab>(isAgent ? "mine" : "all");
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DeliveryOutcome>("OUT_FOR_DELIVERY");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = tab === "mine" ? await myDeliveryQueue() : await deliveryQueue();
      setOrders(data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const manifest = useMemo(() => orders.map((o) => ({
    Code: o.code || o.id.slice(0, 8), Customer: o.customerName, Phone: o.phone,
    Address: o.deliveryAddress || "—", State: o.state || "—", Package: o.packageName || "—",
    Price: o.price, Delivery: o.deliveryStatus || "—", Agent: o.deliveryAssignedToName || "—",
  })), [orders]);

  const claim = async (id: string) => {
    try { await assignDeliveryToMe(id); toast.success("Delivery assigned to you"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const save = async () => {
    if (!openId) return;
    if (!note.trim()) { toast.error("Note is required"); return; }
    setSaving(true);
    try {
      await deliveryUpdate(openId, outcome, note.trim());
      toast.success("Delivery updated");
      setOpenId(null); setNote("");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Delivery & Logistics" subtitle="Confirmed orders ready for dispatch." actions={
        <>
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <button onClick={() => exportCSV("order-manifest.csv", manifest)} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><Download size={14} /> Manifest CSV</button>
          <button onClick={() => exportPDF("order-manifest.pdf", "Order Manifest", manifest)} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><FileText size={14} /> Manifest PDF</button>
        </>
      } />

      <Card className="p-4 mb-4 flex flex-wrap gap-2 items-center">
        {[
          { k: "mine" as Tab, l: "My Deliveries" },
          { k: "all" as Tab, l: "All Delivery Queue" },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${tab === t.k ? "text-white border-transparent" : "hover:bg-muted"}`}
            style={tab === t.k ? { background: "var(--gradient-electric)" } : undefined}>
            {t.l}
          </button>
        ))}
        <div className="ml-auto text-xs text-muted-foreground">{orders.length} orders</div>
      </Card>

      {loading && orders.length === 0 ? (
        <Card><div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div></Card>
      ) : orders.length === 0 ? (
        <Card><Empty title="Delivery queue is empty" hint="Confirmed orders appear here for dispatch." /></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Order","Customer","Address","Package","Price","Status","Agent",""].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{o.code || o.id.slice(0, 8)}<div className="text-[10px] text-muted-foreground">{fmtDate(o.createdAt)}</div></td>
                    <td className="px-3 py-2">{o.customerName}<div className="text-xs text-muted-foreground">{o.phone}</div></td>
                    <td className="px-3 py-2 text-xs max-w-xs"><div className="flex items-start gap-1"><MapPin size={12} className="mt-0.5 shrink-0" /><span>{o.deliveryAddress}<div className="text-muted-foreground">{o.state}</div></span></div></td>
                    <td className="px-3 py-2 text-xs">{o.packageName || "—"}</td>
                    <td className="px-3 py-2">{NGN(o.price)}</td>
                    <td className="px-3 py-2"><StatusBadge status={(o.deliveryStatus || "not_dispatched").toLowerCase()} /></td>
                    <td className="px-3 py-2 text-xs">{o.deliveryAssignedToName || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {!o.deliveryAssignedToId && isAgent && (
                          <button onClick={() => claim(o.id)} className="text-xs px-2 py-1 rounded border hover:bg-muted"><Truck size={12} className="inline mr-1" />Claim</button>
                        )}
                        <button onClick={() => { setOpenId(o.id); setOutcome("OUT_FOR_DELIVERY"); setNote(""); }}
                          className="text-xs px-2 py-1 rounded text-white" style={{ background: "var(--gradient-electric)" }}>Update</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {openId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setOpenId(null)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-3">Delivery Update</div>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as DeliveryOutcome)} className="w-full px-3 py-2 rounded border bg-background mb-2">
              {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <textarea placeholder="Delivery note *" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 rounded border bg-background" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setOpenId(null)} disabled={saving} className="px-3 py-2 text-sm rounded border">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
