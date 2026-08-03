import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { AttemptRing } from "@/components/StatusBadge";
import { NGN, fmtDate, fmtDateTime } from "@/lib/format";
import { Phone, MessageCircle, ExternalLink, Loader2, RefreshCw, Lock } from "lucide-react";
import {
  listOrders, salesTreatment, assignOrderToMe,
  waLink, shortStaffId, type ApiOrder, type TreatmentOutcome,
  listDeliveryAgents, deliveryAgentStockAll, getOrderDeliveryAssignment,
  apiListUsers, listProducts, apiFetch, listCohorts,
  type DeliveryAgent, type DeliveryAgentStockRow,
  type BackendUser, type ApiProduct, type Cohort,
} from "@/lib/api";

const assignedIdOf = (o: ApiOrder) => o.assignedTo || o.assignedCustomerCareId || "";
const assignedNameOf = (o: ApiOrder) => o.assignedToName || o.assignedCustomerCareName || "";


import { useCurrentUser } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/call-queue")({
  head: () => ({ meta: [{ title: "Sales Rep Follow-Up — Glowbalmart CRM" }] }),
  component: SalesRepFollowUpPage,
});

interface OutcomeOpt { value: TreatmentOutcome; label: string; requiresNote?: boolean; requiresDate?: boolean; allowDate?: boolean; hint?: string; }
const OUTCOMES: OutcomeOpt[] = [
  { value: "PENDING", label: "Pending", hint: "No action yet." },
  { value: "IN_TRANSIT", label: "Confirmed", hint: "Select an external delivery agent in the customer's state." },
  { value: "RESCHEDULED", label: "Rescheduled", requiresDate: true, hint: "Pick the new date/time." },
  { value: "NOT_AVAILABLE", label: "Not Available", allowDate: true },
  { value: "CALL_BACK", label: "Call Back", requiresDate: true, hint: "Pick when to call back." },
  { value: "REJECTED", label: "Rejected", requiresNote: true, hint: "Reason required." },
  { value: "NUMBER_BUSY", label: "Number Busy", allowDate: true },
  { value: "SWITCHED_OFF", label: "Switched Off", allowDate: true },
  { value: "NOT_ANSWERING", label: "Not Answering", allowDate: true },
  { value: "NOT_READY", label: "Not Ready", allowDate: true },
  { value: "CANCELLED", label: "Cancelled", requiresNote: true, hint: "Reason required." },
  { value: "DELIVERED", label: "Delivered", hint: "Requires an assigned delivery agent with enough stock." },
  { value: "FOLLOW_UP", label: "Follow Up", allowDate: true },
];

type Tab = "mine" | "all" | "completed";

const TERMINAL_OUTCOMES = new Set(["DELIVERED", "CANCELLED", "REJECTED"]);
const isCompleted = (o: ApiOrder) => {
  const s = (o.status || "").toUpperCase();
  const d = (o.deliveryStatus || "").toUpperCase();
  const last = (o.lastCallOutcome || "").toUpperCase();
  const fu = (o.followUpStatus || "").toUpperCase();
  return s === "DELIVERED" || s === "CANCELLED" || d === "DELIVERED" || TERMINAL_OUTCOMES.has(last) || TERMINAL_OUTCOMES.has(fu);
};

function extractErr(e: unknown, fallback = "Request failed"): string {
  const raw = e instanceof Error ? e.message : String(e || fallback);
  try {
    const p = JSON.parse(raw);
    const first = p?.errors?.[0]?.defaultMessage || p?.errors?.[0]?.message || p?.message || p?.error;
    if (first && typeof first === "string") return first;
  } catch { /* not json */ }
  return raw || fallback;
}

const normState = (s?: string) => (s || "").trim().toLowerCase();

function SalesRepFollowUpPage() {
  const user = useCurrentUser()!;
  const [tab, setTab] = useState<Tab>("mine");
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<TreatmentOutcome>("FOLLOW_UP");
  const [note, setNote] = useState("");
  const [nextAt, setNextAt] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [stockRows, setStockRows] = useState<DeliveryAgentStockRow[]>([]);
  const [deliveryAgentId, setDeliveryAgentId] = useState<string>("");
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);


  const load = async () => {
    setLoading(true);
    try {
      const data = await listOrders();
      setOrders(data);
    } catch (e) { toast.error(extractErr(e, "Failed to load queue")); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  useEffect(() => {
    apiListUsers().then(setUsers).catch(() => setUsers([]));
    listProducts().then(setProducts).catch(() => setProducts([]));
    listCohorts(false).then(setCohorts).catch(() => setCohorts([]));
  }, []);

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const sameCohortUserIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of cohorts) {
      if (c.active === false) continue;
      const ids = (c.members || []).map((m) => m.userId);
      if (ids.includes(user.id)) ids.forEach((id) => s.add(id));
    }
    return s;
  }, [cohorts, user.id]);

  const userById = useMemo(() => {
    const m = new Map<string, BackendUser>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  const productById = useMemo(() => {
    const m = new Map<string, ApiProduct>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    let items = orders;
    if (tab === "completed") {
      items = items.filter(isCompleted);
      if (tab === "completed") {
        // For completed, do not further restrict by assignment; show all completed.
      }
    } else {
      // Active queues exclude completed orders so delivered ones leave the queue.
      items = items.filter((o) => !isCompleted(o));
      if (tab === "mine") {
        items = items.filter((o) => assignedIdOf(o) === user.id);
      }
    }
    if (q.trim()) {
      const t = q.toLowerCase();
      items = items.filter((o) => o.customerName?.toLowerCase().includes(t) || o.phone?.includes(t) || (o.code || "").toLowerCase().includes(t));
    }
    return items.slice().sort((a, b) => {
      if (tab === "completed") {
        return (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "");
      }
      const now = Date.now();
      const dueOf = (o: ApiOrder) => {
        const raw = (o as any).nextFollowUpAt || o.nextFollowUpDate || "";
        if (!raw) return null;
        const t = new Date(raw).getTime();
        return isFinite(t) ? t : null;
      };
      const aDueTs = dueOf(a);
      const bDueTs = dueOf(b);
      const aDue = aDueTs != null && aDueTs <= now ? 0 : 1;
      const bDue = bDueTs != null && bDueTs <= now ? 0 : 1;
      if (aDue !== bDue) return aDue - bDue;
      const aUnassigned = !assignedIdOf(a) ? 0 : 1;
      const bUnassigned = !assignedIdOf(b) ? 0 : 1;
      if (aUnassigned !== bUnassigned) return aUnassigned - bUnassigned;
      return (b.callAttempts ?? 0) - (a.callAttempts ?? 0);
    });
  }, [orders, q, tab, user.id]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of orders) {
      const k = (o.followUpStatus || o.lastCallOutcome || "PENDING").toUpperCase();
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [orders]);

  const openOrder = useMemo(() => orders.find((o) => o.id === openId) || null, [orders, openId]);

  const loadAgents = async () => {
    setLoadingAgents(true);
    try {
      const [ags, stock] = await Promise.all([
        listDeliveryAgents({ activeOnly: true }).catch(() => [] as DeliveryAgent[]),
        deliveryAgentStockAll().catch(() => [] as DeliveryAgentStockRow[]),
      ]);
      setAgents(ags);
      setStockRows(stock);
    } finally { setLoadingAgents(false); }
  };

  const openSave = async (id: string) => {
    setOpenId(id); setOutcome("FOLLOW_UP"); setNote(""); setNextAt(""); setCustomerMessage("");
    setDeliveryAgentId("");
    await loadAgents();
  };

  // Reload agents/stock whenever the modal user switches to an in-transit outcome,
  // so the courier dropdown always has fresh data even if the earlier fetch failed.
  useEffect(() => {
    if (!openId) return;
    if (outcome === "IN_TRANSIT") { loadAgents(); }
    // eslint-disable-next-line
  }, [openId, outcome]);
  

  const currentOpt = OUTCOMES.find((o) => o.value === outcome)!;
  const needsAgent = outcome === "IN_TRANSIT" || (outcome as string) === "OUT_FOR_DELIVERY";
  const requiredQty = (openOrder?.inventoryQuantity as number | undefined) || 1;
  const productId = openOrder?.inventoryProductId as string | undefined;
  const custStateNorm = normState(openOrder?.state);

  // STRICT: only same-state active delivery agents
  const agentOptions = useMemo(() => {
    if (!openOrder) return [] as { agent: DeliveryAgent; available: number; enough: boolean }[];
    const same = agents.filter((a) => custStateNorm && normState(a.state) === custStateNorm);
    const rows = same.map((a) => {
      const available = productId
        ? stockRows
            .filter((s) => s.deliveryAgentId === a.id && s.productId === productId)
            .reduce((sum, s) => sum + (s.quantityRemaining || 0), 0)
        : 0;
      const enough = !!productId && available >= requiredQty;
      return { agent: a, available, enough };
    });
    rows.sort((x, y) => {
      if (x.enough !== y.enough) return x.enough ? -1 : 1;
      return y.available - x.available;
    });
    return rows;
  }, [agents, stockRows, openOrder, productId, requiredQty, custStateNorm]);

  const noSameStateAgent = needsAgent && !loadingAgents && agentOptions.length === 0;
  const selectedAgentRow = agentOptions.find((r) => r.agent.id === deliveryAgentId);
  const selectedAgentInsufficient = !!selectedAgentRow && !selectedAgentRow.enough;

  const canSave = !saving && (
    !needsAgent
      ? true
      : (!!deliveryAgentId && !noSameStateAgent)
  );

  const save = async () => {
    if (!openId) return;
    if (currentOpt.requiresNote && !note.trim()) return toast.error("A note is required for this outcome");
    if (currentOpt.requiresDate && !nextAt) return toast.error("Please pick a date and time");
    if (needsAgent) {
      if (noSameStateAgent) return toast.error("No active delivery agent found in this customer's state. Create or activate a delivery agent in this state first.");
      if (!deliveryAgentId) return toast.error("Select a delivery agent in the customer's state before sending this order for delivery");
    }

    setSaving(true);
    try {
      if (outcome === "DELIVERED") {
        const assignment = await getOrderDeliveryAssignment(openId).catch(() => null);
        if (!assignment || !assignment.deliveryAgentId) {
          setSaving(false);
          return toast.error("Assign a delivery agent before marking this order as delivered.");
        }
        // Stock check on assigned agent
        if (productId) {
          const available = stockRows
            .filter((s) => s.deliveryAgentId === assignment.deliveryAgentId && s.productId === productId)
            .reduce((sum, s) => sum + (s.quantityRemaining || 0), 0);
          if (available < requiredQty) {
            setSaving(false);
            return toast.error("This delivery agent does not have enough stock yet. Allocate stock before marking this order as delivered.");
          }
        }
      }
      await salesTreatment(openId, {
        outcome,
        deliveryAgentId: needsAgent ? deliveryAgentId : undefined,
        note: note.trim() || undefined,
        nextFollowUpAt: nextAt ? new Date(nextAt).toISOString() : undefined,
        customerMessage: customerMessage.trim() || undefined,
      });
      toast.success(
        needsAgent ? "Order sent for delivery successfully." :
        outcome === "DELIVERED" ? "Order marked as delivered successfully." :
        "Treatment saved"
      );
      setOpenId(null);
      load();
      if (needsAgent) {
        // Refresh delivery-related caches so the assignment shows up everywhere.
        const oid = openId;
        Promise.all([
          apiFetch(`/api/delivery-agents/orders/${oid}/assignment`).catch(() => null),
          apiFetch(`/api/delivery-agents/assignments`).catch(() => null),
          deliveryAgentStockAll().then(setStockRows).catch(() => null),
        ]);
      }
    } catch (e) { toast.error(extractErr(e, "Failed to save treatment")); }
    finally { setSaving(false); }
  };


  const claim = async (id: string) => {
    try {
      const res = await assignOrderToMe(id) as { order?: ApiOrder } | ApiOrder | undefined;
      const returned = (res && typeof res === "object" && "order" in (res as any) ? (res as any).order : res) as ApiOrder | undefined;
      if (returned && returned.id) {
        setOrders((prev) => prev.map((o) => o.id === returned.id ? { ...o, ...returned } : o));
      } else {
        // optimistic: mark this order as mine
        setOrders((prev) => prev.map((o) => o.id === id ? { ...o, assignedTo: user.id, assignedToName: user.name } : o));
      }
      toast.success("Assigned to you");
      // refresh from backend
      const [freshOrders, freshUsers] = await Promise.all([
        listOrders().catch(() => null),
        apiListUsers().catch(() => null),
      ]);
      if (freshOrders) setOrders(freshOrders);
      if (freshUsers) setUsers(freshUsers);
      setTab("mine");
    } catch (e) {
      toast.error(extractErr(e, "This order has already been assigned to another staff member."));
      load();
    }
  };

  const attemptLabel = (n: number) => n === 0 ? "1st call" : n === 1 ? "2nd call" : n === 2 ? "3rd call (final)" : "Max reached";

  const openOrderProduct = openOrder?.inventoryProductId ? productById.get(openOrder.inventoryProductId) : undefined;

  return (
    <>
      <PageHeader title="Sales Rep Follow-Up" subtitle="Customer treatment queue · 3-call circle · outcomes save to sales-treatment." />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {["PENDING","FOLLOW_UP","RESCHEDULED","CALL_BACK","NOT_ANSWERING","NUMBER_BUSY","SWITCHED_OFF","NOT_READY","CANCELLED","REJECTED","DELIVERED","IN_TRANSIT"].map((k) => (
          <Card key={k} className="p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k === "IN_TRANSIT" ? "CONFIRMED" : k.replace(/_/g," ")}</div>
            <div className="text-lg font-bold">{counts[k] || 0}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          {(["mine","all","completed"] as Tab[]).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${tab === k ? "text-white border-transparent" : "hover:bg-muted"}`}
              style={tab === k ? { background: "var(--gradient-electric)" } : undefined}>
              {k === "mine" ? "My Queue" : k === "all" ? "All Queue" : "Completed"}
            </button>
          ))}
          <button onClick={load} className="ml-auto inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, phone, code…"
            className="px-3 py-1.5 text-sm rounded-lg border bg-background outline-none w-full sm:w-72" />
        </div>
      </Card>

      {loading && orders.length === 0 ? (
        <Card><div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading queue…</div></Card>
      ) : filtered.length === 0 ? (
        <Card><Empty title={tab === "mine" ? "No orders assigned to you yet." : tab === "completed" ? "No completed orders yet." : "The queue is clear 🎉"} hint={tab === "all" ? "No pending treatments right now." : undefined} /></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((o) => {
            const n = o.callAttempts ?? 0;
            const assignedId = assignedIdOf(o);
            const mine = !!assignedId && assignedId === user.id;
            const lockedToOther = !!assignedId && !mine;
            const isPrivileged = user.role === "admin" || user.role === "manager";
            const canSeeAssignedStaff = mine || isPrivileged || (assignedId ? sameCohortUserIds.has(assignedId) : false);
            const assignedUser = assignedId ? userById.get(assignedId) : undefined;
            const assignedName = assignedNameOf(o) || assignedUser?.name || (assignedId ? `Staff ${shortStaffId({ id: assignedId })}` : "");
            const product = o.inventoryProductId ? productById.get(o.inventoryProductId) : undefined;
            const dueRaw = (o as any).nextFollowUpAt || o.nextFollowUpDate;
            const dueTs = dueRaw ? new Date(dueRaw).getTime() : NaN;
            const isDue = Number.isFinite(dueTs) && dueTs <= Date.now();
            return (
              <Card key={o.id} className={`p-4 ${lockedToOther ? "opacity-70" : ""} ${isDue ? "ring-1 ring-rose-300" : ""}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <AttemptRing attempt={n} max={3} size={48} />
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{o.customerName}</span>
                      <span className="text-xs text-muted-foreground">{o.code || o.id.slice(0, 8)}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700">{n}/3</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-700">{attemptLabel(n)}</span>
                      {isDue && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 font-semibold">Due now</span>}
                      {mine && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">Mine</span>}
                      {lockedToOther && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 inline-flex items-center gap-1"><Lock size={10} /> Locked</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>{o.packageName || "—"} · {NGN(o.price)}</span>
                      {o.state && <span>State: {o.state}</span>}
                      {o.deliveryAddress && <span>Addr: {o.deliveryAddress}</span>}
                      <span>
                        Product: {product ? (
                          <>
                            <span className="font-medium">{product.name}</span>
                            {product.sku ? <> · SKU {product.sku}</> : null}
                          </>
                        ) : o.inventoryProductId
                          ? <span className="text-amber-700">Linked product not found or product was deleted</span>
                          : <span className="text-amber-700">No linked product on this package</span>}
                      </span>
                      <span>Stock units deducted after delivery: {o.inventoryQuantity ?? 1}</span>
                      {dueRaw && (
                        isDue
                          ? <span className="text-rose-700 font-medium">Due now</span>
                          : <span>Next: {fmtDateTime(dueRaw)}</span>
                      )}
                      {assignedId ? (
                        canSeeAssignedStaff ? (
                          <span>
                            {lockedToOther ? "Claimed by: " : "Rep: "}
                            <span className="font-medium">{assignedName}</span>
                            {" · "}<span className="font-mono">Staff ID: {shortStaffId({ id: assignedId })}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Assigned to another staff</span>
                        )
                      ) : (
                        <span className="text-emerald-700">Unassigned</span>
                      )}
                      {o.deliveryAssignedToName && <span>Courier: {o.deliveryAssignedToName}</span>}
                      {o.deliveryStatus && <span>Delivery: {o.deliveryStatus.replace(/_/g, " ")}</span>}
                      <span>Stock deducted: {o.stockDeducted ? "Yes" : "No"}</span>
                      {o.lastCallOutcome && <span>Last: {o.lastCallOutcome.replace(/_/g, " ")}</span>}
                      {o.createdAt && <span>Created: {fmtDate(o.createdAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`tel:${o.phone}`} className="rounded-lg p-2 hover:bg-muted" title="Call"><Phone size={16} /></a>
                    <a href={waLink(o.whatsappNumber || o.phone)} target="_blank" rel="noreferrer" className="rounded-lg p-2 hover:bg-muted" title="WhatsApp"><MessageCircle size={16} /></a>
                    <Link to="/orders/$id" params={{ id: o.id }} className="rounded-lg p-2 hover:bg-muted" title="Open"><ExternalLink size={16} /></Link>
                    {!assignedId && (
                      <button onClick={() => claim(o.id)} className="rounded-lg px-3 py-2 text-xs border hover:bg-muted">Claim</button>
                    )}
                    {mine && (
                      <button onClick={() => openSave(o.id)} className="rounded-lg px-3 py-2 text-sm text-white font-medium"
                        style={{ background: "var(--gradient-electric)" }}>Treat</button>
                    )}
                    {lockedToOther && (
                      <button disabled title="Assigned to another staff member."
                        className="rounded-lg px-3 py-2 text-sm border text-muted-foreground cursor-not-allowed">Assigned</button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {openId && openOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !saving && setOpenId(null)}>
          <div className="w-full max-w-lg rounded-xl bg-card p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-1">Sales Rep Treatment</div>
            <div className="text-xs text-muted-foreground mb-3">Saved to <code>/api/orders/{"{id}"}/sales-treatment</code>.</div>

            <div className="rounded-lg border bg-muted/30 p-3 mb-3 text-xs space-y-1">
              <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{openOrder.customerName}</span> · {openOrder.phone}</div>
              <div><span className="text-muted-foreground">State:</span> {openOrder.state || "—"} · <span className="text-muted-foreground">Address:</span> {openOrder.deliveryAddress || "—"}</div>
              <div><span className="text-muted-foreground">Package:</span> <span className="font-medium">{openOrder.packageName || "—"}</span> · {NGN(openOrder.price)}</div>
              <div>
                <span className="text-muted-foreground">Product:</span>{" "}
                {openOrderProduct ? (
                  <><span className="font-medium">{openOrderProduct.name}</span>{openOrderProduct.sku ? <> · SKU {openOrderProduct.sku}</> : null}</>
                ) : openOrder.inventoryProductId ? <span className="text-amber-700">Linked product not found.</span> : "—"}
                {" · "}Units to deduct after delivery: <span className="font-medium">{requiredQty}</span>
              </div>
            </div>

            <label className="text-sm font-medium">Outcome</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as TreatmentOutcome)}
              className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm">
              {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {currentOpt.hint && <div className="text-[11px] text-muted-foreground mt-1">{currentOpt.hint}</div>}

            {needsAgent && (
              <div className="mt-3">
                <label className="text-sm font-medium block">Delivery Agent / Courier *</label>
                <div className="text-[11px] text-muted-foreground mb-1">
                  Only external couriers in <span className="font-medium">{openOrder.state || "the customer's state"}</span> are shown.
                </div>
                {loadingAgents ? (
                  <div className="text-xs text-muted-foreground"><Loader2 className="inline animate-spin mr-1" size={12} />Loading agents…</div>
                ) : noSameStateAgent ? (
                  <div className="text-xs text-red-700 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    No active delivery agent found in this customer's state. Create or activate a delivery agent in this state first.
                  </div>
                ) : (
                  <>
                    <select
                      value={deliveryAgentId}
                      onChange={(e) => setDeliveryAgentId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                    >
                      <option value="">— Select delivery agent —</option>
                      {agentOptions.map(({ agent, available }) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.agentName} · {agent.state || "—"} · {available} units available
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Requires {requiredQty} unit{requiredQty === 1 ? "" : "s"} of the ordered product.
                    </div>
                    {selectedAgentInsufficient && (
                      <div className="mt-2 text-xs text-amber-800 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                        Stock is not yet allocated to this agent. You can send for delivery, but allocate stock before marking Delivered.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}


            {(currentOpt.requiresDate || currentOpt.allowDate) && (
              <>
                <label className="text-sm font-medium mt-3 block">
                  Next follow-up {currentOpt.requiresDate ? "*" : "(optional)"}
                </label>
                <input type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm" />
              </>
            )}

            <label className="text-sm font-medium mt-3 block">
              Internal note {currentOpt.requiresNote ? "*" : "(optional)"}
            </label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder="What did the customer say?"
              className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm" />

            <label className="text-sm font-medium mt-3 block">Customer message (optional)</label>
            <textarea value={customerMessage} onChange={(e) => setCustomerMessage(e.target.value)} rows={2}
              placeholder="Message to send/read to the customer"
              className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm" />

            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setOpenId(null)} disabled={saving} className="px-3 py-2 rounded-lg border text-sm">Cancel</button>
              <button onClick={save} disabled={!canSave}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-60"
                style={{ background: "var(--gradient-electric)" }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Save Treatment
              </button>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
