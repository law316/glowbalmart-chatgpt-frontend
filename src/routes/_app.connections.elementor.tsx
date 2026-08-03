import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, Empty, PrimaryBtn } from "@/components/ModulePage";
import { useStore } from "@/lib/store";
import { useLocal } from "@/lib/useLocal";
import { Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/connections/elementor")({
  head: () => ({ meta: [{ title: "Elementor Form — Glowbalmart CRM" }] }),
  component: ElementorPage,
});

interface ElHook { id: string; name: string; productId: string; url: string; mapping: Record<string, string>; }

function ElementorPage() {
  const products = useStore((s) => s.products);
  const [hooks, setHooks] = useLocal<ElHook[]>("elHooks", []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", productId: "" });

  const create = () => {
    if (!form.name) return toast.error("Name required");
    const id = "eh_" + Date.now();
    setHooks([...hooks, { id, name: form.name, productId: form.productId, url: `https://demo.glowbalmartcrm.com/elementor/${id}`, mapping: { customerName: "name", phone: "phone", whatsapp: "whatsapp", address: "address", state: "state", offer: "offer", qty: "qty", price: "price" } }]);
    toast.success("Webhook created");
    setOpen(false); setForm({ name: "", productId: "" });
  };

  return (
    <>
      <PageHeader title="Elementor Form" subtitle="Receive orders from Elementor forms and map offer tiers."
        actions={<PrimaryBtn onClick={() => setOpen(true)}><Plus size={14} /> Create New Webhook</PrimaryBtn>} />

      {hooks.length === 0 ? (
        <Card><Empty title="No Elementor webhooks yet." hint="Create a webhook for the product you are building in Elementor." /></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {hooks.map(h => (
            <Card key={h.id} className="p-4">
              <div className="font-semibold">{h.name}</div>
              <div className="text-xs text-muted-foreground">{products.find(p => p.id === h.productId)?.name || "—"}</div>
              <div className="mt-3"><div className="text-[10px] uppercase text-muted-foreground">Webhook URL</div>
                <div className="flex gap-2 mt-1"><input readOnly value={h.url} className="flex-1 px-2 py-1.5 rounded border bg-muted text-xs font-mono" /><button onClick={() => { navigator.clipboard.writeText(h.url); toast.success("Copied"); }} className="px-2 rounded border hover:bg-muted"><Copy size={12} /></button></div></div>
              <div className="mt-3"><button onClick={() => toast.success("Prices fetched (mock)")} className="text-xs px-2 py-1 rounded border hover:bg-muted">Fetch Prices</button></div>
              <div className="mt-3 text-[10px] uppercase text-muted-foreground">Field mapping</div>
              <div className="grid grid-cols-2 gap-1 text-[11px] mt-1">{Object.entries(h.mapping).map(([k, v]) => <div key={k} className="flex justify-between bg-muted/30 rounded px-2 py-0.5"><span className="text-muted-foreground">{k}</span><span className="font-mono">{v}</span></div>)}</div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-5 mt-4">
        <div className="font-semibold mb-2">How it works</div>
        <p className="text-sm text-muted-foreground">Create a webhook for the product you are building in Elementor, copy the webhook URL into <strong className="text-foreground">Elementor Form → Actions After Submit → Webhook</strong>, then use <strong className="text-foreground">Fetch Prices</strong> to copy the offer labels into your Elementor select/radio field. Incoming Elementor submissions create Glowbalmart CRM orders with customer, phone, address, selected offer, quantity and price.</p>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-3"><div className="font-semibold">New Elementor Webhook</div><button onClick={() => setOpen(false)}><X size={16} /></button></div>
            <div className="space-y-2 text-sm">
              <input placeholder="Webhook name" className="w-full px-3 py-2 rounded border bg-background" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <select className="w-full px-3 py-2 rounded border bg-background" value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })}><option value="">Select product</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOpen(false)} className="px-3 py-2 rounded border text-sm">Cancel</button><PrimaryBtn onClick={create}>Create</PrimaryBtn></div>
          </div>
        </div>
      )}
    </>
  );
}
