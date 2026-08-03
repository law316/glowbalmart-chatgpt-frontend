import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty, ExportButton, FilterSelect } from "@/components/ModulePage";
import { fmtDateTime, NGN } from "@/lib/format";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listDeliveryAgentAssignments, listDeliveryAgents, listOrders, listProducts, listForms, orderProductLabel,
  listSMDailyReports,
  type DeliveryAgentAssignment, type DeliveryAgent, type ApiOrder, type ApiProduct, type ApiPackage,
  type SMDailyReport,
} from "@/lib/api";

export const Route = createFileRoute("/_app/agent-deliveries")({
  head: () => ({ meta: [{ title: "Agent Deliveries — Glowbalmart CRM" }] }),
  component: AgentDeliveriesPage,
});

function AgentDeliveriesPage() {
  const [assignments, setAssignments] = useState<DeliveryAgentAssignment[]>([]);
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [packages, setPackages] = useState<ApiPackage[]>([]);
  const [reports, setReports] = useState<SMDailyReport[]>([]);
  const [tab, setTab] = useState<"orders" | "reports">("orders");
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [agentFilter, setAgentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [a, ag, o, p, f, dr] = await Promise.all([
        listDeliveryAgentAssignments().catch(() => []),
        listDeliveryAgents().catch(() => []),
        listOrders().catch(() => []),
        listProducts().catch(() => [] as ApiProduct[]),
        listForms().catch(() => [] as any[]),
        listSMDailyReports().catch(() => [] as SMDailyReport[]),
      ]);
      setReports(dr);
      setAssignments(a); setAgents(ag); setOrders(o); setProducts(p);
      setPackages(f.flatMap((x: any) => (x.packages || []) as ApiPackage[]));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load deliveries"); }
    finally { setLoading(false); setLoadedOnce(true); }
  };
  useEffect(() => { load(); }, []);

  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const agentsById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const rows = useMemo(() => assignments.map((a) => {
    const o = ordersById.get(a.orderId);
    const ag = a.deliveryAgentId ? agentsById.get(a.deliveryAgentId as string) : undefined;
    return {
      key: `${a.orderId}-${a.id || ""}`,
      agentId: (a.deliveryAgentId as string) || ag?.id || "",
      ref: o?.code || a.orderId,
      date: a.deliveredAt || a.assignedAt || o?.createdAt || "",
      agent: a.agentName || ag?.agentName || "—",
      agentCode: a.agentCode || ag?.agentCode || "—",
      customer: o?.customerName || "—",
      state: a.state || o?.state || "—",
      product: o ? orderProductLabel(o, products, packages) : "—",
      qty: o?.inventoryQuantity ?? 0,
      value: o?.price ?? 0,
      status: a.deliveredAt ? "Delivered" : "In Transit",
    };
  }).sort((x, y) => (y.date || "").localeCompare(x.date || "")),
    [assignments, ordersById, agentsById, products, packages]);

  const filtered = rows
    .filter((r) => !agentFilter || r.agentId === agentFilter)
    .filter((r) => !statusFilter || r.status === statusFilter);

  const delivered = filtered.filter((r) => r.status === "Delivered").length;

  return (
    <>
      <PageHeader title="Agent Deliveries" subtitle={`${filtered.length} deliveries · ${delivered} completed`} actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <Link to="/sales-manager-office" className="text-sm px-3 py-2 rounded-lg border hover:bg-muted">Open Sales Manager Office</Link>
          <ExportButton filename="agent-deliveries.csv" rows={filtered.map((r) => ({
            Ref: r.ref, Date: r.date, Agent: r.agent, AgentCode: r.agentCode, Customer: r.customer,
            State: r.state, Product: r.product, Qty: r.qty, Value: r.value, Status: r.status,
          }))} />
        </div>
      } />

      <div className="flex gap-2 mb-4">
        {([["orders", `Order Deliveries (${rows.length})`], ["reports", `Daily Delivery Reports (${reports.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as "orders" | "reports")}
            className={`text-sm px-3 py-1.5 rounded-lg border ${tab === k ? "text-white" : "hover:bg-muted"}`}
            style={tab === k ? { background: "var(--gradient-electric)", borderColor: "transparent" } : undefined}>
            {label}
          </button>
        ))}
      </div>

      {tab === "orders" && (<>
      <Card className="p-3 mb-4 flex flex-wrap gap-2">
        <FilterSelect value={agentFilter} onChange={setAgentFilter} options={[{ value: "", label: "All Agents" }, ...agents.map((a) => ({ value: a.id, label: a.agentName }))]} />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: "", label: "All Statuses" }, { value: "In Transit", label: "In Transit" }, { value: "Delivered", label: "Delivered" }]} />
      </Card>

      <Card>
        {loading && filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : loadedOnce && filtered.length === 0 ? (
          <Empty title="No deliveries yet" hint="Send an order for delivery to an agent and it will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Order","Date","Agent","Code","Customer","State","Product","Qty","Value","Status"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.key} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{r.ref}</td>
                    <td className="px-3 py-2 text-xs">{r.date ? fmtDateTime(r.date) : "—"}</td>
                    <td className="px-3 py-2">{r.agent}</td>
                    <td className="px-3 py-2 text-xs font-mono">{r.agentCode}</td>
                    <td className="px-3 py-2">{r.customer}</td>
                    <td className="px-3 py-2 text-xs">{r.state}</td>
                    <td className="px-3 py-2 text-xs">{r.product}</td>
                    <td className="px-3 py-2">{r.qty || "—"}</td>
                    <td className="px-3 py-2">{NGN(r.value)}</td>
                    <td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${r.status === "Delivered" ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </>)}

      {tab === "reports" && (
        <Card>
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <div className="font-semibold">Daily Delivery Reports</div>
              <div className="text-xs text-muted-foreground">Manual delivery confirmations recorded in Sales Manager Office.</div>
            </div>
            <ExportButton filename="daily-delivery-reports.csv" rows={reports.map((r) => ({
              Date: r.reportDate || r.date || "", State: r.state || "", Agent: r.deliveryAgentName || "",
              Product: r.productName || "", OrderCode: r.orderCode || "", Customer: r.customerName || "",
              Qty: r.quantityDelivered ?? 0, UnitPrice: r.unitPrice ?? 0, Expected: r.expectedRevenue ?? 0,
              PaymentStatus: r.paymentStatus || "", Paid: r.amountPaid ?? 0, Pending: r.amountPending ?? 0,
              EnteredBy: (r.enteredByName as string) || (r.createdByName as string) || "", Notes: r.notes || "",
            }))} />
          </div>
          {loading && reports.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
          ) : reports.length === 0 ? (
            <Empty title="No daily delivery reports yet" hint="Record one from Sales Manager Office." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr>{["Date","State","Delivery Agent","Product","Order Code","Customer","Qty","Unit Price","Expected","Payment","Paid","Pending","Entered By","Notes"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>
                  {reports.map((r, idx) => (
                    <tr key={r.id || idx} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs">{(r.reportDate || r.date || "—").toString().slice(0, 10)}</td>
                      <td className="px-3 py-2 text-xs">{r.state || "—"}</td>
                      <td className="px-3 py-2">{r.deliveryAgentName || "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.productName || "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.orderCode || "—"}</td>
                      <td className="px-3 py-2">{r.customerName || "—"}</td>
                      <td className="px-3 py-2">{r.quantityDelivered ?? 0}</td>
                      <td className="px-3 py-2">{NGN(r.unitPrice || 0)}</td>
                      <td className="px-3 py-2 font-medium">{NGN(r.expectedRevenue || 0)}</td>
                      <td className="px-3 py-2 text-[11px]">{r.paymentStatus || "—"}</td>
                      <td className="px-3 py-2 text-emerald-700">{NGN(r.amountPaid || 0)}</td>
                      <td className="px-3 py-2 text-amber-700">{NGN(r.amountPending || 0)}</td>
                      <td className="px-3 py-2 text-xs">{(r.enteredByName as string) || (r.createdByName as string) || "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
