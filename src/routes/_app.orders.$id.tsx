import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore, useCurrentUser } from "@/lib/store";
import { PageHeader, Card } from "@/components/AppShell";
import { StatusBadge, AttemptRing } from "@/components/StatusBadge";
import { NGN, fmtDateTime } from "@/lib/format";
import { exportCSV, exportPDF } from "@/lib/export";
import { toast } from "sonner";
import { Phone, MessageCircle, Download, FileText, Loader2, Truck, RefreshCw, Send, CheckCircle2, Wallet } from "lucide-react";
import type { CallOutcome, OrderStatus } from "@/lib/types";
import {
  orderCallLogs, resourceActivity, listDeliveryAgents, getOrderDeliveryAssignment,
  deliveryAgentStockAll, sendOrderForDelivery, markOrderDelivered, getOrder, shortStaffId,
  recordOrderPayment, salesStatusLabel, ledgerAccounts, orderAllCallLogs,
  type CallLogEntry, type ActivityLog, type DeliveryAgent, type DeliveryAgentAssignment,
  type DeliveryAgentStockRow, type ApiOrder, type LedgerAccount, type MergedCallLog,
} from "@/lib/api";

export const Route = createFileRoute("/_app/orders/$id")({
  head: () => ({ meta: [{ title: "Order — Glowbalmart CRM" }] }),
  component: OrderDetailPage,
});

const OUTCOMES: CallOutcome[] = ["deal_successful","on_hold","not_reached","callback_later","wrong_number","cancelled","duplicate"];

/** Sales-facing text: IN_TRANSIT / OUT_FOR_DELIVERY read as "Confirmed" anywhere in a message. */
function humanizeStatusText(text?: string | null): string {
  return (text || "")
    .replace(/IN[_\s-]?TRANSIT/gi, "Confirmed")
    .replace(/OUT[_\s-]?FOR[_\s-]?DELIVERY/gi, "Confirmed")
    .replace(/_/g, " ");
}

function extractErr(e: unknown, fallback = "Request failed"): string {
  const raw = e instanceof Error ? e.message : String(e || fallback);
  try {
    const p = JSON.parse(raw);
    const first = p?.errors?.[0]?.defaultMessage || p?.errors?.[0]?.message || p?.message || p?.error;
    if (first && typeof first === "string") return first;
  } catch { /* not json */ }
  return raw || fallback;
}

function OrderDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const localOrder = useStore((s) => s.orders.find((o) => o.id === id));
  const users = useStore((s) => s.users);
  const logCall = useStore((s) => s.logCall);
  const reassign = useStore((s) => s.reassignOrder);
  const updateOrder = useStore((s) => s.updateOrder);

  const [outcome, setOutcome] = useState<CallOutcome>("not_reached");
  const [notes, setNotes] = useState("");
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [beOrder, setBeOrder] = useState<ApiOrder | null>(null);

  const [deliveryAgents, setDeliveryAgents] = useState<DeliveryAgent[]>([]);
  const [agentStock, setAgentStock] = useState<DeliveryAgentStockRow[]>([]);
  const [assignment, setAssignment] = useState<DeliveryAgentAssignment | null>(null);

  const [showSend, setShowSend] = useState(false);
  const [sendAgent, setSendAgent] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [sendSaving, setSendSaving] = useState(false);
  const [deliveredSaving, setDeliveredSaving] = useState(false);

  // Record payment (accountant / finance / owner controlled)
  const currentUser = useCurrentUser();
  const canRecordPayment = ["admin", "manager", "finance"].includes(currentUser?.role || "");
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payAccountId, setPayAccountId] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);

  const savePayment = async () => {
    if (!id) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return toast.error("Enter a valid payment amount");
    setPaySaving(true);
    try {
      const res = await recordOrderPayment({ orderId: id, amount, method: payMethod, accountId: payAccountId || undefined, paidAt: payDate || undefined, reference: payRef || undefined, note: payNote || undefined });
      toast.success(payAccountId && !res.ledgerLinked
        ? "Payment recorded. Ledger account crediting is not connected yet."
        : "Payment recorded");
      setPayOpen(false); setPayRef(""); setPayNote("");
      await Promise.all([
        getOrder(id).then(setBeOrder).catch(() => {}),
        refreshActivity({ silent: true }),
      ]);
    } catch (e) { toast.error(extractErr(e, "Failed to record payment")); }
    finally { setPaySaving(false); }
  };


  const loadAssignment = () => {
    if (!id) return;
    getOrderDeliveryAssignment(id).then((a) => setAssignment(a || null)).catch(() => setAssignment(null));
  };
  const refreshActivity = async (opts?: { silent?: boolean }) => {
    if (!id) return;
    if (!opts?.silent) setLogsLoading(true);
    try {
      const [c, a] = await Promise.all([
        orderCallLogs(id).catch(() => [] as CallLogEntry[]),
        resourceActivity("ORDER", id).catch(() => [] as ActivityLog[]),
      ]);
      setCallLogs(c); setActivity(a);
      loadAssignment();
    } finally { if (!opts?.silent) setLogsLoading(false); }
  };
  const refreshAgentData = async () => {
    const [ags, stock] = await Promise.all([
      listDeliveryAgents({ activeOnly: true }).catch(() => [] as DeliveryAgent[]),
      deliveryAgentStockAll().catch(() => [] as DeliveryAgentStockRow[]),
    ]);
    setDeliveryAgents(ags); setAgentStock(stock);
  };

  useEffect(() => {
    if (!id) return;
    setLogsLoading(true);
    getOrder(id).then(setBeOrder).catch(() => setBeOrder(null));
    ledgerAccounts(true).then(setAccounts).catch(() => setAccounts([]));
    refreshAgentData();
    refreshActivity();
    const t = setInterval(() => refreshActivity({ silent: true }), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Strict same-state agent filter for Send-For-Delivery modal
  const productId = beOrder?.inventoryProductId;
  const qtyNeeded = beOrder?.inventoryQuantity ?? 1;
  const custState = (beOrder?.state || "").trim().toLowerCase();

  const agentOptions = useMemo(() => {
    const stockByAgent = new Map<string, number>();
    if (productId) {
      for (const r of agentStock) {
        if (r.productId === productId) {
          stockByAgent.set(r.deliveryAgentId, (stockByAgent.get(r.deliveryAgentId) || 0) + (r.quantityRemaining || 0));
        }
      }
    }
    const sameState = deliveryAgents.filter((a) => custState && (a.state || "").trim().toLowerCase() === custState);
    const opts = sameState.map((a) => {
      const stock = stockByAgent.get(a.id) ?? 0;
      const enough = !productId || stock >= qtyNeeded;
      return { agent: a, stock, enough, stateMatch: true };
    });
    opts.sort((x, y) => {
      if (x.enough !== y.enough) return x.enough ? -1 : 1;
      return (y.stock - x.stock);
    });
    return opts;
  }, [deliveryAgents, agentStock, productId, qtyNeeded, custState]);

  const noSameStateAgent = agentOptions.length === 0;
  const anyEnough = agentOptions.some((o) => o.enough);
  const selectedOpt = agentOptions.find((o) => o.agent.id === sendAgent);

  const openSendModal = () => {
    if (noSameStateAgent) {
      toast.error("No active delivery agent found in this customer's state. Create or activate a delivery agent in this state first.");
      return;
    }
    setSendAgent(""); setSendNote(""); setShowSend(true);
  };

  const doSendForDelivery = async () => {
    if (!id) return;
    if (!sendAgent) return toast.error("Choose a delivery agent in the customer's state");
    setSendSaving(true);
    try {
      await sendOrderForDelivery(id, sendAgent, sendNote || "Customer confirmed. Sent for delivery.");
      toast.success("Order sent for delivery successfully.");
      setShowSend(false);
      await Promise.all([getOrder(id).then(setBeOrder).catch(() => {}), refreshAgentData(), refreshActivity({ silent: true })]);
    } catch (e) { toast.error(extractErr(e, "Failed to send for delivery")); }
    finally { setSendSaving(false); }
  };

  const doMarkDelivered = async () => {
    if (!id) return;
    setDeliveredSaving(true);
    try {
      const a = await getOrderDeliveryAssignment(id).catch(() => null);
      if (!a || !a.deliveryAgentId) {
        toast.error("Assign a delivery agent before marking this order as delivered.");
        return;
      }
      if (productId) {
        const available = agentStock
          .filter((s) => s.deliveryAgentId === a.deliveryAgentId && s.productId === productId)
          .reduce((sum, s) => sum + (s.quantityRemaining || 0), 0);
        if (available < qtyNeeded) {
          toast.error("This delivery agent does not have enough stock yet. Allocate stock before marking this order as delivered.");
          return;
        }
      }
      await markOrderDelivered(id, "Customer received product.");
      toast.success("Order delivered. Agent stock reduced.");
      await Promise.all([getOrder(id).then(setBeOrder).catch(() => {}), refreshAgentData(), refreshActivity({ silent: true })]);
    } catch (e) { toast.error(extractErr(e, "Failed to mark delivered")); }
    finally { setDeliveredSaving(false); }
  };

  if (!localOrder && !beOrder) return <div className="p-8">Order not found. <button onClick={() => navigate({ to: "/orders" })} className="underline">Back</button></div>;
  const order = localOrder;
  const assigned = order ? users.find((u) => u.id === order.assignedTo) : undefined;
  const setStatus = (s: OrderStatus) => { if (order) { updateOrder(order.id, { status: s }); toast.success("Order updated"); } };

  // Merged view model — backend order is the source of truth, local order is a fallback.
  const v = {
    code: beOrder?.code || order?.code || id?.slice(0, 8) || "",
    customerName: beOrder?.customerName || order?.customerName || "—",
    phone: beOrder?.phone || order?.phone || "",
    whatsapp: beOrder?.whatsappNumber || order?.whatsapp || "",
    email: beOrder?.customerEmail || "",
    state: beOrder?.state || order?.state || "—",
    address: beOrder?.deliveryAddress || order?.address || "—",
    packageName: beOrder?.packageName || order?.packageName || "—",
    packageDescription: beOrder?.packageDescription || "",
    price: beOrder?.price ?? order?.price ?? 0,
    status: beOrder?.status || order?.status || "",
    paymentStatus: beOrder?.paymentStatus || order?.paymentStatus || "",
    deliveryStatus: beOrder?.deliveryStatus || order?.deliveryStatus || "",
    createdAt: beOrder?.createdAt || order?.createdAt || "",
  };

  const buildExportRows = () => {
    const summary: Record<string, string | number | undefined> = {
      Code: v.code, Customer: v.customerName, Phone: v.phone, WhatsApp: v.whatsapp, Email: v.email || "—",
      State: v.state, Address: v.address, Package: v.packageName, Price: v.price,
      Status: v.status, Payment: v.paymentStatus, Delivery: v.deliveryStatus,
      Attempts: `${beOrder?.callAttempts ?? order?.callAttempts ?? 0}/3`,
      AssignedTo: beOrder?.assignedCustomerCareName || assigned?.name || "—",
      Created: v.createdAt ? fmtDateTime(v.createdAt) : "—",
    };
    const timeline = (order?.timeline || []).map((e) => ({
      Code: v.code, Section: "Timeline", Type: e.type, Event: e.message, At: fmtDateTime(e.at),
    }));
    return [{ Section: "Order", ...summary }, ...timeline];
  };

  const assignedStaffId = beOrder?.assignedCustomerCareId ? shortStaffId({ id: beOrder.assignedCustomerCareId }) : (assigned ? shortStaffId({ id: assigned.id }) : "");
  const assignedStaffName = beOrder?.assignedCustomerCareName || assigned?.name || "Unassigned";

  return (
    <>
      <PageHeader title={`Order ${v.code}`} subtitle={v.createdAt ? `Created ${fmtDateTime(v.createdAt)}` : ""}
        actions={
          <>
            <button onClick={() => exportCSV(`${v.code}.csv`, buildExportRows())} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><Download size={14} /> Excel</button>
            <button onClick={() => exportPDF(`${v.code}.pdf`, `Order ${v.code}`, buildExportRows())} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><FileText size={14} /> PDF</button>
            <button onClick={() => navigate({ to: "/orders" })} className="text-sm px-3 py-2 rounded-lg border">← Back</button>
          </>
        } />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Customer</div>
              <div className="flex gap-2">
                {v.phone && <a href={`tel:${v.phone}`} className="rounded-lg p-2 hover:bg-muted"><Phone size={16} /></a>}
                {(v.whatsapp || v.phone) && <a href={`https://wa.me/${(v.whatsapp || v.phone).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 hover:bg-muted"><MessageCircle size={16} /></a>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Name</div><div className="font-medium">{v.customerName}</div></div>
              <div><div className="text-xs text-muted-foreground">Phone</div><div>{v.phone || "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">WhatsApp</div><div>{v.whatsapp || "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">Email</div><div className="break-all">{v.email || "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">State</div><div>{v.state}</div></div>
              <div className="col-span-2"><div className="text-xs text-muted-foreground">Address</div><div>{v.address}</div></div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-semibold mb-3">Package</div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{v.packageName}</div>
                {v.packageDescription && <div className="text-xs text-muted-foreground">{v.packageDescription}</div>}
                {beOrder?.inventoryProductName && <div className="text-xs text-muted-foreground">Product: {beOrder.inventoryProductName}</div>}
                {beOrder?.inventoryQuantity != null && <div className="text-xs text-muted-foreground">Stock units deducted after delivery: {beOrder.inventoryQuantity}</div>}
              </div>
              <div className="text-xl font-bold shrink-0">{NGN(v.price)}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              {v.status && <StatusBadge status={v.status as any} />}
              {v.status && <span className="text-[11px] text-muted-foreground">({salesStatusLabel(v.status)})</span>}
              {v.paymentStatus && <StatusBadge status={v.paymentStatus as any} />}
              {v.deliveryStatus && <StatusBadge status={v.deliveryStatus as any} />}
              {beOrder && <span className={`text-[11px] px-2 py-0.5 rounded-full ${beOrder.stockDeducted ? "bg-emerald-500/15 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>Stock deducted: {beOrder.stockDeducted ? "Yes" : "No"}</span>}
            </div>
            {beOrder && canRecordPayment && (beOrder.paymentStatus || "").toUpperCase() !== "PAID" && (
              <div className="mt-4 pt-3 border-t">
                {!payOpen ? (
                  <button onClick={() => { setPayAmount(String(v.price || "")); setPayOpen(true); }} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}>
                    <Wallet size={14} /> Record Payment
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Record Payment</div>
                    <div className="grid sm:grid-cols-3 gap-2 text-sm">
                      <input type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Amount" className="px-3 py-2 rounded border bg-background" />
                      <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="px-3 py-2 rounded border bg-background">
                        {["CASH", "BANK", "POS", "MOBILE_MONEY", "OTHER"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                      </select>
                      <select value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)} className="px-3 py-2 rounded border bg-background">
                        <option value="">Select account…</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.accountType}</option>)}
                      </select>
                      <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="px-3 py-2 rounded border bg-background" />
                      <input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Reference (optional)" className="px-3 py-2 rounded border bg-background" />
                      <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note (optional)" className="px-3 py-2 rounded border bg-background" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={savePayment} disabled={paySaving} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                        {paySaving && <Loader2 size={14} className="animate-spin" />} Save payment
                      </button>
                      <button onClick={() => setPayOpen(false)} disabled={paySaving} className="text-sm px-3 py-2 rounded-lg border">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>


          {order && (
            <Card className="p-4">
              <div className="font-semibold mb-3">Activity Timeline</div>
              <ol className="relative border-l ml-2 space-y-3">
                {order.timeline.map((e) => (
                  <li key={e.id} className="pl-4 relative">
                    <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full" style={{ background: "var(--electric)" }} />
                    <div className="text-sm">{humanizeStatusText(e.message)}</div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(e.at)}</div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card className="p-4">
            <div className="font-semibold mb-3 flex items-center gap-2">Backend Call Logs {logsLoading && <Loader2 size={12} className="animate-spin" />}</div>
            {callLogs.length === 0 ? <div className="text-xs text-muted-foreground">No backend call logs yet.</div> : (
              <ol className="space-y-2">
                {callLogs.map((c: any) => (
                  <li key={c.id} className="text-sm border rounded p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs uppercase">{c.outcome || c.result || "call"}</span>
                      <span className="text-[11px] text-muted-foreground">{c.createdAt ? fmtDateTime(c.createdAt) : ""}</span>
                    </div>
                    {(c.note || c.notes) && <div className="text-xs text-muted-foreground mt-1">{c.note || c.notes}</div>}
                    {(c.staffId || c.calledByName) && <div className="text-[11px] text-muted-foreground">by {c.calledByName || c.staffName || "—"}{c.staffId ? ` · Staff ID: ${shortStaffId({ id: c.staffId })}` : ""}</div>}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card className="p-4">
            <div className="font-semibold mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">Backend Activity {logsLoading && <Loader2 size={12} className="animate-spin" />}</span>
              <button onClick={() => refreshActivity()} title="Refresh (auto every 10s)" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            {activity.length === 0 ? <div className="text-xs text-muted-foreground">No backend activity yet.</div> : (
              <ol className="relative border-l ml-2 space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="pl-4 relative">
                    <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full" style={{ background: "var(--electric)" }} />
                    <div className="text-sm">{humanizeStatusText(a.title || a.activityType)}</div>
                    {a.message && <div className="text-xs text-muted-foreground">{humanizeStatusText(a.message)}</div>}
                    <div className="text-[11px] text-muted-foreground">{a.actorName ? `${a.actorName} · ` : ""}{a.createdAt ? fmtDateTime(a.createdAt) : ""}</div>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3 text-[10px] text-muted-foreground">Auto-refreshes every 10 seconds.</div>
          </Card>
        </div>

        <div className="space-y-4">
          {order && (
            <Card className="p-4">
              <div className="font-semibold mb-3">Follow-up Progress</div>
              <div className="flex items-center gap-3">
                <AttemptRing attempt={order.callAttempts} size={60} />
                <div>
                  <div className="text-sm font-medium">Attempt {order.callAttempts} of 3</div>
                  <div className="text-xs text-muted-foreground">{order.lastOutcome ? `Last: ${order.lastOutcome.replace(/_/g, " ")}` : "No calls yet"}</div>
                </div>
              </div>
              {order.nextFollowUp && <div className="mt-2 text-xs text-muted-foreground">Next due: {order.nextFollowUp}</div>}
            </Card>
          )}

          {order && (
            <Card className="p-4">
              <div className="font-semibold mb-3">Save Call Result</div>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                {OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
              </select>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes…" rows={2}
                className="mt-2 w-full px-3 py-2 rounded-lg border bg-background text-sm" />
              <button onClick={() => { logCall(order.id, outcome, notes); setNotes(""); toast.success("Call logged"); }}
                disabled={order.status === "closed_max" || order.status === "deal_successful" || order.status === "cancelled"}
                className="mt-2 w-full rounded-lg py-2 text-white text-sm font-medium disabled:opacity-50" style={{ background: "var(--gradient-electric)" }}>
                Save Call Result
              </button>
            </Card>
          )}

          <Card className="p-4">
            <div className="font-semibold mb-1">Assigned Staff</div>
            <div className="text-sm">{assignedStaffName}</div>
            {assignedStaffId && <div className="text-[11px] font-mono text-muted-foreground">Staff ID: {assignedStaffId}</div>}
            {order && (
              <>
                <select value={order.assignedTo || ""} onChange={(e) => { reassign(order.id, e.target.value); toast.success("Reassigned"); }}
                  className="mt-2 w-full px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="">Unassigned</option>
                  {users.filter((u) => u.role === "staff" || u.role === "manager").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </>
            )}
          </Card>

          <Card className="p-4">
            <div className="font-semibold mb-3 flex items-center gap-2"><Truck size={16} /> Delivery</div>
            {assignment && assignment.deliveryAgentId ? (
              <div className="text-sm space-y-1">
                <div><span className="text-xs text-muted-foreground">Courier: </span><span className="font-medium">{assignment.agentName || "—"}</span></div>
                {assignment.agentCode && <div className="text-xs text-muted-foreground">Code: <span className="font-mono">{assignment.agentCode}</span></div>}
                {assignment.state && <div className="text-xs text-muted-foreground">State: {assignment.state}</div>}
                {assignment.assignedByName && <div className="text-xs text-muted-foreground">Assigned by: {assignment.assignedByName}</div>}
                {assignment.assignedAt && <div className="text-xs text-muted-foreground">Assigned: {fmtDateTime(assignment.assignedAt)}</div>}
                <div className="text-xs">Stock deducted: {assignment.stockDeducted ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-muted-foreground">No (deducts on Delivered)</span>}</div>
                {assignment.deliveredAt && <div className="text-xs text-emerald-700">Delivered: {fmtDateTime(assignment.deliveredAt)}</div>}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No delivery agent assigned yet.</div>
            )}
            <div className="mt-3 grid gap-2">
              <button onClick={openSendModal} disabled={sendSaving}
                className="inline-flex items-center justify-center gap-1 rounded-lg py-2 text-white text-sm font-medium disabled:opacity-50"
                style={{ background: "var(--gradient-electric)" }}>
                <Send size={14} /> {assignment?.deliveryAgentId ? "Reassign / Resend" : "Send for Delivery"}
              </button>
              <button onClick={doMarkDelivered} disabled={deliveredSaving || !assignment?.deliveryAgentId}
                className="inline-flex items-center justify-center gap-1 rounded-lg py-2 border text-sm font-medium disabled:opacity-50 hover:bg-muted">
                {deliveredSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Mark Delivered
              </button>
            </div>
          </Card>

          {order && (
            <Card className="p-4">
              <div className="font-semibold mb-3">Quick Actions</div>
              <div className="grid gap-2">
                <button onClick={() => setStatus("deal_successful")} className="text-sm rounded-lg py-2 border hover:bg-muted">Mark Deal Successful</button>
                <button onClick={() => setStatus("on_hold")} className="text-sm rounded-lg py-2 border hover:bg-muted">Put On Hold</button>
                <button onClick={() => setStatus("cancelled")} className="text-sm rounded-lg py-2 border hover:bg-muted text-rose-600">Cancel Order</button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {showSend && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !sendSaving && setShowSend(false)}>
          <div className="bg-card w-full max-w-lg rounded-xl p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-1 flex items-center gap-2"><Send size={16} /> Send Order for Delivery</div>
            <div className="text-xs text-muted-foreground mb-3">Stock is NOT deducted yet. It reduces only when the order is marked Delivered.</div>

            <div className="rounded-lg border p-3 text-sm space-y-1 mb-3 bg-muted/30">
              <div><span className="text-xs text-muted-foreground">Customer: </span><span className="font-medium">{beOrder?.customerName || order?.customerName}</span></div>
              <div className="text-xs text-muted-foreground">Phone: {beOrder?.phone || order?.phone} · State: {beOrder?.state || order?.state || "—"}</div>
              <div className="text-xs text-muted-foreground">Address: {beOrder?.deliveryAddress || order?.address || "—"}</div>
              <div className="text-xs">Package: <span className="font-medium">{beOrder?.packageName || order?.packageName || "—"}</span></div>
              {beOrder?.inventoryQuantity != null && <div className="text-xs">Stock units deducted after delivery: <span className="font-medium">{beOrder.inventoryQuantity}</span></div>}
              {assignedStaffId && <div className="text-xs">Sales Rep: <span className="font-medium">{assignedStaffName}</span> · <span className="font-mono">Staff ID: {assignedStaffId}</span></div>}
            </div>

            <label className="text-sm font-medium">Delivery Agent (same state as customer)</label>
            <select value={sendAgent} onChange={(e) => setSendAgent(e.target.value)} className="mt-1 mb-1 w-full px-3 py-2 rounded border bg-background text-sm">
              <option value="">Select delivery agent…</option>
              {agentOptions.map((o) => (
                <option key={o.agent.id} value={o.agent.id}>
                  {o.agent.agentName} · {o.agent.state || "—"} · {productId ? `${o.stock} units available` : "stock N/A"}
                </option>
              ))}
            </select>
            {productId && !anyEnough && (
              <div className="text-xs text-amber-800 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-2">
                Stock not yet allocated to this agent. You can send for delivery, but you must allocate stock before marking Delivered.
              </div>
            )}
            {selectedOpt && !selectedOpt.enough && (
              <div className="text-[11px] text-amber-700 mb-2">
                Selected agent has {selectedOpt.stock} units — {qtyNeeded} required. Allocate before marking Delivered.
              </div>
            )}

            <label className="text-sm font-medium mt-2 block">Note (optional)</label>
            <textarea value={sendNote} onChange={(e) => setSendNote(e.target.value)} rows={2}
              placeholder="Customer confirmed. Sent for delivery."
              className="mt-1 w-full px-3 py-2 rounded border bg-background text-sm" />

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowSend(false)} disabled={sendSaving} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={doSendForDelivery} disabled={sendSaving || !sendAgent}
                className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm disabled:opacity-60"
                style={{ background: "var(--gradient-electric)" }}>
                {sendSaving && <Loader2 size={14} className="animate-spin" />} Send for Delivery
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
