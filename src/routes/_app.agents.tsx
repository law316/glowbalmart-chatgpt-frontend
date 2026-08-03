import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { AccessDenied } from "@/components/AccessDenied";
import { useCurrentUser } from "@/lib/store";
import { NIGERIAN_STATES } from "@/lib/states";
import { Plus, Truck, RefreshCw, Loader2, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import {
  listDeliveryAgents, deliveryAgentsSummary, createDeliveryAgent, updateDeliveryAgent,
  ownerDeleteDeliveryAgent,
  type DeliveryAgent, type DeliveryAgentSummary, type DeliveryAgentStatus,
} from "@/lib/api";

export const Route = createFileRoute("/_app/agents")({
  head: () => ({ meta: [{ title: "Delivery Agents / Courier Partners — Glowbalmart CRM" }] }),
  component: AgentsPage,
});

const STATUS_OPTS: DeliveryAgentStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];

const STATES_WITH_FCT = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT Abuja","Gombe",
  "Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos",
  "Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto",
  "Taraba","Yobe","Zamfara",
];
// keep the standard list too in case backend prefers "FCT - Abuja"
void NIGERIAN_STATES;

function AgentsPage() {
  const current = useCurrentUser();
  const canManage = current?.role === "admin" || current?.role === "manager";
  const isOwner = current?.role === "admin";

  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [summary, setSummary] = useState<DeliveryAgentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [q, setQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryAgent | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    agentName: "", states: ["Lagos"] as string[], status: "ACTIVE" as DeliveryAgentStatus,
    contactPhone: "", email: "", notes: "",
  });

  const toggleState = (st: string) => {
    setForm((f) => {
      const has = f.states.includes(st);
      const next = has ? f.states.filter((x) => x !== st) : [...f.states, st];
      return { ...f, states: next };
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([
        listDeliveryAgents(activeOnly ? { activeOnly: true } : undefined).catch((e) => { throw e; }),
        deliveryAgentsSummary().catch(() => null),
      ]);
      setAgents(a); setSummary(s);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setLoadedOnce(true); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeOnly]);

  if (!canManage) return <AccessDenied allowed={["admin", "manager"]} role={current?.role ?? "staff"} />;

  const openCreate = () => {
    setEditing(null);
    setForm({ agentName: "", states: ["Lagos"], status: "ACTIVE", contactPhone: "", email: "", notes: "" });
    setOpen(true);
  };
  const openEdit = (a: DeliveryAgent) => {
    setEditing(a);
    const existingStates = (a as any).states || (a as any).locations || (a.state ? [a.state] : []);
    setForm({
      agentName: a.agentName || "",
      states: existingStates.length ? existingStates : ["Lagos"],
      status: (a.status || "ACTIVE") as DeliveryAgentStatus,
      contactPhone: a.contactPhone || "", email: a.email || "", notes: a.notes || "",
    });
    setOpen(true);
  };
  const save = async () => {
    if (!form.agentName.trim()) { toast.error("Agent / Company Name is required"); return; }
    if (form.states.length === 0) { toast.error("Select at least one state / location"); return; }
    setSaving(true);
    const payload = {
      agentName: form.agentName,
      agentCode: editing?.agentCode,
      contactPhone: form.contactPhone,
      email: form.email,
      status: form.status,
      state: form.states[0],
      states: form.states,
      locations: form.states,
      notes: form.notes,
    };
    try {
      if (editing) {
        await updateDeliveryAgent(editing.id, payload);
        toast.success("Delivery agent updated");
      } else {
        await createDeliveryAgent(payload);
        toast.success("Delivery agent created");
      }
      setOpen(false);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const removeAgent = async (a: DeliveryAgent) => {
    if (!confirm(`Delete delivery agent "${a.agentName}"? This cannot be undone.`)) return;
    try {
      await ownerDeleteDeliveryAgent(a.id);
      toast.success("Delivery agent deleted");
      setAgents((prev) => prev.filter((x) => x.id !== a.id));
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const agentStates = (a: DeliveryAgent): string[] => {
    const arr = (a as any).states || (a as any).locations;
    if (Array.isArray(arr) && arr.length) return arr;
    return a.state ? [a.state] : [];
  };

  const filtered = agents.filter((a) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [a.agentName, a.agentCode, ...agentStates(a), a.contactPhone, a.email].some((v) => (v || "").toLowerCase().includes(s));
  });

  return (
    <>
      <PageHeader
        title="Delivery Agents / Courier Partners"
        subtitle="External delivery agents and courier companies who receive inventory stock and deliver products."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
            </button>
            <button onClick={openCreate} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}>
              <Plus size={14} /> Add Agent
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Total Agents</div><div className="text-2xl font-bold">{summary?.totalAgents ?? agents.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Active Agents</div><div className="text-2xl font-bold text-emerald-600">{summary?.activeAgents ?? agents.filter((a) => a.status === "ACTIVE").length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Agents with Stock</div><div className="text-2xl font-bold">{summary?.agentsWithStock ?? 0}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Qty Remaining</div><div className="text-2xl font-bold">{(summary?.totalQuantityRemaining ?? 0).toLocaleString()}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Low Stock Rows</div><div className="text-2xl font-bold text-amber-600">{summary?.lowStockRows ?? 0}</div></Card>
      </div>

      <Card className="mb-4">
        <div className="p-3 border-b flex flex-wrap items-center gap-2">
          <div className="font-semibold mr-auto">Agents</div>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Active only
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-2.5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-7 pr-2 py-1.5 rounded border bg-background text-sm" />
          </div>
        </div>

        {loading && agents.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : loadedOnce && filtered.length === 0 ? (
          <Empty title="No delivery agents yet" hint="Click Add Agent to onboard a courier company." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>{["Agent / Company","Code","Phone","Email","Locations / States","Status","Products","Qty Remaining","Low Stock",""].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: "var(--gradient-electric)" }}><Truck size={14} /></div>
                        <div>
                          <div>{a.agentName}</div>
                          {a.notes && <div className="text-[11px] text-muted-foreground line-clamp-1">{a.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">{a.agentCode || "—"}</td>
                    <td className="px-3 py-2 text-xs">{a.contactPhone || "—"}</td>
                    <td className="px-3 py-2 text-xs">{a.email || "—"}</td>
                    <td className="px-3 py-2 text-xs">{agentStates(a).length ? agentStates(a).join(", ") : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        a.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700"
                        : a.status === "SUSPENDED" ? "bg-rose-100 text-rose-700"
                        : "bg-slate-200 text-slate-600"
                      }`}>{a.status || (a.active ? "ACTIVE" : "INACTIVE")}</span>
                    </td>
                    <td className="px-3 py-2">{a.totalProducts ?? 0}</td>
                    <td className="px-3 py-2 font-semibold">{(a.totalQuantityRemaining ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {a.lowStockRows && a.lowStockRows > 0
                        ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1"><AlertTriangle size={10}/> {a.lowStockRows}</span>
                        : <span className="text-[11px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 space-x-1 whitespace-nowrap">
                      <button onClick={() => openEdit(a)} className="text-xs px-2 py-1 rounded border hover:bg-muted">Edit</button>
                      {isOwner && (
                        <button onClick={() => removeAgent(a)} className="text-xs px-2 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-3 flex items-center gap-2"><Truck size={16} /> {editing ? "Edit Agent" : "Add Agent"}</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Agent / Company Name *</label>
                <input value={form.agentName} onChange={(e) => setForm({ ...form, agentName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">States / Locations (select one or more) *</label>
                <div className="mt-1 max-h-40 overflow-y-auto border rounded p-2 grid grid-cols-2 gap-1">
                  {STATES_WITH_FCT.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={form.states.includes(s)} onChange={() => toggleState(s)} /> {s}
                    </label>
                  ))}
                </div>
                {form.states.length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-1">Selected: {form.states.join(", ")}</div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DeliveryAgentStatus })} className="w-full mt-1 px-3 py-2 rounded border bg-background text-sm">
                  {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Contact Phone</label>
                <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={saving} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                {saving && <Loader2 size={14} className="animate-spin" />} {editing ? "Save Changes" : "Add Agent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
