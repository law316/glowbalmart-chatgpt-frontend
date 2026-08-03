import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty, ExportButton } from "@/components/ModulePage";
import { fmtDateTime } from "@/lib/format";
import { listBroadcasts, type BroadcastRecord } from "@/lib/api";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/broadcast-history")({
  head: () => ({ meta: [{ title: "Broadcast History — Glowbalmart CRM" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const [rows, setRows] = useState<BroadcastRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState("");
  const [staff, setStaff] = useState("");
  const [campaign, setCampaign] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await listBroadcasts();
      setRows(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load broadcast history");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const channels = useMemo(() => Array.from(new Set((rows || []).map((r) => r.channel).filter(Boolean))) as string[], [rows]);
  const staffs = useMemo(() => Array.from(new Set((rows || []).map((r) => r.sentByName).filter(Boolean))) as string[], [rows]);
  const campaigns = useMemo(() => Array.from(new Set((rows || []).map((r) => r.campaignName).filter(Boolean))) as string[], [rows]);
  const statuses = useMemo(() => Array.from(new Set((rows || []).map((r) => r.status).filter(Boolean))) as string[], [rows]);

  const visible = (rows || []).filter((r) =>
    (!channel || r.channel === channel) &&
    (!staff || r.sentByName === staff) &&
    (!campaign || r.campaignName === campaign) &&
    (!status || r.status === status)
  );

  return (
    <>
      <PageHeader title="Broadcast History" subtitle="Past broadcasts and campaigns across all channels." actions={
        <>
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <ExportButton filename="broadcasts.csv" rows={visible.map((r) => ({ Title: r.title || r.subject || "", Channel: r.channel || "", SentBy: r.sentByName || "", Recipients: r.recipientCount ?? "", Template: r.templateName || "", Status: r.status || "", Date: r.createdAt ? fmtDateTime(r.createdAt) : "" }))} />
        </>
      } />

      {rows && rows.length > 0 && (
        <Card className="p-3 mb-4 flex flex-wrap gap-2">
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
            <option value="">All channels</option>
            {channels.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={staff} onChange={(e) => setStaff(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
            <option value="">All staff</option>
            {staffs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
            <option value="">All campaigns</option>
            {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading broadcast history…</div>
        ) : rows === null ? (
          <Empty title="Broadcast history is not available on the server yet." />
        ) : rows.length === 0 ? (
          <Empty title="No broadcasts yet." />
        ) : visible.length === 0 ? (
          <Empty title="No broadcasts match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Title", "Channel", "Sent by", "Recipients", "Template", "Status", "Date"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.title || r.subject || "—"}</td>
                    <td className="px-3 py-2"><span className="text-[10px] px-2 py-0.5 rounded-full capitalize bg-muted">{r.channel || "—"}</span></td>
                    <td className="px-3 py-2 text-xs">{r.sentByName || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.recipientCount ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground line-clamp-1">{r.templateName || "—"}</td>
                    <td className="px-3 py-2 text-xs capitalize">{(r.status || "—").toLowerCase()}</td>
                    <td className="px-3 py-2 text-xs">{r.createdAt ? fmtDateTime(r.createdAt) : "—"}</td>
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
