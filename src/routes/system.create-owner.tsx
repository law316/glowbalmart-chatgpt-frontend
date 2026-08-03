import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/system/create-owner")({
  head: () => ({ meta: [{ title: "System — Create Owner" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: CreateOwnerPage,
});

function CreateOwnerPage() {
  const navigate = useNavigate();
  const createUser = useStore((s) => s.createUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createUser({ name, email, password, role: "admin", active: true });
    toast.success("Owner created. You can now sign in.");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--gradient-navy)" }}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Hidden system route</div>
        <h1 className="mt-1 text-2xl font-bold">Create Owner Account</h1>
        <p className="text-sm text-muted-foreground mt-1">Internal setup only. Do not share this link publicly.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border bg-background outline-none" />
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border bg-background outline-none" />
          <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border bg-background outline-none" />
          <button className="w-full rounded-lg py-2.5 text-white font-medium" style={{ background: "var(--gradient-electric)" }}>
            Create Owner
          </button>
        </form>
      </div>
    </div>
  );
}
