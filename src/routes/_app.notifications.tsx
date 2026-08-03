import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { listNotifications, markNotificationRead, markAllNotificationsRead, type ApiNotification } from "@/lib/api";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";
import { Loader2, RefreshCw, CheckCheck, Bell } from "lucide-react";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Glowbalmart CRM" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setItems(await listNotifications()); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const markOne = async (id: string) => { try { await markNotificationRead(id); load(); } catch { /* */ } };
  const markAll = async () => { try { await markAllNotificationsRead(); toast.success("All marked read"); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } };

  return (
    <>
      <PageHeader title="Notifications" subtitle={`${items.filter((n) => !n.read).length} unread`} actions={
        <>
          <button onClick={load} className="text-sm inline-flex items-center gap-1 px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <button onClick={markAll} className="text-sm inline-flex items-center gap-1 px-3 py-2 rounded-lg border hover:bg-muted"><CheckCheck size={14} /> Mark all read</button>
        </>
      } />
      <Card>
        {loading && items.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div> :
          items.length === 0 ? <Empty title="No notifications yet" /> : (
            <div className="divide-y">
              {items.map((n) => (
                <div key={n.id} className={`p-4 flex items-start gap-3 ${!n.read ? "bg-muted/30" : ""}`}>
                  <div className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: "var(--gradient-electric)" }}><Bell size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{n.title}</div>
                    {n.message && <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>}
                    <div className="text-[11px] text-muted-foreground mt-1">{n.createdAt ? fmtDateTime(n.createdAt) : ""}</div>
                  </div>
                  {!n.read && <button onClick={() => markOne(n.id)} className="text-xs px-2 py-1 rounded border hover:bg-muted">Mark read</button>}
                </div>
              ))}
            </div>
          )
        }
      </Card>
    </>
  );
}
