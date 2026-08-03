import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { AccessDenied } from "@/components/AccessDenied";
import { useCurrentUser } from "@/lib/store";
import {
  profitSummary, profitOrders, profitAgents, profitCampaigns, listOrders, apiListUsers, listDeliveryAgents,
  type ProfitSummary, type ProfitOrderRow, type ProfitAgentRow, type ProfitCampaignRow, type ApiOrder, type BackendUser, type DeliveryAgent,
} from "@/lib/api";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { NGN } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profit-dashboard")({
  head: () => ({ meta: [{ title: "Profit Dashboard — Glowbalmart CRM" }] }),
  component: ProfitDashboardPage,
});

function ProfitDashboardPage() {
  const current = useCurrentUser();
  const canView = current?.role === "admin" || current?.role === "manager" || current?.role === "finance";
  const [sum, setSum] = useState<ProfitSummary | null>(null);
  const [orders, setOrders] = useState<ProfitOrderRow[]>([]);
  const [agents, setAgents] = useState<ProfitAgentRow[]>([]);
  const [camps, setCamps] = useState<ProfitCampaignRow[]>([]);
  const [allOrders, setAllOrders] = useState<ApiOrder[]>([]);
  const [staffUsers, setStaffUsers] = useState<BackendUser[]>([]);
  const [agentsList, setAgentsList] = useState<DeliveryAgent[]>([]);
  const [agentTableIsCourier, setAgentTableIsCourier] = useState(false);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true);
    const f = from ? new Date(from).toISOString() : undefined;
    const t = to ? new Date(to).toISOString() : undefined;
    try {
      const [s, o, a, c, ords, users, dAgents] = await Promise.all([
        profitSummary(f, t).catch(() => null),
        profitOrders(f, t).catch(() => [] as ProfitOrderRow[]),
        profitAgents(f, t).catch(() => [] as ProfitAgentRow[]),
        profitCampaigns(f, t).catch(() => [] as ProfitCampaignRow[]),
        listOrders().catch(() => [] as ApiOrder[]),
        apiListUsers().catch(() => [] as BackendUser[]),
        listDeliveryAgents().catch(() => [] as DeliveryAgent[]),
      ]);
      setSum(s); setOrders(o); setAgents(a); setCamps(c);
      setAllOrders(ords); setStaffUsers(users); setAgentsList(dAgents);
      // Determine whether the agent performance rows represent delivery agents (couriers)
      // or sales staff, based on whether the ids match known delivery agents.
      const agentIdSet = new Set(dAgents.map((x) => x.id));
      const courierMatches = a.filter((row) => agentIdSet.has(row.agentUserId)).length;
      setAgentTableIsCourier(a.length > 0 && courierMatches >= a.length / 2);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (canView) load(); /* eslint-disable-next-line */ }, [canView]);

  const isUuid = (v?: string) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  const orderCustomerName = (o: ProfitOrderRow): string => {
    if (o.customer && !isUuid(o.customer)) return o.customer;
    const match = allOrders.find((x) => x.id === o.orderId || x.code === o.orderCode);
    return match?.customerName || o.customer || "—";
  };

  const agentDisplayName = (a: ProfitAgentRow): string => {
    if (a.agentName && !isUuid(a.agentName)) return a.agentName;
    const staff = staffUsers.find((u) => u.id === a.agentUserId);
    if (staff?.name) return staff.name;
    const agent = agentsList.find((g) => g.id === a.agentUserId);
    if (agent?.agentName) return agent.agentName;
    return "Unknown staff";
  };

  // De-duplicate agent rows by agentUserId (backend sometimes returns one row keyed
  // by uuid and another by readable name for the same person).
  const dedupedAgents = (() => {
    const map = new Map<string, ProfitAgentRow>();
    for (const a of agents) {
      const existing = map.get(a.agentUserId);
      if (!existing) { map.set(a.agentUserId, a); continue; }
      // Prefer the row that carries more data / a readable name.
      const existingHasName = !!existing.agentName && !isUuid(existing.agentName);
      const currentHasName = !!a.agentName && !isUuid(a.agentName);
      if (currentHasName && !existingHasName) map.set(a.agentUserId, a);
    }
    return [...map.values()];
  })();

  if (!canView) return <AccessDenied allowed={["admin","manager","finance"]} role={current?.role ?? "staff"} />;

  return (
    <>
      <PageHeader title="Profit Dashboard" subtitle="Delivered revenue, costs, expenses and true profit."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="pd-from" className="text-[10px] text-muted-foreground">Start date</label>
              <input id="pd-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-sm px-2 py-1.5 rounded border bg-background" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label htmlFor="pd-to" className="text-[10px] text-muted-foreground">End date</label>
              <input id="pd-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-sm px-2 py-1.5 rounded border bg-background" />
            </div>
            <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
            </button>
          </div>
        } />

      {sum && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Kpi label="Delivered Revenue" v={NGN(sum.deliveredRevenue ?? 0)} tone="pos" />
          <Kpi label="Inventory Cost" v={NGN(sum.inventoryCost ?? 0)} tone="neg" />
          <Kpi label="Gross Profit" v={NGN(sum.grossProfit ?? 0)} tone="pos" />
          <Kpi label="Total Expenses" v={NGN(sum.totalExpenses ?? 0)} tone="neg" />
          <Kpi label="Net Profit" v={NGN(sum.netProfit ?? 0)} tone={(sum.netProfit ?? 0) >= 0 ? "pos" : "neg"} />
          <Kpi label="Margin" v={`${(sum.profitMarginPercent ?? 0).toFixed(1)}%`} />
          <Kpi label="Campaign Revenue" v={NGN(sum.campaignRevenue ?? 0)} />
          <Kpi label="Campaign Profit" v={NGN(sum.campaignProfit ?? 0)} tone={(sum.campaignProfit ?? 0) >= 0 ? "pos" : "neg"} />
          <Kpi label="Agent Expenses" v={NGN(sum.agentExpenses ?? 0)} tone="neg" />
          <Kpi label="Campaign Expenses" v={NGN(sum.campaignExpenses ?? 0)} tone="neg" />
          <Kpi label="Order Expenses" v={NGN(sum.orderExpenses ?? 0)} tone="neg" />
          <Kpi label="General Expenses" v={NGN(sum.generalExpenses ?? 0)} tone="neg" />
        </div>
      )}

      <Section title="Recent Delivered Orders">
        <Table headers={["Order","Customer","Package","Revenue","Cost","Gross","Stock","Delivered"]}
          rows={orders.slice(0, 50).map((o) => [
            o.orderCode || o.orderId, orderCustomerName(o), o.packageName || "—",
            NGN(o.revenue || 0), NGN(o.inventoryCost || 0),
            <span className={(o.grossProfit || 0) >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>{NGN(o.grossProfit || 0)}</span>,
            o.stockDeducted ? "✓" : "—",
            o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString() : "—",
          ])} />
      </Section>

      <Section title={agentTableIsCourier ? "Delivery Agent Performance" : "Sales Rep Performance"}>
        <Table headers={["Agent","Delivered","Revenue","Cost","Gross","Expenses","Net"]}
          rows={dedupedAgents.map((a) => [
            agentDisplayName(a), a.deliveredOrders || 0,
            NGN(a.revenue || 0), NGN(a.inventoryCost || 0), NGN(a.grossProfit || 0),
            NGN(a.expenses || 0),
            <span className={(a.netProfit || 0) >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>{NGN(a.netProfit || 0)}</span>,
          ])} />
      </Section>

      <Section title="Campaign Performance">
        <Table headers={["Campaign","Promoter","Tracking","Reach","Clicks","Conv","Orders","Paid","Revenue","Cost","Ledger Exp.","True Profit"]}
          rows={camps.map((c) => [
            c.campaignName || c.campaignId, c.promoterName || "—", c.trackingCode || "—",
            (c.reach || 0).toLocaleString(), (c.clicks || 0).toLocaleString(), c.conversions || 0,
            c.ordersGenerated || 0, c.paidOrders || 0,
            NGN(c.revenue || 0), NGN(c.campaignCost || 0), NGN(c.ledgerExpenses || 0),
            <span className={(c.trueProfit || 0) >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>{NGN(c.trueProfit || 0)}</span>,
          ])} />
      </Section>
    </>
  );
}

function Kpi({ label, v, tone }: { label: string; v: string; tone?: "pos" | "neg" }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-rose-600" : ""}`}>{v}</div>
    </Card>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-4">
      <div className="px-3 py-2 border-b text-sm font-semibold flex items-center gap-2"><TrendingUp size={14} /> {title}</div>
      {children}
    </Card>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <Empty title="No data" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((c, j) => <td key={j} className="px-3 py-2 text-sm">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
