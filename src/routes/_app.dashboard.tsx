import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/store";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { NGN, fmtDate } from "@/lib/format";
import {
  ShoppingBag, CheckCircle2, Clock, Wallet,
  AlertTriangle, Loader2, RefreshCw, TrendingUp, Users, Truck, Package, Megaphone, MapPin,
} from "lucide-react";
import {
  financeSummary, listOrders, inventorySummary, salesStatusLabel, getDashboardInsights,
  type FinanceSummary, type InventorySummary, type ApiOrder, type DashboardInsights,
} from "@/lib/api";

import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Glowbalmart CRM" }] }),
  component: Dashboard,
});

function Kpi({ icon: Icon, label, value, tone = "default" }: { icon: any; label: string; value: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneCls = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-rose-600" : "text-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon size={16} className="text-muted-foreground" />
      </div>
      <div className={`mt-2 text-2xl font-bold ${toneCls}`}>{value}</div>
    </Card>
  );
}

function Dashboard() {
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const [fin, setFin] = useState<FinanceSummary | null>(null);
  const [inv, setInv] = useState<InventorySummary | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [f, o, i, ins] = await Promise.all([
        financeSummary().catch(() => null),
        listOrders().catch(() => []),
        inventorySummary().catch(() => null),
        getDashboardInsights().catch(() => null),
      ]);
      setFin(f); setOrders(o); setInv(i); setInsights(ins);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load dashboard"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todaysOrders = orders.filter((o) => (o.createdAt || "").slice(0, 10) === today);
  const deliveredToday = orders.filter((o) => (o.deliveryStatus || "").toUpperCase() === "DELIVERED" && (o.deliveredAt || o.updatedAt || "").slice(0, 10) === today);
  const pendingFollowUps = orders.filter((o) => {
    const s = (o.followUpStatus || o.status || "").toUpperCase();
    return s.includes("PENDING") || s.includes("FOLLOW");
  }).length;
  const revenueToday = todaysOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);

  const recent = [...orders]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 8);

  return (
    <>
      <PageHeader title={`Hello ${user.name.split(" ")[0]} 👋`} subtitle="Live snapshot from the Glowbalmart backend." actions={
        <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      } />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Kpi icon={ShoppingBag} label="Orders Today" value={String(todaysOrders.length)} />
        <Kpi icon={CheckCircle2} label="Delivered Today" value={String(deliveredToday.length)} tone="good" />
        <Kpi icon={Clock} label="Pending Follow-ups" value={String(pendingFollowUps)} tone="warn" />
        <Kpi icon={Wallet} label="Revenue Today" value={NGN(revenueToday)} tone="good" />
        <Kpi icon={AlertTriangle} label="Unpaid Delivered Value" value={NGN(fin?.unpaidOrderValue || 0)} tone="warn" />
        <Kpi icon={AlertTriangle} label="Low Stock Alerts" value={String(inv?.lowStockProducts ?? 0)} tone={(inv?.lowStockProducts || 0) > 0 ? "warn" : "default"} />
      </div>

      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Quick Actions</div>
          <Link to="/call-queue" className="text-sm" style={{ color: "var(--electric)" }}>Open call queue →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link to="/call-queue" className="rounded-lg border p-3 hover:bg-muted">📞 Customer Care Queue</Link>
          <Link to="/orders" className="rounded-lg border p-3 hover:bg-muted">🛒 All Orders</Link>
          <Link to="/delivery" className="rounded-lg border p-3 hover:bg-muted">🚚 Delivery Queue</Link>
          <Link to="/finance" className="rounded-lg border p-3 hover:bg-muted">💰 Finance</Link>
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b font-semibold">Recent Orders</div>
        {loading && orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : recent.length === 0 ? (
          <Empty title="No orders yet" hint="Orders will show up here once created." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {["Customer", "Package", "Status", "Amount", "Date"].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-t cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: "/orders/$id", params: { id: o.id } })}>
                    <td className="px-3 py-2">{o.customerName}</td>
                    <td className="px-3 py-2">{o.packageName || "—"}</td>
                    <td className="px-3 py-2 text-xs">{salesStatusLabel(o.status)}</td>
                    <td className="px-3 py-2 font-medium">{NGN(o.price)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <InsightsSection insights={insights} loading={loading} />
    </>
  );
}

function InsightCard({ icon: Icon, title, value, subitems }: { icon: any; title: string; value?: string; subitems: { label: string; value: string }[] }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-muted-foreground" />
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      </div>
      <div className="text-lg font-bold mb-2">{value || "—"}</div>
      <div className="space-y-1">
        {subitems.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{s.label}</span>
            <span className="font-medium text-foreground">{s.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function pick(row: any, keys: string[]): any {
  for (const k of keys) {
    if (row && row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return undefined;
}

function fmtVal(v: any): string {
  if (v === undefined || v === null || v === "") return "—";
  return String(v);
}

function InsightsTable({ title, rows, columns }: { title: string; rows: any[]; columns: { label: string; keys: string[]; money?: boolean; percent?: boolean }[] }) {
  return (
    <Card>
      <div className="p-4 border-b font-semibold">{title}</div>
      {rows.length === 0 ? (
        <Empty title="No data yet" hint="Data will show up here once available." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {columns.map((c) => (
                  <th key={c.label} className="px-3 py-2 text-xs uppercase text-muted-foreground">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t">
                  {columns.map((c) => {
                    const raw = pick(row, c.keys);
                    let display = fmtVal(raw);
                    if (raw !== undefined && c.money) display = NGN(Number(raw) || 0);
                    else if (raw !== undefined && c.percent) display = `${raw}%`;
                    return <td key={c.label} className="px-3 py-2">{display}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function InsightsSection({ insights, loading }: { insights: DashboardInsights | null; loading: boolean }) {
  const i = (insights || {}) as DashboardInsights;

  return (
    <div className="mt-8">
      <div className="mb-3">
        <div className="text-lg font-semibold">Business Insights</div>
        <div className="text-sm text-muted-foreground">Best performers and portfolio-wide trends (live from the backend).</div>
      </div>

      {loading && !insights ? (
        <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
            <InsightCard icon={MapPin} title="Best Performing State" value={i.bestPerformingState} subitems={[
              { label: "Delivered", value: fmtVal(i.bestPerformingStateDelivered) },
              { label: "Revenue", value: NGN(i.bestPerformingStateRevenue || 0) },
            ]} />
            <InsightCard icon={Users} title="Best Sales Agent" value={i.bestSalesAgent} subitems={[
              { label: "Assigned", value: fmtVal(i.bestSalesAgentAssigned) },
              { label: "Delivered", value: fmtVal(i.bestSalesAgentDelivered) },
              { label: "Conversion Rate", value: `${i.bestSalesAgentConversionRate ?? 0}%` },
            ]} />
            <InsightCard icon={TrendingUp} title="Best Sales Cohort" value={i.bestSalesCohort} subitems={[
              { label: "Assigned", value: fmtVal(i.bestSalesCohortAssigned) },
              { label: "Delivered", value: fmtVal(i.bestSalesCohortDelivered) },
              { label: "Achievement", value: `${i.bestSalesCohortAchievementPercent ?? 0}%` },
            ]} />
            <InsightCard icon={Truck} title="Best Delivery Agent" value={i.bestDeliveryAgent} subitems={[
              { label: "Delivered", value: fmtVal(i.bestDeliveryAgentDelivered) },
              { label: "Units", value: fmtVal(i.bestDeliveryAgentUnits) },
            ]} />
            <InsightCard icon={Package} title="Best Product" value={i.bestProduct} subitems={[
              { label: "Units", value: fmtVal(i.bestProductUnits) },
              { label: "Revenue", value: NGN(i.bestProductRevenue || 0) },
            ]} />
            <InsightCard icon={Megaphone} title="Top Campaign" value={i.topCampaign} subitems={[
              { label: "Orders", value: fmtVal(i.topCampaignOrders) },
              { label: "Delivered", value: fmtVal(i.topCampaignDelivered) },
              { label: "Revenue", value: NGN(i.topCampaignRevenue || 0) },
            ]} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
            <Kpi icon={Users} label="Total Assigned Leads" value={String(i.totalAssignedLeads ?? 0)} />
            <Kpi icon={CheckCircle2} label="Delivered Leads" value={String(i.deliveredLeads ?? 0)} tone="good" />
            <Kpi icon={Clock} label="Pending Leads" value={String(i.pendingLeads ?? 0)} tone="warn" />
            <Kpi icon={TrendingUp} label="Conversion Rate" value={`${i.conversionRate ?? 0}%`} tone="good" />
            <Kpi icon={Wallet} label="Pending Payment (Delivery Agents)" value={NGN(i.pendingPaymentFromDeliveryAgents || 0)} tone="warn" />
            <Kpi icon={Wallet} label="Paid Remittance" value={NGN(i.paidRemittance || 0)} tone="good" />
            <Kpi icon={Wallet} label="Pending Remittance" value={NGN(i.pendingRemittance || 0)} tone="warn" />
            <Kpi icon={AlertTriangle} label="Low Stock Count" value={String(i.lowStockCount ?? 0)} tone={(i.lowStockCount || 0) > 0 ? "warn" : "default"} />
            <Kpi icon={Truck} label="In-Transit Stock Units" value={String(i.inTransitStockUnits ?? 0)} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <InsightsTable title="Top States" rows={i.topStates || []} columns={[
              { label: "State", keys: ["name", "state"] },
              { label: "Delivered", keys: ["deliveredCount", "delivered"] },
              { label: "Units", keys: ["units", "quantity"] },
              { label: "Amount", keys: ["amount", "revenue"], money: true },
            ]} />
            <InsightsTable title="Top Sales Agents" rows={i.topSalesAgents || []} columns={[
              { label: "Agent", keys: ["name", "agentName"] },
              { label: "Assigned", keys: ["count", "assigned"] },
              { label: "Delivered", keys: ["deliveredCount", "delivered"] },
              { label: "Percent", keys: ["percent", "achievementPercent", "conversionRate"], percent: true },
              { label: "Amount", keys: ["amount", "revenue"], money: true },
            ]} />
            <InsightsTable title="Top Cohorts" rows={i.topCohorts || []} columns={[
              { label: "Cohort", keys: ["name"] },
              { label: "Assigned", keys: ["count", "assigned"] },
              { label: "Delivered", keys: ["deliveredCount", "delivered"] },
              { label: "Percent", keys: ["percent", "achievementPercent"], percent: true },
              { label: "Amount", keys: ["amount", "revenue"], money: true },
              { label: "Extra", keys: ["extra", "note"] },
            ]} />
            <InsightsTable title="Top Delivery Agents" rows={i.topDeliveryAgents || []} columns={[
              { label: "Agent", keys: ["name", "agentName"] },
              { label: "Code", keys: ["code", "agentCode"] },
              { label: "Delivered", keys: ["deliveredCount", "delivered"] },
              { label: "Units", keys: ["units"] },
              { label: "Amount", keys: ["amount", "revenue"], money: true },
            ]} />
            <InsightsTable title="Top Products" rows={i.topProducts || []} columns={[
              { label: "Product", keys: ["name", "productName"] },
              { label: "Code", keys: ["code", "sku"] },
              { label: "Units", keys: ["units"] },
              { label: "Amount", keys: ["amount", "revenue"], money: true },
            ]} />
            <InsightsTable title="Campaign Snapshot" rows={i.campaignSnapshot || []} columns={[
              { label: "Campaign", keys: ["name", "campaignName"] },
              { label: "Code", keys: ["code"] },
              { label: "Orders", keys: ["count", "orders"] },
              { label: "Delivered", keys: ["deliveredCount", "delivered"] },
              { label: "Amount", keys: ["amount", "revenue"], money: true },
              { label: "Percent", keys: ["percent"], percent: true },
              { label: "Extra", keys: ["extra", "note"] },
            ]} />
          </div>
        </>
      )}
    </div>
  );
}
