import { PageHeader, Card, Empty } from "@/components/ModulePage";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useLocal } from "@/lib/useLocal";
import { listConnections } from "@/lib/api";
import type { MessageTemplate } from "@/lib/types";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

const PROVIDER_KEYWORDS: Record<string, string[]> = {
  whatsapp: ["whatsapp"],
  sms: ["sms"],
  email: ["email", "smtp", "mail"],
};

export default function AutomationPage({ title, subtitle, channel }: { title: string; subtitle: string; channel: "whatsapp" | "sms" | "email" }) {
  const seed = useStore((s) => s.templates);
  const [list, setList] = useLocal<MessageTemplate[]>("templates", seed);
  const templates = list.filter((t) => t.channel === channel);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setChecking(true);
      try {
        const conns = await listConnections();
        const kws = PROVIDER_KEYWORDS[channel];
        const match = conns.find((c) =>
          kws.some((k) => (c.providerKey || "").toLowerCase().includes(k) || (c.providerName || "").toLowerCase().includes(k))
        );
        if (alive) setConnected(!!match && (match.connected || match.status === "connected" || match.active === true));
      } catch {
        if (alive) setConnected(false);
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, [channel]);

  const providerLabel = channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "SMS" : "Email";

  const saveEdit = (id: string) => {
    const body = draft[id];
    if (body === undefined) return;
    setList(list.map((t) => (t.id === id ? { ...t, body } : t)));
    toast.success("Template updated");
  };
  const removeTemplate = (id: string) => {
    setList(list.filter((t) => t.id !== id));
  };

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />

      <Card className="p-4 mb-4 text-sm">
        {checking ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Checking provider connection…</span>
        ) : connected ? (
          <span className="text-emerald-700">{providerLabel} provider connected.</span>
        ) : (
          <span className="text-muted-foreground">{providerLabel} provider not connected.</span>
        )}
        <div className="mt-1 text-xs text-muted-foreground">Triggers and templates can be prepared here, but live sending stays disabled until a provider is connected.</div>
      </Card>

      <Card className="p-5 mt-4">
        <div className="font-semibold mb-3">Triggers</div>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {["New order received", "Order assigned to staff", "Order placed but not paid", "Customer abandoned cart", "Delivery dispatched", "Delivery delivered"].map((t) => (
            <label key={t} className="flex items-center gap-2 p-2 rounded border"><input type="checkbox" disabled /> {t}</label>
          ))}
        </div>
      </Card>
      <Card className="p-5 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">{channel} templates</div>
          <Link to="/message-templates" className="text-xs underline">Manage all templates →</Link>
        </div>
        {templates.length === 0 ? <Empty title="No templates for this channel" /> : (
          <div className="grid md:grid-cols-2 gap-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{t.name}</div>
                  <button onClick={() => removeTemplate(t.id)} className="text-rose-600"><Trash2 size={14} /></button>
                </div>
                <textarea
                  rows={3}
                  className="mt-2 w-full text-xs rounded border bg-background p-2"
                  value={draft[t.id] ?? t.body}
                  onChange={(e) => setDraft({ ...draft, [t.id]: e.target.value })}
                />
                <button onClick={() => saveEdit(t.id)} className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted"><Save size={12} /> Save</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
