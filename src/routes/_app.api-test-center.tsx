import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Card } from "@/components/AppShell";
import { apiGet, apiLogin, setToken, roleLabel, type BackendUser } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Play, ChevronDown, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/api-test-center")({
  head: () => ({
    meta: [
      { title: "API Test Center — Glowbalmart CRM" },
      { name: "description", content: "Admin tool to test live Glowbalmart backend endpoints and inspect responses." },
      { property: "og:title", content: "API Test Center — Glowbalmart CRM" },
      { property: "og:description", content: "Admin tool to test live Glowbalmart backend endpoints and inspect responses." },
    ],
  }),
  component: ApiTestCenter,
});

const ENDPOINTS: { method: string; path: string; label: string }[] = [
  { method: "GET", path: "/api/dashboard/insights", label: "Dashboard insights" },
  { method: "GET", path: "/api/sales-manager/summary", label: "Sales manager summary" },
  { method: "GET", path: "/api/delivery-agents/summary", label: "Delivery agents summary" },
  { method: "GET", path: "/api/roles", label: "Roles" },
  { method: "GET", path: "/api/users", label: "Users" },
  { method: "GET", path: "/api/cohorts", label: "Cohorts" },
  { method: "GET", path: "/api/inventory/products", label: "Inventory products" },
  { method: "GET", path: "/api/delivery-agents", label: "Delivery agents" },
  { method: "GET", path: "/api/delivery-agents/stock/all", label: "Agent stock (all)" },
  { method: "GET", path: "/api/delivery-agents/stock/allocations", label: "Stock allocations" },
  { method: "GET", path: "/api/delivery-agents/stock/allocations/in-transit", label: "Allocations in transit" },
  { method: "GET", path: "/api/finance-ledger/accounts", label: "Finance ledger accounts" },
];

type Result = { status: "idle" | "loading" | "success" | "error"; data?: unknown; error?: string };

function ApiTestCenter() {
  const setSession = useStore((s) => s.setSession);
  const [email, setEmail] = useState("admin@glowbalmart.com");
  const [password, setPassword] = useState("password123");
  const [loggingIn, setLoggingIn] = useState(false);
  const [who, setWho] = useState<BackendUser | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const { token, user } = await apiLogin(email, password);
      setToken(token);
      setSession(token, user);
      setWho(user);
      toast.success(`Signed in as ${user.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoggingIn(false);
    }
  };

  const run = async (path: string) => {
    setResults((r) => ({ ...r, [path]: { status: "loading" } }));
    try {
      const data = await apiGet(path);
      setResults((r) => ({ ...r, [path]: { status: "success", data } }));
      setOpen((o) => ({ ...o, [path]: true }));
    } catch (err) {
      setResults((r) => ({ ...r, [path]: { status: "error", error: err instanceof Error ? err.message : "Request failed" } }));
      setOpen((o) => ({ ...o, [path]: true }));
    }
  };

  const runAll = () => ENDPOINTS.forEach((e) => run(e.path));

  return (
    <div>
      <PageHeader
        title="API Test Center"
        subtitle="Admin-only tool for verifying live backend endpoints."
        actions={
          <button onClick={runAll} className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded text-white" style={{ background: "var(--gradient-electric)" }}>
            <Play size={14} /> Run all tests
          </button>
        }
      />

      <Card className="p-4 mb-6">
        <div className="font-semibold text-sm mb-3">Backend login</div>
        <form onSubmit={login} className="grid sm:grid-cols-3 gap-3 items-end">
          <label className="text-xs font-medium">Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 px-3 py-2 rounded border bg-background text-sm" />
          </label>
          <label className="text-xs font-medium">Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-1 px-3 py-2 rounded border bg-background text-sm" />
          </label>
          <button disabled={loggingIn} className="px-4 py-2 text-sm rounded border hover:bg-muted disabled:opacity-60 inline-flex items-center gap-1 justify-center">
            {loggingIn && <Loader2 size={14} className="animate-spin" />} Sign in
          </button>
        </form>
        {who && (
          <div className="mt-3 text-sm text-muted-foreground">
            Logged in as <span className="font-medium text-foreground">{who.name}</span> · {roleLabel(who.roleName)} · token saved as <code>glowbalmart_token</code>
          </div>
        )}
      </Card>

      <div className="space-y-2">
        {ENDPOINTS.map((ep) => {
          const r = results[ep.path] || { status: "idle" as const };
          const isOpen = open[ep.path];
          return (
            <Card key={ep.path} className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted">{ep.method}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{ep.label}</div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">{ep.path}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {r.status === "loading" && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> loading</span>}
                  {r.status === "success" && <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={12} /> success</span>}
                  {r.status === "error" && <span className="text-xs text-destructive inline-flex items-center gap-1"><XCircle size={12} /> error</span>}
                  <button onClick={() => run(ep.path)} className="text-xs px-2 py-1 rounded border hover:bg-muted">Test</button>
                  {(r.data !== undefined || r.error) && (
                    <button onClick={() => setOpen((o) => ({ ...o, [ep.path]: !isOpen }))} className="text-xs px-2 py-1 rounded border hover:bg-muted inline-flex items-center gap-1">
                      <ChevronDown size={12} className={isOpen ? "rotate-180 transition-transform" : "transition-transform"} /> Response
                    </button>
                  )}
                </div>
              </div>
              {r.status === "error" && <div className="mt-2 text-xs text-destructive">{r.error}</div>}
              {isOpen && r.data !== undefined && (
                <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted p-3 text-[11px] leading-relaxed">{JSON.stringify(r.data, null, 2)}</pre>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
