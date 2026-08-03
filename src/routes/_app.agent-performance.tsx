import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, KpiCard, Empty } from "@/components/ModulePage";
import {
  listDeliveryAgents, deliveryAgentsSummary, deliveryAgentStockAll, listDeliveryAgentAssignments,
  type DeliveryAgent, type DeliveryAgentSummary, type DeliveryAgentStockRow, type DeliveryAgentAssignment,
} from "@/lib/api";
import { Loader2, RefreshCw, Truck, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/agent-performance")({
  head: () => ({ meta: [{ title: "Delivery Agent Performance — Glowbalmart CRM" }] }),
  component: DeliveryAgentPerfPage,
});

type SortKey = "name" | "assignments";
type SortDir = "asc" | "desc";

function DeliveryAgentPerfPage() {
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [summary, setSummary] = useState<DeliveryAgentSummary | null>(null);
  const [stock, setStock] = useState<DeliveryAgentStockRow[]>([]);
  const [assignments, setAssignments] = useState<DeliveryAgentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("assignments");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    setLoading(true);
    try {
      const [a, s, st, asg] = await Promise.all([
        listDeliveryAgents(),
        deliveryAgentsSummary().catch(() => null),
        deliveryAgentStockAll().catch(() => []),
        listDeliveryAgentAssignments().catch(() => []),
      ]);
      setAgents(a); setSummary(s); setStock(st); setAssignments(asg);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => agents.map((a) => {
    const s = stock.filter((r) => r.deliveryAgentId === a.id);
    const remaining = s.reduce((t, r) => t + (r.quantityRemaining || 0), 0);
    const allocated = s.reduce((t, r) => t + (r.quantityAllocated || 0), 0);
    const lowRows = s.filter((r) => r.lowStock || (r.quantityRemaining ?? 0) <= (r.lowStockThreshold ?? 0)).length;
    const asg = assignments.filter((x) => x.deliveryAgentId === a.id);
    return {
      id: a.id, name: a.agentName, code: a.agentCode, state: a.state,
      status: a.status || (a.active ? "ACTIVE" : "INACTIVE"),
      products: s.length, allocated, remaining, delivered: Math.max(0, allocated - remaining),
      lowRows, assignments: asg.length,
    };
  }), [agents, stock, assignments]);

  const sortedRows = useMemo(() => {
    const sign = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((x, y) => {
      if (sortKey === "name") return (x.name || "").localeCompare(y.name || "") * sign;
      return (x.assignments - y.assignments) * sign;
    });
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalAgents = summary?.totalAgents ?? agents.length;
  const activeAgents = summary?.activeAgents ?? agents.filter((a) => (a.status || "").toUpperCase() === "ACTIVE" || a.active).length;
  const agentsWithStock = summary?.agentsWithStock ?? rows.filter((r) => r.remaining > 0).length;
  const totalRemaining = summary?.totalQuantityRemaining ?? rows.reduce((t, r) => t + r.remaining, 0);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
    setPage(1);
  };
  const SortIcon = ({ k }: { k: SortKey }) => sortKey !== k ? null : sortDir === "asc" ? <ArrowUp size={11} className="inline ml-1" /> : <ArrowDown size={11} className="inline ml-1" />;

  return (
    <>
      <PageHeader
        title="Delivery Agent Performance"
        subtitle="External delivery agents and courier partners only."
        actions={
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Delivery Agents" value={totalAgents} />
        <KpiCard label="Active Agents" value={activeAgents} accent="var(--electric)" />
        <KpiCard label="Agents With Stock" value={agentsWithStock} />
        <KpiCard label="Total Qty Remaining" value={totalRemaining.toLocaleString()} />
      </div>

      <Card>
        {loading && agents.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : rows.length === 0 ? (
          <Empty title="No delivery agent performance yet" hint="Create a delivery agent and assign orders first." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 text-xs uppercase text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("name")}>
                      Delivery Agent<SortIcon k="name" />
                    </th>
                    <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Code</th>
                    <th className="px-3 py-2 text-xs uppercase text-muted-foreground">State</th>
                    <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-xs uppercase text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("assignments")}>
                      Assignments<SortIcon k="assignments" />
                    </th>
                    <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Products</th>
                    <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Allocated</th>
                    <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Delivered / Used</th>
                    <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Remaining</th>
                    <th className="px-3 py-2 text-xs uppercase text-muted-foreground">Low Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: "var(--gradient-electric)" }}><Truck size={14} /></div>
                          <div>{r.name}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono">{r.code || "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.state || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          r.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700"
                          : r.status === "SUSPENDED" ? "bg-rose-100 text-rose-700"
                          : "bg-slate-200 text-slate-600"
                        }`}>{r.status}</span>
                      </td>
                      <td className="px-3 py-2 font-semibold">{r.assignments.toLocaleString()}</td>
                      <td className="px-3 py-2">{r.products}</td>
                      <td className="px-3 py-2">{r.allocated.toLocaleString()}</td>
                      <td className="px-3 py-2 font-semibold text-emerald-600">{r.delivered.toLocaleString()}</td>
                      <td className="px-3 py-2 font-semibold">{r.remaining.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {r.lowRows > 0
                          ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{r.lowRows}</span>
                          : <span className="text-[11px] text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t text-xs text-muted-foreground">
              <div>
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length}
              </div>
              <div className="flex items-center gap-2">
                <label>Rows:</label>
                <select value={pageSize} onChange={(e) => { setPageSize(+e.target.value); setPage(1); }} className="px-2 py-1 rounded border bg-background">
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}
                  className="p-1 rounded border disabled:opacity-40 hover:bg-muted"><ChevronLeft size={14} /></button>
                <span>Page {currentPage} / {totalPages}</span>
                <button disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}
                  className="p-1 rounded border disabled:opacity-40 hover:bg-muted"><ChevronRight size={14} /></button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
