import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, X, Loader2 } from "lucide-react";
import { myFollowUpsDue, completeFollowUp, type FollowUpReminder } from "@/lib/api";
import { toast } from "sonner";

/** Polls due follow-up reminders every 60s and shows a popup. */
export function FollowUpReminderPopup() {
  const [items, setItems] = useState<FollowUpReminder[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await myFollowUpsDue();
        if (cancelled) return;
        setItems(rows);
        for (const r of rows) {
          if (!shown.current.has(r.id)) {
            shown.current.add(r.id);
            toast.message("Customer follow-up due", {
              description: `${r.customerName || "Customer"} · ${r.orderCode || ""}`.trim(),
            });
          }
        }
      } catch {
        /* silent — likely endpoint missing or 401 already handled */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (items.length === 0) return null;

  const complete = async (id: string) => {
    setBusyId(id);
    try {
      await completeFollowUp(id);
      setItems((s) => s.filter((r) => r.id !== id));
      toast.success("Reminder marked complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to complete reminder");
    } finally { setBusyId(null); }
  };

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-40 rounded-full px-4 py-2 text-sm text-white shadow-lg flex items-center gap-2"
        style={{ background: "var(--gradient-electric)" }}
      >
        <Bell size={14} /> {items.length} follow-up{items.length > 1 ? "s" : ""} due
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[92vw] bg-card border shadow-xl rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 text-white text-sm font-semibold" style={{ background: "var(--gradient-electric)" }}>
        <Bell size={14} /> Follow-ups due ({items.length})
        <button onClick={() => setMinimized(true)} className="ml-auto opacity-80 hover:opacity-100"><X size={14} /></button>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y">
        {items.slice(0, 6).map((r) => (
          <div key={r.id} className="p-3 text-sm">
            <div className="font-medium">{r.customerName || "Customer"}</div>
            <div className="text-xs text-muted-foreground truncate">
              {r.orderCode ? `${r.orderCode} · ` : ""}{r.phone || ""}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {r.outcome ? r.outcome.replace(/_/g, " ") : ""} · {new Date(r.scheduledAt).toLocaleString()}
            </div>
            <div className="mt-2 flex gap-2">
              {r.orderId && (
                <Link to="/orders/$id" params={{ id: r.orderId }}
                  className="text-xs px-2 py-1 rounded border hover:bg-muted">Open order</Link>
              )}
              <button onClick={() => complete(r.id)} disabled={busyId === r.id}
                className="text-xs px-2 py-1 rounded text-white inline-flex items-center gap-1 disabled:opacity-60"
                style={{ background: "var(--gradient-electric)" }}>
                {busyId === r.id && <Loader2 size={10} className="animate-spin" />} Mark complete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
