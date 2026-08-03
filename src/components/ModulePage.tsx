import { type ReactNode } from "react";
import { PageHeader, Card, Empty } from "./AppShell";
import { Download, Search } from "lucide-react";
import { exportCSV } from "@/lib/export";

export function Toolbar({ children }: { children: ReactNode }) {
  return <Card className="p-3 mb-4 flex flex-wrap gap-2 items-center">{children}</Card>;
}

export function SearchInput({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-8 pr-3 py-2 rounded-lg border bg-background text-sm" />
    </div>
  );
}

export function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="px-2.5 py-2 rounded-lg border bg-background text-sm">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function ExportButton<T extends Record<string, any>>({ filename, rows }: { filename: string; rows: T[] }) {
  return (
    <button onClick={() => exportCSV(filename, rows)} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
      <Download size={14} /> Export CSV
    </button>
  );
}

export function PrimaryBtn({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-lg text-white font-medium shadow-md hover:shadow-lg transition-shadow" style={{ background: "var(--gradient-electric)" }}>
      {children}
    </button>
  );
}

export function KpiCard({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-2xl font-bold" style={accent ? { color: accent } : undefined}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

export function SectionTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between items-end gap-2 mb-3">
      <div>
        <div className="font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}

export function ComingSoon({ what }: { what: string }) {
  return (
    <Card className="p-4 flex items-center gap-3 border-dashed">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: "color-mix(in oklab, var(--electric) 18%, transparent)" }}>🔌</span>
      <div className="flex-1">
        <div className="font-medium text-sm">{what}</div>
        <div className="text-xs text-muted-foreground">Integration will be connected later. The UI is ready to wire up.</div>
      </div>
      <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-700">Coming soon</span>
    </Card>
  );
}

export { PageHeader, Card, Empty };
