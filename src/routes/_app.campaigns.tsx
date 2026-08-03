import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import {
  listCampaigns, createCampaign, launchCampaign, pauseCampaign, completeCampaign, cancelCampaign,
  marketingSummary, apiListUsers, listForms, campaignShareLink, ownerDeleteCampaign,
  type ApiCampaign, type MarketingSummary, type BackendUser, type ApiForm,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/store";
import { toast } from "sonner";
import { Loader2, Plus, Play, Pause, CheckCircle2, XCircle, RefreshCw, Copy, ExternalLink, Info, MessageSquare, Trash2 } from "lucide-react";
import { NGN } from "@/lib/format";

export const Route = createFileRoute("/_app/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — Glowbalmart CRM" }] }),
  component: CampaignsPage,
});

const TYPES = ["WHATSAPP", "SMS", "EMAIL", "MULTI_CHANNEL"];
const AUDIENCES = ["ALL_CUSTOMERS", "RECENT_BUYERS", "ABANDONED_CART", "VIP", "CUSTOM"];

// Normalise backend status enums into a simple 3-state display model.
function normaliseStatus(status?: string): "DRAFT" | "RUNNING" | "COMPLETED" | "PAUSED" | "CANCELLED" {
  const s = (status || "").toUpperCase();
  if (["RUNNING", "ACTIVE", "LAUNCHED", "IN_PROGRESS"].includes(s)) return "RUNNING";
  if (["COMPLETED", "COMPLETE", "FINISHED", "ENDED"].includes(s)) return "COMPLETED";
  if (["PAUSED", "ON_HOLD"].includes(s)) return "PAUSED";
  if (["CANCELLED", "CANCELED"].includes(s)) return "CANCELLED";
  return "DRAFT";
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", RUNNING: "Running", COMPLETED: "Completed", PAUSED: "Paused", CANCELLED: "Cancelled",
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  RUNNING: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  PAUSED: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

function CampaignsPage() {
  const currentUser = useCurrentUser();
  const isOwner = currentUser?.role === "admin";
  const [items, setItems] = useState<ApiCampaign[]>([]);
  const [sum, setSum] = useState<MarketingSummary | null>(null);
  const [promoters, setPromoters] = useState<BackendUser[]>([]);
  const [forms, setForms] = useState<ApiForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", campaignType: "WHATSAPP", targetAudience: "ALL_CUSTOMERS", message: "",
    promoterUserId: "", formSlug: "",
    startDate: "", endDate: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [c, s, u, f] = await Promise.all([
        listCampaigns().catch(() => [] as ApiCampaign[]),
        marketingSummary().catch(() => null),
        apiListUsers().catch(() => [] as BackendUser[]),
        listForms().catch(() => [] as ApiForm[]),
      ]);
      setItems(c); setSum(s);
      setPromoters(u.filter((x) => x.active !== false && ["MEDIA_PROMOTER","MEDIA_BUYER"].includes((x.roleName || "").toUpperCase())));
      setForms(f);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Derive KPI counts client-side from normalised status so a DRAFT campaign
  // is never counted as running, regardless of what the backend summary says.
  const kpi = useMemo(() => {
    const counts = { DRAFT: 0, RUNNING: 0, COMPLETED: 0, PAUSED: 0, CANCELLED: 0 };
    items.forEach((c) => { counts[normaliseStatus(c.status)]++; });
    return counts;
  }, [items]);

  const create = async () => {
    if (!form.name) return toast.error("Name required");
    setSaving(true);
    try {
      const selectedForm = forms.find((f) => f.slug === form.formSlug);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const landingUrl = selectedForm ? `${origin}/form/${selectedForm.slug}` : undefined;
      await createCampaign({
        name: form.name,
        campaignType: form.campaignType,
        targetAudience: form.targetAudience,
        message: form.message,
        promoterUserId: form.promoterUserId || undefined,
        landingUrl,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        active: true,
      } as any);
      toast.success("Campaign created");
      setShowNew(false);
      setForm({ name: "", campaignType: "WHATSAPP", targetAudience: "ALL_CUSTOMERS", message: "",
        promoterUserId: "", formSlug: "",
        startDate: "", endDate: "" });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const act = async (id: string, fn: (i: string) => Promise<unknown>, msg: string) => {
    try { await fn(id); toast.success(msg); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const removeCampaign = async (c: ApiCampaign) => {
    if (!confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return;
    try {
      await ownerDeleteCampaign(c.trackingCode || c.id);
      toast.success("Campaign deleted");
      setItems((prev) => prev.filter((x) => x.id !== c.id));
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const copy = async (text: string, label: string) => {
    if (!text) return toast.error("Nothing to copy");
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); }
    catch { toast.error("Copy failed"); }
  };

  const shareFor = (c: ApiCampaign) => {
    const slugFromLanding = c.landingUrl ? c.landingUrl.split("/form/")[1]?.split("?")[0] : undefined;
    return campaignShareLink(slugFromLanding, c.trackingCode, c.landingUrl);
  };

  return (
    <>
      <PageHeader title="Campaign Manager" subtitle="Plan, launch and track marketing campaigns." actions={
        <>
          <button onClick={load} className="text-sm inline-flex items-center gap-1 px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <button onClick={() => setShowNew(true)} className="text-sm inline-flex items-center gap-1 px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}>
            <Plus size={14} /> New Campaign
          </button>
        </>
      } />

      <Card className="p-3 mb-4">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <span>Campaigns are tracked through the tracking link. When a customer submits an order through the campaign link, the backend attributes the order to the campaign and promoter.</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{items.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Running</div><div className="text-2xl font-bold text-emerald-600">{kpi.RUNNING}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Draft</div><div className="text-2xl font-bold">{kpi.DRAFT}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Completed</div><div className="text-2xl font-bold">{kpi.COMPLETED}</div></Card>
      </div>

      <Card>
        {loading && items.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading campaigns…</div> :
          items.length === 0 ? <Empty title="No campaigns yet" hint="Create your first campaign to reach customers." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>{["Name","Media Buyer","Type","Status","Tracking","Reach","Clicks","Conv","Orders","Paid","Revenue","Cost","Profit","Actions"].map(h => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const link = shareFor(c);
                  const waMsg = (c.message || "") + (link ? `\n\n${link}` : "");
                  const profit = (c.estimatedProfit ?? ((c.revenueGenerated || 0) - (c.campaignCost || 0)));
                  const promoterName = c.promoterName || c.mediaPromoterName || "—";
                  const st = normaliseStatus(c.status);
                  return (
                    <tr key={c.id} className="border-t align-top">
                      <td className="px-3 py-2 font-medium min-w-[180px]">{c.name}<div className="text-xs text-muted-foreground truncate max-w-[220px]">{c.message}</div></td>
                      <td className="px-3 py-2 text-xs">{promoterName}</td>
                      <td className="px-3 py-2 text-xs">{c.campaignType || "—"}</td>
                      <td className="px-3 py-2 text-xs"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLOR[st]}`}>{STATUS_LABEL[st]}</span></td>
                      <td className="px-3 py-2 text-xs">
                        {c.trackingCode ? (
                          <div>
                            <div className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded inline-block">{c.trackingCode}</div>
                            {link && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                <button title="Copy tracking link" onClick={() => copy(link, "Tracking link")} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] hover:bg-muted"><Copy size={11} /> Copy Link</button>
                                <a title="Open/Preview tracking link" href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] hover:bg-muted"><ExternalLink size={11} /> Preview</a>
                                <button title="Copy WhatsApp message" onClick={() => copy(waMsg, "WhatsApp message")} className="p-1 rounded hover:bg-muted"><MessageSquare size={12} /></button>
                              </div>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2">{c.actualReach ?? c.expectedReach ?? 0}</td>
                      <td className="px-3 py-2">{c.clickCount ?? 0}</td>
                      <td className="px-3 py-2">{c.conversionCount ?? 0}</td>
                      <td className="px-3 py-2">{c.ordersGenerated ?? 0}</td>
                      <td className="px-3 py-2">{c.paidOrders ?? 0}</td>
                      <td className="px-3 py-2">{NGN(c.revenueGenerated ?? 0)}</td>
                      <td className="px-3 py-2 text-rose-600">{NGN(c.campaignCost ?? 0)}</td>
                      <td className={`px-3 py-2 font-semibold ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{NGN(profit)}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {st === "DRAFT" && (
                            <button title="Launch" onClick={() => act(c.id, launchCampaign, "Launched")} className="p-1.5 rounded hover:bg-muted text-emerald-600"><Play size={14} /></button>
                          )}
                          {st === "RUNNING" && (
                            <>
                              <button title="Pause" onClick={() => act(c.id, pauseCampaign, "Paused")} className="p-1.5 rounded hover:bg-muted text-amber-600"><Pause size={14} /></button>
                              <button title="Complete" onClick={() => act(c.id, completeCampaign, "Completed")} className="p-1.5 rounded hover:bg-muted"><CheckCircle2 size={14} /></button>
                            </>
                          )}
                          {st === "PAUSED" && (
                            <>
                              <button title="Resume" onClick={() => act(c.id, launchCampaign, "Resumed")} className="p-1.5 rounded hover:bg-muted text-emerald-600"><Play size={14} /></button>
                              <button title="Complete" onClick={() => act(c.id, completeCampaign, "Completed")} className="p-1.5 rounded hover:bg-muted"><CheckCircle2 size={14} /></button>
                            </>
                          )}
                          {(st === "DRAFT" || st === "RUNNING" || st === "PAUSED") && (
                            <button title="Cancel" onClick={() => act(c.id, cancelCampaign, "Cancelled")} className="p-1.5 rounded hover:bg-muted text-rose-600"><XCircle size={14} /></button>
                          )}
                          {isOwner && (
                            <button title="Delete (Owner)" onClick={() => removeCampaign(c)} className="p-1.5 rounded hover:bg-rose-50 text-rose-600"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-3 mt-3 text-xs text-muted-foreground">
        To track this campaign, share the campaign tracking link. Orders submitted through that link will be counted under this campaign and promoter. Launching only changes status to running — the promoter must share the tracking link manually.
      </Card>

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setShowNew(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-xl w-full max-w-xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="font-semibold mb-3">New Campaign</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <input className="md:col-span-2 px-3 py-2 rounded border bg-background" placeholder="Campaign name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <label className="text-xs">Type
                <select value={form.campaignType} onChange={(e) => setForm({ ...form, campaignType: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background">
                  {TYPES.map(x => <option key={x} value={x}>{x.replace("_"," ")}</option>)}
                </select>
              </label>
              <label className="text-xs">Target Audience
                <select value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background">
                  {AUDIENCES.map(x => <option key={x} value={x}>{x.replace("_"," ")}</option>)}
                </select>
              </label>
              <label className="text-xs md:col-span-2">Assign Media Buyer
                <select value={form.promoterUserId} onChange={(e) => setForm({ ...form, promoterUserId: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background">
                  <option value="">— None —</option>
                  {promoters.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
                </select>
                {promoters.length === 0 && <div className="text-[10px] text-muted-foreground mt-1">No active media buyer users. Add one under Media Buyers.</div>}
              </label>
              <label className="text-xs md:col-span-2">Sales Form / Landing Page
                <select value={form.formSlug} onChange={(e) => setForm({ ...form, formSlug: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background">
                  <option value="">— No landing page —</option>
                  {forms.map((f) => <option key={f.id} value={f.slug}>{f.name} (/form/{f.slug})</option>)}
                </select>
              </label>
              <label className="text-xs">Start Date<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background" /></label>
              <label className="text-xs">End Date<input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background" /></label>
              <textarea placeholder="Message body" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="md:col-span-2 w-full px-3 py-2 rounded border bg-background" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} disabled={saving} className="text-sm px-3 py-2 rounded border">Cancel</button>
              <button onClick={create} disabled={saving} className="text-sm px-4 py-2 rounded text-white inline-flex items-center gap-1 disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
