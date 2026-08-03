import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty, ExportButton, SearchInput, FilterSelect } from "@/components/ModulePage";
import { listOrders, orderAllCallLogs, type ApiOrder, type MergedCallLog } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/call-logs")({
  head: () => ({ meta: [{ title: "Call Logs — Glowbalmart CRM" }] }),
  component: CallLogsPage,
});

interface Row extends MergedCallLog { order?: ApiOrder; }

const CHUNK = 15;

async function loadAllCallLogs(orders: ApiOrder[]): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < orders.length; i += CHUNK) {
    const chunk = orders.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map((o) => orderAllCallLogs(o.id).then((logs) => logs.map((l) => ({ ...l, order: o }))).catch(() => [] as Row[]))
    );
    out.push(...results.flat());
  }
  return out;
}

function CallLogsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [outcomeF, setOutcomeF] = useState("");
  const [staffF, setStaffF] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const orders = await listOrders();
      const flat = (await loadAllCallLogs(orders)).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setRows(flat);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load call logs"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const outcomes = useMemo(() => [...new Set(rows.map((r) => r.outcome).filter(Boolean))] as string[], [rows]);
  const staffNames = useMemo(() => [...new Set(rows.map((r) => r.staffName).filter(Boolean))] as string[], [rows]);

  const filtered = rows
    .filter((r) => !q || r.order?.customerName?.toLowerCase().includes(q.toLowerCase()) || r.order?.phone?.includes(q) || r.order?.code?.toLowerCase().includes(q.toLowerCase()))
    .filter((r) => !outcomeF || r.outcome === outcomeF)
    .filter((r) => !staffF || r.staffName === staffF)
    .filter((r) => !from || (r.createdAt || "") >= from)
    .filter((r) => !to || (r.createdAt || "") <= to + "T23:59:59");

  return (
    <>
      <PageHeader title="Call Logs" subtitle="Every call and treatment update recorded across orders from the backend." actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <ExportButton filename="call-logs.csv" rows={filtered.map(r => ({ Date: r.createdAt, Order: r.order?.code, Customer: r.order?.customerName, Phone: r.order?.phone, Staff: r.staffName, Attempt: r.attempt, Outcome: r.outcome, Notes: r.note || "" }))} />
        </div>
      } />

      <Card className="p-3 mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search customer, phone or order code…" />
        <FilterSelect value={staffF} onChange={setStaffF} options={[{ value: "", label: "All staff" }, ...staffNames.map((s) => ({ value: s, label: s }))]} />
        <FilterSelect value={outcomeF} onChange={setOutcomeF} options={[{ value: "", label: "All outcomes" }, ...outcomes.map((o) => ({ value: o, label: o.replace(/_/g, " ") }))]} />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2.5 py-2 rounded-lg border bg-background text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2.5 py-2 rounded-lg border bg-background text-sm" />
      </Card>

      <Card>
        {loading && rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading call activity…</div>
        ) : filtered.length === 0 ? (
          <Empty title="No call activity recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Date","Order","Customer","Phone","Staff","Attempt","Outcome","Notes"].map(h => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id || `${r.orderId}-${r.createdAt}`} className="border-t">
                    <td className="px-3 py-2 text-xs">{fmtDateTime(r.createdAt || "")}</td>
                    <td className="px-3 py-2 text-xs">{r.order ? <Link to="/orders/$id" params={{ id: r.order.id }} className="underline">{r.order.code}</Link> : "—"}</td>
                    <td className="px-3 py-2 font-medium">{r.order?.customerName || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.order?.phone || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.staffName || "—"}</td>
                    <td className="px-3 py-2">{r.attempt ?? "—"}</td>
                    <td className="px-3 py-2 text-xs capitalize">{(r.outcome || "").replace(/_/g, " ").toLowerCase()}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
