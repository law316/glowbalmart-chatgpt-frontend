import { useEffect, useState } from "react";

const REMOTE_LOGO = "https://i.postimg.cc/RNS9Nj0x/glowbalmart-logo.png";

export function Logo({ size = 32 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex items-center gap-2.5">
      {failed ? (
        <div
          className="relative rounded-full flex items-center justify-center text-white font-bold"
          style={{ width: size, height: size, background: "var(--gradient-electric)", boxShadow: "0 0 16px oklch(0.65 0.2 250 / 0.5)" }}
        >
          <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="white" strokeWidth="2.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 13l2.5 2.5L16 10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        <img
          src={REMOTE_LOGO}
          alt="Glowbalmart CRM"
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="rounded-full object-cover"
          style={{ width: size, height: size, boxShadow: "0 0 16px oklch(0.65 0.2 250 / 0.35)" }}
        />
      )}
      <div className="leading-tight">
        <div className="font-bold tracking-tight">Glowbalmart</div>
        <div className="text-[10px] uppercase tracking-widest opacity-60 -mt-0.5">CRM</div>
      </div>
    </div>
  );
}

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("gbm-theme") as "light" | "dark") || "light";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("gbm-theme", theme);
  }, [theme]);
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
