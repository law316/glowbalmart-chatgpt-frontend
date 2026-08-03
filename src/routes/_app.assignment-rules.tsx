import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import {
  apiListUsers, listOrders, activityLogs,
  prettyRole, type BackendUser, type ApiOrder, type ActivityLog,
} from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Activity, Info, Loader2, RefreshCw, Scale } from "lucide-react";

export const Route = createFileRoute("/_app/assignment-rules")({
  head: () => ({ meta: [{ title: "Assignment Rules — Glowbalmart CRM" }] }),
  component: AssignmentRulesPage,
});

const CLOSED = new Set(["delivered", "cancelled", "rejected", "closed", "returned"]);

function isOpen(o: ApiOrder) {
  const s = (o.status || "").toLowerCase();
  const ds = (o.deliveryStatus || "").toLowerCase();
  if (o.stockDeducted) return false;
  return !CLOSED.has(s) && !CLOSED.has(ds);
}

function isDelivered(o: ApiOrder) {
  const s = (o.status || "").toLowerCase();
  const ds = (o.deliveryStatus || "").toLowerCase();
  return s === "delivered" || ds === "delivered" || !!o.stockDeducted;
}

function AssignmentRulesPage() {
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [u, o, l] = await Promise.all([
        apiListUsers(),
        listOrders(),
        activityLogs().catch(() => [] as ActivityLog[]),
      ]);
      setUsers(u); setOrders(o); setLogs(l);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const staff = useMemo(() =>
    users.filter((u) => u.active !== false && ["SALES_REP", "CUSTOMER_CARE"].includes((u.roleName || "").toUpperCase())),
    [users]
  );

  const rows = useMemo(() => staff.map((u) => {
    const assigned = orders.filter((o) => o.assignedTo === u.id || o.assignedCustomerCareId === u.id);
    const active = assigned.filter(isOpen).length;
    const delivered = assigned.filter(isDelivered).length;
    return { id: u.id, name: u.name, role: prettyRole(u.roleName), active, delivered };
  }).sort((a, b) => a.active - b.active), [staff, orders]);

  const assignmentLogs = useMemo(() =>
    logs.filter((l) => {
      const t = (l.activityType || "").toLowerCase();
      return t.includes("assign") || t.includes("claim");
    }).slice(0, 100),
    [logs]
  );

  return (
    <>
      <PageHeader title="Staff Assignment Rules" subtitle="How incoming orders are routed to your Sales Rep team."
        actions={
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
        }
      />

      <Card className="p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg" style={{ background: "color-mix(in oklab, var(--electric) 15%, transparent)" }}>
            <Scale size={18} />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Current backend assignment: Least-open active orders</div>
            <div className="text-sm text-muted-foreground mt-1">
              New public form orders are assigned to the active Sales Rep with the fewest open orders.
            </div>
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <Info size={14} className="mt-0.5" />
              <span>Assignment settings backend endpoint is not connected yet. This view is read-only.</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="p-4 border-b font-semibold">Current Workload</div>
        {loading && rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : rows.length === 0 ? (
          <Empty title="No active Sales Reps yet" hint="Add users with role SALES_REP or CUSTOMER_CARE." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>
                {["Staff", "Role", "Active Orders", "Delivered Orders", "Capacity", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const max = Math.max(1, ...rows.map((x) => x.active), 10);
                  const pct = Math.min(100, Math.round((r.active / max) * 100));
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 capitalize text-xs">{r.role}</td>
                      <td className="px-3 py-2">{r.active}</td>
                      <td className="px-3 py-2">{r.delivered}</td>
                      <td className="px-3 py-2">
                        <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--electric)" }} />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">Available</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="p-4 border-b font-semibold flex items-center gap-2"><Activity size={16} /> Assignment Activity Log</div>
        {assignmentLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No assignments logged yet.</div>
        ) : (
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {assignmentLogs.map((e) => (
              <div key={e.id} className="p-3 text-sm flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <div className="flex-1">
                  <div>{e.title || e.message || e.activityType}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {e.actorName ? `${e.actorName} · ` : ""}{e.createdAt ? fmtDateTime(e.createdAt) : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
