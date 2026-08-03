import { Sparkles } from "lucide-react";
import { Card } from "./AppShell";

export function ComingSoon({ title = "Coming soon", hint }: { title?: string; hint?: string }) {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-white"
        style={{ background: "var(--gradient-electric)" }}>
        <Sparkles size={22} />
      </div>
      <div className="mt-4 font-semibold text-lg">{title}</div>
      {hint && <div className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">{hint}</div>}
    </Card>
  );
}
