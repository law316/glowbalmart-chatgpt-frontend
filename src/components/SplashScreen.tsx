import { useEffect, useState } from "react";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 1800);
    const t2 = setTimeout(onDone, 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500 ${out ? "opacity-0" : "opacity-100"}`}
      style={{ background: "var(--gradient-navy)" }}>
      <div className="relative w-44 h-44 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full animate-glow"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.2 250 / 0.5), transparent 70%)" }} />
        <div className="relative w-28 h-28 rounded-full border-2 border-white/30 animate-orbit flex items-center justify-center">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white" />
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl"
            style={{ background: "var(--gradient-electric)" }}>
            ✓
          </div>
        </div>
      </div>
      <h1 className="mt-8 text-white text-4xl font-bold tracking-tight animate-fade-in-up">Glowbalmart CRM</h1>
      <p className="mt-2 text-white/70 text-sm tracking-widest uppercase animate-fade-in-up">
        Sales · Follow-ups · Finance · Intelligence
      </p>
    </div>
  );
}
