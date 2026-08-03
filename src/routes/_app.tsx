import { createFileRoute, Outlet, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { getToken } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const userId = useStore((s) => s.currentUserId);
  const hydrated = useStore((s) => s.hydrated);
  const restoring = useStore((s) => s.restoring);
  const restoreSession = useStore((s) => s.restoreSession);
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    if (getToken()) restoreSession();
    else if (userId) useStore.getState().logout();
  }, [hydrated, restoreSession, userId]);

  // global 401 handler
  useEffect(() => {
    const onUnauth = () => {
      logout();
      toast.error("Session expired. Please sign in again.");
      navigate({ to: "/login" });
    };
    window.addEventListener("glowbalmart:unauthorized", onUnauth as EventListener);
    return () => window.removeEventListener("glowbalmart:unauthorized", onUnauth as EventListener);
  }, [logout, navigate]);

  if (!hydrated || restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 rounded-full border-2 border-muted border-t-transparent animate-spin"
            style={{ borderTopColor: "var(--electric)" }} />
          <div className="text-sm">Restoring your session…</div>
        </div>
      </div>
    );
  }

  if (!userId) return <Navigate to="/login" />;
  return <AppShell><Outlet /></AppShell>;
}
