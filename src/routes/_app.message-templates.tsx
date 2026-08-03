import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, Empty, PrimaryBtn, ExportButton } from "@/components/ModulePage";
import { useStore } from "@/lib/store";
import { useLocal } from "@/lib/useLocal";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { MessageTemplate } from "@/lib/types";

export const Route = createFileRoute("/_app/message-templates")({
  head: () => ({ meta: [{ title: "Message Templates — Glowbalmart CRM" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const seed = useStore((s) => s.templates);
  const [list, setList] = useLocal<MessageTemplate[]>("templates", seed);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Partial<MessageTemplate>>({ channel: "whatsapp" });

  const save = () => {
    if (!f.name || !f.body) return toast.error("Name and body required");
    setList([{ id: "t_" + Date.now(), name: f.name!, channel: f.channel as any, body: f.body! }, ...list]);
    setOpen(false); setF({ channel: "whatsapp" });
    toast.success("Template saved");
  };

  return (
    <>
      <PageHeader title="Message Templates" subtitle="Reusable templates across WhatsApp, SMS and Email." actions={<>
        <ExportButton filename="templates.csv" rows={list.map(t => ({ Name: t.name, Channel: t.channel, Body: t.body }))} />
        <PrimaryBtn onClick={() => setOpen(true)}><Plus size={14} /> New Template</PrimaryBtn>
      </>} />

      {list.length === 0 ? <Card><Empty title="No templates" /></Card> : (
        <div className="grid md:grid-cols-2 gap-3">
          {list.map(t => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between">
                <div><div className="font-semibold">{t.name}</div><span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${t.channel === "whatsapp" ? "bg-emerald-500/15 text-emerald-700" : t.channel === "sms" ? "bg-blue-500/15 text-blue-700" : "bg-purple-500/15 text-purple-700"}`}>{t.channel}</span></div>
                <button onClick={() => setList(list.filter(x => x.id !== t.id))} className="text-rose-600"><Trash2 size={14} /></button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{t.body}</p>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-3"><div className="font-semibold">New Template</div><button onClick={() => setOpen(false)}><X size={16} /></button></div>
            <div className="space-y-2 text-sm">
              <input placeholder="Template name" className="w-full px-3 py-2 rounded border bg-background" value={f.name || ""} onChange={e => setF({ ...f, name: e.target.value })} />
              <select className="w-full px-3 py-2 rounded border bg-background" value={f.channel} onChange={e => setF({ ...f, channel: e.target.value as any })}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option></select>
              <textarea rows={5} placeholder="Body — use {{name}}, {{package}}, {{code}}" className="w-full px-3 py-2 rounded border bg-background" value={f.body || ""} onChange={e => setF({ ...f, body: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOpen(false)} className="px-3 py-2 rounded border text-sm">Cancel</button><PrimaryBtn onClick={save}>Save</PrimaryBtn></div>
          </div>
        </div>
      )}
    </>
  );
}
