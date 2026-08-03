import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, Empty, PrimaryBtn, ExportButton, SearchInput } from "@/components/ModulePage";
import { useLocal } from "@/lib/useLocal";
import { useStaff, useCustomerRefs } from "@/lib/useBackendRefs";
import { fmtDateTime, uid } from "@/lib/format";
import { Plus, StickyNote, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customer-notes")({
  head: () => ({ meta: [{ title: "Customer Notes — Glowbalmart CRM" }] }),
  component: NotesPage,
});

interface Note { id: string; customerName: string; phone: string; body: string; staffId: string; createdAt: string; }

function NotesPage() {
  const { staff, nameOf } = useStaff();
  const { customers } = useCustomerRefs();
  const [list, setList] = useLocal<Note[]>("customerNotes", []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ customerName: "", phone: "", body: "", staffId: "" });

  const filtered = list.filter(n => !q || n.customerName.toLowerCase().includes(q.toLowerCase()) || n.body.toLowerCase().includes(q.toLowerCase()));
  const save = () => {
    if (!f.customerName || !f.body) return toast.error("Customer and note required");
    setList([{ id: uid("n"), ...f, createdAt: new Date().toISOString() }, ...list]);
    toast.success("Note added");
    setOpen(false); setF({ customerName: "", phone: "", body: "", staffId: "" });
  };

  return (
    <>
      <PageHeader title="Customer Notes" subtitle="Internal notes about customers — visible only to staff." actions={<>
        <ExportButton filename="customer-notes.csv" rows={filtered.map(n => ({ When: n.createdAt, Customer: n.customerName, Phone: n.phone, Note: n.body, Staff: nameOf(n.staffId) }))} />
        <PrimaryBtn onClick={() => setOpen(true)}><Plus size={14} /> New Note</PrimaryBtn>
      </>} />

      <div className="text-xs text-muted-foreground mb-4">Records are stored locally in this browser until a dedicated backend module is available. Customers, staff and products referenced are real.</div>

      <Card className="p-3 mb-4"><SearchInput value={q} onChange={setQ} placeholder="Search notes…" /></Card>

      {filtered.length === 0 ? <Card><Empty title="No customer notes yet." /></Card> : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map(n => (
            <Card key={n.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/15 text-amber-700"><StickyNote size={16} /></span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{n.customerName}</div>
                  <div className="text-[11px] text-muted-foreground">{n.phone} · {fmtDateTime(n.createdAt)} · by {nameOf(n.staffId)}</div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{n.body}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-3"><div className="font-semibold">New Customer Note</div><button onClick={() => setOpen(false)}><X size={16} /></button></div>
            <div className="space-y-2 text-sm">
              <><input list="real-customers" placeholder="Customer name (from real orders)" className="w-full px-3 py-2 rounded border bg-background" value={f.customerName || ""} onChange={e => { const c = customers.find((x) => x.name === e.target.value); setF({ ...f, customerName: e.target.value, ...(c ? { phone: c.phone, orderCode: c.orderCode } : {}) }); }} /><datalist id="real-customers">{customers.map((c) => <option key={c.orderId} value={c.name}>{c.phone} · {c.orderCode}</option>)}</datalist></>
              <input placeholder="Phone" className="w-full px-3 py-2 rounded border bg-background" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
              <textarea rows={4} placeholder="Note…" className="w-full px-3 py-2 rounded border bg-background" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
              <select className="w-full px-3 py-2 rounded border bg-background" value={f.staffId} onChange={e => setF({ ...f, staffId: e.target.value })}><option value="">Author</option>{staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOpen(false)} className="px-3 py-2 rounded border text-sm">Cancel</button><PrimaryBtn onClick={save}>Save</PrimaryBtn></div>
          </div>
        </div>
      )}
    </>
  );
}
