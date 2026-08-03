import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore, useCurrentUser } from "@/lib/store";
import { PageHeader, Card } from "@/components/AppShell";
import { AccessDenied } from "@/components/AccessDenied";
import { Plus, Trash2, Loader2, RefreshCw, Users, Pencil, Power, PowerOff, Copy } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/lib/types";
import {
  apiSignup, apiListUsers, apiListRoles, apiUpdateUser,
  apiActivateUser, apiDeactivateUser, apiDeleteUser,
  getToken, mapBackendRole, prettyRole, roleLabel, shortStaffId,
  BACKEND_ROLES, type BackendRoleName, type BackendRole, type BackendUser,
} from "@/lib/api";

export const Route = createFileRoute("/_app/staff")({
  head: () => ({ meta: [{ title: "Staff — Glowbalmart CRM" }] }),
  component: StaffPage,
});




const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Owner / Admin" },
  { value: "manager", label: "Sales Manager" },
  { value: "staff", label: "Sales Staff" },
  { value: "finance", label: "Finance Officer" },
  { value: "delivery", label: "Delivery Agent" },
];
const PERMISSIONS: Record<Role, string[]> = {
  admin: ["All modules", "User management", "Settings", "Finance"],
  manager: ["Sales", "Staff", "Orders", "Reports", "Call queue"],
  staff: ["Assigned orders", "Call queue", "Customers"],
  finance: ["Finance", "Expenses", "Sales revenue", "Reports"],
  delivery: ["Delivery board", "Order delivery status"],
};

function extractErr(e: unknown, fallback = "Request failed"): string {
  const raw = e instanceof Error ? e.message : String(e || fallback);
  const low = raw.toLowerCase();
  try {
    const parsed = JSON.parse(raw);
    const first = parsed?.errors?.[0]?.defaultMessage || parsed?.errors?.[0]?.message || parsed?.message || parsed?.error;
    if (first && typeof first === "string") return first;
  } catch { /* not json */ }
  if (low.includes("exist") || low.includes("duplicate") || low.includes("already")) return "Email already exists.";
  if (low.includes("forbidden") || low.includes("permission") || low.includes("403")) return "Only Owner can perform this action.";
  if (low.includes("last") && low.includes("owner")) return "You cannot deactivate or remove the last active Owner account.";
  if (low.includes("email") && (low.includes("valid") || low.includes("well-formed"))) return "Please enter a valid email address, for example name@example.com.";
  return raw || fallback;
}

function StaffPage() {
  const current = useCurrentUser();
  const canManage = current?.role === "admin" || current?.role === "manager";
  const isOwner = current?.role === "admin";

  const [users, setUsers] = useState<BackendUser[]>([]);
  const [roles, setRoles] = useState<BackendRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [openAdd, setOpenAdd] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "",
    roleName: "SALES_REP" as BackendRoleName,
  });

  const [editing, setEditing] = useState<BackendUser | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", email: "", phone: "", password: "",
    roleName: "SALES_REP" as BackendRoleName, active: true,
  });

  const refresh = async () => {
    if (!getToken()) return;
    setLoading(true);
    try { setUsers(await apiListUsers()); }
    catch (e) { toast.error(extractErr(e, "Failed to load staff")); }
    finally { setLoading(false); setLoadedOnce(true); }
  };
  useEffect(() => {
    if (!canManage) return;
    refresh();
    apiListRoles().then(setRoles).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const isInventoryManager = current?.roleName === "INVENTORY_MANAGER";
  const RESTRICTED_ROLES = new Set(["OWNER", "ADMIN", "ACCOUNTANT", "SALES_MANAGER"]);
  const roleOptions = useMemo(() => {
    // Merge backend roles with the known frontend role list so Owner/Admin always
    // see Sales Manager, Media Buyer, WhatsApp Marketer, etc. even if /api/roles is thin.
    const seen = new Map<string, { value: string; label: string }>();
    for (const r of roles) {
      const v = String(r.name || "").toUpperCase();
      if (v) seen.set(v, { value: v, label: roleLabel(v) });
    }
    for (const r of BACKEND_ROLES) {
      const v = String(r).toUpperCase();
      if (!seen.has(v)) seen.set(v, { value: v, label: roleLabel(v) });
    }
    // MEDIA_PROMOTER and MEDIA_BUYER share a label — keep only one entry.
    if (seen.has("MEDIA_BUYER")) seen.delete("MEDIA_PROMOTER");
    const all = [...seen.values()];
    return isInventoryManager ? all.filter(r => !RESTRICTED_ROLES.has(String(r.value).toUpperCase())) : all;
  }, [roles, isInventoryManager]);

  const save = async () => {
    if (!form.name || !form.email || !form.password) return toast.error("Name, email and password are required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return toast.error("Please enter a valid email address, for example name@example.com.");
    setAddSaving(true);
    try {
      await apiSignup(getToken()!, {
        name: form.name, email: form.email.trim(), password: form.password,
        phone: form.phone || undefined, roleName: form.roleName,
      });
      toast.success("Staff created successfully.");
      setOpenAdd(false);
      setForm({ name: "", email: "", phone: "", password: "", roleName: "SALES_REP" });
      refresh();
    } catch (e) { toast.error(extractErr(e, "Failed to create staff")); }
    finally { setAddSaving(false); }
  };

  const openEdit = (u: BackendUser) => {
    setEditing(u);
    setEditForm({
      name: u.name || "", email: u.email || "", phone: u.phone || "", password: "",
      roleName: (u.roleName as BackendRoleName) || "SALES_REP", active: !!u.active,
    });
  };
  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.name || !editForm.email) return toast.error("Name and email are required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim()))
      return toast.error("Please enter a valid email address, for example name@example.com.");
    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name, email: editForm.email.trim(), phone: editForm.phone || undefined,
        roleName: editForm.roleName, active: editForm.active,
      };
      if (editForm.password.trim()) payload.password = editForm.password;
      await apiUpdateUser(editing.id, payload as any);
      toast.success("Staff updated successfully.");
      setEditing(null);
      refresh();
    } catch (e) { toast.error(extractErr(e, "Failed to update staff")); }
    finally { setEditSaving(false); }
  };

  const doActivate = async (u: BackendUser) => {
    setBusyId(u.id);
    try { await apiActivateUser(u.id); toast.success("Staff activated successfully."); refresh(); }
    catch (e) { toast.error(extractErr(e, "Failed to activate")); }
    finally { setBusyId(null); }
  };
  const doDeactivate = async (u: BackendUser) => {
    if (current && u.id === current.id) return toast.error("You cannot deactivate your own owner account.");
    setBusyId(u.id);
    try { await apiDeactivateUser(u.id); toast.success("Staff deactivated successfully."); refresh(); }
    catch (e) { toast.error(extractErr(e, "Failed to deactivate")); }
    finally { setBusyId(null); }
  };
  const doDelete = async (u: BackendUser) => {
    if (current && u.id === current.id) return toast.error("You cannot delete your own owner account.");
    if (!confirm("Delete this staff member? This cannot be undone.")) return;
    setBusyId(u.id);
    try { await apiDeleteUser(u.id); toast.success("Staff deleted successfully."); refresh(); }
    catch (e) { toast.error(extractErr(e, "Failed to delete")); }
    finally { setBusyId(null); }
  };

  const copyId = (id: string) => {
    navigator.clipboard?.writeText(id).then(() => toast.success("Full staff ID copied")).catch(() => {});
  };

  if (!canManage) return <AccessDenied allowed={["admin", "manager"]} role={current?.role ?? "staff"} />;

  return (
    <>
      <PageHeader
        title="Staff & Roles"
        subtitle="Create, edit, activate, deactivate or remove internal staff."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={refresh} disabled={loading} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
            </button>
            <button onClick={() => setOpenAdd(true)} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}>
              <Plus size={14} /> Add Staff
            </button>
          </div>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>{["Staff ID","Name","Email","Phone","Role","Status","Created","Actions"].map((h) => <th key={h} className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading && users.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading staff…</td></tr>
              )}
              {!loading && loadedOnce && users.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground"><Users className="inline mr-2" size={14} /> No staff yet.</td></tr>
              )}
              {users.map((u) => {
                const isSelf = current?.id === u.id;
                return (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2 text-xs font-mono">
                      <button onClick={() => copyId(u.id)} className="inline-flex items-center gap-1 hover:underline" title={`Copy full ID: ${u.id}`}>
                        {shortStaffId(u)} <Copy size={10} className="opacity-50" />
                      </button>
                    </td>
                    <td className="px-3 py-2 font-medium">{u.name}{isSelf && <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>}</td>
                    <td className="px-3 py-2 text-xs">{u.email}</td>
                    <td className="px-3 py-2 text-xs">{u.phone || "—"}</td>
                    <td className="px-3 py-2 text-xs">{u.roleName ? prettyRole(u.roleName) : (u.roleDisplayName || "—")}</td>
                    <td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${u.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{u.active ? "Active" : "Inactive"}</span></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button disabled={busyId === u.id} onClick={() => openEdit(u)} className="text-xs px-2 py-1 rounded border hover:bg-muted inline-flex items-center gap-1" title="Edit"><Pencil size={11} /> Edit</button>
                        {u.active ? (
                          <button disabled={busyId === u.id || isSelf} onClick={() => doDeactivate(u)} className="text-xs px-2 py-1 rounded border hover:bg-muted inline-flex items-center gap-1 disabled:opacity-50" title="Deactivate"><PowerOff size={11} /> Deactivate</button>
                        ) : (
                          <button disabled={busyId === u.id} onClick={() => doActivate(u)} className="text-xs px-2 py-1 rounded border hover:bg-muted inline-flex items-center gap-1 text-emerald-700" title="Activate"><Power size={11} /> Activate</button>
                        )}
                        {isOwner && (
                          <button disabled={busyId === u.id || isSelf} onClick={() => doDelete(u)} className="text-xs px-2 py-1 rounded border hover:bg-rose-50 text-rose-600 inline-flex items-center gap-1 disabled:opacity-50" title="Delete"><Trash2 size={11} /> Delete</button>
                        )}
                        {busyId === u.id && <Loader2 size={12} className="animate-spin ml-1" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4 mt-4">
        <div className="font-semibold mb-3">Role Permissions</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ROLES.map((r) => (
            <div key={r.value} className="rounded-lg border p-3">
              <div className="font-medium text-sm capitalize">{r.label}</div>
              <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                {PERMISSIONS[r.value].map((p) => <li key={p}>• {p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {openAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !addSaving && setOpenAdd(false)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-3">Add Staff</div>
            <div className="space-y-2">
              <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
              <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
              <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
              <select value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value as BackendRoleName })} className="w-full px-3 py-2 rounded border bg-background">
                {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpenAdd(false)} disabled={addSaving} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={save} disabled={addSaving} className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                {addSaving && <Loader2 size={14} className="animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !editSaving && setEditing(null)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-1">Edit Staff</div>
            <div className="text-[11px] font-mono text-muted-foreground mb-3">Staff ID: {shortStaffId(editing)}</div>
            <div className="space-y-2">
              <input placeholder="Full name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
              <input placeholder="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
              <input placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
              <select value={editForm.roleName} onChange={(e) => setEditForm({ ...editForm, roleName: e.target.value as BackendRoleName })} className="w-full px-3 py-2 rounded border bg-background">
                {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input placeholder="New password (optional)" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} disabled={editSaving} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving} className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                {editSaving && <Loader2 size={14} className="animate-spin" />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
