import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, Empty, PrimaryBtn, ExportButton } from "@/components/ModulePage";
import { useLocal } from "@/lib/useLocal";
import { useStaff, useCustomerRefs, useProductRefs } from "@/lib/useBackendRefs";
import { fmtDate, uid, today } from "@/lib/format";
import { Plus, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/returns")({
  head: () => ({ meta: [{ title: "Returns — Glowbalmart CRM" }] }),
  component: ReturnsPage,
});

type RStatus = "requested" | "approved" | "received" | "rejected";
type RefundStatus = "none" | "pending" | "refunded";
interface ReturnItem { id: string; date: string; customerName: string; orderCode: string; productName: string; reason: string; status: RStatus; refund: RefundStatus; staffId: string; notes?: string; }

function ReturnsPage() {
  const { staff, nameOf } = useStaff();
  const { customers } = useCustomerRefs();
  const productRefs = useProductRefs();
  const [list, setList] = useLocal<ReturnItem[]>("returns", []);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Partial<ReturnItem>>({ status: "requested", refund: "none", date: today() });

  const save = () => {
    if (!f.customerName) return toast.error("Customer required");
    setList([{ id: uid("rt"), date: f.date || today(), customerName: f.customerName!, orderCode: f.orderCode || "", productName: f.productName || "", reason: f.reason || "", status: "requested", refund: "none", staffId: f.staffId || "", notes: f.notes }, ...list]);
    toast.success("Return logged");
    setOpen(false); setF({ status: "requested", refund: "none", date: today() });
  };

  return (
    <>
      <PageHeader title="Returns" subtitle="Track product returns and refunds." actions={<>
        <ExportButton filename="returns.csv" rows={list.map(r => ({ Date: r.date, Customer: r.customerName, Order: r.orderCode, Product: r.productName, Reason: r.reason, Status: r.status, Refund: r.refund }))} />
        <PrimaryBtn onClick={() => setOpen(true)}><Plus size={14} /> New Return</PrimaryBtn>
      </>} />

      <div className="text-xs text-muted-foreground mb-4">Records are stored locally in this browser until a dedicated backend module is available. Customers, staff and products referenced are real.</div>

      <Card>
        {list.length === 0 ? <Empty title="No returns logged yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Date","Customer","Order","Product","Reason","Status","Refund","Staff",""].map(h => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 text-xs">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2 font-medium"><RotateCcw size={12} className="inline mr-1 text-amber-600" />{r.customerName}</td>
                    <td className="px-3 py-2 text-xs font-mono">{r.orderCode || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.productName}</td>
                    <td className="px-3 py-2 text-xs">{r.reason}</td>
                    <td className="px-3 py-2"><select value={r.status} onChange={e => setList(list.map(x => x.id === r.id ? { ...x, status: e.target.value as RStatus } : x))} className="text-xs px-2 py-1 rounded border bg-background"><option value="requested">Requested</option><option value="approved">Approved</option><option value="received">Received</option><option value="rejected">Rejected</option></select></td>
                    <td className="px-3 py-2"><select value={r.refund} onChange={e => setList(list.map(x => x.id === r.id ? { ...x, refund: e.target.value as RefundStatus } : x))} className="text-xs px-2 py-1 rounded border bg-background"><option value="none">None</option><option value="pending">Pending</option><option value="refunded">Refunded</option></select></td>
                    <td className="px-3 py-2 text-xs">{nameOf(r.staffId)}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => setList(list.filter(x => x.id !== r.id))} className="text-xs text-rose-600">Delete</button></td>
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
            <div className="flex justify-between mb-3"><div className="font-semibold">New Return</div><button onClick={() => setOpen(false)}><X size={16} /></button></div>
            <div className="space-y-2 text-sm">
              <><input list="real-customers" placeholder="Customer name (from real orders)" className="w-full px-3 py-2 rounded border bg-background" value={f.customerName || ""} onChange={e => { const c = customers.find((x) => x.name === e.target.value); setF({ ...f, customerName: e.target.value, ...(c ? { phone: c.phone, orderCode: c.orderCode } : {}) }); }} /><datalist id="real-customers">{customers.map((c) => <option key={c.orderId} value={c.name}>{c.phone} · {c.orderCode}</option>)}</datalist></>
              <input placeholder="Order ID" className="w-full px-3 py-2 rounded border bg-background" value={f.orderCode || ""} onChange={e => setF({ ...f, orderCode: e.target.value })} />
              <select className="w-full px-3 py-2 rounded border bg-background" value={f.productName || ""} onChange={e => setF({ ...f, productName: e.target.value })}><option value="">Product</option>{productRefs.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}</select>
              <input placeholder="Reason" className="w-full px-3 py-2 rounded border bg-background" value={f.reason || ""} onChange={e => setF({ ...f, reason: e.target.value })} />
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
