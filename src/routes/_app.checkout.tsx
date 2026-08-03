import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card, PrimaryBtn, ComingSoon } from "@/components/ModulePage";
import { useLocal } from "@/lib/useLocal";
import { Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Glowbalmart CRM" }] }),
  component: CheckoutPage,
});

interface CheckoutCfg {
  reqName: boolean; reqPhone: boolean; reqWhatsapp: boolean; reqAddress: boolean; reqState: boolean;
  allowNotes: boolean; coupon: boolean; bumps: boolean; upsells: boolean;
  deliveryFee: number; chargePayer: "owner" | "customer";
  confirmation: string; redirect: string;
}
const DEFAULT: CheckoutCfg = {
  reqName: true, reqPhone: true, reqWhatsapp: false, reqAddress: true, reqState: true,
  allowNotes: true, coupon: false, bumps: false, upsells: false,
  deliveryFee: 2500, chargePayer: "customer",
  confirmation: "Thank you! Your order has been received. We'll call you to confirm shortly.",
  redirect: "",
};

function CheckoutPage() {
  const [cfg, setCfg] = useLocal<CheckoutCfg>("checkout", DEFAULT);
  const u = <K extends keyof CheckoutCfg>(k: K, v: CheckoutCfg[K]) => setCfg({ ...cfg, [k]: v });
  const save = () => toast.success("Checkout saved");

  const Check = ({ k, label }: { k: keyof CheckoutCfg; label: string }) => (
    <label className="flex items-center gap-2 text-sm py-1.5"><input type="checkbox" checked={cfg[k] as boolean} onChange={e => u(k, e.target.checked as any)} /> {label}</label>
  );

  return (
    <>
      <PageHeader title="Checkout" subtitle="Manage checkout settings for your storefront and order forms." actions={<PrimaryBtn onClick={save}><Save size={14} /> Save</PrimaryBtn>} />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="font-semibold mb-3">Checkout fields</div>
          <div className="grid sm:grid-cols-2 gap-2">
            <Check k="reqName" label="Require full name" />
            <Check k="reqPhone" label="Require phone" />
            <Check k="reqWhatsapp" label="Require WhatsApp" />
            <Check k="reqAddress" label="Require delivery address" />
            <Check k="reqState" label="Require state" />
            <Check k="allowNotes" label="Allow customer notes" />
            <Check k="coupon" label="Enable coupon (placeholder)" />
            <Check k="bumps" label="Enable order bumps (placeholder)" />
            <Check k="upsells" label="Enable upsells (placeholder)" />
          </div>

          <div className="grid md:grid-cols-2 gap-3 mt-5 pt-5 border-t">
            <div><label className="text-xs uppercase text-muted-foreground">Delivery fee (₦)</label><input type="number" className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm" value={cfg.deliveryFee} onChange={e => u("deliveryFee", +e.target.value)} /></div>
            <div><label className="text-xs uppercase text-muted-foreground">Who pays gateway charge?</label>
              <select className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm" value={cfg.chargePayer} onChange={e => u("chargePayer", e.target.value as any)}><option value="owner">Store Owner</option><option value="customer">Customer</option></select>
            </div>
          </div>
          <div className="mt-3"><label className="text-xs uppercase text-muted-foreground">Order confirmation message</label><textarea rows={3} className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm" value={cfg.confirmation} onChange={e => u("confirmation", e.target.value)} /></div>
          <div className="mt-3"><label className="text-xs uppercase text-muted-foreground">Redirect URL after checkout</label><input className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="https://…" value={cfg.redirect} onChange={e => u("redirect", e.target.value)} /></div>
        </Card>

        <div className="space-y-4">
          <ComingSoon what="Payment methods" />
          <ComingSoon what="WhatsApp order notifications" />
          <Card className="p-5">
            <div className="font-semibold mb-3">Checkout form preview</div>
            <div className="space-y-2 text-sm">
              {cfg.reqName && <div className="h-9 rounded border bg-muted/30 flex items-center px-3 text-muted-foreground">Full name *</div>}
              {cfg.reqPhone && <div className="h-9 rounded border bg-muted/30 flex items-center px-3 text-muted-foreground">Phone *</div>}
              {cfg.reqWhatsapp && <div className="h-9 rounded border bg-muted/30 flex items-center px-3 text-muted-foreground">WhatsApp *</div>}
              {cfg.reqAddress && <div className="h-9 rounded border bg-muted/30 flex items-center px-3 text-muted-foreground">Delivery address *</div>}
              {cfg.reqState && <div className="h-9 rounded border bg-muted/30 flex items-center px-3 text-muted-foreground">State *</div>}
              {cfg.allowNotes && <div className="h-9 rounded border bg-muted/30 flex items-center px-3 text-muted-foreground">Notes</div>}
              <button className="w-full py-2 mt-1 text-white font-medium rounded-lg" style={{ background: "var(--gradient-electric)" }}>Place order</button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
