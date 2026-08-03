import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, PrimaryBtn, ComingSoon } from "@/components/ModulePage";
import { useLocal } from "@/lib/useLocal";
import { Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/connections/woocommerce")({
  head: () => ({ meta: [{ title: "WooCommerce — Glowbalmart CRM" }] }),
  component: WooPage,
});

const MAPPINGS = [
  { from: "pending", to: "Default Pending" },
  { from: "processing", to: "Default Pending" },
  { from: "on-hold", to: "Default Call Back" },
  { from: "completed", to: "Default Delivered" },
  { from: "cancelled", to: "Default Cancelled" },
  { from: "refunded", to: "Default Cancelled" },
  { from: "failed", to: "Default Rejected" },
];

interface WooCfg { storeUrl: string; consumerKey: string; consumerSecret: string; secret: string; mapping: Record<string, string>; }
const DEF: WooCfg = { storeUrl: "", consumerKey: "", consumerSecret: "", secret: "", mapping: Object.fromEntries(MAPPINGS.map(m => [m.from, m.to])) };

function WooPage() {
  const [cfg, setCfg] = useLocal<WooCfg>("wooCfg", DEF);
  const [activity] = useState<any[]>([]);
  const webhookUrl = "https://demo.glowbalmartcrm.com/wp-json/glowbalmart/v1/woo/default";
  const fallback = "https://demo.glowbalmartcrm.com/?gbmcrm_woo_in=default";

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };
  const gen = () => { setCfg({ ...cfg, secret: "wbs_" + Math.random().toString(36).slice(2, 16) }); toast.success("Secret generated"); };
  const test = () => toast.success("Connection test passed (mock)");
  const pull = () => toast.success("Pulled 0 new orders (mock)");

  return (
    <>
      <PageHeader title="WooCommerce" subtitle="Receive orders, sync products, and pull from your store" />

      <Card className="p-4 mb-4 border-l-4 border-l-blue-500">
        <div className="text-sm"><strong>Settings for Glowbalmart Demo Store only</strong> — each business has its own WooCommerce connection, status mapping, and order sync records.</div>
      </Card>

      <Card className="p-5 mb-4">
        <div className="font-semibold">Pull Orders from WooCommerce</div>
        <div className="text-sm text-muted-foreground mt-1">Manually import the latest 50 orders from your WooCommerce store. Same matching and dedup logic as the live webhook — safe to click repeatedly.</div>
        <div className="mt-3"><PrimaryBtn onClick={pull}><RefreshCw size={14} /> Pull Orders Now</PrimaryBtn></div>
      </Card>

      <Card className="p-5 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold">Webhook Configuration</div>
            <div className="text-xs text-muted-foreground">Webhook endpoint</div>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${cfg.secret ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>{cfg.secret ? "Configured" : "Not Yet Configured"}</span>
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-1">Delivery URL</div>
            <div className="flex gap-2"><input readOnly value={webhookUrl} className="flex-1 px-3 py-2 rounded border bg-muted text-xs font-mono" /><button onClick={() => copy(webhookUrl)} className="px-3 rounded border hover:bg-muted"><Copy size={14} /></button></div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-1">Fallback URL</div>
            <div className="flex gap-2"><input readOnly value={fallback} className="flex-1 px-3 py-2 rounded border bg-muted text-xs font-mono" /><button onClick={() => copy(fallback)} className="px-3 rounded border hover:bg-muted"><Copy size={14} /></button></div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-1">Webhook Secret</div>
            <div className="flex gap-2"><input value={cfg.secret} readOnly placeholder="Click Generate to create a secret" className="flex-1 px-3 py-2 rounded border bg-background text-sm font-mono" /><button onClick={gen} className="px-3 rounded-lg border hover:bg-muted text-sm inline-flex items-center gap-1"><ShieldCheck size={14} /> Generate</button></div>
            <div className="text-[11px] text-muted-foreground mt-1">Generate a secret to start receiving Woo webhooks. Without one, every incoming webhook is rejected.</div>
          </div>
        </div>
      </Card>

      <Card className="p-5 mb-4">
        <div className="font-semibold mb-3">WooCommerce API credentials</div>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-xs"><div className="uppercase text-muted-foreground mb-1">Store URL</div><input placeholder="https://yourstore.com" value={cfg.storeUrl} onChange={e => setCfg({ ...cfg, storeUrl: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm" /></label>
          <label className="text-xs"><div className="uppercase text-muted-foreground mb-1">Consumer Key</div><input placeholder="ck_xxxxxxxxxxxxxxxx" value={cfg.consumerKey} onChange={e => setCfg({ ...cfg, consumerKey: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm" /></label>
          <label className="text-xs md:col-span-2"><div className="uppercase text-muted-foreground mb-1">Consumer Secret</div><input type="password" placeholder="cs_xxxxxxxxxxxxxxxx" value={cfg.consumerSecret} onChange={e => setCfg({ ...cfg, consumerSecret: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm" /></label>
        </div>
        <div className="mt-3"><button onClick={test} className="text-sm px-3 py-2 rounded-lg border hover:bg-muted">Test Configuration</button></div>
        <div className="text-[11px] text-muted-foreground mt-2">Credentials are stored per business and used for all REST API operations. Settings auto-save — no Save button needed.</div>
      </Card>

      <Card className="p-5 mb-4">
        <div className="font-semibold mb-3">Status Mapping</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {MAPPINGS.map(m => (
            <div key={m.from} className="flex items-center gap-2 text-sm">
              <span className="text-xs px-2 py-1 rounded bg-muted font-mono">woo {m.from}</span>
              <span>→</span>
              <input value={cfg.mapping[m.from] || ""} onChange={e => setCfg({ ...cfg, mapping: { ...cfg.mapping, [m.from]: e.target.value } })} className="flex-1 px-2 py-1 rounded border bg-background text-xs" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3"><div className="font-semibold">Recent Activity</div><button onClick={() => toast.success("Refreshed")} className="text-xs px-2 py-1 rounded border hover:bg-muted inline-flex items-center gap-1"><RefreshCw size={12} /> Refresh</button></div>
        {activity.length === 0 ? <div className="text-sm text-center py-6 text-muted-foreground">No webhook activity yet.</div> : null}
      </Card>

      <Card className="p-5">
        <div className="font-semibold mb-3">How to set up connection</div>
        <ol className="text-sm space-y-2 list-decimal pl-5 text-muted-foreground">
          <li>In WooCommerce admin, go to <strong className="text-foreground">WooCommerce → Settings → Advanced → REST API</strong>. Click Add Key. Description: "Glowbalmart CRM". Permissions: Read/Write. Generate API Key.</li>
          <li>Copy the Consumer Key and Consumer Secret into Glowbalmart CRM.</li>
          <li>Click <strong className="text-foreground">Test Configuration</strong>.</li>
          <li>For real-time order receipt, create Order Created and Order Updated webhooks in WooCommerce manually pointing to the Delivery URL above.</li>
          <li>To bring in existing orders, click <strong className="text-foreground">Pull Orders Now</strong>.</li>
        </ol>
        <div className="mt-4"><ComingSoon what="Live WooCommerce sync" /></div>
      </Card>
    </>
  );
}
