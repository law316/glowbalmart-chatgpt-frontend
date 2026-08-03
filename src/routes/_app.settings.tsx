import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, Card } from "@/components/AppShell";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Glowbalmart CRM" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const resetDemo = useStore((s) => s.resetDemo);
  const [s, setS] = useState(settings);

  const save = () => { useStore.setState({ settings: s }); toast.success("Settings saved"); };

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="font-semibold mb-3">Company Profile</div>
          <label className="text-xs">Company name</label>
          <input value={s.companyName} onChange={(e) => setS({ ...s, companyName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background" />
          <label className="text-xs mt-3 block">Currency</label>
          <input value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background" />
          <label className="text-xs mt-3 block">Logo upload</label>
          <div className="mt-1 text-xs text-muted-foreground rounded border border-dashed p-3">Upload placeholder — connect storage later.</div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold mb-3">Follow-up Rules</div>
          <label className="text-xs">Max call attempts</label>
          <input type="number" value={s.followUpMaxAttempts} onChange={(e) => setS({ ...s, followUpMaxAttempts: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background" />
          <div className="mt-2 text-xs text-muted-foreground">After this many unsuccessful calls, the order is auto-closed as "Closed — Max Follow-up Reached".</div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold mb-3">Payment Gateways</div>
          <div className="text-xs text-muted-foreground mb-2">API keys will be added later.</div>
          <input placeholder="Paystack secret key" value={s.paystackKey || ""} onChange={(e) => setS({ ...s, paystackKey: e.target.value })} className="w-full mb-2 px-3 py-2 rounded border bg-background" />
          <input placeholder="Flutterwave secret key" value={s.flutterwaveKey || ""} onChange={(e) => setS({ ...s, flutterwaveKey: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
        </Card>

        <Card className="p-4">
          <div className="font-semibold mb-3">AI Provider</div>
          <select value={s.aiProvider || ""} onChange={(e) => setS({ ...s, aiProvider: e.target.value as any })} className="w-full px-3 py-2 rounded border bg-background">
            <option value="">— Not connected (demo mode) —</option>
            <option value="openai">OpenAI</option>
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
            <option value="custom">Custom API endpoint</option>
          </select>
          <div className="mt-2 text-xs text-muted-foreground">API keys will be requested later.</div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold mb-3">Notification Provider</div>
          <div className="text-xs text-muted-foreground">WhatsApp / SMS / Email provider connections will appear here.</div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold mb-3">Data Ownership</div>
          <div className="text-sm text-muted-foreground">Your orders, customers, products and financial records belong to your business. Glowbalmart CRM is your operational tool — not your data owner.</div>
          <button onClick={() => { if (confirm("Reset demo data? This clears local storage.")) resetDemo(); }} className="mt-3 text-xs px-3 py-2 rounded border text-rose-600">Reset demo data</button>
        </Card>
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={save} className="text-sm px-4 py-2 rounded text-white" style={{ background: "var(--gradient-electric)" }}>Save Settings</button>
      </div>
    </>
  );
}
