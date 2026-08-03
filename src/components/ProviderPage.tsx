import { PageHeader, Card, ComingSoon, PrimaryBtn } from "@/components/ModulePage";
import { useLocal } from "@/lib/useLocal";
import { Save } from "lucide-react";
import { toast } from "sonner";

interface Cfg { provider: string; apiKey: string; from: string; enabled: boolean; }

export function ProviderPage({ title, subtitle, providers, storeKey, fromLabel }: {
  title: string; subtitle: string; providers: { id: string; name: string }[]; storeKey: string; fromLabel: string;
}) {
  const [cfg, setCfg] = useLocal<Cfg>(storeKey, { provider: providers[0].id, apiKey: "", from: "", enabled: false });
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={<PrimaryBtn onClick={() => toast.success("Saved")}><Save size={14} /> Save</PrimaryBtn>} />
      <Card className="p-5 max-w-2xl space-y-3">
        <label className="block"><div className="text-xs uppercase text-muted-foreground mb-1">Provider</div>
          <select value={cfg.provider} onChange={e => setCfg({ ...cfg, provider: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm">
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <label className="block"><div className="text-xs uppercase text-muted-foreground mb-1">API key</div><input type="password" value={cfg.apiKey} onChange={e => setCfg({ ...cfg, apiKey: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm" /></label>
        <label className="block"><div className="text-xs uppercase text-muted-foreground mb-1">{fromLabel}</div><input value={cfg.from} onChange={e => setCfg({ ...cfg, from: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} /> Enabled</label>
      </Card>
      <div className="mt-4 max-w-2xl"><ComingSoon what="Live provider sending" /></div>
    </>
  );
}
