import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/ModulePage";
import { exportCSV } from "@/lib/export";
import { fmtDate } from "@/lib/format";
import { Loader2, RefreshCw, Download, Mail, Search } from "lucide-react";
import {
  emailAudience, listForms, apiMe, campaignsForPromoter, createBroadcast,
  type EmailAudienceRow, type ApiForm,
} from "@/lib/api";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/email-marketing")({
  head: () => ({
    meta: [
      { title: "Email Marketing — Glowbalmart CRM" },
      { name: "description", content: "Real customer email audience captured from Glowbalmart orders and sales forms." },
      { property: "og:title", content: "Email Marketing — Glowbalmart CRM" },
      { property: "og:description", content: "Real customer email audience captured from Glowbalmart orders and sales forms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmailMarketingPage,
});

function applyPlaceholders(body: string, r: EmailAudienceRow) {
  return body
    .replace(/\{\{\s*name\s*\}\}/gi, r.customerName || "")
    .replace(/\{\{\s*package\s*\}\}/gi, r.lastPackage || "")
    .replace(/\{\{\s*code\s*\}\}/gi, r.campaign || "")
    .replace(/\{\{\s*price\s*\}\}/gi, "")
    .replace(/\{\{\s*phone\s*\}\}/gi, r.phone || "")
    .replace(/\{\{\s*state\s*\}\}/gi, r.state || "")
    .replace(/\{\{\s*email\s*\}\}/gi, r.email || "");
}

function EmailMarketingPage() {
  const templates = useStore((s) => s.templates).filter((t) => t.channel === "email");
  const [rows, setRows] = useState<EmailAudienceRow[]>([]);
  const [forms, setForms] = useState<ApiForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [pkgFilter, setPkgFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [isPromoter, setIsPromoter] = useState(false);
  const [promoterCampaigns, setPromoterCampaigns] = useState<string[] | null>(null);

  const [templateId, setTemplateId] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, f, me] = await Promise.all([
        emailAudience().catch(() => []),
        listForms().catch(() => []),
        apiMe().catch(() => null),
      ]);
      setRows(a);
      setForms(f);
      if (me && (me.roleName || "").toUpperCase() === "MEDIA_PROMOTER") {
        setIsPromoter(true);
        const camps = await campaignsForPromoter(me.id).catch(() => []);
        setPromoterCampaigns(camps.map((c) => c.name));
      } else {
        setIsPromoter(false);
        setPromoterCampaigns(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load audience");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const scopedRows = useMemo(() => {
    if (!isPromoter) return rows;
    if (!promoterCampaigns || promoterCampaigns.length === 0) return [];
    const set = new Set(promoterCampaigns);
    return rows.filter((r) => r.campaign && set.has(r.campaign));
  }, [rows, isPromoter, promoterCampaigns]);

  const campaigns = useMemo(() => Array.from(new Set(scopedRows.map((r) => r.campaign).filter(Boolean))) as string[], [scopedRows]);
  const states = useMemo(() => Array.from(new Set(scopedRows.map((r) => r.state).filter(Boolean))) as string[], [scopedRows]);
  const packages = useMemo(() => Array.from(new Set(scopedRows.map((r) => r.lastPackage).filter(Boolean))) as string[], [scopedRows]);

  const visible = scopedRows.filter((r) => {
    const t = q.trim().toLowerCase();
    const matchQ = !t || r.customerName.toLowerCase().includes(t) || r.email.toLowerCase().includes(t) || (r.phone || "").includes(t);
    const matchSource = !source || r.campaign === source;
    const matchState = !stateFilter || r.state === stateFilter;
    const matchPkg = !pkgFilter || r.lastPackage === pkgFilter;
    const status = (r.lastStatus || "").toUpperCase();
    const isDelivered = status === "DELIVERED";
    const isUnpaid = status.includes("UNPAID") || status === "NEW" || status === "PENDING";
    const matchStatus = !statusFilter || statusFilter === "all"
      || (statusFilter === "delivered" && isDelivered)
      || (statusFilter === "unpaid" && isUnpaid);
    return matchQ && matchSource && matchState && matchPkg && matchStatus;
  });
  const subscribed = visible.filter((r) => !r.unsubscribed);
  const selectedRows = visible.filter((r) => selected.has(r.email));

  const toggleAll = () => {
    if (visible.every((r) => selected.has(r.email))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((r) => r.email)));
    }
  };
  const toggleOne = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  };

  const copyAll = async () => {
    if (!subscribed.length) return toast.error("No emails to copy");
    await navigator.clipboard.writeText(subscribed.map((r) => r.email).join(", "));
    toast.success(`${subscribed.length} email addresses copied`);
  };
  const copySelected = async () => {
    if (!selectedRows.length) return toast.error("No emails selected");
    await navigator.clipboard.writeText(selectedRows.map((r) => r.email).join(", "));
    toast.success(`${selectedRows.length} email addresses copied`);
  };

  const template = templates.find((t) => t.id === templateId);
  const previewSample = selectedRows[0] || visible[0];
  const previewBody = template && previewSample ? applyPlaceholders(template.body, previewSample) : template?.body || "";

  const saveDraft = async () => {
    if (!template) return toast.error("Select an email template first");
    if (!selectedRows.length) return toast.error("Select at least one recipient");
    setSavingDraft(true);
    try {
      const res = await createBroadcast({
        title: template.name,
        channel: "EMAIL",
        recipientCount: selectedRows.length,
        templateName: template.name,
        status: "DRAFT",
      });
      if (res === null) {
        toast.error("Broadcast history is not available on the server yet — draft was not saved.");
      } else {
        toast.success("Draft saved to Broadcast History");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const Kpi = ({ l, v }: { l: string; v: string | number }) => (
    <Card className="p-3"><div className="text-xs uppercase text-muted-foreground">{l}</div><div className="mt-1 text-xl font-bold">{v}</div></Card>
  );

  return (
    <>
      <PageHeader title="Email Marketing" subtitle="Your real customer email audience, captured from live orders and sales forms." actions={
        <>
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <button onClick={copyAll} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><Mail size={14} /> Copy all filtered emails</button>
          <button onClick={copySelected} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><Mail size={14} /> Copy selected emails</button>
          <button onClick={() => exportCSV("email-audience.csv", visible.map((r) => ({ Name: r.customerName, Email: r.email, Phone: r.phone || "", State: r.state || "", Package: r.lastPackage || "", Status: r.lastStatus || "", Campaign: r.campaign || "", Captured: r.capturedAt ? fmtDate(r.capturedAt) : "" })))} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><Download size={14} /> CSV</button>
        </>
      } />

      {isPromoter && (!promoterCampaigns || promoterCampaigns.length === 0) && (
        <Card className="p-3 mb-4 text-sm text-muted-foreground">You are not assigned to any campaigns yet, so no customer emails are shown.</Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi l="Contacts with email" v={scopedRows.length} />
        <Kpi l="Subscribed" v={scopedRows.filter((r) => !r.unsubscribed).length} />
        <Kpi l="Campaign sources" v={campaigns.length} />
        <Kpi l="Live sales forms" v={forms.filter((f) => f.active !== false).length} />
      </div>

      <Card className="p-3 mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone…" className="w-full pl-8 pr-3 py-2 rounded border bg-background text-sm" />
        </div>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
          <option value="">All campaign sources</option>
          {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
          <option value="">All statuses</option>
          <option value="delivered">Delivered</option>
          <option value="unpaid">Unpaid</option>
          <option value="all">All</option>
        </select>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={pkgFilter} onChange={(e) => setPkgFilter(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
          <option value="">All packages</option>
          {packages.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="ml-auto self-center text-xs text-muted-foreground">{visible.length} contacts · {selected.size} selected</div>
      </Card>

      <Card>
        {loading && rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading audience…</div>
        ) : visible.length === 0 ? (
          <Empty title="No customer emails yet" hint="Emails appear here once customers submit a sales form with an email address." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>
                <th className="px-3 py-2"><input type="checkbox" checked={visible.length > 0 && visible.every((r) => selected.has(r.email))} onChange={toggleAll} /></th>
                {["Customer", "Email", "Phone", "State", "Last package", "Status", "Source", "Captured"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}
              </tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.email} className="border-t">
                    <td className="px-3 py-2"><input type="checkbox" checked={selected.has(r.email)} onChange={() => toggleOne(r.email)} /></td>
                    <td className="px-3 py-2 font-medium">{r.customerName}</td>
                    <td className="px-3 py-2 text-xs">{r.email}{r.unsubscribed && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700">unsubscribed</span>}</td>
                    <td className="px-3 py-2 text-xs">{r.phone || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.state || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.lastPackage || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.lastStatus || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.campaign || "Direct"}</td>
                    <td className="px-3 py-2 text-xs">{r.capturedAt ? fmtDate(r.capturedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Email templates</div>
          <Link to="/message-templates" className="text-xs underline">Manage all templates →</Link>
        </div>
        {templates.length === 0 ? <Empty title="No email templates yet" hint="Create a template to reuse for broadcasts." /> : (
          <div className="grid md:grid-cols-2 gap-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border p-3">
                <div className="text-sm font-medium">{t.name}</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{t.body}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 mt-4">
        <div className="font-semibold mb-3">Broadcast draft</div>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm">
            <option value="">Select email template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={saveDraft} disabled={savingDraft} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted disabled:opacity-50">
            {savingDraft ? <Loader2 size={14} className="animate-spin" /> : null} Save draft to Broadcast History
          </button>
        </div>
        {template && (
          <div className="rounded-lg border p-3 bg-muted/30 text-sm whitespace-pre-wrap">
            {previewSample ? previewBody : "Select at least one recipient to preview with real data."}
          </div>
        )}
        <div className="mt-3 text-xs text-muted-foreground">Email provider not connected. You can prepare and preview broadcast, but live sending is disabled.</div>
      </Card>
    </>
  );
}
