import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, Empty, PrimaryBtn } from "@/components/ModulePage";
import { useLocal } from "@/lib/useLocal";
import { Copy, Plus, Webhook, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/connections/webhooks")({
  head: () => ({ meta: [{ title: "Webhooks — Glowbalmart CRM" }] }),
  component: WebhooksPage,
});

interface Hook { id: string; name: string; source: string; destination: string; secret: string; status: "active" | "paused"; lastReceived?: string; }

function WebhooksPage() {
  const [list, setList] = useLocal<Hook[]>("hooks", []);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", source: "incoming", destination: "" });

  const create = () => {
    if (!f.name) return toast.error("Name required");
    setList([...list, { id: "wh_" + Date.now(), name: f.name, source: f.source, destination: f.destination, secret: "shh_" + Math.random().toString(36).slice(2, 10), status: "active" }]);
    toast.success("Webhook created");
    setOpen(false); setF({ name: "", source: "incoming", destination: "" });
  };

  return (
    <>
      <PageHeader title="Webhooks" subtitle="Manage incoming and outgoing automation hooks."
        actions={<PrimaryBtn onClick={() => setOpen(true)}><Plus size={14} /> Create New Webhook</PrimaryBtn>} />

      <Card>
        {list.length === 0 ? <Empty title="No webhooks yet" hint="Create one to start automating events." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Name","Source","Destination","Secret","Status","Last Received",""].map(h => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {list.map(h => (
                  <tr key={h.id} className="border-t">
                    <td className="px-3 py-2 font-medium flex items-center gap-2"><Webhook size={14} /> {h.name}</td>
                    <td className="px-3 py-2 text-xs">{h.source}</td>
                    <td className="px-3 py-2 text-xs font-mono">{h.destination || "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono"><button onClick={() => { navigator.clipboard.writeText(h.secret); toast.success("Copied"); }} className="inline-flex items-center gap-1">{h.secret.slice(0, 12)}… <Copy size={10} /></button></td>
                    <td className="px-3 py-2"><span className={`text-[10px] px-2 py-0.5 rounded-full ${h.status === "active" ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{h.status}</span></td>
                    <td className="px-3 py-2 text-xs">{h.lastReceived || "—"}</td>
                    <td className="px-3 py-2"><button onClick={() => toast.success("Test sent (mock)")} className="text-xs underline">Test</button></td>
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
            <div className="flex justify-between mb-3"><div className="font-semibold">New Webhook</div><button onClick={() => setOpen(false)}><X size={16} /></button></div>
            <div className="space-y-2 text-sm">
              <input placeholder="Webhook name" className="w-full px-3 py-2 rounded border bg-background" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
              <select className="w-full px-3 py-2 rounded border bg-background" value={f.source} onChange={e => setF({ ...f, source: e.target.value })}><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select>
              <input placeholder="Destination URL (for outgoing)" className="w-full px-3 py-2 rounded border bg-background" value={f.destination} onChange={e => setF({ ...f, destination: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOpen(false)} className="px-3 py-2 rounded border text-sm">Cancel</button><PrimaryBtn onClick={create}>Create</PrimaryBtn></div>
          </div>
        </div>
      )}
    </>
  );
}
