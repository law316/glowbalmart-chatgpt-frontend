import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card } from "@/components/AppShell";
import { downloadReport, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { Download, FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports — Glowbalmart CRM" }] }),
  component: ReportsPage,
});

interface Rep { title: string; desc: string; csv: string; pdf?: string; }

const REPORTS: Rep[] = [
  { title: "Orders Report", desc: "All orders with customer, package, status.", csv: "/api/reports/export/orders" },
  { title: "Finance Report", desc: "Payments, expenses and reconciliations.", csv: "/api/reports/export/finance" },
  { title: "Staff Performance", desc: "Staff earnings/performance records from the backend.", csv: "/api/reports/export/staff-performance" },
  { title: "Follow-up Report", desc: "Order follow-up fields and progression.", csv: "/api/reports/export/follow-ups" },
  { title: "Inventory Report", desc: "Stock levels, costs and valuations.", csv: "/api/reports/export/inventory-products" },
  { title: "Stock Movements", desc: "Warehouse and agent stock movement history.", csv: "/api/reports/export/stock-movements" },
  { title: "Delivery Manifest", desc: "Assigned, out-for-delivery and delivered orders.", csv: "/api/reports/export/delivery-manifest" },
];

function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<Record<string, boolean>>({});

  const range = () => {
    const q: string[] = [];
    if (from) q.push(`from=${from}`);
    if (to) q.push(`to=${to}`);
    return q.length ? "?" + q.join("&") : "";
  };

  const download = async (r: Rep, kind: "csv" | "pdf") => {
    const url = kind === "csv" ? r.csv : r.pdf;
    if (!url) return;
    const key = r.title + kind;
    setBusy(key);
    try {
      await downloadReport(url + range(), `${r.title.replace(/\s+/g, "-").toLowerCase()}.${kind === "csv" ? "csv" : "pdf"}`);
      setUnavailable((u) => ({ ...u, [key]: false }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Download failed";
      toast.error(msg);
      if (e instanceof ApiError && [404, 501].includes(e.status)) {
        setUnavailable((u) => ({ ...u, [key]: true }));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Reports" subtitle="Download live reports straight from the backend." />
      <Card className="p-3 mb-4 flex flex-wrap gap-4 items-end">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Start date <span className="text-[10px]">(optional · day/month/year)</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 rounded border bg-background text-sm text-foreground" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          End date <span className="text-[10px]">(optional · day/month/year)</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 rounded border bg-background text-sm text-foreground" />
        </label>
        <button onClick={() => { setFrom(""); setTo(""); }} className="text-xs text-muted-foreground underline mb-1.5">Reset</button>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        {REPORTS.map((r) => (
          <Card key={r.title} className="p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{r.desc}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => download(r, "csv")} disabled={!!busy} className="text-sm px-3 py-1.5 rounded border hover:bg-muted inline-flex items-center gap-1 disabled:opacity-50">
                  {busy === r.title + "csv" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Excel
                </button>
                {r.pdf && (
                  <button onClick={() => download(r, "pdf")} disabled={!!busy} className="text-sm px-3 py-1.5 rounded border hover:bg-muted inline-flex items-center gap-1 disabled:opacity-50">
                    {busy === r.title + "pdf" ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF
                  </button>
                )}
              </div>
            </div>
            {(unavailable[r.title + "csv"] || unavailable[r.title + "pdf"]) && (
              <div className="text-xs text-amber-600">This report is not available on the server yet.</div>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-4 mt-4 text-xs text-muted-foreground">
        Reports stream directly from the Glowbalmart backend. If a range is set, only records within that window are included.
      </Card>
    </>
  );
}
