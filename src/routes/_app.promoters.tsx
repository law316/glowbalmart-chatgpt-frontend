import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { AccessDenied } from "@/components/AccessDenied";
import { useCurrentUser } from "@/lib/store";
import {
  apiListUsers, apiSignup, campaignsForPromoter, listCampaigns, updateCampaign,
  campaignShareLink,
  type BackendUser, type ApiCampaign,
} from "@/lib/api";
import { Loader2, Plus, RefreshCw, Megaphone, Copy, ExternalLink, MessageSquare, Info, Eye, Link as LinkIcon, X } from "lucide-react";
import { NGN } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/promoters")({
  head: () => ({ meta: [{ title: "Media Buyers — Glowbalmart CRM" }] }),
  component: MediaPromotersPage,
});

interface PromoterStats {
  campaigns: number; running: number;
  reach: number; clicks: number; conversions: number;
  orders: number; paidOrders: number;
  revenue: number; cost: number; profit: number;
}

const EMPTY_STATS: PromoterStats = { campaigns: 0, running: 0, reach: 0, clicks: 0, conversions: 0, orders: 0, paidOrders: 0, revenue: 0, cost: 0, profit: 0 };

function MediaPromotersPage() {
  const current = useCurrentUser();
  const canManage = current?.role === "admin" || current?.role === "manager";

  const [promoters, setPromoters] = useState<BackendUser[]>([]);
  const [stats, setStats] = useState<Record<string, PromoterStats>>({});
  const [campaignsByPromoter, setCampaignsByPromoter] = useState<Record<string, ApiCampaign[]>>({});
  const [allCampaigns, setAllCampaigns] = useState<ApiCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });

  const [viewPromoter, setViewPromoter] = useState<BackendUser | null>(null);
  const [assignPromoter, setAssignPromoter] = useState<BackendUser | null>(null);
  const [assignId, setAssignId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [users, all] = await Promise.all([
        apiListUsers(),
        listCampaigns().catch(() => [] as ApiCampaign[]),
      ]);
      const proms = users.filter((u) => ["MEDIA_PROMOTER","MEDIA_BUYER"].includes((u.roleName || "").toUpperCase()));
      setPromoters(proms);
      setAllCampaigns(all);
      const results = await Promise.all(proms.map((p) =>
        campaignsForPromoter(p.id).then((cs) => [p.id, cs] as [string, ApiCampaign[]]).catch(() => [p.id, [] as ApiCampaign[]] as [string, ApiCampaign[]])
      ));
      const cmap: Record<string, ApiCampaign[]> = {};
      const smap: Record<string, PromoterStats> = {};
      for (const [id, cs] of results) {
        cmap[id] = cs;
        smap[id] = cs.reduce((acc, c) => ({
          campaigns: acc.campaigns + 1,
          running: acc.running + ((c.status || "").toLowerCase() === "running" ? 1 : 0),
          reach: acc.reach + (c.actualReach || 0),
          clicks: acc.clicks + (c.clickCount || 0),
          conversions: acc.conversions + (c.conversionCount || 0),
          orders: acc.orders + (c.ordersGenerated || 0),
          paidOrders: acc.paidOrders + (c.paidOrders || 0),
          revenue: acc.revenue + (c.revenueGenerated || 0),
          cost: acc.cost + (c.campaignCost || 0),
          profit: acc.profit + (c.estimatedProfit ?? ((c.revenueGenerated || 0) - (c.campaignCost || 0))),
        }), { ...EMPTY_STATS });
      }
      setCampaignsByPromoter(cmap);
      setStats(smap);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load promoters"); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (canManage) load(); }, [canManage]);

  const save = async () => {
    if (!form.name || !form.email || !form.password) { toast.error("Name, email and password required"); return; }
    setSaving(true);
    try {
      await apiSignup("", { name: form.name, email: form.email, password: form.password, phone: form.phone || undefined, roleName: "MEDIA_PROMOTER" });
      toast.success("Media buyer created");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", password: "" });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to create"); }
    finally { setSaving(false); }
  };

  const copy = async (text: string, label: string) => {
    if (!text) return toast.error("Nothing to copy");
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); }
    catch { toast.error("Copy failed"); }
  };

  const shareFor = (c: ApiCampaign) => {
    const slug = c.landingUrl ? c.landingUrl.split("/form/")[1]?.split("?")[0] : undefined;
    return campaignShareLink(slug, c.trackingCode, c.landingUrl);
  };

  const doAssign = async () => {
    if (!assignPromoter || !assignId) return;
    try {
      await updateCampaign(assignId, { promoterUserId: assignPromoter.id } as any);
      toast.success("Campaign assigned");
      setAssignPromoter(null); setAssignId("");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Assign failed"); }
  };

  if (!canManage) return <AccessDenied allowed={["admin","manager"]} role={current?.role ?? "staff"} />;

  const unassignedOrOther = (pid: string) => allCampaigns.filter((c) => (c.promoterUserId || c.mediaPromoterUserId) !== pid);

  return (
    <>
      <PageHeader
        title="Media Buyers"
        subtitle="Media buyers running paid campaigns."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
            </button>
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}>
              <Plus size={14} /> Add Media Buyer
            </button>
          </div>
        }
      />

      <Card className="p-3 mb-4">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <span>Campaigns are tracked through the tracking link. When a customer submits an order through the campaign link, the backend attributes the order to the campaign and promoter.</span>
        </div>
      </Card>

      <Card>
        {loading && promoters.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : promoters.length === 0 ? (
          <Empty title="No media buyers yet" hint="Add a MEDIA_BUYER user to start tracking campaigns." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>{["Name","Email","Phone","Status","Assigned","Running","Orders","Paid","Conv.","Revenue","Cost","Profit","Actions"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {promoters.map((p) => {
                  const s = stats[p.id] || EMPTY_STATS;
                  return (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-xs">{p.email}</td>
                      <td className="px-3 py-2 text-xs">{p.phone || "—"}</td>
                      <td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{p.active ? "Active" : "Inactive"}</span></td>
                      <td className="px-3 py-2">{s.campaigns}</td>
                      <td className="px-3 py-2">{s.running}</td>
                      <td className="px-3 py-2">{s.orders}</td>
                      <td className="px-3 py-2">{s.paidOrders}</td>
                      <td className="px-3 py-2">{s.conversions.toLocaleString()}</td>
                      <td className="px-3 py-2">{NGN(s.revenue)}</td>
                      <td className="px-3 py-2 text-rose-600">{NGN(s.cost)}</td>
                      <td className={`px-3 py-2 font-semibold ${s.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{NGN(s.profit)}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button title="View campaigns" onClick={() => setViewPromoter(p)} className="p-1.5 rounded hover:bg-muted"><Eye size={14} /></button>
                          <button title="Assign campaign" onClick={() => { setAssignPromoter(p); setAssignId(""); }} className="p-1.5 rounded hover:bg-muted"><LinkIcon size={14} /></button>
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

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-1 flex items-center gap-2"><Megaphone size={16} /> Add Media Buyer</div>
            <div className="text-xs text-muted-foreground mb-3">Creates a backend user with role Media Buyer.</div>
            <div className="space-y-2">
              <input className="w-full px-3 py-2 rounded border bg-background" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="w-full px-3 py-2 rounded border bg-background" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="w-full px-3 py-2 rounded border bg-background" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="w-full px-3 py-2 rounded border bg-background" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={saving} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}

      {viewPromoter && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewPromoter(null)}>
          <div className="bg-card w-full max-w-2xl rounded-xl p-5 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold">Campaigns · {viewPromoter.name}</div>
                <div className="text-xs text-muted-foreground">{viewPromoter.email}</div>
              </div>
              <button onClick={() => setViewPromoter(null)}><X size={16} /></button>
            </div>
            {(campaignsByPromoter[viewPromoter.id] || []).length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No campaigns assigned yet.</div>
            ) : (
              <div className="space-y-2">
                {(campaignsByPromoter[viewPromoter.id] || []).map((c) => {
                  const link = shareFor(c);
                  const waMsg = (c.message || "") + (link ? `\n\n${link}` : "");
                  return (
                    <div key={c.id} className="border rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{c.name}</div>
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-muted">{c.status || "—"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{c.message}</div>
                      {c.trackingCode && (
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{c.trackingCode}</span>
                          <button onClick={() => copy(link, "Tracking link")} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-muted"><Copy size={12} /> Link</button>
                          <button onClick={() => copy(waMsg, "WhatsApp message")} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-muted"><MessageSquare size={12} /> WhatsApp</button>
                          {link && <a href={link} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-muted"><ExternalLink size={12} /> Open</a>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {assignPromoter && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAssignPromoter(null)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-3">Assign Campaign · {assignPromoter.name}</div>
            <select value={assignId} onChange={(e) => setAssignId(e.target.value)} className="w-full px-3 py-2 rounded border bg-background text-sm">
              <option value="">— Select existing campaign —</option>
              {unassignedOrOther(assignPromoter.id).map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.promoterName ? `(current: ${c.promoterName})` : ""}</option>
              ))}
            </select>
            <div className="text-xs text-muted-foreground mt-2">To create a new campaign for this promoter, use Campaign Manager and pick this promoter in the form.</div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAssignPromoter(null)} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={doAssign} disabled={!assignId} className="px-3 py-2 rounded text-white text-sm disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>Assign</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
