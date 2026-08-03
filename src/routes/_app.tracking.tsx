import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/ModulePage";
import { listForms, getTrackingConfigs, saveTrackingConfig, type ApiForm, type TrackingConfig } from "@/lib/api";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tracking")({
  head: () => ({
    meta: [
      { title: "Meta Pixel & Tracking — Glowbalmart CRM" },
      { name: "description", content: "Configure Meta Pixel IDs and conversion events for each live Glowbalmart sales form." },
      { property: "og:title", content: "Meta Pixel & Tracking — Glowbalmart CRM" },
      { property: "og:description", content: "Configure Meta Pixel IDs and conversion events for each live Glowbalmart sales form." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackingPage,
});

const EVENT_KEYS: { key: keyof TrackingConfig; label: string }[] = [
  { key: "pageView", label: "PageView" },
  { key: "lead", label: "Lead" },
  { key: "initiateCheckout", label: "InitiateCheckout" },
  { key: "purchase", label: "Purchase" },
];

function TrackingPage() {
  const [forms, setForms] = useState<ApiForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [cfgs, setCfgs] = useState<Record<string, TrackingConfig>>({});
  const [providerConnected, setProviderConnected] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const f = await listForms();
      setForms(f);
      setSelected((s) => s || f[0]?.id || "");
      const remote = await getTrackingConfigs();
      if (remote === null) {
        setProviderConnected(false);
      } else {
        setProviderConnected(true);
        const map: Record<string, TrackingConfig> = {};
        remote.forEach((c) => { map[c.formId] = c; });
        setCfgs(map);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load forms");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const cfg: TrackingConfig = cfgs[selected] || { formId: selected, pixelId: "", accessToken: "", pageView: false, lead: false, initiateCheckout: false, purchase: false };
  const setCfg = (next: Partial<TrackingConfig>) => setCfgs({ ...cfgs, [selected]: { ...cfg, ...next, formId: selected } });

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await saveTrackingConfig(selected, {
        pixelId: cfg.pixelId, accessToken: cfg.accessToken,
        pageView: cfg.pageView, lead: cfg.lead, initiateCheckout: cfg.initiateCheckout, purchase: cfg.purchase,
      });
      if (res === null) {
        setProviderConnected(false);
        toast.message("Saved locally. Tracking provider not connected yet.");
      } else {
        toast.success("Tracking settings saved");
      }
    } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Meta Pixel & Tracking" subtitle="Per-form pixel and conversion event settings for your real sales forms." actions={
        <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      } />
      {!providerConnected && (
        <div className="mb-4 text-sm px-3 py-2 rounded-lg border border-amber-300/50 bg-amber-500/10 text-amber-700">
          Tracking provider not connected yet. Changes are kept locally in this browser only.
        </div>
      )}
      <Card className="p-4">
        {loading && forms.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading forms…</div>
        ) : forms.length === 0 ? (
          <Empty title="No sales forms yet." hint="Create a sales form first, then add its Meta Pixel here." />
        ) : (
          <>
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
              {forms.map((f) => <option key={f.id} value={f.id}>{f.name}{f.active === false ? " (inactive)" : ""}</option>)}
            </select>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Pixel ID</label>
                  <input value={cfg.pixelId || ""} onChange={(e) => setCfg({ pixelId: e.target.value })} placeholder="e.g. 1234567890"
                    className="mt-1 w-full px-3 py-2 rounded border bg-background" />
                </div>
                <div>
                  <label className="text-xs font-medium">Access token (optional)</label>
                  <input value={cfg.accessToken || ""} onChange={(e) => setCfg({ accessToken: e.target.value })} placeholder="Conversions API access token"
                    className="mt-1 w-full px-3 py-2 rounded border bg-background" />
                </div>
                <button onClick={onSave} disabled={saving} className="text-sm px-3 py-1.5 rounded border hover:bg-muted disabled:opacity-60">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Event toggles</div>
                {EVENT_KEYS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm py-1">
                    <input type="checkbox" checked={Boolean(cfg[key])}
                      onChange={(e) => setCfg({ [key]: e.target.checked } as Partial<TrackingConfig>)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
