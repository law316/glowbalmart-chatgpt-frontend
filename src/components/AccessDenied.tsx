import { Link } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import type { Role } from "@/lib/types";

export function AccessDenied({ allowed, role }: { allowed: Role[]; role: Role }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-2xl border bg-card p-8 shadow-[var(--shadow-soft)]">
        <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-white"
          style={{ background: "var(--gradient-navy)" }}>
          <ShieldOff size={26} />
        </div>
        <h1 className="mt-4 text-xl font-bold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view this page. This module is restricted to{" "}
          <span className="font-medium text-foreground">{allowed.join(", ")}</span>.
          Your current role is <span className="font-medium capitalize text-foreground">{role}</span>.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/dashboard" className="px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ background: "var(--gradient-electric)" }}>Go to Dashboard</Link>
          <Link to="/call-queue" className="px-4 py-2 rounded-lg border text-sm">Open Call Queue</Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          If you believe this is a mistake, contact your workspace admin to update your role.
        </p>
      </div>
    </div>
  );
}

export function RoleGate({ allowed, role, children }: { allowed: Role[]; role: Role; children: React.ReactNode }) {
  if (!allowed.includes(role)) return <AccessDenied allowed={allowed} role={role} />;
  return <>{children}</>;
}
