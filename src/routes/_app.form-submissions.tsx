import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { fmtDateTime, NGN } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { exportCSV } from "@/lib/export";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { listOrders, listProducts, type ApiOrder, type ApiProduct } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/form-submissions")({
  head: () => ({ meta: [{ title: "Form Submissions — Glowbalmart CRM" }] }),
  component: SubmissionsPage,
});

function SubmissionsPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [form, setForm] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [os, ps] = await Promise.all([listOrders(), listProducts().catch(() => [] as ApiProduct[])]);
      setOrders(os);
      setProducts(ps);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load submissions"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const productById = useMemo(() => {
    const m = new Map<string, ApiProduct>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  // Only real backend form submissions: orders that originated from a form
  const submissions = useMemo(() =>
    orders.filter((o) => !!(o.formId || o.formName)),
    [orders]);

  const formOptions = useMemo(() => {
    const s = new Map<string, string>();
    for (const o of submissions) {
      const key = o.formId || o.formName || "";
      if (key) s.set(key, o.formName || key);
    }
    return Array.from(s.entries());
  }, [submissions]);

  const list = useMemo(() => submissions
    .filter((o) => !form || (o.formId || o.formName) === form)
    .filter((o) => !q ||
      o.customerName?.toLowerCase().includes(q.toLowerCase()) ||
      o.phone?.includes(q) ||
      (o.code || "").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [submissions, form, q]);

  const productLabel = (o: ApiOrder) => {
    const p = o.inventoryProductId ? productById.get(o.inventoryProductId) : undefined;
    if (p) return `${p.name}${p.sku ? ` · ${p.sku}` : ""}`;
    if (o.inventoryProductName) return o.inventoryProductName;
    return "—";
  };

  return (
    <>
      <PageHeader title="Form Submissions" subtitle={`${list.length} real submissions from backend`} actions={
        <>
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <button onClick={() => exportCSV("form-submissions.csv", list.map((o) => ({
            Code: o.code || o.id.slice(0, 8), Form: o.formName || o.formId || "—",
            Customer: o.customerName, Phone: o.phone, Package: o.packageName || "—",
            Product: productLabel(o), Price: o.price, Status: o.status || "—",
            Submitted: o.createdAt || "",
          })))} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted"><Download size={14} /> Excel</button>
        </>
      } />

      <Card className="p-3 mb-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone or code…"
          className="px-3 py-2 rounded-lg border bg-background text-sm flex-1 min-w-[200px]" />
        <select value={form} onChange={(e) => setForm(e.target.value)} className="px-3 py-2 rounded-lg border bg-background text-sm">
          <option value="">All forms</option>
          {formOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </Card>

      <Card>
        {loading && submissions.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading submissions…</div>
        ) : list.length === 0 ? <Empty title="No form submissions yet" hint="Submissions from your public sales forms will appear here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Code","Form","Customer","Phone","Package","Product","Price","Status","Submitted",""].map(h => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {list.map(o => (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{o.code || o.id.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-xs">{o.formName || o.formId || "—"}</td>
                    <td className="px-3 py-2">{o.customerName}</td>
                    <td className="px-3 py-2 text-xs">{o.phone}</td>
                    <td className="px-3 py-2">{o.packageName || "—"}</td>
                    <td className="px-3 py-2 text-xs">{productLabel(o)}</td>
                    <td className="px-3 py-2">{NGN(o.price)}</td>
                    <td className="px-3 py-2"><StatusBadge status={(o.status || "new").toLowerCase()} /></td>
                    <td className="px-3 py-2 text-xs">{o.createdAt ? fmtDateTime(o.createdAt) : "—"}</td>
                    <td className="px-3 py-2"><Link to="/orders/$id" params={{ id: o.id }} className="text-xs underline">Open</Link></td>
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
