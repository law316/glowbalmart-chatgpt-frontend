import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, Empty, PrimaryBtn, ExportButton, FilterSelect } from "@/components/ModulePage";
import { useLocal } from "@/lib/useLocal";
import { useStaff, useCustomerRefs } from "@/lib/useBackendRefs";
import { fmtDate, uid, today } from "@/lib/format";
import { Plus, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/complaints")({
  head: () => ({ meta: [{ title: "Complaints — Glowbalmart CRM" }] }),
  component: ComplaintsPage,
});

type CStatus = "open" | "in_progress" | "resolved" | "closed";
interface Complaint { id: string; date: string; customerName: string; phone: string; type: string; orderCode: string; priority: "low" | "medium" | "high"; status: CStatus; staffId: string; notes: string; resolution?: string; }

const COLOR: Record<CStatus, string> = { open: "bg-rose-500/15 text-rose-700", in_progress: "bg-amber-500/15 text-amber-700", resolved: "bg-emerald-500/15 text-emerald-700", closed: "bg-muted text-muted-foreground" };

function ComplaintsPage() {
  const { staff, nameOf } = useStaff();
  const { customers } = useCustomerRefs();
  const [list, setList] = useLocal<Complaint[]>("complaints", []);
  const [statusF, setStatusF] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Partial<Complaint>>({ priority: "medium", status: "open", date: today() });

  const filtered = list.filter(c => !statusF || c.status === statusF);
  const save = () => {
    if (!f.customerName) return toast.error("Customer required");
    setList([{ id: uid("cp"), date: f.date || today(), customerName: f.customerName!, phone: f.phone || "", type: f.type || "Other", orderCode: f.orderCode || "", priority: f.priority as any || "medium", status: "open", staffId: f.staffId || "", notes: f.notes || "" }, ...list]);
    toast.success("Complaint logged");
    setOpen(false); setF({ priority: "medium", status: "open", date: today() });
  };

  return (
    <>
      <PageHeader title="Complaints" subtitle="Log and resolve customer complaints." actions={<>
        <ExportButton filename="complaints.csv" rows={filtered.map(c => ({ Date: c.date, Customer: c.customerName, Type: c.type, Order: c.orderCode, Priority: c.priority, Status: c.status }))} />
        <PrimaryBtn onClick={() => setOpen(true)}><Plus size={14} /> New Complaint</PrimaryBtn>
      </>} />

      <div className="text-xs text-muted-foreground mb-4">Records are stored locally in this browser until a dedicated backend module is available. Customers, staff and products referenced are real.</div>

      <Card className="p-3 mb-4 flex flex-wrap gap-2">
        <FilterSelect value={statusF} onChange={setStatusF} options={[{ value: "", label: "All" }, { value: "open", label: "Open" }, { value: "in_progress", label: "In progress" }, { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" }]} />
      </Card>

      <Card>
        {filtered.length === 0 ? <Empty title="No complaints logged yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Date","Customer","Type","Order","Priority","Staff","Status",""].map(h => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2 text-xs">{fmtDate(c.date)}</td>
                    <td className="px-3 py-2 font-medium"><AlertTriangle size={12} className="inline text-amber-600 mr-1" />{c.customerName}<div className="text-xs text-muted-foreground">{c.phone}</div></td>
                    <td className="px-3 py-2 text-xs">{c.type}</td>
                    <td className="px-3 py-2 text-xs font-mono">{c.orderCode || "—"}</td>
                    <td className="px-3 py-2 text-xs capitalize">{c.priority}</td>
                    <td className="px-3 py-2 text-xs">{nameOf(c.staffId)}</td>
                    <td className="px-3 py-2"><select value={c.status} onChange={e => setList(list.map(x => x.id === c.id ? { ...x, status: e.target.value as CStatus } : x))} className={`text-xs px-2 py-1 rounded-full border-0 ${COLOR[c.status]}`}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></td>
                    <td className="px-3 py-2 text-right"><button onClick={() => setList(list.filter(x => x.id !== c.id))} className="text-xs text-rose-600">Delete</button></td>
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
            <div className="flex justify-between mb-3"><div className="font-semibold">New Complaint</div><button onClick={() => setOpen(false)}><X size={16} /></button></div>
            <div className="space-y-2 text-sm">
              <><input list="real-customers" placeholder="Customer name (from real orders)" className="w-full px-3 py-2 rounded border bg-background" value={f.customerName || ""} onChange={e => { const c = customers.find((x) => x.name === e.target.value); setF({ ...f, customerName: e.target.value, ...(c ? { phone: c.phone, orderCode: c.orderCode } : {}) }); }} /><datalist id="real-customers">{customers.map((c) => <option key={c.orderId} value={c.name}>{c.phone} · {c.orderCode}</option>)}</datalist></>
              <input placeholder="Phone" className="w-full px-3 py-2 rounded border bg-background" value={f.phone || ""} onChange={e => setF({ ...f, phone: e.target.value })} />
              <input placeholder="Complaint type" className="w-full px-3 py-2 rounded border bg-background" value={f.type || ""} onChange={e => setF({ ...f, type: e.target.value })} />
              <input placeholder="Order ID" className="w-full px-3 py-2 rounded border bg-background" value={f.orderCode || ""} onChange={e => setF({ ...f, orderCode: e.target.value })} />
              <select className="w-full px-3 py-2 rounded border bg-background" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as any })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
              <select className="w-full px-3 py-2 rounded border bg-background" value={f.staffId || ""} onChange={e => setF({ ...f, staffId: e.target.value })}><option value="">Assign staff</option>{staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
              <textarea rows={2} placeholder="Notes" className="w-full px-3 py-2 rounded border bg-background" value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOpen(false)} className="px-3 py-2 rounded border text-sm">Cancel</button><PrimaryBtn onClick={save}>Log</PrimaryBtn></div>
          </div>
        </div>
      )}
    </>
  );
}
