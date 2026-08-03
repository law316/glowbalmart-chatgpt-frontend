import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty, PrimaryBtn } from "@/components/ModulePage";
import { Plus, Shield, ShieldCheck, X, Loader2, RefreshCw, Save, Users, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  apiListRoles,
  apiCreateRole,
  apiUpdateRole,
  apiActivateRole,
  apiDeactivateRole,
  apiListUsers,
  apiUpdateUser,
  roleLabel,
  shortStaffId,
  type BackendRole,
  type BackendUser,
  type BackendRoleName,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/store";

export const Route = createFileRoute("/_app/roles-permissions")({
  head: () => ({ meta: [{ title: "Roles & Permissions — Glowbalmart CRM" }] }),
  component: RolesPage,
});

const DEFAULT_PERMS = [
  "users:read", "users:create", "users:update", "users:delete",
  "roles:read", "roles:create", "roles:update",
  "orders:read", "orders:update", "orders:assign",
  "sales:read", "sales:update", "cohorts:read", "cohorts:create", "cohorts:update",
  "inventory:read", "inventory:update", "agent-stock:read", "agent-stock:update",
  "delivery:read", "delivery:update", "marketing:read", "marketing:create", "marketing:update",
  "finance:read", "finance:update", "reports:read", "reports:sales", "reports:finance",
  "whatsapp:read", "whatsapp:update",
];

const ROLE_ORDER = [
  "OWNER", "ADMIN", "MANAGER", "SALES_MANAGER", "SALES_REP", "CUSTOMER_CARE",
  "MEDIA_BUYER", "MEDIA_PROMOTER", "WHATSAPP_MARKETER", "ACCOUNTANT",
  "INVENTORY_MANAGER", "DELIVERY_AGENT",
];

function extractErr(e: unknown, fallback = "Request failed") {
  const raw = e instanceof Error ? e.message : String(e || fallback);
  try {
    const parsed = JSON.parse(raw);
    return parsed?.message || parsed?.error || raw;
  } catch {
    return raw || fallback;
  }
}

function splitPermissions(value: string) {
  return value
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function sortedRoles(roles: BackendRole[]) {
  return [...roles].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf((a.name || "").toUpperCase());
    const bi = ROLE_ORDER.indexOf((b.name || "").toUpperCase());
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return roleLabel(a.name).localeCompare(roleLabel(b.name));
  });
}

function RolesPage() {
  const current = useCurrentUser();
  const isOwnerAdmin = current?.role === "admin" || ["OWNER", "ADMIN"].includes((current?.roleName || "").toUpperCase());

  const [roles, setRoles] = useState<BackendRole[]>([]);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<BackendRole | null>(null);
  const [form, setForm] = useState({ name: "", displayName: "", description: "", permissions: "" });
  const [editForm, setEditForm] = useState({ displayName: "", description: "", active: true, permissions: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [roleRows, userRows] = await Promise.all([
        apiListRoles().catch(() => []),
        apiListUsers().catch(() => []),
      ]);
      setRoles(sortedRoles(roleRows));
      setUsers(userRows);
    } catch (e) {
      toast.error(extractErr(e, "Failed to load roles"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const roleUsers = useMemo(() => {
    const map = new Map<string, BackendUser[]>();
    for (const user of users) {
      const key = (user.roleName || "").toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(user);
    }
    return map;
  }, [users]);

  const roleOptions = roles.filter((r) => r.active !== false);

  const openEdit = (role: BackendRole) => {
    setEditRole(role);
    setEditForm({
      displayName: role.displayName || roleLabel(role.name),
      description: role.description || "",
      active: role.active !== false,
      permissions: (role.permissions || []).join("\n"),
    });
  };

  const createRole = async () => {
    if (!form.name.trim()) return toast.error("Role code is required");
    if (!form.displayName.trim()) return toast.error("Display name is required");
    setSaving(true);
    try {
      await apiCreateRole("", {
        name: form.name.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, "_"),
        displayName: form.displayName.trim(),
        description: form.description.trim() || undefined,
        permissions: splitPermissions(form.permissions),
      });
      toast.success("Role created");
      setCreateOpen(false);
      setForm({ name: "", displayName: "", description: "", permissions: "" });
      await load();
    } catch (e) {
      toast.error(extractErr(e, "Failed to create role"));
    } finally {
      setSaving(false);
    }
  };

  const saveRole = async () => {
    if (!editRole) return;
    if (!editForm.displayName.trim()) return toast.error("Display name is required");
    setSaving(true);
    try {
      await apiUpdateRole(editRole.id, {
        displayName: editForm.displayName.trim(),
        description: editForm.description.trim() || undefined,
        active: editForm.active,
        permissions: splitPermissions(editForm.permissions),
      });
      toast.success("Role updated");
      setEditRole(null);
      await load();
    } catch (e) {
      toast.error(extractErr(e, "Failed to update role"));
    } finally {
      setSaving(false);
    }
  };

  const toggleRoleActive = async (role: BackendRole) => {
    setBusyId(role.id);
    try {
      if (role.active === false) await apiActivateRole(role.id);
      else await apiDeactivateRole(role.id);
      toast.success(role.active === false ? "Role activated" : "Role deactivated");
      await load();
    } catch (e) {
      toast.error(extractErr(e, "Failed to update role status"));
    } finally {
      setBusyId(null);
    }
  };

  const reassignUser = async (user: BackendUser, roleName: string) => {
    if (!roleName || roleName === user.roleName) return;
    setBusyId(user.id);
    try {
      await apiUpdateUser(user.id, {
        name: user.name,
        email: user.email,
        phone: user.phone,
        active: user.active,
        roleName: roleName as BackendRoleName,
      });
      toast.success(`${user.name} reassigned to ${roleLabel(roleName)}`);
      await load();
    } catch (e) {
      toast.error(extractErr(e, "Failed to reassign staff"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Owner control center for roles, permissions and staff role assignment."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
            </button>
            {isOwnerAdmin && <PrimaryBtn onClick={() => setCreateOpen(true)}><Plus size={14} /> Create Role</PrimaryBtn>}
          </div>
        }
      />

      {!isOwnerAdmin && (
        <Card className="p-4 mb-4 text-sm text-amber-700 bg-amber-50 border-amber-200">
          You can view roles, but only Owner/Admin can create roles, edit permissions, or reassign staff roles.
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {loading && roles.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground lg:col-span-2"><Loader2 size={16} className="inline animate-spin mr-2" /> Loading roles…</Card>
        ) : roles.length === 0 ? (
          <Card className="p-5 lg:col-span-2"><Empty title="No backend roles found." hint="Run seed roles or create a new role." /></Card>
        ) : roles.map((role) => {
          const assigned = roleUsers.get((role.name || "").toUpperCase()) || [];
          return (
            <Card key={role.id || role.name} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    <ShieldCheck size={16} className={role.systemRole ? "text-emerald-600" : "text-blue-600"} />
                    {roleLabel(role.name)}
                    {role.systemRole && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted uppercase">system</span>}
                    {role.active === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 uppercase">inactive</span>}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">{role.name}</div>
                  {role.description && <div className="text-xs text-muted-foreground mt-1">{role.description}</div>}
                </div>
                {isOwnerAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(role)} className="text-xs px-2 py-1 rounded border hover:bg-muted inline-flex items-center gap-1"><Pencil size={12} /> Edit</button>
                    <button onClick={() => toggleRoleActive(role)} disabled={busyId === role.id || role.name === "OWNER"} className="text-xs px-2 py-1 rounded border hover:bg-muted disabled:opacity-50">
                      {busyId === role.id ? "Saving…" : role.active === false ? "Activate" : "Deactivate"}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold mb-1 flex items-center gap-1"><Shield size={13} /> Permissions</div>
                {role.permissions?.length ? (
                  <div className="flex flex-wrap gap-1">{role.permissions.map((p) => <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">{p}</span>)}</div>
                ) : <div className="text-xs text-muted-foreground">No permissions set.</div>}
              </div>

              <div className="border-t pt-3">
                <div className="text-xs font-semibold mb-2 flex items-center gap-1"><Users size={13} /> Assigned staff ({assigned.length})</div>
                {assigned.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No staff assigned to this role.</div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-auto pr-1">
                    {assigned.map((user) => (
                      <div key={user.id} className="flex items-center gap-2 rounded-lg border p-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{user.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{shortStaffId(user)} · {user.email}</div>
                        </div>
                        {isOwnerAdmin ? (
                          <select
                            value={(user.roleName || "").toUpperCase()}
                            disabled={busyId === user.id}
                            onChange={(e) => reassignUser(user, e.target.value)}
                            className="text-xs px-2 py-1.5 rounded border bg-background max-w-[180px]"
                          >
                            {roleOptions.map((r) => <option key={r.id || r.name} value={(r.name || "").toUpperCase()}>{roleLabel(r.name)}</option>)}
                          </select>
                        ) : <div className="text-xs text-muted-foreground">{roleLabel(user.roleName)}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setCreateOpen(false)}>
          <div className="bg-card w-full max-w-lg rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-3"><div className="font-semibold">Create Role</div><button onClick={() => setCreateOpen(false)}><X size={16} /></button></div>
            <div className="space-y-2">
              <input placeholder="Role code, e.g. SALES_LEAD" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]+/g, "_") })} className="w-full px-3 py-2 rounded border bg-background text-sm font-mono" />
              <input placeholder="Display name, e.g. Sales Lead" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm" />
              <textarea rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm" />
              <textarea rows={6} placeholder="Permissions, one per line or comma separated" value={form.permissions} onChange={(e) => setForm({ ...form, permissions: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-xs font-mono" />
              <div className="text-[11px] text-muted-foreground">Examples: {DEFAULT_PERMS.slice(0, 8).join(", ")}</div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCreateOpen(false)} disabled={saving} className="px-3 py-2 text-sm rounded border">Cancel</button>
              <button onClick={createRole} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Role</button>
            </div>
          </div>
        </div>
      )}

      {editRole && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setEditRole(null)}>
          <div className="bg-card w-full max-w-lg rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-1"><div className="font-semibold">Edit Role</div><button onClick={() => setEditRole(null)}><X size={16} /></button></div>
            <div className="text-[11px] font-mono text-muted-foreground mb-3">{editRole.name}</div>
            <div className="space-y-2">
              <input value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm" />
              <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-sm" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.active} disabled={editRole.name === "OWNER"} onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} /> Active</label>
              <textarea rows={8} value={editForm.permissions} onChange={(e) => setEditForm({ ...editForm, permissions: e.target.value })} className="w-full px-3 py-2 rounded border bg-background text-xs font-mono" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditRole(null)} disabled={saving} className="px-3 py-2 text-sm rounded border">Cancel</button>
              <button onClick={saveRole} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
