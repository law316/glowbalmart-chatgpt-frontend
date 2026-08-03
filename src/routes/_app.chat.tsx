import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { PageHeader, Card } from "@/components/AppShell";
import {
  chatUsers, chatConversations, chatMessages, chatSend, chatOpenDirect, chatMarkRead,
  type ChatUser, type ChatConversation, type ChatMessage,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/store";
import { toast } from "sonner";
import { Send, Loader2, Search, Plus, ArrowLeft, MessageSquare, AlertCircle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/chat")({
  head: () => ({ meta: [{ title: "Team Chat — Glowbalmart CRM" }] }),
  component: ChatPage,
});

const initials = (name?: string | null) => {
  const n = (name || "").trim();
  if (!n) return "?";
  return n.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
};

const displayName = (v: { name?: string; email?: string; roleName?: string; role?: string } | null | undefined) =>
  v?.name?.trim() || v?.email?.split("@")[0] || v?.roleName || v?.role || "Teammate";

const convoName = (c: ChatConversation) =>
  c.otherUserName?.trim() || c.otherUserEmail?.split("@")[0] || c.otherUserRole || "Conversation";

const timeShort = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

function ChatPage() {
  const me = useCurrentUser();
  const [convos, setConvos] = useState<ChatConversation[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [convosError, setConvosError] = useState<string | null>(null);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [msgsError, setMsgsError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const active = useMemo(() => convos.find((c) => c.id === activeId) || null, [convos, activeId]);

  const loadConvos = useCallback(async () => {
    try { setConvos(await chatConversations()); setConvosError(null); }
    catch (e) { setConvosError(e instanceof Error ? e.message : "Failed to load conversations"); }
  }, []);
  const loadUsers = useCallback(async () => {
    try { setUsers(await chatUsers()); } catch { /* silent */ }
  }, []);

  // initial load
  useEffect(() => {
    (async () => { setLoading(true); await Promise.all([loadConvos(), loadUsers()]); setLoading(false); })();
  }, [loadConvos, loadUsers]);

  // poll conversations while page open
  useEffect(() => {
    const t = setInterval(loadConvos, 8000);
    return () => clearInterval(t);
  }, [loadConvos]);

  // load messages for active conversation + poll
  useEffect(() => {
    if (!activeId) { setMessages([]); setMsgsError(null); return; }
    let cancelled = false;
    const run = async (initial = false) => {
      if (initial) setMsgsLoading(true);
      try {
        const msgs = await chatMessages(activeId);
        if (!cancelled) { setMessages(msgs); setMsgsError(null); }
      } catch (e) {
        if (cancelled) return;
        const err = e instanceof Error ? e.message : "Failed";
        if (/404|not found/i.test(err)) {
          toast.error("Conversation was not found. Start a new chat.");
          setActiveId(null);
          setMessages([]);
          loadConvos();
        } else {
          setMsgsError(err);
        }
      } finally {
        if (initial && !cancelled) setMsgsLoading(false);
      }
    };
    run(true);
    chatMarkRead(activeId).catch(() => {});
    const t = setInterval(() => run(false), 6000);
    return () => { cancelled = true; clearInterval(t); };
  }, [activeId, loadConvos]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, activeId]);

  const send = async () => {
    const text = input.trim();
    if (!text || !activeId || sending) return;
    setSending(true); setInput("");
    try {
      await chatSend(activeId, text);
      const [msgs] = await Promise.all([chatMessages(activeId), loadConvos()]);
      setMessages(msgs);
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to send";
      toast.error(err);
      setInput(text);
      if (/404|not found/i.test(err)) { setActiveId(null); loadConvos(); }
    } finally { setSending(false); }
  };

  const openWith = async (u: ChatUser) => {
    if (opening) return;
    setOpening(u.id);
    try {
      const conv = await chatOpenDirect(u.id);
      setShowNew(false);
      await loadConvos();
      setActiveId(conv.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open conversation");
    } finally { setOpening(null); }
  };

  const filtered = convos.filter((c) => !q || convoName(c).toLowerCase().includes(q.toLowerCase()));
  const otherUsers = users.filter((u) => u.id !== me?.id);

  return (
    <>
      <PageHeader title="Team Chat" subtitle="Direct messaging with your teammates." />
      <Card className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-13rem)] min-h-[520px] overflow-hidden p-0">
        {/* Left pane */}
        <aside className={`border-r flex flex-col min-h-0 ${activeId ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 border-b flex gap-2 items-center">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search chats…"
                className="w-full pl-8 pr-2 py-2 rounded-full border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
              />
            </div>
            <button onClick={() => setShowNew(true)} title="New chat"
              className="p-2 rounded-full text-white shadow-sm hover:opacity-90"
              style={{ background: "var(--gradient-electric)" }}><Plus size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="animate-spin" size={12} /> Loading conversations…
              </div>
            ) : convosError ? (
              <div className="p-4 text-xs text-destructive space-y-2">
                <div className="flex items-center gap-1"><AlertCircle size={12} /> {convosError}</div>
                <button onClick={loadConvos} className="text-xs px-2 py-1 rounded border inline-flex items-center gap-1">
                  <RefreshCw size={11} /> Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 opacity-40" size={24} />
                No conversations yet.<br />Tap <b>+</b> to start one.
              </div>
            ) : filtered.map((c) => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition ${activeId === c.id ? "bg-muted" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0"
                    style={{ background: "var(--gradient-electric)" }}>
                    {initials(convoName(c))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">{convoName(c)}</div>
                      <div className="text-[10px] text-muted-foreground shrink-0">{timeShort(c.lastMessageAt || c.updatedAt)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="text-xs text-muted-foreground truncate">{c.lastMessage || "No messages yet"}</div>
                      {(c.unreadCount ?? 0) > 0 && (
                        <span className="text-[10px] min-w-[18px] h-[18px] px-1.5 rounded-full text-white flex items-center justify-center shrink-0"
                          style={{ background: "var(--electric)" }}>{c.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Right pane */}
        <section className={`flex flex-col min-h-0 ${activeId ? "flex" : "hidden md:flex"}`}
          style={{ background: "linear-gradient(180deg, hsl(var(--muted)/.3), hsl(var(--muted)/.15))" }}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <div>
                <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white mb-3"
                  style={{ background: "var(--gradient-electric)" }}>
                  <MessageSquare size={26} />
                </div>
                <div className="font-semibold">Pick a conversation</div>
                <div className="text-xs text-muted-foreground">Or start a new one with the + button.</div>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b p-3 flex items-center gap-3 bg-background/80 backdrop-blur">
                <button onClick={() => setActiveId(null)} className="md:hidden p-1 -ml-1 rounded hover:bg-muted"><ArrowLeft size={18} /></button>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0"
                  style={{ background: "var(--gradient-electric)" }}>
                  {initials(convoName(active))}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{convoName(active)}</div>
                  <div className="text-xs text-muted-foreground truncate">{active.otherUserRole || active.otherUserEmail || ""}</div>
                </div>
              </div>

              <div ref={scroller} className="flex-1 overflow-y-auto p-4 space-y-1.5">
                {msgsLoading ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="animate-spin" size={12} /> Loading messages…</div>
                ) : msgsError ? (
                  <div className="text-xs text-destructive space-y-2">
                    <div className="flex items-center gap-1"><AlertCircle size={12} /> {msgsError}</div>
                    <button onClick={() => activeId && chatMessages(activeId).then(setMessages).catch(() => {})}
                      className="text-xs px-2 py-1 rounded border inline-flex items-center gap-1">
                      <RefreshCw size={11} /> Retry
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-10">No messages yet. Say hi 👋</div>
                ) : messages.map((m, i) => {
                  const mine = m.senderId === me?.id;
                  const prev = messages[i - 1];
                  const grouped = prev && prev.senderId === m.senderId;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? "text-white rounded-br-sm" : "bg-background border rounded-bl-sm"}`}
                        style={mine ? { background: "var(--gradient-electric)" } : undefined}
                      >
                        {!mine && !grouped && m.senderName && (
                          <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">{m.senderName}</div>
                        )}
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                        <div className={`text-[10px] mt-0.5 text-right ${mine ? "text-white/70" : "text-muted-foreground"}`}>{timeShort(m.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t p-2.5 flex gap-2 items-end bg-background/80 backdrop-blur">
                <textarea
                  value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message…" rows={1}
                  className="flex-1 resize-none max-h-32 px-3 py-2 rounded-2xl border bg-background text-sm focus:outline-none"
                />
                <button onClick={send} disabled={!input.trim() || sending}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-50 shrink-0"
                  style={{ background: "var(--gradient-electric)" }}>
                  {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                </button>
              </div>
            </>
          )}
        </section>
      </Card>

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-xl w-full max-w-md p-5 shadow-xl">
            <div className="font-semibold mb-3">Start a chat</div>
            {otherUsers.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">No teammates found.</div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y">
                {otherUsers.map((u) => (
                  <button key={u.id} onClick={() => openWith(u)} disabled={opening === u.id}
                    className="w-full text-left p-3 hover:bg-muted flex items-center gap-3 disabled:opacity-50">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                      style={{ background: "var(--gradient-electric)" }}>
                      {initials(displayName(u))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{displayName(u)}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.roleDisplayName || u.roleName || u.role || u.email}</div>
                    </div>
                    {opening === u.id && <Loader2 className="animate-spin" size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
