import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, KpiCard, ExportButton, Empty } from "@/components/ModulePage";
import { NGN } from "@/lib/format";
import {
  listOrders, apiListUsers, listCohorts, prettyRole,
  type ApiOrder, type BackendUser, type Cohort,
} from "@/lib/api";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/staff-performance")({
  head: () => ({ meta: [{ title: "Staff Performance — Glowbalmart CRM" }] }),
  component: PerfPage,
});

const ROLES = [
  "OWNER", "MANAGER", "SALES_REP", "CUSTOMER_CARE",
  "ACCOUNTANT", "INVENTORY_MANAGER", "MEDIA_PROMOTER", "DELIVERY_AGENT",
] as const;

function isDelivered(o: ApiOrder): boolean {
  const s = (o.status || "").toLowerCase();
  const ds = (o.deliveryStatus || "").toLowerCase();
  return s === "delivered" || ds === "delivered" || o.stockDeducted === true;
}

function PerfPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [o, u, c] = await Promise.all([
        listOrders(),
        apiListUsers(),
        listCohorts(true).catch(() => [] as Cohort[]),
      ]);
      setOrders(o); setUsers(u); setCohorts(c);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const userCohort = useMemo(() => {
    const map = new Map<string, Cohort>();
    cohorts.forEach((c) => (c.members || []).forEach((m) => { if (!map.has(m.userId)) map.set(m.userId, c); }));
    return map;
  }, [cohorts]);

  const rows = useMemo(() => {
    const active = users.filter((u) => u.active !== false && ROLES.includes((u.roleName || "").toUpperCase() as any));
    return active.map((u) => {
      const assigned = orders.filter((o) => o.assignedTo === u.id || o.assignedCustomerCareId === u.id);
      const delivered = assigned.filter(isDelivered);
      const revenue = delivered.reduce((s, o) => s + (o.price || 0), 0);
      const followUps = assigned.filter((o) => (o.callAttempts || 0) > 0 || o.lastCallOutcome).length;
      const rate = assigned.length ? Math.round((delivered.length / assigned.length) * 100) : 0;
      const cohort = userCohort.get(u.id);
      let targetStatus: "met" | "progress" | "none" = "none";
      if (cohort) {
        const tgt = cohort.targetDeliveries || 0;
        targetStatus = tgt > 0 && delivered.length >= tgt ? "met" : "progress";
      }
      return {
        id: u.id, name: u.name,
        roleName: (u.roleName || "").toUpperCase(),
        role: prettyRole(u.roleName),
        assigned: assigned.length, delivered: delivered.length,
        followUps, rate, revenue,
        cohortName: cohort?.name || "",
        targetStatus,
      };
    });
  }, [orders, users, userCohort]);

  const totals = rows.reduce((a, r) => ({
    assigned: a.assigned + r.assigned,
    delivered: a.delivered + r.delivered,
    revenue: a.revenue + r.revenue,
  }), { assigned: 0, delivered: 0, revenue: 0 });
  const conv = totals.assigned ? Math.round((totals.delivered / totals.assigned) * 100) : 0;

  const grouped = useMemo(() => {
    const g: Record<string, typeof rows> = {};
    for (const r of rows) (g[r.roleName] ||= []).push(r);
    return g;
  }, [rows]);

  const targetLabel = (s: "met" | "progress" | "none") =>
    s === "met" ? "Target met" : s === "progress" ? "In progress" : "No cohort";
  const targetClass = (s: "met" | "progress" | "none") =>
    s === "met" ? "bg-emerald-100 text-emerald-700" :
    s === "progress" ? "bg-amber-100 text-amber-700" :
    "bg-slate-200 text-slate-600";

  return (
    <>
      <PageHeader title="Staff Performance" subtitle="Real backend orders, users and cohorts." actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <ExportButton filename="staff-performance.csv" rows={rows.map(r => ({ Name: r.name, Role: r.role, Assigned: r.assigned, Delivered: r.delivered, FollowUps: r.followUps, "Conv %": r.rate, Revenue: r.revenue, Cohort: r.cohortName, Target: targetLabel(r.targetStatus) }))} />
        </div>
      } />

      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Assigned Orders" value={totals.assigned} />
        <KpiCard label="Delivered" value={totals.delivered} />
        <KpiCard label="Conversion" value={`${conv}%`} accent="var(--electric)" />
        <KpiCard label="Revenue" value={NGN(totals.revenue)} />
      </div>

      {loading && rows.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><Empty title="No active staff yet" hint="Create staff in Staff Management." /></Card>
      ) : (
        ROLES.filter((r) => grouped[r]?.length).map((role) => (
          <Card key={role} className="mb-4">
            <div className="px-4 py-3 border-b font-semibold text-sm flex items-center justify-between">
              <span>{prettyRole(role)}</span>
              <span className="text-xs text-muted-foreground">{grouped[role].length} staff</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>{["Staff","Assigned","Delivered","Follow-ups","Conv. %","Revenue","Cohort","Target"].map(h => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {grouped[role].map((r) => {
                    const financeRole = role === "ACCOUNTANT";
                    const invRole = role === "INVENTORY_MANAGER";
                    const showZeroNote = (financeRole || invRole) && r.assigned === 0;
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2">{r.assigned}</td>
                        <td className="px-3 py-2">{r.delivered}</td>
                        <td className="px-3 py-2">{r.followUps}</td>
                        <td className="px-3 py-2">{r.rate}%</td>
                        <td className="px-3 py-2">{NGN(r.revenue)}</td>
                        <td className="px-3 py-2 text-xs">{r.cohortName || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${targetClass(r.targetStatus)}`}>
                            {targetLabel(r.targetStatus)}
                          </span>
                          {showZeroNote && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {financeRole ? "No finance activity yet." : "No stock activity yet."}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </>
  );
}
