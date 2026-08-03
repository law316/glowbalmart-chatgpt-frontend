import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { AccessDenied } from "@/components/AccessDenied";
import { useCurrentUser } from "@/lib/store";
import {
  listPromoterTargets, createPromoterTarget, promoterTargetPerformance,
  apiListUsers, type PromoterTarget, type PromoterTargetPerformance, type BackendUser, type PromoterCommissionType,
} from "@/lib/api";
import { Loader2, Plus, RefreshCw, Award } from "lucide-react";
import { NGN } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/promoter-targets")({
  head: () => ({ meta: [{ title: "Media Buyer Targets — Glowbalmart CRM" }] }),
  component: PromoterTargetsPage,
});

const CT: PromoterCommissionType[] = ["FIXED","PER_CAMPAIGN","PER_ORDER","PER_PAID_ORDER","PERCENT_OF_REVENUE","PERCENT_OF_PROFIT","NONE"];

function hasCommission(t?: PromoterTarget | null) {
  const ct = (t?.commissionType || "").toUpperCase();
  return !!ct && ct !== "NONE";
}

function PromoterTargetsPage() {
  const current = useCurrentUser();
  const canManage = current?.role === "admin" || current?.role === "manager";
  const [targets, setTargets] = useState<PromoterTarget[]>([]);
  const [promoters, setPromoters] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState("");
  const [perf, setPerf] = useState<PromoterTargetPerformance | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    promoterUserId: "", name: "", description: "",
    targetStartDate: "", targetEndDate: "",
    targetCampaigns: 0, targetReach: 0, targetClicks: 0, targetConversions: 0,
    targetOrders: 0, targetPaidOrders: 0, targetRevenue: 0, targetProfit: 0,
    commissionType: "PER_ORDER" as PromoterCommissionType, commissionValue: 0,
    active: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [t, u] = await Promise.all([listPromoterTargets(true), apiListUsers().catch(() => [] as BackendUser[])]);
      setTargets(t);
      setPromoters(u.filter((x) => ["MEDIA_PROMOTER","MEDIA_BUYER"].includes((x.roleName || "").toUpperCase())));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (canManage) load(); }, [canManage]);

  useEffect(() => {
    if (!sel) { setPerf(null); return; }
    setPerf(null);
    promoterTargetPerformance(sel).then(setPerf).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
  }, [sel]);

  const save = async () => {
    if (!form.promoterUserId || !form.name) { toast.error("Media buyer and name required"); return; }
    setSaving(true);
    try {
      await createPromoterTarget({
        ...form,
        targetStartDate: form.targetStartDate ? new Date(form.targetStartDate).toISOString() : undefined,
        targetEndDate: form.targetEndDate ? new Date(form.targetEndDate).toISOString() : undefined,
      } as Partial<PromoterTarget>);
      toast.success("Target created");
      setOpen(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  if (!canManage) return <AccessDenied allowed={["admin","manager"]} role={current?.role ?? "staff"} />;
  const selected = targets.find((t) => t.id === sel);
  const commissionTarget = perf?.target || selected;

  return (
    <>
      <PageHeader title="Media Buyer Targets" subtitle="Set reach, clicks, orders, revenue and profit targets for media buyers."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
            </button>
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}>
              <Plus size={14} /> New Target
            </button>
          </div>
        } />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 p-3">
          <div className="font-semibold mb-2 flex items-center gap-2"><Award size={16} /> Targets</div>
          {loading ? <div className="p-6 text-center"><Loader2 className="inline animate-spin" size={14} /></div>
            : targets.length === 0 ? <Empty title="No targets yet" />
            : (
              <ul className="space-y-1">
                {targets.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => setSel(t.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sel === t.id ? "bg-muted font-medium" : "hover:bg-muted/50"}`}>
                      <div>{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.promoterName || "—"}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </Card>

        <Card className="lg:col-span-2 p-4">
          {!sel ? <Empty title="Select a target" />
            : !perf ? <div className="p-6 text-center"><Loader2 className="inline animate-spin" size={14} /></div>
            : (
              <>
                <div>
                  <div className="font-semibold text-lg">{selected?.name}</div>
                  <div className="text-xs text-muted-foreground">{selected?.promoterName || "—"}</div>
                  {selected?.description && <div className="text-xs text-muted-foreground mt-1">{selected.description}</div>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <Row label="Campaigns" actual={perf.actualCampaigns} target={selected?.targetCampaigns} />
                  <Row label="Reach" actual={perf.actualReach} target={selected?.targetReach} />
                  <Row label="Clicks" actual={perf.actualClicks} target={selected?.targetClicks} />
                  <Row label="Conversions" actual={perf.actualConversions} target={selected?.targetConversions} />
                  <Row label="Orders" actual={perf.actualOrders} target={selected?.targetOrders} />
                  <Row label="Paid Orders" actual={perf.actualPaidOrders} target={selected?.targetPaidOrders} />
                  <Row label="Revenue" actual={perf.actualRevenue} target={selected?.targetRevenue} money />
                  <Row label="Profit" actual={perf.actualProfit} target={selected?.targetProfit} money />
                </div>
                <Card className="p-3 mt-4">
                  {hasCommission(commissionTarget) ? (
                    <>
                      <div className="text-xs text-muted-foreground">Commission earned ({commissionTarget?.commissionType?.replace(/_/g, " ")})</div>
                      <div className="text-xl font-bold text-emerald-600">{NGN(perf.commissionEarned || 0)}</div>
                      <div className={`mt-1 text-[10px] px-2 py-0.5 rounded-full inline-block ${perf.targetMet ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {perf.targetMet ? "Target met" : "In progress"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-muted-foreground">Commission</div>
                      <div className="text-sm text-muted-foreground italic">No commission rule configured</div>
                    </>
                  )}
                </Card>
              </>
            )}
        </Card>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-card w-full max-w-2xl rounded-xl p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-3">Create Media Buyer Target</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select className="md:col-span-2 px-3 py-2 rounded border bg-background" value={form.promoterUserId} onChange={(e) => setForm({ ...form, promoterUserId: e.target.value })}>
                <option value="">Select media buyer…</option>
                {promoters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="md:col-span-2 px-3 py-2 rounded border bg-background" placeholder="Target name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <textarea className="md:col-span-2 px-3 py-2 rounded border bg-background" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <label className="text-xs">Start<input type="datetime-local" className="w-full mt-1 px-2 py-2 rounded border bg-background" value={form.targetStartDate} onChange={(e) => setForm({ ...form, targetStartDate: e.target.value })} /></label>
              <label className="text-xs">End<input type="datetime-local" className="w-full mt-1 px-2 py-2 rounded border bg-background" value={form.targetEndDate} onChange={(e) => setForm({ ...form, targetEndDate: e.target.value })} /></label>
              {[
                ["targetCampaigns","Campaigns"],["targetReach","Reach"],["targetClicks","Clicks"],["targetConversions","Conversions"],
                ["targetOrders","Orders"],["targetPaidOrders","Paid Orders"],["targetRevenue","Revenue"],["targetProfit","Profit"],
              ].map(([k, l]) => (
                <label key={k} className="text-xs">{l}<input type="number" className="w-full mt-1 px-2 py-2 rounded border bg-background" value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: +e.target.value })} /></label>
              ))}
              <label className="text-xs">Commission Type
                <select className="w-full mt-1 px-2 py-2 rounded border bg-background" value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value as PromoterCommissionType })}>
                  {CT.map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                </select>
              </label>
              <label className="text-xs">Commission Value<input type="number" className="w-full mt-1 px-2 py-2 rounded border bg-background" value={form.commissionValue} onChange={(e) => setForm({ ...form, commissionValue: +e.target.value })} /></label>
              <label className="md:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={saving} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm" style={{ background: "var(--gradient-electric)" }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, actual = 0, target = 0, money }: { label: string; actual?: number; target?: number; money?: boolean }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  const fmt = (v: number) => money ? NGN(v) : v.toLocaleString();
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-bold">{fmt(actual)}</div>
      <div className="text-[11px] text-muted-foreground">Target {fmt(target)}</div>
      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full" style={{ width: `${pct}%`, background: "var(--gradient-electric)" }} /></div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{pct}%</div>
    </Card>
  );
}
