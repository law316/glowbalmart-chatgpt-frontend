import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { AccessDenied } from "@/components/AccessDenied";
import { useCurrentUser } from "@/lib/store";
import {
  attributionSummary, attributionByTracking, attributionByCampaign, listCampaigns, listOrders,
  listProducts, listForms, orderProductLabel,
  type AttributionSummary, type AttributionEntry, type ApiCampaign, type ApiOrder,
  type ApiProduct, type ApiPackage,
} from "@/lib/api";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { NGN } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/campaign-attribution")({
  head: () => ({ meta: [{ title: "Campaign Attribution — Glowbalmart CRM" }] }),
  component: AttributionPage,
});

interface EnrichedEntry extends AttributionEntry {
  customerPhone?: string;
  packageName?: string;
  productName?: string;
  status?: string;
  paymentStatus?: string;
}

function AttributionPage() {
  const current = useCurrentUser();
  const canView = current?.role === "admin" || current?.role === "manager" || current?.role === "finance";
  const [sum, setSum] = useState<AttributionSummary | null>(null);
  const [entries, setEntries] = useState<EnrichedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const enrich = (list: AttributionEntry[], orders: ApiOrder[], products: ApiProduct[] = [], packages: ApiPackage[] = []): EnrichedEntry[] => {
    const byId = new Map(orders.map((o) => [o.id, o]));
    const byCode = new Map(orders.map((o) => [o.code, o]));
    return list.map((e) => {
      const o = (e.orderId ? byId.get(e.orderId) : undefined) || (e.orderCode ? byCode.get(e.orderCode) : undefined);
      return {
        ...e,
        orderCode: e.orderCode || o?.code,
        customerName: e.customerName || o?.customerName,
        customerPhone: o?.phone,
        packageName: o?.packageName,
        productName: o ? orderProductLabel(o, products, packages) : undefined,
        status: o?.status,
        paymentStatus: o?.paymentStatus,
      };
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const s = await attributionSummary();
      setSum(s);
      let list = Array.isArray(s.entries) ? s.entries : [];
      if (list.length === 0 && (s.totalAttributedOrders ?? 0) > 0) {
        // Fallback: build the list from campaigns + per-campaign attribution
        const campaigns = await listCampaigns().catch(() => [] as ApiCampaign[]);
        const perCampaign = await Promise.all(
          campaigns.map((c) => attributionByCampaign(c.id).catch(() => [] as AttributionEntry[]))
        );
        list = perCampaign.flat();
      }
      const [orders, products, forms] = await Promise.all([
        listOrders().catch(() => [] as ApiOrder[]),
        listProducts().catch(() => [] as ApiProduct[]),
        listForms().catch(() => [] as any[]),
      ]);
      const packages = forms.flatMap((f: any) => (f.packages || []) as ApiPackage[]);
      setEntries(enrich(list, orders, products, packages));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (canView) load(); }, [canView]);

  const search = async () => {
    if (!q.trim()) return load();
    setLoading(true);
    try {
      const [r, orders, products, forms] = await Promise.all([
        attributionByTracking(q.trim()),
        listOrders().catch(() => [] as ApiOrder[]),
        listProducts().catch(() => [] as ApiProduct[]),
        listForms().catch(() => [] as any[]),
      ]);
      const packages = forms.flatMap((f: any) => (f.packages || []) as ApiPackage[]);
      setEntries(enrich(r, orders, products, packages));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to search"); }
    finally { setLoading(false); }
  };

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((e) => (e.trackingCode || "").toLowerCase().includes(term));
  }, [entries, q]);

  if (!canView) return <AccessDenied allowed={["admin","manager","finance"]} role={current?.role ?? "staff"} />;

  return (
    <>
      <PageHeader title="Campaign Attribution" subtitle="Orders attributed to marketing campaigns via tracking codes."
        actions={
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
        } />

      {sum && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Attributed Orders</div><div className="text-2xl font-bold">{sum.totalAttributedOrders ?? 0}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Delivered</div><div className="text-2xl font-bold text-emerald-600">{sum.deliveredAttributedOrders ?? 0}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Paid</div><div className="text-2xl font-bold text-blue-600">{sum.paidAttributedOrders ?? 0}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Value</div><div className="text-xl font-bold">{NGN(sum.totalAttributedValue ?? 0)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Delivered Revenue</div><div className="text-xl font-bold text-emerald-600">{NGN(sum.deliveredAttributedRevenue ?? 0)}</div></Card>
        </div>
      )}

      <Card className="p-3 mb-3">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Filter / search by tracking code…" className="flex-1 px-3 py-2 rounded border bg-background text-sm" />
          <button onClick={search} className="px-3 py-2 rounded text-sm text-white" style={{ background: "var(--gradient-electric)" }}>Search</button>
        </div>
      </Card>

      <Card>
        {loading ? <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
          : visible.length === 0 ? <Empty title="No attributed orders" hint="Share form links with ?trackingCode=... to attribute orders to campaigns." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>{["Order","Customer","Phone","Campaign","Tracking","Promoter","Package","Product","Value","Status","Payment","Submitted"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.id} className="border-t align-top">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{e.orderCode || "—"}</td>
                      <td className="px-3 py-2 text-xs">{e.customerName || "—"}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{e.customerPhone || "—"}</td>
                      <td className="px-3 py-2 text-xs">{e.campaignName || "—"}</td>
                      <td className="px-3 py-2 text-xs"><code>{e.trackingCode || "—"}</code></td>
                      <td className="px-3 py-2 text-xs">{e.promoterName || "—"}</td>
                      <td className="px-3 py-2 text-xs">{e.packageName || "—"}</td>
                      <td className="px-3 py-2 text-xs">{e.productName || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{NGN(e.orderValue || 0)}</td>
                      <td className="px-3 py-2 text-xs">{e.status || "—"}</td>
                      <td className="px-3 py-2 text-xs">{e.paymentStatus || "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}</td>
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
