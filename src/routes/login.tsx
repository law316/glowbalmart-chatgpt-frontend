import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { apiLogin } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Glowbalmart CRM" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setSession = useStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await apiLogin(email, password);
      const u = setSession(token, user);
      toast.success(`Welcome, ${u.name}`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 text-white relative overflow-hidden" style={{ background: "var(--gradient-navy)" }}>
        <Logo />
        <div className="relative z-10">
          <h2 className="text-4xl font-bold leading-tight">Smart Sales Operations<br/>for Serious Ecommerce Teams.</h2>
          <p className="mt-4 text-white/70 max-w-md">Run your follow-up circle, embed order forms, manage finance and watch every sale close — from one premium control room.</p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {["3-Call Follow-up", "Embed Order Forms", "Finance & Commissions"].map((f) => (
              <div key={f} className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm">{f}</div>
            ))}
          </div>
        </div>
        <div className="text-xs text-white/40">© Glowbalmart CRM</div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full animate-glow" style={{ background: "radial-gradient(circle, oklch(0.65 0.2 250 / 0.4), transparent 70%)" }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Logo size={36} /></div>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back to your sales command room.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background outline-none focus:border-electric" />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background outline-none focus:border-electric" />
            </div>
            <button disabled={loading} className="w-full rounded-lg py-2.5 text-white font-medium disabled:opacity-60"
              style={{ background: "var(--gradient-electric)" }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="mt-8 rounded-xl bg-muted/50 border p-4 text-xs text-muted-foreground">
            Sign in with your Glowbalmart account credentials. Access is granted by your account owner.
          </div>
          <div className="mt-4 text-xs text-muted-foreground text-center">
            Enterprise software · public registration is disabled.{" "}
            <Link to="/system/create-owner" className="underline opacity-60 hover:opacity-100">System</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
