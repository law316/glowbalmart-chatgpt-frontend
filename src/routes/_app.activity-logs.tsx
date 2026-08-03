import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { activityLogs, type ActivityLog } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, RefreshCw, Activity } from "lucide-react";

export const Route = createFileRoute("/_app/activity-logs")({
  head: () => ({ meta: [{ title: "Activity Logs — Glowbalmart CRM" }] }),
  component: ActivityLogsPage,
});

function ActivityLogsPage() {
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { setItems(await activityLogs()); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader title="Activity Logs" subtitle="System-wide audit trail." actions={
        <button onClick={load} className="text-sm inline-flex items-center gap-1 px-3 py-2 rounded-lg border hover:bg-muted">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      } />
      <Card>
        {loading && items.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div> :
          items.length === 0 ? <Empty title="No activity yet" /> : (
            <ol className="divide-y">
              {items.map((a) => (
                <li key={a.id} className="p-4 flex items-start gap-3">
                  <div className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: "var(--gradient-electric)" }}><Activity size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{a.title || a.activityType || "Activity"}</div>
                    {a.message && <div className="text-xs text-muted-foreground mt-0.5">{a.message}</div>}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {a.actorName ? `${a.actorName} · ` : ""}{a.createdAt ? fmtDateTime(a.createdAt) : ""}
                      {a.resourceType ? ` · ${a.resourceType}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )
        }
      </Card>
    </>
  );
}
