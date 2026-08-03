import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { useCurrentUser } from "@/lib/store";
import { NGN, fmtDate } from "@/lib/format";
import { Loader2, RefreshCw, Download, CheckCircle2, Wallet, XCircle, Plus, X } from "lucide-react";
import { exportCSV } from "@/lib/export";
import {
  listEarnings, myEarnings, earningsSummary, approveEarning, markEarningPaid, cancelEarning,
  createEarning, apiListUsers, listOrders, type ApiEarning, type EarningsSummary, type BackendUser, type ApiOrder,
} from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/staff-earnings")({
  head: () => ({ meta: [{ title: "Staff Earnings — Glowbalmart CRM" }] }),
  component: EarningsPage,
});

function EarningsPage() {
  const user = useCurrentUser()!;
  const canManage = user.role === "admin" || user.role === "finance" || user.role === "manager";
  const [rows, setRows] = useState<ApiEarning[]>([]);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusF, setStatusF] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [staff, setStaff] = useState<BackendUser[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ staffId: "", earningType: "COMMISSION", amount: "", note: "", orderId: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        canManage ? listEarnings().catch(() => []) : myEarnings().catch(() => []),
        canManage ? earningsSummary().catch(() => null) : null,
      ]);
      setRows(list); setSummary(s);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [canManage]);
  useEffect(() => { if (canManage) apiListUsers().then(setStaff).catch(() => setStaff([])); }, [canManage]);
  useEffect(() => { if (canManage) listOrders().then(setOrders).catch(() => setOrders([])); }, [canManage]);

  const saveEarning = async () => {
    const amount = Number(form.amount);
    if (!form.staffId) return toast.error("Select a staff member");
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    try {
      await createEarning({ staffId: form.staffId, earningType: form.earningType, amount, note: form.note || undefined, orderId: form.orderId || undefined });
      toast.success("Earning recorded");
      setOpen(false);
      setForm({ staffId: "", earningType: "COMMISSION", amount: "", note: "", orderId: "" });
      setOrderQuery("");
      load();
      if (canManage) earningsSummary().then(setSummary).catch(() => {});
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to record earning"); }
    finally { setSaving(false); }
  };

  const visible = statusF ? rows.filter((r) => (r.status || "").toUpperCase() === statusF) : rows;

  const act = async (fn: () => Promise<any>, msg: string, id: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(msg);
      await load();
      if (canManage) earningsSummary().then(setSummary).catch(() => {});
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusyId(null); }
  };

  const Kpi = ({ l, v, tone = "" }: { l: string; v: string; tone?: string }) => (
    <Card className="p-3"><div className="text-xs text-muted-foreground uppercase">{l}</div><div className={`mt-1 text-xl font-bold ${tone}`}>{v}</div></Card>
  );

  return (
    <>
      <PageHeader title={canManage ? "Staff Earnings" : "My Earnings"} subtitle={canManage ? "Approve, pay or cancel commission earnings across the team." : "Your commissions and bonuses."} actions={
        <>
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          {canManage && <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"><Plus size={14} /> Add Earning</button>}
          <button onClick={() => exportCSV("staff-earnings.csv", visible.map((r) => ({ Date: fmtDate(r.createdAt), Staff: r.staffName || r.staffId || "", Type: r.earningType || "", Amount: r.amount, Status: r.status || "", Order: r.orderId || "" })))} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border"><Download size={14} /> CSV</button>
        </>
      } />

      {canManage && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Kpi l="Pending" v={NGN(summary?.totalPending || 0)} tone="text-amber-600" />
          <Kpi l="Approved" v={NGN(summary?.totalApproved || 0)} tone="text-blue-600" />
          <Kpi l="Paid" v={NGN(summary?.totalPaid || 0)} tone="text-emerald-600" />
          <Kpi l="Outstanding" v={NGN(summary?.totalOutstanding || 0)} tone="text-rose-600" />
        </div>
      )}

      <Card className="p-3 mb-4 flex flex-wrap gap-2">
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
          <option value="">All statuses</option>
          {["PENDING","APPROVED","PAID","CANCELLED"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="ml-auto text-xs text-muted-foreground self-center">{visible.length} entries</div>
      </Card>

      <Card>
        {loading && rows.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
          : visible.length === 0 ? <Empty title="No earnings yet" hint="Earnings appear when orders are delivered." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr>{["Date", canManage ? "Staff" : "Ref", "Type","Order","Amount","Status", canManage ? "Actions" : ""].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 text-xs">{fmtDate(r.createdAt)}</td>
                      <td className="px-3 py-2 text-xs">{canManage ? (r.staffName || r.staffId) : (r.id.slice(0, 8))}</td>
                      <td className="px-3 py-2 text-xs">{r.earningType || "—"}</td>
                      <td className="px-3 py-2 text-xs font-mono">{r.orderId?.slice(0, 8) || "—"}</td>
                      <td className="px-3 py-2 font-medium">{NGN(r.amount)}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full ${
                          r.status === "PAID" ? "bg-emerald-500/15 text-emerald-700"
                          : r.status === "APPROVED" ? "bg-blue-500/15 text-blue-700"
                          : r.status === "CANCELLED" ? "bg-rose-500/15 text-rose-700"
                          : "bg-amber-500/15 text-amber-700"
                        }`}>{r.status || "PENDING"}</span>
                      </td>
                      {canManage && (
                        <td className="px-3 py-2 text-xs">
                          <div className="flex gap-1">
                            {r.status === "PENDING" && <button disabled={busyId === r.id} onClick={() => act(() => approveEarning(r.id), "Approved", r.id)} className="px-2 py-1 rounded border hover:bg-muted"><CheckCircle2 size={12} className="inline mr-1" />Approve</button>}
                            {(r.status === "APPROVED" || r.status === "PENDING") && <button disabled={busyId === r.id} onClick={() => act(() => markEarningPaid(r.id), "Marked paid", r.id)} className="px-2 py-1 rounded border hover:bg-muted text-emerald-600"><Wallet size={12} className="inline mr-1" />Pay</button>}
                            {r.status !== "PAID" && r.status !== "CANCELLED" && <button disabled={busyId === r.id} onClick={() => act(() => cancelEarning(r.id), "Cancelled", r.id)} className="px-2 py-1 rounded border hover:bg-muted text-rose-600"><XCircle size={12} className="inline mr-1" />Cancel</button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-3"><div className="font-semibold">Add Manual Earning</div><button onClick={() => setOpen(false)}><X size={16} /></button></div>
            <div className="space-y-2 text-sm">
              <select value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="w-full px-3 py-2 rounded border bg-background">
                <option value="">Select staff *</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select value={form.earningType} onChange={(e) => setForm({ ...form, earningType: e.target.value })} className="w-full px-3 py-2 rounded border bg-background">
                {["COMMISSION", "BONUS", "ADJUSTMENT", "OTHER"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="number" min={0} placeholder="Amount (₦) *" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
              <div className="relative">
                <input
                  placeholder="Search order by code or customer (optional)"
                  value={form.orderId ? (orders.find((o) => o.id === form.orderId) ? `${orders.find((o) => o.id === form.orderId)!.code || orders.find((o) => o.id === form.orderId)!.id.slice(0, 8)} — ${orders.find((o) => o.id === form.orderId)!.customerName}` : orderQuery) : orderQuery}
                  onChange={(e) => { setOrderQuery(e.target.value); setForm({ ...form, orderId: "" }); setOrderPickerOpen(true); }}
                  onFocus={() => setOrderPickerOpen(true)}
                  className="w-full px-3 py-2 rounded border bg-background"
                />
                {form.orderId && (
                  <button type="button" onClick={() => { setForm({ ...form, orderId: "" }); setOrderQuery(""); }} className="absolute right-2 top-2 text-xs text-muted-foreground">clear</button>
                )}
                {orderPickerOpen && orderQuery && !form.orderId && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded border bg-card shadow-lg">
                    {orders
                      .filter((o) => {
                        const q = orderQuery.toLowerCase();
                        return (o.code || "").toLowerCase().includes(q) || (o.customerName || "").toLowerCase().includes(q);
                      })
                      .slice(0, 20)
                      .map((o) => (
                        <div
                          key={o.id}
                          className="px-3 py-2 text-xs hover:bg-muted cursor-pointer"
                          onClick={() => { setForm({ ...form, orderId: o.id }); setOrderPickerOpen(false); }}
                        >
                          {(o.code || o.id.slice(0, 8))} — {o.customerName}
                        </div>
                      ))}
                    {orders.filter((o) => {
                      const q = orderQuery.toLowerCase();
                      return (o.code || "").toLowerCase().includes(q) || (o.customerName || "").toLowerCase().includes(q);
                    }).length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No matching orders</div>}
                  </div>
                )}
              </div>
              <textarea rows={2} placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button disabled={saving} onClick={saveEarning} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">{saving && <Loader2 size={14} className="animate-spin" />} Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
