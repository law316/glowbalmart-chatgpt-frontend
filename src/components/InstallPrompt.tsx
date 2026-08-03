import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const dismissed = localStorage.getItem("gbm-install-dismissed");
    if (dismissed) return;
    const t = setTimeout(() => setShow(true), 6000);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed bottom-6 left-6 z-40 max-w-sm glass-card p-4 flex items-start gap-3 animate-fade-in-up">
      <div className="rounded-lg p-2 text-white" style={{ background: "var(--gradient-electric)" }}>
        <Download size={18} />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-sm">Install Glowbalmart CRM</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Add it to your home screen and use it like a native app — works on desktop, tablet and mobile.
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={() => { localStorage.setItem("gbm-install-dismissed", "1"); setShow(false); alert("To install: in your browser menu, choose 'Install app' or 'Add to Home screen'."); }}
            className="text-xs px-3 py-1.5 rounded-md text-white" style={{ background: "var(--gradient-electric)" }}>
            Install
          </button>
          <button onClick={() => { localStorage.setItem("gbm-install-dismissed", "1"); setShow(false); }}
            className="text-xs px-3 py-1.5 rounded-md hover:bg-muted">Later</button>
        </div>
      </div>
      <button onClick={() => setShow(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
    </div>
  );
}
