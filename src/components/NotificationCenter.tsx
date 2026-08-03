import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Bell, X, Check, CheckCheck, Volume2, VolumeX, Loader2, RefreshCw,
  ShoppingBag, CheckCircle2, AlertTriangle, PackageOpen, Wallet,
  Megaphone, Target, Trophy, Users,
} from "lucide-react";
import { listNotifications, markNotificationRead, markAllNotificationsRead, type ApiNotification } from "@/lib/api";
import { useCurrentUser } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";

type Tab = "all" | "unread" | "orders" | "inventory" | "finance" | "marketing" | "delivery";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" }, { key: "unread", label: "Unread" },
  { key: "orders", label: "Orders" }, { key: "inventory", label: "Inventory" },
  { key: "finance", label: "Finance" }, { key: "marketing", label: "Marketing" },
  { key: "delivery", label: "Delivery" },
];

function typeMeta(n: ApiNotification) {
  const t = (n.type || "").toUpperCase();
  if (t.includes("DELIVERED")) return { Icon: CheckCircle2, tint: "text-emerald-600 bg-emerald-100" };
  if (t.includes("DELIVERY") || t.includes("RETURNED") || t.includes("FAILED")) return { Icon: AlertTriangle, tint: "text-rose-600 bg-rose-100" };
  if (t.includes("LOW_STOCK") || t.includes("STOCK")) return { Icon: PackageOpen, tint: "text-amber-600 bg-amber-100" };
  if (t.includes("FINANCE") || t.includes("DEPOSIT") || t.includes("EXPENSE")) return { Icon: Wallet, tint: "text-indigo-600 bg-indigo-100" };
  if (t.includes("CAMPAIGN") || t.includes("ATTRIBUT")) return { Icon: Megaphone, tint: "text-fuchsia-600 bg-fuchsia-100" };
  if (t.includes("TARGET") || t.includes("PROMOTER")) return { Icon: Target, tint: "text-cyan-600 bg-cyan-100" };
  if (t.includes("COHORT")) return { Icon: Trophy, tint: "text-amber-600 bg-amber-100" };
  if (t.includes("ORDER")) return { Icon: ShoppingBag, tint: "text-blue-600 bg-blue-100" };
  if (t.includes("FOLLOW")) return { Icon: Users, tint: "text-sky-600 bg-sky-100" };
  return { Icon: Bell, tint: "text-slate-600 bg-slate-100" };
}

function categoryOf(n: ApiNotification): Exclude<Tab, "all" | "unread"> | "other" {
  const t = (n.type || "").toUpperCase();
  const r = (n.resourceType || "").toUpperCase();
  if (r === "ORDER" || t.includes("ORDER") || t.includes("FOLLOW")) return "orders";
  if (r.includes("INVENTORY") || t.includes("STOCK")) return "inventory";
  if (t.includes("FINANCE") || t.includes("DEPOSIT") || t.includes("EXPENSE")) return "finance";
  if (t.includes("CAMPAIGN") || t.includes("PROMOTER") || t.includes("MARKETING") || t.includes("COHORT")) return "marketing";
  if (t.includes("DELIVER") || r.includes("DELIVERY_AGENT")) return "delivery";
  return "other";
}

function routeFor(n: ApiNotification): string | null {
  const r = (n.resourceType || "").toUpperCase();
  if (r === "ORDER" && n.resourceId) return `/orders/${n.resourceId}`;
  if (r === "ORDER") return "/orders";
  if (r.includes("INVENTORY")) return "/inventory";
  if (r.includes("DELIVERY_AGENT")) return "/agents";
  if (r.includes("CAMPAIGN")) return "/campaigns";
  if (r.includes("PROMOTER")) return "/promoter-targets";
  if (r.includes("FINANCE")) return "/finance-ledger";
  if (r.includes("COHORT")) return "/sales-cohorts";
  return null;
}

const POLL_MS = 15000;
const SOUND_KEY = "gbm-notif-sound";

export function NotificationCenter() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [error, setError] = useState<string | null>(null);
  const [backendMissing, setBackendMissing] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SOUND_KEY) === "1";
  });
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const playChime = useCallback(() => {
    if (!soundOn) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      o.start(now); o.stop(now + 0.36);
    } catch { /* ignore */ }
  }, [soundOn]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await listNotifications();
      setError(null); setBackendMissing(false);
      // detect new
      if (!firstLoadRef.current) {
        const fresh = data.filter((n) => !n.read && !seenIdsRef.current.has(n.id));
        if (fresh.length > 0) {
          setPulse(true);
          setTimeout(() => setPulse(false), 2500);
          playChime();
          fresh.slice(0, 3).forEach((n) => {
            const meta = typeMeta(n);
            toast.custom((id) => (
              <div className="w-[360px] bg-card border rounded-xl shadow-2xl p-3 flex gap-3 animate-fade-in-up">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.tint}`}>
                  <meta.Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{n.title || "New notification"}</div>
                  {n.message && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>}
                  <div className="mt-1.5 flex items-center gap-2">
                    {routeFor(n) && (
                      <button
                        onClick={() => { markNotificationRead(n.id).catch(() => {}); navigate({ to: routeFor(n)! }); toast.dismiss(id); }}
                        className="text-[11px] px-2 py-1 rounded text-white"
                        style={{ background: "var(--gradient-electric)" }}
                      >Open</button>
                    )}
                    <button onClick={() => toast.dismiss(id)} className="text-[11px] px-2 py-1 rounded border">Dismiss</button>
                  </div>
                </div>
              </div>
            ), { duration: 6500 });
          });
        }
      }
      data.forEach((n) => seenIdsRef.current.add(n.id));
      setItems(data);
      firstLoadRef.current = false;
    } catch (e: any) {
      const msg = e?.message || "Could not load notifications";
      setError(msg);
      if (e?.status === 404 || /not.?found/i.test(msg)) setBackendMissing(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [navigate, playChime]);

  // initial + polling
  useEffect(() => {
    if (!user) return;
    load();
    const iv = setInterval(() => {
      if (document.hidden) return;
      load(true);
    }, POLL_MS);
    return () => clearInterval(iv);
  }, [user, load]);

  if (!user) return null;

  const unreadCount = items.filter((n) => !n.read).length;

  const filtered = items.filter((n) => {
    if (tab === "all") return true;
    if (tab === "unread") return !n.read;
    return categoryOf(n) === tab;
  });

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (typeof window !== "undefined") localStorage.setItem(SOUND_KEY, next ? "1" : "0");
  };

  const markOne = async (n: ApiNotification) => {
    try { await markNotificationRead(n.id); setItems((x) => x.map((i) => i.id === n.id ? { ...i, read: true } : i)); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  const markAll = async () => {
    try { await markAllNotificationsRead(); toast.success("All marked read"); setItems((x) => x.map((i) => ({ ...i, read: true }))); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  const openNotif = (n: ApiNotification) => {
    if (!n.read) markOne(n);
    const to = routeFor(n);
    if (to) { setDrawerOpen(false); navigate({ to }); }
  };

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="p-2 rounded-lg hover:bg-muted relative"
        aria-label="Notifications"
      >
        <Bell size={18} className={pulse ? "animate-bounce" : ""} />
        {unreadCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${pulse ? "animate-pulse" : ""}`}
            style={{ background: "var(--electric, #2563eb)" }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in-up" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-card border-l shadow-2xl flex flex-col animate-slide-in-right">
            <div className="p-4 border-b flex items-center gap-2">
              <Bell size={18} />
              <div className="font-semibold">Notifications</div>
              <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={toggleSound} className="p-1.5 rounded hover:bg-muted" title={soundOn ? "Sound on" : "Sound off"}>
                  {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button onClick={() => load()} className="p-1.5 rounded hover:bg-muted" title="Refresh">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </button>
                <button onClick={markAll} className="p-1.5 rounded hover:bg-muted" title="Mark all read"><CheckCheck size={16} /></button>
                <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded hover:bg-muted"><X size={16} /></button>
              </div>
            </div>

            <div className="px-2 pt-2 border-b overflow-x-auto">
              <div className="flex gap-1 min-w-max pb-2">
                {TABS.map((t) => {
                  const active = t.key === tab;
                  return (
                    <button key={t.key} onClick={() => setTab(t.key)}
                      className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${active ? "text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                      style={active ? { background: "var(--gradient-electric)" } : {}}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {backendMissing ? (
                <div className="p-6 text-sm text-center text-muted-foreground">
                  <AlertTriangle className="mx-auto mb-2 text-amber-600" size={20} />
                  Notification backend endpoint not connected yet.
                </div>
              ) : error ? (
                <div className="p-6 text-xs text-center text-muted-foreground">Could not load notifications.</div>
              ) : loading && items.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nothing here yet.</div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((n) => {
                    const meta = typeMeta(n);
                    return (
                      <li key={n.id} className={`p-3 flex gap-3 hover:bg-muted/40 cursor-pointer ${!n.read ? "bg-muted/20" : ""}`}
                        onClick={() => openNotif(n)}>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.tint}`}>
                          <meta.Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="text-sm font-medium flex-1">{n.title || "Notification"}</div>
                            {!n.read && <span className="w-2 h-2 rounded-full mt-1.5" style={{ background: "var(--electric,#2563eb)" }} />}
                          </div>
                          {n.message && <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>}
                          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                            {n.createdAt ? fmtDateTime(n.createdAt) : ""}
                            {!n.read && (
                              <button onClick={(e) => { e.stopPropagation(); markOne(n); }} className="ml-auto text-[11px] px-1.5 py-0.5 rounded border hover:bg-muted inline-flex items-center gap-1">
                                <Check size={10} /> Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
