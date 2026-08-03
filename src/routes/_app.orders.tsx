import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { NGN, fmtDate, fmtDateTime } from "@/lib/format";
import { exportCSV, exportPDF } from "@/lib/export";
import { Download, FileText, Loader2, RefreshCw, X, Wallet, Phone, MessageCircle } from "lucide-react";
import {
  listOrders, shortStaffId, ownerDeleteOrder, getOrder, apiListUsers, orderAllCallLogs,
  salesStatusLabel, recordOrderPayment, ledgerAccounts, listProducts, listForms,
  getOrderDeliveryAssignment, orderProductLabel,
  type ApiOrder, type BackendUser, type MergedCallLog, type LedgerAccount,
  type ApiProduct, type ApiPackage, type DeliveryAgentAssignment,
} from "@/lib/api";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/store";

export const Route = createFileRoute("/_app/orders")({
  head: () => ({ meta: [{ title: "Orders — Glowbalmart CRM" }] }),
  component: OrdersPage,
});

function extractErr(e: unknown, fallback = "Request failed"): string {
  const raw = e instanceof Error ? e.message : String(e || fallback);
  try {
    const p = JSON.parse(raw);
    const first = p?.errors?.[0]?.defaultMessage || p?.errors?.[0]?.message || p?.message || p?.error;
    if (first && typeof first === "string") return first;
  } catch { /* not json */ }
  return raw || fallback;
}

const PAY_METHODS = ["CASH", "BANK", "POS", "MOBILE_MONEY", "OTHER"];

function OrderDetailsModal({ order, users, onClose, canRecordPayment, accounts, onPaid, products, packages, resolvedAssignedName }: {
  order: ApiOrder;
  users: BackendUser[];
  onClose: () => void;
  canRecordPayment: boolean;
  accounts: LedgerAccount[];
  onPaid: () => void;
  products: ApiProduct[];
  packages: ApiPackage[];
  resolvedAssignedName: string;
}) {
  const [enriched, setEnriched] = useState<ApiOrder>(order);
  const [callLogs, setCallLogs] = useState<MergedCallLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [assignment, setAssignment] = useState<DeliveryAgentAssignment | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [accountId, setAccountId] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOrder(order.id).then((fresh) => {
      if (cancelled || !fresh) return;
      // merge so already-resolved list fields are never wiped by a sparser detail payload
      const merged = { ...order } as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(fresh as unknown as Record<string, unknown>)) {
        if (v !== null && v !== undefined && v !== "") merged[k] = v;
      }
      setEnriched(merged as unknown as ApiOrder);
    }).catch(() => {});
    orderAllCallLogs(order.id).then((l) => { if (!cancelled) setCallLogs(l); }).catch(() => {})
      .finally(() => { if (!cancelled) setLoadingLogs(false); });
    getOrderDeliveryAssignment(order.id).then((a) => { if (!cancelled) setAssignment(a); }).catch(() => {});
    return () => { cancelled = true; };
  }, [order.id]);

  useEffect(() => { setAccountId(accounts[0]?.id || ""); }, [accounts]);

  const o = enriched;
  const userName = (id?: string) => (id ? users.find((u) => u.id === id)?.name : undefined);
  const assignedName =
    o.assignedCustomerCareName || o.assignedToName ||
    userName(o.assignedCustomerCareId) || userName(o.assignedTo) ||
    (resolvedAssignedName && resolvedAssignedName !== "Unassigned" ? resolvedAssignedName : "Not assigned");
  const productLabel = orderProductLabel(o, products, packages);
  const agentLabel = assignment?.agentName
    ? `${assignment.agentName}${assignment.agentCode ? ` · ${assignment.agentCode}` : ""}`
    : (o.deliveryAssignedToName as string | undefined) || "Not assigned";
  const isDelivered = (o.status || o.deliveryStatus || "").toUpperCase() === "DELIVERED";
  const isPaid = (o.paymentStatus || "").toUpperCase() === "PAID";
  const canPay = canRecordPayment && isDelivered && !isPaid;

  const savePayment = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    try {
      const res = await recordOrderPayment({
        orderId: o.id, amount: amt, method, accountId: accountId || undefined,
        paidAt: paidAt || undefined, reference: reference || undefined, note: note || undefined,
      });
      toast.success(accountId && !res.ledgerLinked
        ? "Payment recorded. Ledger account crediting is not connected yet."
        : "Payment recorded");
      setPayOpen(false);
      onPaid();
      getOrder(o.id).then(setEnriched).catch(() => {});
    } catch (e) { toast.error(extractErr(e, "Failed to record payment")); }
    finally { setSaving(false); }
  };

  const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
    <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-sm font-medium break-words">{value ?? "—"}</div></div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card w-full max-w-2xl rounded-xl p-5 shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-lg">Order {o.code || o.id.slice(0, 8)}</div>
          <div className="flex items-center gap-2">
            <Link to="/orders/$id" params={{ id: o.id }} className="text-xs px-2 py-1 rounded border hover:bg-muted">Full page</Link>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X size={18} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Row label="Customer name" value={o.customerName} />
          <Row label="Phone" value={o.phone ? <a href={`tel:${o.phone}`} className="inline-flex items-center gap-1"><Phone size={12} />{o.phone}</a> : "—"} />
          <Row label="WhatsApp" value={o.whatsappNumber ? <a href={`https://wa.me/${o.whatsappNumber.replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1"><MessageCircle size={12} />{o.whatsappNumber}</a> : "—"} />
          <Row label="Email" value={o.customerEmail} />
          <Row label="Delivery address" value={o.deliveryAddress} />
          <Row label="State" value={o.state} />
          <Row label="Package" value={o.packageName} />
          <Row label="Product" value={productLabel} />
          <Row label="Quantity" value={o.inventoryQuantity} />
          <Row label="Price" value={NGN(o.price)} />
          <Row label="Status" value={<StatusBadge status={(o.status || "new").toLowerCase()} />} />
          <Row label="Sales status" value={salesStatusLabel(o.status)} />
          <Row label="Payment status" value={<StatusBadge status={(o.paymentStatus || "unpaid").toLowerCase()} />} />
          <Row label="Assigned sales rep" value={assignedName} />
          <Row label="Delivery agent" value={agentLabel} />
          <Row label="Created" value={o.createdAt ? fmtDateTime(o.createdAt) : "—"} />
          <Row label="Delivered" value={o.deliveredAt ? fmtDateTime(o.deliveredAt) : "—"} />
        </div>

        {o.notes && (
          <div className="mb-4"><div className="text-xs text-muted-foreground">Notes</div><div className="text-sm">{o.notes}</div></div>
        )}

        <div className="mb-4">
          <div className="text-sm font-semibold mb-2">Call attempts / history ({o.callAttempts ?? 0})</div>
          {loadingLogs ? <div className="text-xs text-muted-foreground"><Loader2 className="inline animate-spin mr-1" size={12} /> Loading…</div> :
            callLogs.length === 0 ? <div className="text-xs text-muted-foreground">No call history yet.</div> : (
              <ol className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {callLogs.map((c) => (
                  <li key={c.id} className="text-xs border rounded p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium uppercase">{c.outcome || "call"}</span>
                      <span className="text-muted-foreground">{c.createdAt ? fmtDateTime(c.createdAt) : ""}</span>
                    </div>
                    {c.note && <div className="text-muted-foreground mt-1">{c.note}</div>}
                    {c.staffName && <div className="text-[11px] text-muted-foreground">by {c.staffName}</div>}
                  </li>
                ))}
              </ol>
            )}
        </div>

        {canPay && (
          <div className="pt-3 border-t">
            {!payOpen ? (
              <button onClick={() => { setAmount(String(o.price || "")); setPayOpen(true); }} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}>
                <Wallet size={14} /> Record Payment
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-semibold">Record Payment</div>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount paid" className="px-3 py-2 rounded border bg-background" />
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-3 py-2 rounded border bg-background">
                    {PAY_METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                  </select>
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="px-3 py-2 rounded border bg-background">
                    <option value="">Select account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.accountType}</option>)}
                  </select>
                  <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="px-3 py-2 rounded border bg-background" />
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference (optional)" className="px-3 py-2 rounded border bg-background" />
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="px-3 py-2 rounded border bg-background" />
                </div>
                <div className="flex gap-2">
                  <button onClick={savePayment} disabled={saving} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                    {saving && <Loader2 size={14} className="animate-spin" />} Save payment
                  </button>
                  <button onClick={() => setPayOpen(false)} disabled={saving} className="text-sm px-3 py-2 rounded-lg border">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OrdersPage() {
  const currentUser = useCurrentUser();
  const isOwner = currentUser?.role === "admin";
  const canRecordPayment = ["admin", "manager", "finance"].includes(currentUser?.role || "");
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [packages, setPackages] = useState<ApiPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ApiOrder | null>(null);

  const deleteOrderOwner = async (o: ApiOrder) => {
    const label = o.code || o.id.slice(0, 8);
    if (!confirm(`Delete order ${label}? This cannot be undone.`)) return;
    try {
      await ownerDeleteOrder(o.code || o.id);
      toast.success("Order deleted");
      setOrders((prev) => prev.filter((x) => x.id !== o.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete order");
    }
  };
  const [status, setStatus] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [ords, us, accs, prods, forms] = await Promise.all([
        listOrders(),
        apiListUsers().catch(() => [] as BackendUser[]),
        ledgerAccounts(true).catch(() => [] as LedgerAccount[]),
        listProducts().catch(() => [] as ApiProduct[]),
        listForms().catch(() => [] as any[]),
      ]);
      setOrders(ords); setUsers(us); setAccounts(accs); setProducts(prods);
      setPackages(forms.flatMap((f: any) => (f.packages || []) as ApiPackage[]));
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load orders"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const usersById = useMemo(() => {
    const m = new Map<string, BackendUser>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  const assignedName = (o: ApiOrder): string => {
    if (o.assignedCustomerCareName) return o.assignedCustomerCareName;
    if (o.assignedToName) return o.assignedToName;
    const id = o.assignedCustomerCareId || o.assignedTo;
    if (id) return usersById.get(id)?.name || "Unassigned";
    return "Unassigned";
  };

  const visible = useMemo(() => orders
    .filter((o) => !status || (o.status || "").toUpperCase() === status.toUpperCase())
    .filter((o) => !q ||
      o.customerName?.toLowerCase().includes(q.toLowerCase()) ||
      o.phone?.includes(q) ||
      (o.code || o.id).toLowerCase().includes(q.toLowerCase())
    ), [orders, q, status]);

  const rows = () => visible.map((o) => ({
    Code: o.code || o.id.slice(0, 8),
    Customer: o.customerName, Phone: o.phone, State: o.state || "—",
    Package: o.packageName || "—", Price: o.price,
    Status: salesStatusLabel(o.status), Payment: o.paymentStatus || "—", Delivery: o.deliveryStatus || "—",
    Assigned: assignedName(o),
    Attempts: o.callAttempts ?? 0, Created: fmtDate(o.createdAt),
  }));

  return (
    <>
      <PageHeader title="Orders" subtitle={`${visible.length} orders`} actions={
        <>
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <button onClick={() => exportCSV("orders.csv", rows())} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><Download size={14} /> Excel</button>
          <button onClick={() => exportPDF("orders.pdf", "Orders Report", rows())} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><FileText size={14} /> PDF</button>
        </>
      } />

      <Card className="p-3 mb-4 flex flex-wrap gap-2">
        <input placeholder="Search customer, phone, code…" value={q} onChange={(e) => setQ(e.target.value)} className="px-3 py-2 rounded-lg border bg-background text-sm flex-1 min-w-[200px]" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-lg border bg-background text-sm">
          <option value="">All statuses</option>
          {["NEW","ASSIGNED","IN_PROGRESS","CLIENT_SERVICED","READY_FOR_DELIVERY","OUT_FOR_DELIVERY","DELIVERED","DELIVERY_FAILED","RETURNED","CANCELLED"].map((s) => <option key={s} value={s}>{salesStatusLabel(s)}</option>)}
        </select>
      </Card>

      <Card>
        {loading && orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading orders…</div>
        ) : visible.length === 0 ? <Empty title="No orders match your filters" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>{["Code","Customer","Package","Price","State","Status","Payment","Attempts","Assigned","Created",""].map((h) => (
                  <th key={h} className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{o.code || o.id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{o.customerName}<div className="text-xs text-muted-foreground">{o.phone}</div></td>
                    <td className="px-3 py-2">{o.packageName || "—"}</td>
                    <td className="px-3 py-2">{NGN(o.price)}</td>
                    <td className="px-3 py-2">{o.state || "—"}</td>
                    <td className="px-3 py-2"><StatusBadge status={(o.status || "new").toLowerCase()} /> <span className="text-[10px] text-muted-foreground block">{salesStatusLabel(o.status)}</span></td>
                    <td className="px-3 py-2"><StatusBadge status={(o.paymentStatus || "unpaid").toLowerCase()} /></td>
                    <td className="px-3 py-2">{o.callAttempts ?? 0}/3</td>
                    <td className="px-3 py-2 text-xs">{assignedName(o)}{(o.assignedCustomerCareId || o.assignedTo) && <div className="font-mono text-[10px] text-muted-foreground">ID: {shortStaffId({ id: o.assignedCustomerCareId || o.assignedTo })}</div>}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(o.createdAt)}</td>
                    <td className="px-3 py-2 space-x-1 whitespace-nowrap">
                      <button onClick={() => setSelected(o)} className="text-xs font-medium" style={{ color: "var(--electric)" }}>Open</button>
                      <Link to="/orders/$id" params={{ id: o.id }} className="text-xs text-muted-foreground underline">Full page</Link>
                      {isOwner && (
                        <button onClick={() => deleteOrderOwner(o)} className="text-xs px-2 py-1 rounded border hover:bg-rose-50 text-rose-600 border-rose-200">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <OrderDetailsModal
          order={selected}
          users={users}
          onClose={() => setSelected(null)}
          canRecordPayment={canRecordPayment}
          accounts={accounts}
          onPaid={load}
          products={products}
          packages={packages}
          resolvedAssignedName={assignedName(selected)}
        />
      )}
    </>
  );
}
