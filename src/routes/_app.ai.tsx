import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader, Card } from "@/components/AppShell";
import { aiAsk, aiSnapshot, aiLogs, type AiLog } from "@/lib/api";
import { toast } from "sonner";
import { Sparkles, Send, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/ai")({
  head: () => ({ meta: [{ title: "AI Assistant — Glowbalmart CRM" }] }),
  component: AIPage,
});

interface Msg { role: "user" | "assistant"; text: string; }

function AIPage() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", text: "Hi! Ask me anything about your sales, follow-ups, finance or inventory." }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState("general");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    aiSnapshot().then(setSnapshot).catch(() => {});
    aiLogs().then(setLogs).catch(() => {});
  }, []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || sending) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput(""); setSending(true);
    try {
      const r = await aiAsk(q, mode);
      const answer = r.answer || r.response || r.message || (typeof r.data === "string" ? r.data : JSON.stringify(r.data)) || "No response.";
      setMessages((m) => [...m, { role: "assistant", text: String(answer) }]);
    } catch (e) {
      const err = e instanceof Error ? e.message : "AI failed";
      setMessages((m) => [...m, { role: "assistant", text: `⚠️ ${err}` }]);
      toast.error(err);
    } finally { setSending(false); }
  };

  return (
    <>
      <PageHeader title="Glow AI Sales Assistant" subtitle="Powered by your live Glowbalmart data." />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 flex flex-col h-[70vh]">
          <div ref={scroller} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "text-white" : "bg-muted"}`}
                  style={m.role === "user" ? { background: "var(--gradient-electric)" } : undefined}>
                  {m.text}
                </div>
              </div>
            ))}
            {sending && <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Glow AI is thinking…</div>}
          </div>
          <div className="border-t p-3">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                "Which customers need follow-up now?",
                "Which follow-ups are due today?",
                "Which orders were cancelled or rejected?",
                "Which orders are delivered but unpaid?",
                "What should sales reps focus on today?",
                "What is reducing profit?",
              ].map((s) => (
                <button key={s} onClick={() => setInput(s)}
                  className="text-[11px] px-2 py-1 rounded-full border hover:bg-muted">
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="px-2 py-2 rounded border bg-background text-xs">
                {["general","sales","finance","inventory","staff"].map(x => <option key={x} value={x}>{x}</option>)}
              </select>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder="Ask about your business…" className="flex-1 px-3 py-2 rounded border bg-background text-sm" />
              <button onClick={send} disabled={sending || !input.trim()} className="px-4 rounded text-white disabled:opacity-50" style={{ background: "var(--gradient-electric)" }}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3"><Sparkles size={16} style={{ color: "var(--electric)" }} /><div className="font-semibold">Business Snapshot</div></div>
            {snapshot ? (
              <div className="text-xs space-y-1">
                {Object.entries(snapshot).slice(0, 12).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-medium">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span></div>
                ))}
              </div>
            ) : <div className="text-xs text-muted-foreground">Loading snapshot…</div>}
          </Card>
          <Card className="p-4">
            <div className="font-semibold mb-2 text-sm">Recent Questions</div>
            {logs.length === 0 ? <div className="text-xs text-muted-foreground">No history yet.</div> : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {logs.slice(0, 10).map((l) => (
                  <div key={l.id} className="text-xs border-b pb-1.5">
                    <div className="font-medium">{l.question}</div>
                    <div className="text-muted-foreground truncate">{l.answer}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
