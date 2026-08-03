import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card } from "@/components/AppShell";
import { useCurrentUser } from "@/lib/store";
import { AccessDenied } from "@/components/AccessDenied";
import { ownerResetBusinessData } from "@/lib/api";
import { AlertTriangle, Loader2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/danger-zone")({
  head: () => ({ meta: [{ title: "Owner Danger Zone — Glowbalmart CRM" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: DangerZonePage,
});

const CONFIRM_PHRASE = "DELETE_GLOWBALMART_TEST_DATA";

function DangerZonePage() {
  const user = useCurrentUser();
  const isOwner = user?.role === "admin";
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOwner) return <AccessDenied allowed={["admin"]} role={user?.role || "staff"} />;

  const run = async () => {
    if (typed !== CONFIRM_PHRASE) return;
    setBusy(true);
    try {
      await ownerResetBusinessData();
      toast.success("Business test data cleared. Staff, owner login, roles, store settings and provider connections were kept.");
      setOpen(false); setTyped("");
      // Force refresh of all cached data
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear business data");
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Owner Danger Zone" subtitle="Irreversible maintenance actions — Owner only" />

      <Card className="p-6 border-2 border-rose-300 bg-rose-50/40">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
            <ShieldAlert size={22} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-rose-900">Clear Business Test Data</div>
            <p className="text-sm text-rose-900/80 mt-1">
              Deletes all orders, sales forms, packages, products, delivery agents, delivery stock,
              assignments, stock movements, follow-up reminders, and treatment logs.
              Staff users, roles, and admin login will <b>not</b> be deleted.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium"
            >
              <AlertTriangle size={14} /> Clear Business Test Data
            </button>
          </div>
        </div>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="bg-card w-full max-w-lg rounded-xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 text-rose-700 font-semibold"><ShieldAlert size={18} /> Confirm destructive reset</div>
              <button onClick={() => !busy && setOpen(false)}><X size={16} /></button>
            </div>
            <p className="text-sm text-muted-foreground">
              This will delete all orders, sales forms, packages, products, delivery agents,
              delivery stock, assignments, stock movements, follow-up reminders, and treatment logs.
              Staff users, roles, and admin login will not be deleted.
            </p>
            <p className="text-sm mt-3">
              Type <code className="px-1.5 py-0.5 rounded bg-muted font-mono">{CONFIRM_PHRASE}</code> to confirm:
            </p>
            <input
              autoFocus value={typed} onChange={(e) => setTyped(e.target.value)}
              className="mt-2 w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono"
              placeholder={CONFIRM_PHRASE}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={busy} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button
                onClick={run}
                disabled={busy || typed !== CONFIRM_PHRASE}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-medium"
              >
                {busy && <Loader2 size={14} className="animate-spin" />} Permanently Clear Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
