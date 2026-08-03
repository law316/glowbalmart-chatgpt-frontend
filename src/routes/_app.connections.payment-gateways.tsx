import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card, ComingSoon } from "@/components/ModulePage";
import { useLocal } from "@/lib/useLocal";
import { CreditCard } from "lucide-react";

export const Route = createFileRoute("/_app/connections/payment-gateways")({
  head: () => ({ meta: [{ title: "Payment Gateways — Glowbalmart CRM" }] }),
  component: PayPage,
});

interface PG { provider: string; publicKey: string; secretKey: string; enabled: boolean; }
const PROVIDERS = [
  { id: "paystack", name: "Paystack", desc: "Cards, bank transfer, USSD" },
  { id: "flutterwave", name: "Flutterwave", desc: "Cards, mobile money, bank" },
  { id: "stripe", name: "Stripe", desc: "International cards" },
  { id: "monnify", name: "Monnify", desc: "Bank transfer reserved accounts" },
];

function PayPage() {
  const [cfg, setCfg] = useLocal<Record<string, PG>>("paymentGateways", {});
  const upd = (id: string, patch: Partial<PG>) => setCfg({ ...cfg, [id]: { ...(cfg[id] || { provider: id, publicKey: "", secretKey: "", enabled: false }), ...patch } });

  return (
    <>
      <PageHeader title="Payment Gateways" subtitle="Connect payment providers to receive online payments." />
      <div className="grid md:grid-cols-2 gap-3">
        {PROVIDERS.map(p => {
          const c = cfg[p.id] || { provider: p.id, publicKey: "", secretKey: "", enabled: false };
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><CreditCard size={18} /></span>
                  <div><div className="font-semibold">{p.name}</div><div className="text-xs text-muted-foreground">{p.desc}</div></div>
                </div>
                <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={c.enabled} onChange={e => upd(p.id, { enabled: e.target.checked })} /> Enabled</label>
              </div>
              <div className="mt-3 space-y-2">
                <input type="password" placeholder="Public key" value={c.publicKey} onChange={e => upd(p.id, { publicKey: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm" />
                <input type="password" placeholder="Secret key" value={c.secretKey} onChange={e => upd(p.id, { secretKey: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm" />
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-4"><ComingSoon what="Live payment processing" /></div>
    </>
  );
}
