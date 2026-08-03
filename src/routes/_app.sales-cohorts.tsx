import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { AccessDenied } from "@/components/AccessDenied";
import { useCurrentUser } from "@/lib/store";
import {
  listCohorts, createCohort, addCohortMember, addCohortMembersBulk, removeCohortMember, cohortPerformance,
  apiListUsers, prettyRole, roleLabel, ownerDeleteCohort,
  type Cohort, type CohortPerformance, type BackendUser, type CommissionType,
} from "@/lib/api";
import { Loader2, Plus, RefreshCw, UsersRound, X, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { NGN } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sales-cohorts")({
  head: () => ({ meta: [{ title: "Sales Cohorts — Glowbalmart CRM" }] }),
  component: SalesCohortsPage,
});

const COMMISSION_TYPES: CommissionType[] = ["FIXED", "PER_DELIVERY", "PERCENT_OF_REVENUE", "NONE"];
const COMMISSION_LABELS: Record<CommissionType, string> = {
  FIXED: "Fixed Amount",
  PER_DELIVERY: "Per Delivery",
  PERCENT_OF_REVENUE: "Percentage",
  NONE: "None",
};
const MEMBER_ROLES = ["SALES_REP", "CUSTOMER_CARE", "ACCOUNTANT", "INVENTORY_MANAGER", "MEDIA_PROMOTER", "DELIVERY_AGENT", "MANAGER"];

function SalesCohortsPage() {
  const current = useCurrentUser();
  const canManage = current?.role === "admin" || current?.role === "manager";
  const isOwner = current?.role === "admin";

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [perf, setPerf] = useState<CohortPerformance | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [staffForbidden, setStaffForbidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "",
    targetPercent: 60,
    targetStartAt: "", targetEndAt: "",
    targetDeliveries: 0, targetFollowUps: 0, targetRevenue: 0,
    commissionType: "PER_DELIVERY" as CommissionType, commissionValue: 100000,
    active: true,
    memberIds: [] as string[],
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = async () => {
    setLoading(true); setStaffForbidden(false);
    try {
      const [c, u] = await Promise.all([
        listCohorts(true),
        apiListUsers().catch(() => [] as BackendUser[]),
      ]);
      setCohorts(c);
      setUsers(u.filter((x) => x.active !== false && MEMBER_ROLES.includes((x.roleName || "").toUpperCase())));
    } catch (e: any) {
      if (e?.status === 403) setStaffForbidden(true);
      else toast.error(e instanceof Error ? e.message : "Failed to load cohorts");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) { setPerf(null); return; }
    setPerfLoading(true);
    cohortPerformance(selectedId)
      .then(setPerf)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load performance"))
      .finally(() => setPerfLoading(false));
  }, [selectedId]);

  const save = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const created = await createCohort({
        name: form.name,
        description: form.description || undefined,
        targetPercent: Number(form.targetPercent) || 0,
        targetStartAt: form.targetStartAt ? new Date(form.targetStartAt).toISOString() : undefined,
        targetEndAt: form.targetEndAt ? new Date(form.targetEndAt).toISOString() : undefined,
        targetDeliveries: Number(form.targetDeliveries) || 0,
        targetFollowUps: Number(form.targetFollowUps) || 0,
        targetRevenue: Number(form.targetRevenue) || 0,
        commissionType: form.commissionType,
        commissionValue: Number(form.commissionValue) || 0,
        active: form.active,
      } as any);
      const newId = created?.cohort?.id || created?.id;
      if (newId && form.memberIds.length > 0) {
        await addCohortMembersBulk(newId, form.memberIds).catch(() => {});
      }
      toast.success("Cohort created");
      setOpen(false);
      setForm({ ...form, name: "", description: "", memberIds: [] });
      await load();
      if (newId) setSelectedId(newId);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to create cohort"); }
    finally { setSaving(false); }
  };

  const addMember = async (userId: string) => {
    if (!selectedId) return;
    try {
      await addCohortMember(selectedId, userId);
      toast.success("Member added");
      const p = await cohortPerformance(selectedId); setPerf(p);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add member"); }
  };
  const removeMember = async (userId: string) => {
    if (!selectedId) return;
    try {
      await removeCohortMember(selectedId, userId);
      toast.success("Member removed");
      const p = await cohortPerformance(selectedId); setPerf(p);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to remove member"); }
  };

  const removeCohort = async (c: Cohort) => {
    if (!confirm(`Delete cohort "${c.name}"? This cannot be undone.`)) return;
    try {
      await ownerDeleteCohort(c.id);
      toast.success("Cohort deleted");
      setCohorts((prev) => prev.filter((x) => x.id !== c.id));
      if (selectedId === c.id) { setSelectedId(""); setPerf(null); }
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const selectedCohort = cohorts.find((c) => c.id === selectedId);
  const memberList = useMemo(() => perf?.memberPerformances || perf?.members || selectedCohort?.members || [], [perf, selectedCohort]);
  const memberIds = new Set(memberList.map((m) => m.userId));
  const assignedElsewhere = useMemo(() => {
    const s = new Set<string>();
    for (const c of cohorts) {
      if (c.active === false) continue;
      if (c.id === selectedId) continue;
      for (const m of (c.members || [])) s.add(m.userId);
    }
    return s;
  }, [cohorts, selectedId]);
  const assignedAnywhereActive = useMemo(() => {
    const s = new Set<string>();
    for (const c of cohorts) {
      if (c.active === false) continue;
      for (const m of (c.members || [])) s.add(m.userId);
    }
    return s;
  }, [cohorts]);
  const nonMembers = users.filter((u) => !memberIds.has(u.id) && !assignedElsewhere.has(u.id));

  const isUuid = (v?: string) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const memberDisplay = (m: any) => {
    const user = users.find((u) => u.id === m.userId);
    const name = (m.name && !isUuid(m.name)) ? m.name : user?.name;
    return { name: name || "Unknown staff", email: user?.email || m.email || "" };
  };

  if (staffForbidden && !canManage) {
    return (
      <>
        <PageHeader title="Sales Cohorts" subtitle="Group staff into cohorts and track team targets." />
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Cohort viewing for staff is not enabled in backend yet.
        </Card>
      </>
    );
  }

  if (!canManage) return <AccessDenied allowed={["admin","manager"]} role={current?.role ?? "staff"} />;

  return (
    <>
      <PageHeader
        title="Sales Cohorts"
        subtitle="Group staff into cohorts, track deliveries / follow-ups / revenue and commissions."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
            </button>
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}>
              <Plus size={14} /> Create Cohort
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 p-3">
          <div className="font-semibold mb-2 flex items-center gap-2"><UsersRound size={16} /> Cohorts</div>
          {loading ? <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
            : cohorts.length === 0 ? <Empty title="No cohorts yet" hint="Create your first cohort." />
            : (
              <ul className="space-y-1">
                {cohorts.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setSelectedId(c.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedId === c.id ? "bg-muted font-medium" : "hover:bg-muted/50"}`}>
                      <div className="flex items-center justify-between">
                        <span>{c.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {c.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {c.description && <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </Card>

        <Card className="lg:col-span-2 p-4">
          {!selectedId ? <Empty title="Select a cohort" hint="Pick a cohort to see its performance and members." />
            : perfLoading ? <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading performance…</div>
            : !perf ? <Empty title="No performance data" />
            : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-lg">{selectedCohort?.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedCohort?.description}</div>
                  </div>
                  {perf.allTargetsMet ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 size={12} /> Cohort target met
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                      <Clock size={12} /> Target in progress
                    </span>
                  )}
                  {isOwner && selectedCohort && (
                    <button onClick={() => removeCohort(selectedCohort)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50">
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>

                {(() => {
                  const p: any = perf;
                  const assignedLeads = p.assignedLeads ?? p.totalLeads ?? memberList.length;
                  const deliveredLeads = p.deliveredLeads ?? p.actualDeliveries ?? 0;
                  const pendingLeads = p.pendingLeads ?? Math.max(0, assignedLeads - deliveredLeads);
                  const targetPercent = p.targetPercent ?? selectedCohort?.targetPercent ?? 0;
                  const achievementPercent = p.achievementPercent ?? (targetPercent ? Math.round((deliveredLeads / Math.max(1, assignedLeads)) * 100) : 0);
                  const commissionValue = p.commissionValue ?? selectedCohort?.commissionValue ?? 0;
                  const commissionEarned = p.commissionEarned ?? 0;
                  const targetMet = p.targetMet ?? p.allTargetsMet ?? (targetPercent > 0 && achievementPercent >= targetPercent);
                  return (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <Card className="p-3">
                          <div className="text-xs text-muted-foreground">Assigned Leads</div>
                          <div className="text-lg font-bold">{assignedLeads}</div>
                        </Card>
                        <Card className="p-3">
                          <div className="text-xs text-muted-foreground">Delivered Leads</div>
                          <div className="text-lg font-bold">{deliveredLeads}</div>
                        </Card>
                        <Card className="p-3">
                          <div className="text-xs text-muted-foreground">Pending Leads</div>
                          <div className="text-lg font-bold">{pendingLeads}</div>
                        </Card>
                        <Card className="p-3">
                          <div className="text-xs text-muted-foreground flex items-center justify-between">
                            <span>Achievement</span>
                            {targetMet && <CheckCircle2 size={12} className="text-emerald-600" />}
                          </div>
                          <div className="text-lg font-bold">{achievementPercent}%</div>
                          <div className="text-[11px] text-muted-foreground">Target: {targetPercent}%</div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full" style={{ width: `${Math.min(100, achievementPercent)}%`, background: targetMet ? "#10b981" : "var(--gradient-electric)" }} />
                          </div>
                        </Card>
                        <Card className="p-3">
                          <div className="text-xs text-muted-foreground">Commission Value</div>
                          <div className="text-lg font-bold">{NGN(commissionValue)}</div>
                        </Card>
                        <Card className="p-3">
                          <div className="text-xs text-muted-foreground">Commission Earned</div>
                          <div className="text-lg font-bold text-emerald-600">{NGN(commissionEarned)}</div>
                        </Card>
                        <Card className="p-3">
                          <div className="text-xs text-muted-foreground">Target Status</div>
                          <div className={`mt-1 text-xs px-2 py-0.5 rounded-full inline-block ${targetMet ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {targetMet ? "Target met" : "In progress"}
                          </div>
                        </Card>
                      </div>
                      {targetMet && (
                        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
                          <CheckCircle2 size={16} /> Congratulations! This cohort has reached its target.
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="mt-5">
                  <div className="font-semibold mb-2 text-sm">Member Performance</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left">
                        <tr>{["Staff", "Role", "Assigned Leads", "Delivered Leads", "Pending Leads", "Conversion Rate", "Follow-ups", "Revenue", ""].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {memberList.length === 0 ? (
                          <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">No members yet.</td></tr>
                        ) : memberList.map((m: any) => {
                          const disp = memberDisplay(m);
                          const mAssigned = m.assignedLeads ?? m.totalLeads ?? 0;
                          const mDelivered = m.deliveredLeads ?? m.deliveredOrders ?? m.deliveries ?? 0;
                          const mPending = m.pendingLeads ?? Math.max(0, mAssigned - mDelivered);
                          const conversion = m.conversionRate ?? (mAssigned > 0 ? Math.round((mDelivered / mAssigned) * 100) : 0);
                          return (
                          <tr key={m.userId} className="border-t">
                            <td className="px-3 py-2 font-medium">
                              <div>{disp.name}</div>
                              {disp.email && <div className="text-[11px] text-muted-foreground font-normal">{disp.email}</div>}
                            </td>
                            <td className="px-3 py-2 text-xs">{roleLabel(m.roleName)}</td>
                            <td className="px-3 py-2">{mAssigned}</td>
                            <td className="px-3 py-2">{mDelivered}</td>
                            <td className="px-3 py-2">{mPending}</td>
                            <td className="px-3 py-2">{conversion}%</td>
                            <td className="px-3 py-2">{m.actualFollowUps ?? m.followUps ?? 0}</td>
                            <td className="px-3 py-2">{NGN(m.actualRevenue ?? m.revenue ?? 0)}</td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => removeMember(m.userId)} className="text-rose-600"><X size={14} /></button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {nonMembers.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <select id="add-mem" className="flex-1 px-3 py-2 rounded border bg-background text-sm">
                        <option value="">Add member…</option>
                        {nonMembers.map((u) => (
                          <option key={u.id} value={u.id}>{u.name} ({prettyRole(u.roleName)})</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const el = document.getElementById("add-mem") as HTMLSelectElement | null;
                          if (el && el.value) { addMember(el.value); el.value = ""; }
                        }}
                        className="px-3 py-2 rounded text-white text-sm" style={{ background: "var(--gradient-electric)" }}
                      >Add</button>
                    </div>
                  )}
                </div>
              </>
            )}
        </Card>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-card w-full max-w-lg rounded-xl p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-3">Create Cohort</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input className="md:col-span-2 px-3 py-2 rounded border bg-background" placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <textarea className="md:col-span-2 px-3 py-2 rounded border bg-background" placeholder="Description / slogan (optional)" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <label className="text-xs">Target %<input type="number" min={0} max={100} className="w-full mt-1 px-2 py-2 rounded border bg-background" value={form.targetPercent} onChange={(e) => setForm({ ...form, targetPercent: +e.target.value })} /></label>
              <label className="text-xs">Commission Value<input type="number" className="w-full mt-1 px-2 py-2 rounded border bg-background" value={form.commissionValue} onChange={(e) => setForm({ ...form, commissionValue: +e.target.value })} /></label>

              <div className="md:col-span-2">
                <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-xs text-muted-foreground underline">
                  {showAdvanced ? "Hide" : "Show"} Advanced (legacy)
                </button>
              </div>
              {showAdvanced && (
                <>
                  <label className="text-xs">Target Deliveries<input type="number" className="w-full mt-1 px-2 py-2 rounded border bg-background" value={form.targetDeliveries} onChange={(e) => setForm({ ...form, targetDeliveries: +e.target.value })} /></label>
                  <label className="text-xs">Target Follow-ups<input type="number" className="w-full mt-1 px-2 py-2 rounded border bg-background" value={form.targetFollowUps} onChange={(e) => setForm({ ...form, targetFollowUps: +e.target.value })} /></label>
                  <label className="text-xs md:col-span-2">Target Revenue<input type="number" className="w-full mt-1 px-2 py-2 rounded border bg-background" value={form.targetRevenue} onChange={(e) => setForm({ ...form, targetRevenue: +e.target.value })} /></label>
                  <label className="text-xs">Commission Type
                    <select className="w-full mt-1 px-2 py-2 rounded border bg-background" value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value as CommissionType })}>
                      {COMMISSION_TYPES.map((t) => <option key={t} value={t}>{COMMISSION_LABELS[t]}</option>)}
                    </select>
                  </label>
                </>
              )}

              <div className="md:col-span-2">
                <div className="text-xs mb-1">Add members to cohort</div>
                <div className="border rounded max-h-40 overflow-y-auto divide-y bg-background">
                  {(() => {
                    const eligible = users.filter((u) => !assignedAnywhereActive.has(u.id));
                    if (eligible.length === 0) return <div className="p-2 text-xs text-muted-foreground">All active staff are already assigned to a cohort. Only staff not in any active cohort can be added here.</div>;
                    return eligible.map((u) => {
                      const checked = form.memberIds.includes(u.id);
                      return (
                        <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            setForm((f) => ({ ...f, memberIds: e.target.checked ? [...f.memberIds, u.id] : f.memberIds.filter((x) => x !== u.id) }));
                          }} />
                          <span className="flex-1">{u.name}</span>
                          <span className="text-[10px] text-muted-foreground">{prettyRole(u.roleName)}</span>
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>

              <label className="md:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
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
    </>
  );
}

function Stat({ label, actual, target, money, met }: { label: string; actual: number; target: number; money?: boolean; met?: boolean }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  const fmt = (v: number) => money ? NGN(v) : v.toLocaleString();
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground flex items-center justify-between">
        <span>{label}</span>
        {met && <CheckCircle2 size={12} className="text-emerald-600" />}
      </div>
      <div className="text-lg font-bold">{fmt(actual)}</div>
      <div className="text-[11px] text-muted-foreground">Target: {fmt(target)}</div>
      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: met ? "#10b981" : "var(--gradient-electric)" }} />
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{pct}%</div>
    </Card>
  );
}
