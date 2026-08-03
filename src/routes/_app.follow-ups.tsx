import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty, PrimaryBtn, ExportButton, SearchInput, FilterSelect, KpiCard } from "@/components/ModulePage";
import { useLocal } from "@/lib/useLocal";
import { useStaff, useCustomerRefs } from "@/lib/useBackendRefs";
import { listOrders, orderAllCallLogs, type ApiOrder, type MergedCallLog } from "@/lib/api";
import { fmtDate, uid, today } from "@/lib/format";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/follow-ups")({
  head: () => ({ meta: [{ title: "Follow-ups — Glowbalmart CRM" }] }),
  component: FollowUpsPage,
});

type FStatus = "pending" | "done" | "missed" | "rescheduled" | "cancelled";
type Priority = "low" | "medium" | "high";

interface FU { id: string; customerName: string; phone: string; staffId: string; reason: string; dueDate: string; priority: Priority; status: FStatus; notes?: string; }

const STATUS_COLOR: Record<FStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700", done: "bg-emerald-500/15 text-emerald-700",
  missed: "bg-rose-500/15 text-rose-700", rescheduled: "bg-blue-500/15 text-blue-700",
  cancelled: "bg-muted text-muted-foreground",
};

function FollowUpsPage() {
  const { staff, nameOf } = useStaff();
  const { customers } = useCustomerRefs();
  const [list, setList] = useLocal<FU[]>("custFollowUps", []);
  const [reportRows, setReportRows] = useState<(MergedCallLog & { order?: ApiOrder })[]>([]);
  const [reportLoading, setReportLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setReportLoading(true);
      try {
        const orders = await listOrders();
        const chunks: ApiOrder[][] = [];
        for (let i = 0; i < orders.length; i += 15) chunks.push(orders.slice(i, i + 15));
        const out: (MergedCallLog & { order?: ApiOrder })[] = [];
        for (const chunk of chunks) {
          const res = await Promise.all(chunk.map((o) => orderAllCallLogs(o.id).then((logs) => logs.map((l) => ({ ...l, order: o }))).catch(() => [])));
          out.push(...res.flat());
        }
        setReportRows(out);
      } catch { setReportRows([]); }
      finally { setReportLoading(false); }
    })();
  }, []);

  const now = new Date().toISOString();
  const attempt1 = reportRows.filter((r) => r.attempt === 1).length;
  const attempt2 = reportRows.filter((r) => r.attempt === 2).length;
  const attempt3 = reportRows.filter((r) => (r.attempt || 0) >= 3).length;
  const overdue = useMemo(() => reportRows.filter((r) => r.order?.nextFollowUpDate && r.order.nextFollowUpDate < now && r.order.followUpStatus !== "COMPLETED").length, [reportRows, now]);
  const outcomeBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    reportRows.forEach((r) => { const o = r.outcome || "UNKNOWN"; m[o] = (m[o] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [reportRows]);
  const perStaff = useMemo(() => {
    const m: Record<string, number> = {};
    reportRows.forEach((r) => { const s = r.staffName || "Unassigned"; m[s] = (m[s] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [reportRows]);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<FU>>({ priority: "medium", status: "pending", dueDate: today() });

  const filtered = list.filter(f => (!q || f.customerName.toLowerCase().includes(q.toLowerCase())) && (!statusF || f.status === statusF));

  const save = () => {
    if (!form.customerName) return toast.error("Customer required");
    setList([{ id: uid("fu"), customerName: form.customerName!, phone: form.phone || "", staffId: form.staffId || "", reason: form.reason || "", dueDate: form.dueDate || today(), priority: (form.priority as Priority) || "medium", status: "pending", notes: form.notes }, ...list]);
    toast.success("Follow-up scheduled");
    setOpen(false); setForm({ priority: "medium", status: "pending", dueDate: today() });
  };

  const setStatus = (id: string, s: FStatus) => setList(list.map(f => f.id === id ? { ...f, status: s } : f));

  return (
    <>
      <PageHeader title="Follow-ups" subtitle="Track customer care follow-ups outside the main sales call queue." actions={<>
        <ExportButton filename="follow-ups.csv" rows={filtered.map(f => ({ Customer: f.customerName, Phone: f.phone, Reason: f.reason, Due: f.dueDate, Priority: f.priority, Status: f.status }))} />
        <PrimaryBtn onClick={() => setOpen(true)}><Plus size={14} /> New Follow-up</PrimaryBtn>
      </>} />

      <Card className="p-4 mb-4 border-l-4 border-l-amber-500"><div className="text-sm"><strong>Note:</strong> This Customer Service follow-up page is separate from the main sales 3-call order follow-up queue. Manually scheduled follow-ups below are stored locally until a dedicated backend module is available.</div></Card>

      <div className="mb-4">
        <div className="font-semibold text-sm mb-2 flex items-center gap-2">Sales Follow-up Report {reportLoading && <Loader2 size={14} className="animate-spin" />}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <KpiCard label="Attempt 1" value={attempt1} />
          <KpiCard label="Attempt 2" value={attempt2} />
          <KpiCard label="Attempt 3+" value={attempt3} />
          <KpiCard label="Overdue" value={overdue} accent="var(--destructive)" />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Card className="p-3">
            <div className="text-xs uppercase text-muted-foreground mb-2">Outcome breakdown</div>
            {outcomeBreakdown.length === 0 ? <div className="text-xs text-muted-foreground">No call activity recorded yet.</div> : (
              <ul className="text-sm space-y-1">{outcomeBreakdown.map(([o, c]) => <li key={o} className="flex justify-between"><span className="capitalize">{o.replace(/_/g, " ").toLowerCase()}</span><span className="font-medium">{c}</span></li>)}</ul>
            )}
          </Card>
          <Card className="p-3">
            <div className="text-xs uppercase text-muted-foreground mb-2">Per-staff calls</div>
            {perStaff.length === 0 ? <div className="text-xs text-muted-foreground">No call activity recorded yet.</div> : (
              <ul className="text-sm space-y-1">{perStaff.map(([s, c]) => <li key={s} className="flex justify-between"><span>{s}</span><span className="font-medium">{c}</span></li>)}</ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="p-3 mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search customer…" />
        <FilterSelect value={statusF} onChange={setStatusF} options={[{ value: "", label: "All statuses" }, { value: "pending", label: "Pending" }, { value: "done", label: "Done" }, { value: "missed", label: "Missed" }, { value: "rescheduled", label: "Rescheduled" }, { value: "cancelled", label: "Cancelled" }]} />
      </Card>

      <Card>
        {filtered.length === 0 ? <Empty title="No follow-ups yet" hint="Schedule a follow-up call for a customer." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Customer","Reason","Staff","Due","Priority","Status",""].map(h => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(f => (
                  <tr key={f.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{f.customerName}<div className="text-xs text-muted-foreground">{f.phone}</div></td>
                    <td className="px-3 py-2 text-xs">{f.reason}</td>
                    <td className="px-3 py-2 text-xs">{nameOf(f.staffId)}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(f.dueDate)}</td>
                    <td className="px-3 py-2"><span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${f.priority === "high" ? "bg-rose-500/15 text-rose-700" : f.priority === "medium" ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground"}`}>{f.priority}</span></td>
                    <td className="px-3 py-2"><select value={f.status} onChange={e => setStatus(f.id, e.target.value as FStatus)} className={`text-xs px-2 py-1 rounded-full border-0 ${STATUS_COLOR[f.status]}`}><option value="pending">Pending</option><option value="done">Done</option><option value="missed">Missed</option><option value="rescheduled">Rescheduled</option><option value="cancelled">Cancelled</option></select></td>
                    <td className="px-3 py-2 text-right"><button onClick={() => setList(list.filter(x => x.id !== f.id))} className="text-xs text-rose-600">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-3"><div className="font-semibold">New Follow-up</div><button onClick={() => setOpen(false)}><X size={16} /></button></div>
            <div className="space-y-2 text-sm">
              <><input list="real-customers" placeholder="Customer name (from real orders)" className="w-full px-3 py-2 rounded border bg-background" value={form.customerName || ""} onChange={e => { const c = customers.find((x) => x.name === e.target.value); setForm({ ...form, customerName: e.target.value, ...(c ? { phone: c.phone, orderCode: c.orderCode } : {}) }); }} /><datalist id="real-customers">{customers.map((c) => <option key={c.orderId} value={c.name}>{c.phone} · {c.orderCode}</option>)}</datalist></>
              <input placeholder="Phone" className="w-full px-3 py-2 rounded border bg-background" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <select className="w-full px-3 py-2 rounded border bg-background" value={form.staffId || ""} onChange={e => setForm({ ...form, staffId: e.target.value })}><option value="">Assign staff</option>{staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
              <input placeholder="Reason" className="w-full px-3 py-2 rounded border bg-background" value={form.reason || ""} onChange={e => setForm({ ...form, reason: e.target.value })} />
              <input type="date" className="w-full px-3 py-2 rounded border bg-background" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              <select className="w-full px-3 py-2 rounded border bg-background" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
              <textarea rows={2} placeholder="Notes" className="w-full px-3 py-2 rounded border bg-background" value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOpen(false)} className="px-3 py-2 rounded border text-sm">Cancel</button><PrimaryBtn onClick={save}>Schedule</PrimaryBtn></div>
          </div>
        </div>
      )}
    </>
  );
}
