import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { ExportButton, FilterSelect } from "@/components/ModulePage";
import { fmtDateTime } from "@/lib/format";
import { Loader2, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import {
  listDeliveryAgentAssignments, listDeliveryAgents, listOrders, listProducts, listForms, orderProductLabel,
  type DeliveryAgentAssignment, type DeliveryAgent, type ApiOrder, type ApiProduct, type ApiPackage,
} from "@/lib/api";

export const Route = createFileRoute("/_app/waybill")({
  head: () => ({ meta: [{ title: "Waybill — Glowbalmart CRM" }] }),
  component: WaybillPage,
});

function WaybillPage() {
  const [assignments, setAssignments] = useState<DeliveryAgentAssignment[]>([]);
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [packages, setPackages] = useState<ApiPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [agentFilter, setAgentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [a, ag, o, p, f] = await Promise.all([
        listDeliveryAgentAssignments().catch(() => []),
        listDeliveryAgents().catch(() => []),
        listOrders().catch(() => []),
        listProducts().catch(() => [] as ApiProduct[]),
        listForms().catch(() => [] as any[]),
      ]);
      setAssignments(a); setAgents(ag); setOrders(o); setProducts(p);
      setPackages(f.flatMap((x: any) => (x.packages || []) as ApiPackage[]));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setLoadedOnce(true); }
  };
  useEffect(() => { load(); }, []);

  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const agentsById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const rows = useMemo(() => assignments.map((a) => {
    const o = ordersById.get(a.orderId);
    const ag = a.deliveryAgentId ? agentsById.get(a.deliveryAgentId as string) : undefined;
    const status = a.deliveredAt ? "Delivered" : "In Transit";
    return {
      a, o, status,
      code: o?.code || a.orderId,
      customer: o?.customerName || "—",
      phone: o?.phone || "—",
      state: a.state || o?.state || ag?.state || "—",
      address: o?.deliveryAddress || "—",
      pkg: o?.packageName || "—",
      product: o ? orderProductLabel(o, products, packages) : "—",
      units: o?.inventoryQuantity ?? "—",
      agent: a.agentName || ag?.agentName || "—",
      agentCode: a.agentCode || ag?.agentCode || "—",
      assignedBy: a.assignedByName || "—",
      assignedAt: a.assignedAt || "",
      deliveredAt: a.deliveredAt || "",
      stockDeducted: a.stockDeducted ? "Yes" : "No",
    };
  }), [assignments, ordersById, agentsById, products, packages]);

  const filtered = rows
    .filter((r) => !agentFilter || r.a.deliveryAgentId === agentFilter)
    .filter((r) => !statusFilter || r.status === statusFilter);


  return (
    <>
      <PageHeader title="Waybill / Delivery Manifest" subtitle="Real delivery assignments to courier partners" actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <ExportButton filename="waybill-manifest.csv" rows={filtered.map((r) => ({ OrderCode: r.code, Customer: r.customer, Phone: r.phone, State: r.state, Address: r.address, Package: r.pkg, Product: r.product, StockUnits: r.units, Agent: r.agent, AgentCode: r.agentCode, AssignedBy: r.assignedBy, AssignedAt: r.assignedAt, DeliveredAt: r.deliveredAt, StockDeducted: r.stockDeducted, Status: r.status }))} />
        </div>
      } />

      <Card className="p-3 mb-4 border-electric/30 bg-electric/5">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info size={14} className="mt-0.5" />
          <div>Manifest is generated from delivery assignments. Send orders for delivery from the order detail page to build a manifest.</div>
        </div>
      </Card>

      <Card className="p-3 mb-4 flex flex-wrap gap-2">
        <FilterSelect value={agentFilter} onChange={setAgentFilter} options={[{ value: "", label: "All Agents" }, ...agents.map((a) => ({ value: a.id, label: a.agentName }))]} />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: "", label: "All Statuses" }, { value: "In Transit", label: "In Transit" }, { value: "Delivered", label: "Delivered" }]} />
      </Card>

      <Card>
        {loading && filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : loadedOnce && filtered.length === 0 ? (
          <Empty title="No delivery manifest yet." hint="Send orders for delivery first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Order","Customer","Phone","State","Address","Package","Product","Units","Agent","Code","Assigned By","Assigned","Delivered","Stock","Status"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.a.orderId + i} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                    <td className="px-3 py-2">{r.customer}</td>
                    <td className="px-3 py-2 text-xs">{r.phone}</td>
                    <td className="px-3 py-2 text-xs">{r.state}</td>
                    <td className="px-3 py-2 text-xs max-w-[220px] truncate" title={r.address}>{r.address}</td>
                    <td className="px-3 py-2 text-xs">{r.pkg}</td>
                    <td className="px-3 py-2 text-xs">{r.product}</td>
                    <td className="px-3 py-2 text-xs">{r.units}</td>
                    <td className="px-3 py-2">{r.agent}</td>
                    <td className="px-3 py-2 text-xs font-mono">{r.agentCode}</td>
                    <td className="px-3 py-2 text-xs">{r.assignedBy}</td>
                    <td className="px-3 py-2 text-xs">{r.assignedAt ? fmtDateTime(r.assignedAt) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.deliveredAt ? fmtDateTime(r.deliveredAt) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.stockDeducted}</td>
                    <td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${r.status === "Delivered" ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>{r.status}</span></td>
                  </tr>
                ))}

              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
