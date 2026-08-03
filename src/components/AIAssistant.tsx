import { useState, useEffect } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { NGN } from "@/lib/format";

interface Msg { role: "user" | "ai"; text: string; }

const EXAMPLES = [
  "Show me today's sales summary",
  "Which staff closed the most deals this week?",
  "Show orders stuck after second call",
  "Which state is buying the Family Glow Pack most?",
  "Give me a finance summary for this month",
  "Which customers need urgent follow-up today?",
  "Find all unpaid successful deals",
];

function answer(q: string, state: ReturnType<typeof useStore.getState>): string {
  const ql = q.toLowerCase();
  const orders = state.orders;
  const successful = orders.filter((o) => o.status === "deal_successful");
  const revenue = successful.reduce((s, o) => s + o.price, 0);
  const expenses = state.expenses.reduce((s, e) => s + e.amount, 0);

  if (ql.includes("sales summary") || ql.includes("today")) {
    return `Today's snapshot:\n• Total orders: ${orders.length}\n• Successful deals: ${successful.length}\n• Gross revenue: ${NGN(revenue)}\n• Pending follow-ups: ${orders.filter(o => o.nextFollowUp).length}`;
  }
  if (ql.includes("staff") && ql.includes("most")) {
    const counts = new Map<string, number>();
    successful.forEach((o) => o.assignedTo && counts.set(o.assignedTo, (counts.get(o.assignedTo) || 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const name = top ? state.users.find((u) => u.id === top[0])?.name : "—";
    return `Top performer this week: ${name} with ${top?.[1] || 0} successful deals.`;
  }
  if (ql.includes("second call") || ql.includes("stuck")) {
    const stuck = orders.filter((o) => o.callAttempts >= 2 && o.status !== "deal_successful");
    return `${stuck.length} orders are stuck after the second call. Open the Call Queue → "Third Call" tab to handle them.`;
  }
  if (ql.includes("state") && ql.includes("family")) {
    const fam = orders.filter((o) => /family/i.test(o.packageName));
    const counts = new Map<string, number>();
    fam.forEach((o) => counts.set(o.state, (counts.get(o.state) || 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]} leads the Family Glow Pack with ${top[1]} orders.` : "No Family Glow Pack orders yet.";
  }
  if (ql.includes("finance") || ql.includes("month")) {
    return `Finance summary:\n• Gross revenue: ${NGN(revenue)}\n• Total expenses: ${NGN(expenses)}\n• Net profit: ${NGN(revenue - expenses)}\n• Margin: ${revenue ? Math.round(((revenue - expenses) / revenue) * 100) : 0}%`;
  }
  if (ql.includes("follow-up") || ql.includes("urgent")) {
    const urgent = orders.filter((o) => o.callAttempts >= 2 && o.nextFollowUp);
    return `${urgent.length} customers need urgent follow-up — they're on their final call.`;
  }
  if (ql.includes("unpaid") && ql.includes("successful")) {
    const list = successful.filter((o) => o.paymentStatus !== "paid");
    return `${list.length} successful deals are still unpaid — total ${NGN(list.reduce((s, o) => s + o.price, 0))}.`;
  }
  return "I'm in demo mode. Connect an AI provider in Settings → AI Assistant to unlock full reasoning over your sales data.";
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "Hi! I'm Glow AI Sales Assistant. Try one of the examples or ask anything about your sales." },
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = (text: string) => {
    if (!text.trim()) return;
    const reply = answer(text, useStore.getState());
    setMsgs((m) => [...m, { role: "user", text }, { role: "ai", text: reply }]);
    setInput("");
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full text-white shadow-lg flex items-center gap-2 px-4 py-3 font-medium hover:scale-105 transition-transform"
        style={{ background: "var(--gradient-electric)", boxShadow: "0 8px 24px oklch(0.65 0.2 250 / 0.4)" }}>
        <Sparkles size={18} /> Glow AI
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in-up">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md h-full flex flex-col text-white" style={{ background: "var(--gradient-navy)" }}>
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-electric" />
                <div>
                  <div className="font-semibold">Glow AI Sales Assistant</div>
                  <div className="text-xs text-white/60">Demo mode · mock responses</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgs.map((m, i) => (
                <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-line ${m.role === "user" ? "ml-auto bg-white/15" : "bg-white/5 border border-white/10"}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-white/10">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {EXAMPLES.slice(0, 4).map((ex) => (
                  <button key={ex} onClick={() => send(ex)} className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/80">
                    {ex}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(input)}
                  placeholder="Ask Glow AI…"
                  className="flex-1 rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-sm placeholder-white/40 outline-none focus:border-electric" />
                <button onClick={() => send(input)} className="rounded-lg px-3 text-white" style={{ background: "var(--gradient-electric)" }}>
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
