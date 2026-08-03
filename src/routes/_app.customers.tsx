import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { fmtDate } from "@/lib/format";
import { exportCSV } from "@/lib/export";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { listOrders, apiListUsers, type ApiOrder, type BackendUser } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({ meta: [{ title: "Customers — Glowbalmart CRM" }] }),
  component: CustomersPage,
});

interface CustomerRow {
  key: string;
  name: string;
  phone: string;
  whatsapp: string;
  state: string;
  address: string;
  ordersCount: number;
  deliveredCount: number;
  totalValue: number;
  lastOrderAt?: string;
  lastPackage?: string;
  lastStatus?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
}

const normPhone = (p?: string) => (p || "").replace(/\D+/g, "").replace(/^234/, "0");

function CustomersPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [state, setState] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [o, u] = await Promise.all([
        listOrders(),
        apiListUsers().catch(() => [] as BackendUser[]),
      ]);
      setOrders(o); setUsers(u);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const rows = useMemo<CustomerRow[]>(() => {
    const map = new Map<string, CustomerRow>();
    const sorted = [...orders].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    for (const o of sorted) {
      const key = normPhone(o.phone) || o.customerName || o.id;
      const isDelivered = (o.deliveryStatus || "").toUpperCase() === "DELIVERED";
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          name: o.customerName || "—",
          phone: o.phone || "—",
          whatsapp: o.whatsappNumber || "—",
          state: o.state || "—",
          address: o.deliveryAddress || "—",
          ordersCount: 1,
          deliveredCount: isDelivered ? 1 : 0,
          totalValue: o.price || 0,
          lastOrderAt: o.createdAt,
          lastPackage: o.packageName,
          lastStatus: o.deliveryStatus || o.status,
          assignedStaffId: o.assignedCustomerCareId || o.assignedTo || o.deliveryAssignedToId,
          assignedStaffName: o.assignedToName,
        });
      } else {
        existing.ordersCount += 1;
        if (isDelivered) existing.deliveredCount += 1;
        existing.totalValue += o.price || 0;
      }
    }
    return [...map.values()];
  }, [orders]);

  const filtered = rows
    .filter((c) => !state || c.state === state)
    .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));

  const states = [...new Set(rows.map((c) => c.state).filter((s) => s && s !== "—"))];
  const staffName = (id?: string, fallbackName?: string) => {
    if (id) {
      const found = users.find((u) => u.id === id)?.name;
      if (found) return found;
    }
    if (fallbackName) return fallbackName;
    return "Unassigned";
  };

  return (
    <>
      <PageHeader title="Customers" subtitle={`${filtered.length} customer${filtered.length === 1 ? "" : "s"} · derived from real backend orders`} actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <button onClick={() => exportCSV("customers.csv", filtered.map((c) => ({ Name: c.name, Phone: c.phone, WhatsApp: c.whatsapp, State: c.state, Orders: c.ordersCount, Delivered: c.deliveredCount, TotalValue: c.totalValue, LastOrder: fmtDate(c.lastOrderAt), LastPackage: c.lastPackage || "", LastStatus: c.lastStatus || "", AssignedStaff: staffName(c.assignedStaffId, c.assignedStaffName) })))} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            <Download size={14} /> Export
          </button>
        </div>
      } />

      <Card className="p-3 mb-4 flex flex-wrap gap-2">
        <input placeholder="Search name or phone…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 px-3 py-2 rounded border bg-background text-sm min-w-[200px]" />
        <select value={state} onChange={(e) => setState(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Card>

      <Card>
        {loading && rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : filtered.length === 0 ? (
          <Empty title="No customers yet" hint="Customers will appear after public form orders are submitted." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>{["Customer","Phone","WhatsApp","State","Orders","Delivered","Total Value","Last Order","Last Package","Assigned Staff","Last Status"].map((h) => <th key={h} className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.key} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-xs">{c.phone}</td>
                    <td className="px-3 py-2 text-xs">{c.whatsapp}</td>
                    <td className="px-3 py-2 text-xs">{c.state}</td>
                    <td className="px-3 py-2">{c.ordersCount}</td>
                    <td className="px-3 py-2 text-emerald-600">{c.deliveredCount}</td>
                    <td className="px-3 py-2">₦{c.totalValue.toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(c.lastOrderAt)}</td>
                    <td className="px-3 py-2 text-xs">{c.lastPackage || "—"}</td>
                    <td className="px-3 py-2 text-xs">{staffName(c.assignedStaffId, c.assignedStaffName)}</td>
                    <td className="px-3 py-2 text-xs capitalize">{(c.lastStatus || "—").toLowerCase().replace(/_/g, " ")}</td>
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
