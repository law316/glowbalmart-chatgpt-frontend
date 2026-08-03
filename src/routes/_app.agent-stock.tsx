import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { AccessDenied } from "@/components/AccessDenied";
import { useCurrentUser } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";
import {
  listDeliveryAgents, deliveryAgentsSummary,
  deliveryAgentStockAll, deliveryAgentStockLow, deliveryAgentStockMovements,
  deliveryAgentAllocate, deliveryAgentAdjust, deliveryAgentReturn,
  deliveryAgentTransfer,
  createDAAllocation, listDAAllocationsInTransit, receiveDAAllocation,
  listActiveProducts,
  type DeliveryAgent, type DeliveryAgentSummary,
  type DeliveryAgentStockRow, type DeliveryAgentMovement,
  type DAAllocation,
  type ApiProduct,
} from "@/lib/api";
import { Loader2, RefreshCw, Send, AlertTriangle, PackageMinus, RotateCcw, ArrowLeftRight, PackageCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/agent-stock")({
  head: () => ({ meta: [{ title: "Delivery Agent Stock — Glowbalmart CRM" }] }),
  component: AgentStockPage,
});

type ActionKind = "allocate" | "adjust" | "return" | "transfer";

function AgentStockPage() {
  const current = useCurrentUser();
  const canManage = current?.role === "admin" || current?.role === "manager";

  const [sum, setSum] = useState<DeliveryAgentSummary | null>(null);
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [rows, setRows] = useState<DeliveryAgentStockRow[]>([]);
  const [low, setLow] = useState<DeliveryAgentStockRow[]>([]);
  const [moves, setMoves] = useState<DeliveryAgentMovement[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [inTransit, setInTransit] = useState<DAAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  const [action, setAction] = useState<ActionKind | null>(null);
  const [form, setForm] = useState({
    deliveryAgentId: "", toDeliveryAgentId: "", productId: "", quantity: 0, quantityChange: 0,
    lowStockThreshold: 5, note: "", state: "", location: "",
  });
  const [saving, setSaving] = useState(false);

  const agentById = (id?: string) => agents.find((a) => a.id === id);
  const displayAgentName = (row: { deliveryAgentId?: string; deliveryAgentName?: string; agentName?: string; name?: string }) =>
    row.deliveryAgentName || row.agentName || (row as any).name || agentById(row.deliveryAgentId)?.agentName || row.deliveryAgentId || "—";
  const agentField = (row: { deliveryAgentId?: string }, field: "agentCode" | "contactPhone" | "email" | "state") => {
    const a = agentById(row.deliveryAgentId);
    return a ? (a as any)[field] : undefined;
  };

  const load = async () => {
    setLoading(true);
    try {
      const [s, a, r, l, m, p, it] = await Promise.all([
        deliveryAgentsSummary().catch(() => null),
        listDeliveryAgents({ activeOnly: true }).catch(() => []),
        deliveryAgentStockAll().catch(() => []),
        deliveryAgentStockLow().catch(() => []),
        deliveryAgentStockMovements().catch(() => []),
        listActiveProducts().catch(() => []),
        listDAAllocationsInTransit().catch(() => []),
      ]);
      setSum(s); setAgents(a); setRows(r); setLow(l); setMoves(m); setProducts(p); setInTransit(it);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setLoadedOnce(true); }
  };
  useEffect(() => { load(); }, []);

  const openAction = (kind: ActionKind, row?: DeliveryAgentStockRow) => {
    setAction(kind);
    setForm({
      deliveryAgentId: row?.deliveryAgentId || "",
      toDeliveryAgentId: "",
      productId: row?.productId || "",
      quantity: 0, quantityChange: 0,
      lowStockThreshold: row?.lowStockThreshold ?? 5,
      note: "", state: "", location: "",
    });
  };

  const save = async () => {
    if (!action) return;
    if (!form.deliveryAgentId || !form.productId) { toast.error("Select delivery agent and product"); return; }
    if (action === "transfer" && !form.toDeliveryAgentId) { toast.error("Select destination agent"); return; }
    if (action === "transfer" && form.toDeliveryAgentId === form.deliveryAgentId) { toast.error("Destination must differ from source"); return; }
    setSaving(true);
    try {
      if (action === "transfer") {
        if (form.quantity <= 0) throw new Error("Quantity must be greater than 0");
        await deliveryAgentTransfer({
          fromDeliveryAgentId: form.deliveryAgentId,
          toDeliveryAgentId: form.toDeliveryAgentId,
          productId: form.productId,
          quantity: Number(form.quantity),
          lowStockThreshold: Number(form.lowStockThreshold),
          note: form.note || undefined,
        });
        toast.success("Stock transferred between agents");
      } else if (action === "allocate") {
        if (form.quantity <= 0) throw new Error("Quantity must be greater than 0");
        await createDAAllocation({
          deliveryAgentId: form.deliveryAgentId, productId: form.productId,
          quantity: Number(form.quantity),
          state: form.state || agentById(form.deliveryAgentId)?.state || undefined,
          location: form.location || undefined,
          lowStockThreshold: Number(form.lowStockThreshold),
          note: form.note || undefined,
        } as any);
        toast.success("Stock sent to delivery agent — in transit");
      } else if (action === "adjust") {
        if (!form.quantityChange) throw new Error("Enter a non-zero adjustment");
        await deliveryAgentAdjust({
          deliveryAgentId: form.deliveryAgentId, productId: form.productId,
          quantityChange: Number(form.quantityChange), note: form.note || undefined,
        });
        toast.success("Stock adjusted");
      } else {
        if (form.quantity <= 0) throw new Error("Quantity must be greater than 0");
        await deliveryAgentReturn({
          deliveryAgentId: form.deliveryAgentId, productId: form.productId,
          quantity: Number(form.quantity), note: form.note || undefined,
        });
        toast.success("Stock returned to warehouse");
      }
      setAction(null);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const markReceived = async (allocationId: string) => {
    setReceivingId(allocationId);
    try {
      await receiveDAAllocation(allocationId, "Received by agent");
      toast.success("Allocation marked as received");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setReceivingId(null); }
  };

  if (!canManage) return <AccessDenied allowed={["admin", "manager"]} role={current?.role ?? "staff"} />;

  return (
    <>
      <PageHeader
        title="Delivery Agent Stock"
        subtitle="Stock allocated to external delivery agents and courier partners."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
            </button>
            <button onClick={() => openAction("transfer")} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
              <ArrowLeftRight size={14} /> Transfer Between Agents
            </button>
            <button onClick={() => openAction("allocate")} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}>
              <Send size={14} /> Send Stock to Agent
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Total Agents</div><div className="text-2xl font-bold">{sum?.totalAgents ?? agents.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Active</div><div className="text-2xl font-bold text-emerald-600">{sum?.activeAgents ?? 0}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Agents with Stock</div><div className="text-2xl font-bold">{sum?.agentsWithStock ?? 0}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Qty Remaining</div><div className="text-2xl font-bold">{(sum?.totalQuantityRemaining ?? 0).toLocaleString()}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Low Stock</div><div className="text-2xl font-bold text-amber-600">{sum?.lowStockRows ?? low.length}</div></Card>
      </div>

      <Card className="mb-4">
        <div className="p-3 border-b font-semibold">Delivery Agent Stock</div>
        {loading && rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : loadedOnce && rows.length === 0 ? (
          <Empty title="No delivery agent stock yet" hint="Click Send Stock to Agent to allocate inventory." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>{["Agent / Company","Code","Phone","Email","State / Location","Product","SKU","Allocated","Received/Available","Remaining","Threshold","Status","Updated",""].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{displayAgentName(r)}</td>
                    <td className="px-3 py-2 text-xs font-mono">{r.agentCode || agentField(r, "agentCode") || "—"}</td>
                    <td className="px-3 py-2 text-xs">{agentField(r, "contactPhone") || "—"}</td>
                    <td className="px-3 py-2 text-xs">{agentField(r, "email") || "—"}</td>
                    <td className="px-3 py-2 text-xs">{(r as any).state || (r as any).location || agentField(r, "state") || "—"}</td>
                    <td className="px-3 py-2">{r.productName || r.productId}</td>
                    <td className="px-3 py-2 text-xs">{r.productSku || "—"}</td>
                    <td className="px-3 py-2">{(r.quantityAllocated ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2">{(r.quantityRemaining ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 font-semibold">{(r.quantityRemaining ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs">{r.lowStockThreshold ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.lowStock || (r.lowStockThreshold != null && r.quantityRemaining <= r.lowStockThreshold) ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1"><AlertTriangle size={10}/> Low</span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">OK</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.updatedAt ? fmtDateTime(r.updatedAt) : "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => openAction("adjust", r)} className="text-xs px-2 py-1 rounded border hover:bg-muted inline-flex items-center gap-1"><PackageMinus size={12}/> Adjust</button>
                        <button onClick={() => openAction("return", r)} className="text-xs px-2 py-1 rounded border hover:bg-muted inline-flex items-center gap-1"><RotateCcw size={12}/> Return</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {low.length > 0 && (
        <Card className="mb-4">
          <div className="p-3 border-b font-semibold text-amber-700 flex items-center gap-2"><AlertTriangle size={14}/> Low Stock ({low.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Agent","Product","SKU","Remaining","Threshold"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {low.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{displayAgentName(r)}</td>
                    <td className="px-3 py-2">{r.productName}</td>
                    <td className="px-3 py-2 text-xs">{r.productSku || "—"}</td>
                    <td className="px-3 py-2 text-amber-600 font-semibold">{r.quantityRemaining}</td>
                    <td className="px-3 py-2 text-xs">{r.lowStockThreshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="p-3 border-b font-semibold flex items-center gap-2"><Send size={14}/> In Transit ({inTransit.length})</div>
        {inTransit.length === 0 ? (
          <Empty title="No allocations in transit" hint="Sent stock awaiting agent receipt confirmation will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>{["Product","SKU","Qty","Agent","Code","Phone","Email","State / Location","Sent By","Sent At","Status",""].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr>
              </thead>
              <tbody>
                {inTransit.map((t) => {
                  const agentIdField = t.deliveryAgentId;
                  const a = agentById(agentIdField);
                  return (
                    <tr key={t.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">{t.productName || t.productId || "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.productSku || t.sku || "—"}</td>
                      <td className="px-3 py-2 font-semibold">{(t.quantity ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-2 font-medium">{t.deliveryAgentName || t.agentName || a?.agentName || agentIdField || "—"}</td>
                      <td className="px-3 py-2 text-xs font-mono">{t.agentCode || a?.agentCode || "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.contactPhone || t.phone || a?.contactPhone || "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.email || a?.email || "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.state || t.location || a?.state || "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.sentByName || "—"}</td>
                      <td className="px-3 py-2 text-xs">{(t.sentAt || t.createdAt) ? fmtDateTime((t.sentAt || t.createdAt) as string) : "—"}</td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t.status || "IN_TRANSIT"}</span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => markReceived(t.allocationId || t.id)}
                          disabled={receivingId === (t.allocationId || t.id)}
                          className="text-xs px-2 py-1 rounded border hover:bg-muted inline-flex items-center gap-1 disabled:opacity-60"
                        >
                          {receivingId === (t.allocationId || t.id) ? <Loader2 size={12} className="animate-spin" /> : <PackageCheck size={12} />} Mark as Received
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="p-3 border-b font-semibold">Stock Movements</div>
        {moves.length === 0 ? (
          <Empty title="No movements yet" hint="Allocations, adjustments, returns and deliveries will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>{["Date","Agent","Product","SKU","Type","Change","Prev","New","Order","Note","By"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr>
              </thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2 text-xs">{m.createdAt ? fmtDateTime(m.createdAt) : "—"}</td>
                    <td className="px-3 py-2">{displayAgentName(m) || "—"}</td>
                    <td className="px-3 py-2">{m.productName || "—"}</td>
                    <td className="px-3 py-2 text-xs">{m.productSku || "—"}</td>
                    <td className="px-3 py-2 text-xs"><span className="px-2 py-0.5 rounded-full bg-muted">{m.movementType || "—"}</span></td>
                    <td className={`px-3 py-2 font-medium ${(m.quantityChange ?? 0) < 0 ? "text-rose-600" : "text-emerald-600"}`}>{m.quantityChange ?? m.quantity ?? 0}</td>
                    <td className="px-3 py-2 text-xs">{m.previousQuantity ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{m.newQuantity ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{m.orderCode || "—"}</td>
                    <td className="px-3 py-2 text-xs">{m.note || "—"}</td>
                    <td className="px-3 py-2 text-xs">{m.recordedByName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {action && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setAction(null)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-1 capitalize">
              {action === "allocate" ? "Send Stock to Delivery Agent"
                : action === "adjust" ? "Adjust Agent Stock"
                : action === "transfer" ? "Transfer Stock Between Agents"
                : "Return Stock to Warehouse"}
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {action === "allocate" && "Moves inventory from central stock to the external delivery agent."}
              {action === "adjust" && "Correction only. Use a negative number to reduce."}
              {action === "return" && "Sends units back from the agent to central inventory."}
              {action === "transfer" && "Moves stock from one delivery agent to another without touching central inventory."}
            </div>

            <label className="text-sm font-medium">{action === "transfer" ? "From Agent" : "Delivery Agent / Courier Company"}</label>
            <select value={form.deliveryAgentId} onChange={(e) => setForm({ ...form, deliveryAgentId: e.target.value })} className="mt-1 mb-2 w-full px-3 py-2 rounded border bg-background text-sm">
              <option value="">Select delivery agent…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.agentName}{a.state ? ` · ${a.state}` : ""}</option>)}
            </select>

            {action === "transfer" && (
              <>
                <label className="text-sm font-medium">To Agent</label>
                <select value={form.toDeliveryAgentId} onChange={(e) => setForm({ ...form, toDeliveryAgentId: e.target.value })} className="mt-1 mb-2 w-full px-3 py-2 rounded border bg-background text-sm">
                  <option value="">Select destination agent…</option>
                  {agents.filter((a) => a.id !== form.deliveryAgentId).map((a) => <option key={a.id} value={a.id}>{a.agentName}{a.state ? ` · ${a.state}` : ""}</option>)}
                </select>
              </>
            )}

            <label className="text-sm font-medium">Product</label>
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="mt-1 mb-2 w-full px-3 py-2 rounded border bg-background text-sm">
              <option value="">Select product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""} — stock {p.stockQuantity}</option>)}
            </select>

            {action === "adjust" ? (
              <>
                <label className="text-sm font-medium">Quantity change (e.g. -2)</label>
                <input type="number" value={form.quantityChange} onChange={(e) => setForm({ ...form, quantityChange: +e.target.value })} className="mt-1 mb-2 w-full px-3 py-2 rounded border bg-background text-sm" />
              </>
            ) : (
              <>
                <label className="text-sm font-medium">Quantity</label>
                <input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} className="mt-1 mb-2 w-full px-3 py-2 rounded border bg-background text-sm" />
              </>
            )}

            {(action === "allocate" || action === "transfer") && (
              <>
                <label className="text-sm font-medium">Low stock threshold {action === "transfer" ? "(for destination)" : ""}</label>
                <input type="number" min={0} value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: +e.target.value })} className="mt-1 mb-2 w-full px-3 py-2 rounded border bg-background text-sm" />
              </>
            )}

            {action === "allocate" && (
              <>
                <label className="text-sm font-medium">State (optional, defaults to agent state)</label>
                <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-1 mb-2 w-full px-3 py-2 rounded border bg-background text-sm" placeholder={agentById(form.deliveryAgentId)?.state || "State"} />
                <label className="text-sm font-medium">Location (optional)</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 mb-2 w-full px-3 py-2 rounded border bg-background text-sm" placeholder="Delivery location / address" />
              </>
            )}

            <label className="text-sm font-medium">Note</label>
            <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full px-3 py-2 rounded border bg-background text-sm" />

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAction(null)} disabled={saving} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
