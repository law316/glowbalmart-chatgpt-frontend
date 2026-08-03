import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { AccessDenied } from "@/components/AccessDenied";
import { useCurrentUser } from "@/lib/store";
import { NGN } from "@/lib/format";
import {
  salesManagerSummary, listSMDailyReports, createSMDailyReport,
  listSMRemittances, createSMRemittance, ledgerAccounts, listDeliveryAgents,
  listProducts, roleLabel,
  type SalesManagerSummary, type SMDailyReport, type SMRemittance,
  type LedgerAccount, type DeliveryAgent, type ApiProduct,
} from "@/lib/api";
import { Loader2, Trophy } from "lucide-react";

export const Route = createFileRoute("/_app/sales-manager-office")({
  head: () => ({
    meta: [
      { title: "Sales Manager Office — Glowbalmart CRM" },
      { name: "description", content: "Daily sales performance, cohort achievement and delivery agent remittances in one control room." },
      { property: "og:title", content: "Sales Manager Office — Glowbalmart CRM" },
      { property: "og:description", content: "Daily sales performance, cohort achievement and delivery agent remittances in one control room." },
    ],
  }),
  component: SalesManagerOffice,
});

const inputCls = "w-full mt-1 px-3 py-2 rounded border bg-background text-sm";
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block text-xs font-medium">{label}{children}</label>
);

const emptyReport = {
  reportDate: new Date().toISOString().slice(0, 10),
  state: "", deliveryAgentId: "", productId: "", orderCode: "", customerName: "",
  quantityDelivered: 0, unitPrice: 0,
  paymentStatus: "PENDING_PAYMENT", amountPaid: 0,
  ledgerAccountId: "", paymentMethod: "", reference: "", notes: "",
};
const emptyRemit = {
  deliveryAgentId: "", periodStart: "", periodEnd: "",
  expectedAmount: 0, paidAmount: 0, status: "PENDING",
  ledgerAccountId: "", paymentMethod: "", reference: "", notes: "",
};

function SalesManagerOffice() {
  const user = useCurrentUser();
  const code = (user?.roleName || "").toUpperCase();
  const allowed = ["OWNER", "ADMIN", "MANAGER", "SALES_MANAGER"].includes(code) || user?.role === "admin" || user?.role === "manager";

  const [summary, setSummary] = useState<SalesManagerSummary | null>(null);
  const [reports, setReports] = useState<SMDailyReport[]>([]);
  const [remits, setRemits] = useState<SMRemittance[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingR, setSavingR] = useState(false);
  const [savingM, setSavingM] = useState(false);
  const [rf, setRf] = useState({ ...emptyReport });
  const [mf, setMf] = useState({ ...emptyRemit });

  const load = async () => {
    setLoading(true);
    const [s, r, m, a, ag, p] = await Promise.all([
      salesManagerSummary().catch(() => null),
      listSMDailyReports().catch(() => []),
      listSMRemittances().catch(() => []),
      ledgerAccounts(true).catch(() => []),
      listDeliveryAgents().catch(() => []),
      listProducts().catch(() => []),
    ]);
    setSummary(s); setReports(r); setRemits(m); setAccounts(a); setAgents(ag); setProducts(p);
    setLoading(false);
  };
  useEffect(() => { if (allowed) load(); }, [allowed]);

  const expectedRevenue = num(rf.quantityDelivered) * num(rf.unitPrice);
  const amountPaid = rf.paymentStatus === "PENDING_PAYMENT" ? 0 : num(rf.amountPaid);
  const amountPending =
    rf.paymentStatus === "PAID" ? 0
      : rf.paymentStatus === "PENDING_PAYMENT" ? expectedRevenue
        : Math.max(0, expectedRevenue - amountPaid);

  const remitPending = Math.max(0, num(mf.expectedAmount) - num(mf.paidAmount));

  const agentName = (id?: string) => agents.find((a) => a.id === id)?.agentName || id || "—";
  const productName = (id?: string) => products.find((p) => p.id === id)?.name || id || "—";

  const cohorts: any[] = useMemo(() => (summary?.cohorts as any[]) || [], [summary]);
  const salesAgents: any[] = useMemo(() => ((summary?.salesAgents || summary?.agents) as any[]) || [], [summary]);

  if (!allowed) return <AccessDenied allowed={["admin", "manager"]} role={user?.role || "staff"} />;

  const saveReport = async () => {
    if (!rf.deliveryAgentId || !rf.productId) { toast.error("Select a delivery agent and product."); return; }
    setSavingR(true);
    try {
      await createSMDailyReport({
        ...rf,
        quantityDelivered: num(rf.quantityDelivered),
        unitPrice: num(rf.unitPrice),
        expectedRevenue, amountPaid, amountPending,
        ledgerAccountId: rf.ledgerAccountId || undefined,
      });
      toast.success("Daily delivery report saved.");
      setRf((p) => ({ ...p, quantityDelivered: 0, unitPrice: 0, amountPaid: 0, orderCode: "", customerName: "", reference: "", notes: "" }));
      const r = await listSMDailyReports().catch(() => []);
      setReports(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save report.");
    } finally { setSavingR(false); }
  };

  const saveRemit = async () => {
    if (!mf.deliveryAgentId) { toast.error("Select a delivery agent."); return; }
    setSavingM(true);
    try {
      await createSMRemittance({
        ...mf,
        expectedAmount: num(mf.expectedAmount),
        paidAmount: num(mf.paidAmount),
        pendingAmount: mf.status === "PAID" ? 0 : remitPending,
        ledgerAccountId: mf.ledgerAccountId || undefined,
      });
      toast.success("Remittance saved.");
      setMf((p) => ({ ...p, expectedAmount: 0, paidAmount: 0, reference: "", notes: "" }));
      const m = await listSMRemittances().catch(() => []);
      setRemits(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save remittance.");
    } finally { setSavingM(false); }
  };

  const Kpi = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Sales Manager Office" subtitle="Today's sales, cohort achievement, agent reports and remittances." />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading live data…</div>
      ) : (
        <div className="space-y-8">
          {/* A. today */}
          <section>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sales today</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Orders assigned today" value={num(summary?.ordersAssignedToday)} />
              <Kpi label="Delivered today" value={num(summary?.deliveredToday)} />
              <Kpi label="Pending follow-ups" value={num(summary?.pendingFollowUps)} />
              <Kpi label="Failed / cancelled" value={num(summary?.failedOrCancelled)} />
              <Kpi label="Conversion rate" value={`${num(summary?.conversionRate).toFixed(1)}%`} />
              <Kpi label="Revenue expected" value={NGN(num(summary?.revenueExpected))} />
              <Kpi label="Revenue paid" value={NGN(num(summary?.revenuePaid))} />
              <Kpi label="Pending from delivery agents" value={NGN(num(summary?.revenuePendingFromDeliveryAgents))} />
            </div>
          </section>

          {/* B. cohorts */}
          <section>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Cohort snapshots</div>
            <Card className="overflow-x-auto">
              {cohorts.length === 0 ? <Empty title="No cohort data yet" hint="Cohort performance appears once leads are assigned." /> : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>{["Cohort", "Members", "Assigned", "Delivered", "Target %", "Achievement %", "Commission", "Earned", "Status"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {cohorts.map((c, i) => {
                      const met = c.targetMet ?? (num(c.achievementPercent) >= num(c.targetPercent));
                      return (
                        <tr key={c.cohortId || c.id || i} className="border-t">
                          <td className="px-3 py-2 font-medium">{c.cohortName || c.name || "—"}</td>
                          <td className="px-3 py-2">{num(c.members ?? c.memberCount)}</td>
                          <td className="px-3 py-2">{num(c.assignedLeads)}</td>
                          <td className="px-3 py-2">{num(c.deliveredLeads)}</td>
                          <td className="px-3 py-2">{num(c.targetPercent)}%</td>
                          <td className="px-3 py-2">{num(c.achievementPercent).toFixed(1)}%</td>
                          <td className="px-3 py-2">{NGN(num(c.commissionValue))}</td>
                          <td className="px-3 py-2">{NGN(num(c.commissionEarned))}</td>
                          <td className="px-3 py-2">
                            {met
                              ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><Trophy size={12} /> Congratulations! Target reached.</span>
                              : <span className="text-xs text-muted-foreground">In progress</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          </section>

          {/* C. sales agents */}
          <section>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sales agent snapshots</div>
            <Card className="overflow-x-auto">
              {salesAgents.length === 0 ? <Empty title="No sales agent data yet" /> : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>{["Staff", "Role", "Assigned", "Delivered", "Pending", "Conversion"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {salesAgents.map((a, i) => (
                      <tr key={a.userId || a.id || i} className="border-t">
                        <td className="px-3 py-2 font-medium">{a.name || a.staffName || "—"}</td>
                        <td className="px-3 py-2">{roleLabel(a.roleName)}</td>
                        <td className="px-3 py-2">{num(a.assignedLeads)}</td>
                        <td className="px-3 py-2">{num(a.deliveredLeads)}</td>
                        <td className="px-3 py-2">{num(a.pendingLeads)}</td>
                        <td className="px-3 py-2">{num(a.conversionRate).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </section>

          {/* D. daily report */}
          <section>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Daily delivery report</div>
            <Card className="p-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Date"><input type="date" value={rf.reportDate} onChange={(e) => setRf({ ...rf, reportDate: e.target.value })} className={inputCls} /></Field>
                <Field label="State / location"><input value={rf.state} onChange={(e) => setRf({ ...rf, state: e.target.value })} className={inputCls} placeholder="Rivers" /></Field>
                <Field label="Delivery agent">
                  <select value={rf.deliveryAgentId} onChange={(e) => setRf({ ...rf, deliveryAgentId: e.target.value })} className={inputCls}>
                    <option value="">Select agent</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.agentName}{a.agentCode ? ` (${a.agentCode})` : ""}</option>)}
                  </select>
                </Field>
                <Field label="Product">
                  <select value={rf.productId} onChange={(e) => setRf({ ...rf, productId: e.target.value })} className={inputCls}>
                    <option value="">Select product</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Order code (optional)"><input value={rf.orderCode} onChange={(e) => setRf({ ...rf, orderCode: e.target.value })} className={inputCls} /></Field>
                <Field label="Customer name (optional)"><input value={rf.customerName} onChange={(e) => setRf({ ...rf, customerName: e.target.value })} className={inputCls} /></Field>
                <Field label="Quantity delivered"><input type="number" min={0} value={rf.quantityDelivered} onChange={(e) => setRf({ ...rf, quantityDelivered: +e.target.value })} className={inputCls} /></Field>
                <Field label="Unit price"><input type="number" min={0} value={rf.unitPrice} onChange={(e) => setRf({ ...rf, unitPrice: +e.target.value })} className={inputCls} /></Field>
                <Field label="Expected revenue"><input readOnly value={expectedRevenue} className={`${inputCls} bg-muted`} /></Field>
                <Field label="Payment status">
                  <select value={rf.paymentStatus} onChange={(e) => setRf({ ...rf, paymentStatus: e.target.value })} className={inputCls}>
                    <option value="PENDING_PAYMENT">Pending payment</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="PAID">Paid</option>
                  </select>
                </Field>
                <Field label="Amount paid">
                  <input type="number" min={0} disabled={rf.paymentStatus === "PENDING_PAYMENT"}
                    value={rf.paymentStatus === "PAID" ? expectedRevenue : rf.amountPaid}
                    onChange={(e) => setRf({ ...rf, amountPaid: +e.target.value })} className={inputCls} />
                </Field>
                <Field label="Amount pending"><input readOnly value={amountPending} className={`${inputCls} bg-muted`} /></Field>
                <Field label="Ledger account (optional)">
                  <select value={rf.ledgerAccountId} onChange={(e) => setRf({ ...rf, ledgerAccountId: e.target.value })} className={inputCls}>
                    <option value="">None</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label="Payment method"><input value={rf.paymentMethod} onChange={(e) => setRf({ ...rf, paymentMethod: e.target.value })} className={inputCls} placeholder="Transfer" /></Field>
                <Field label="Reference"><input value={rf.reference} onChange={(e) => setRf({ ...rf, reference: e.target.value })} className={inputCls} /></Field>
                <Field label="Notes"><input value={rf.notes} onChange={(e) => setRf({ ...rf, notes: e.target.value })} className={inputCls} /></Field>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setRf({ ...emptyReport })} className="px-3 py-2 text-sm rounded border">Clear form</button>
                <button onClick={saveReport} disabled={savingR} className="inline-flex items-center gap-1 px-4 py-2 text-sm rounded text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                  {savingR && <Loader2 size={14} className="animate-spin" />} Save daily report
                </button>
              </div>
            </Card>

            <Card className="mt-3 overflow-x-auto">
              {reports.length === 0 ? <Empty title="No daily reports yet" /> : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>{["Date", "State", "Agent", "Product", "Qty", "Expected", "Paid", "Pending", "Status"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {reports.slice(0, 25).map((r, i) => (
                      <tr key={r.id || i} className="border-t">
                        <td className="px-3 py-2">{(r.reportDate || r.date || "").slice(0, 10)}</td>
                        <td className="px-3 py-2">{r.state || "—"}</td>
                        <td className="px-3 py-2">{r.deliveryAgentName || agentName(r.deliveryAgentId)}</td>
                        <td className="px-3 py-2">{r.productName || productName(r.productId)}</td>
                        <td className="px-3 py-2">{num(r.quantityDelivered)}</td>
                        <td className="px-3 py-2">{NGN(num(r.expectedRevenue))}</td>
                        <td className="px-3 py-2">{NGN(num(r.amountPaid))}</td>
                        <td className="px-3 py-2">{NGN(num(r.amountPending))}</td>
                        <td className="px-3 py-2 text-xs">{(r.paymentStatus || "").replace(/_/g, " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </section>

          {/* E. remittances */}
          <section>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Delivery agent remittances</div>
            <Card className="p-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Delivery agent">
                  <select value={mf.deliveryAgentId} onChange={(e) => setMf({ ...mf, deliveryAgentId: e.target.value })} className={inputCls}>
                    <option value="">Select agent</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.agentName}{a.agentCode ? ` (${a.agentCode})` : ""}</option>)}
                  </select>
                </Field>
                <Field label="Period start"><input type="date" value={mf.periodStart} onChange={(e) => setMf({ ...mf, periodStart: e.target.value })} className={inputCls} /></Field>
                <Field label="Period end"><input type="date" value={mf.periodEnd} onChange={(e) => setMf({ ...mf, periodEnd: e.target.value })} className={inputCls} /></Field>
                <Field label="Expected amount"><input type="number" min={0} value={mf.expectedAmount} onChange={(e) => setMf({ ...mf, expectedAmount: +e.target.value })} className={inputCls} /></Field>
                <Field label="Paid amount"><input type="number" min={0} value={mf.paidAmount} onChange={(e) => setMf({ ...mf, paidAmount: +e.target.value })} className={inputCls} /></Field>
                <Field label="Pending amount"><input readOnly value={mf.status === "PAID" ? 0 : remitPending} className={`${inputCls} bg-muted`} /></Field>
                <Field label="Status">
                  <select value={mf.status} onChange={(e) => setMf({ ...mf, status: e.target.value })} className={inputCls}>
                    <option value="PENDING">Pending</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="PAID">Paid</option>
                  </select>
                </Field>
                <Field label="Ledger account (optional)">
                  <select value={mf.ledgerAccountId} onChange={(e) => setMf({ ...mf, ledgerAccountId: e.target.value })} className={inputCls}>
                    <option value="">None</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label="Payment method"><input value={mf.paymentMethod} onChange={(e) => setMf({ ...mf, paymentMethod: e.target.value })} className={inputCls} /></Field>
                <Field label="Reference"><input value={mf.reference} onChange={(e) => setMf({ ...mf, reference: e.target.value })} className={inputCls} /></Field>
                <Field label="Notes"><input value={mf.notes} onChange={(e) => setMf({ ...mf, notes: e.target.value })} className={inputCls} /></Field>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setMf({ ...emptyRemit })} className="px-3 py-2 text-sm rounded border">Clear form</button>
                <button onClick={saveRemit} disabled={savingM} className="inline-flex items-center gap-1 px-4 py-2 text-sm rounded text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                  {savingM && <Loader2 size={14} className="animate-spin" />} Save remittance
                </button>
              </div>
            </Card>

            <Card className="mt-3 overflow-x-auto">
              {remits.length === 0 ? <Empty title="No remittances yet" /> : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>{["Agent", "Period", "Expected", "Paid", "Pending", "Status"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {remits.slice(0, 25).map((r, i) => (
                      <tr key={r.id || i} className="border-t">
                        <td className="px-3 py-2">{r.deliveryAgentName || agentName(r.deliveryAgentId)}</td>
                        <td className="px-3 py-2 text-xs">{(r.periodStart || "").slice(0, 10)} → {(r.periodEnd || "").slice(0, 10)}</td>
                        <td className="px-3 py-2">{NGN(num(r.expectedAmount))}</td>
                        <td className="px-3 py-2">{NGN(num(r.paidAmount))}</td>
                        <td className="px-3 py-2">{NGN(num(r.pendingAmount))}</td>
                        <td className="px-3 py-2 text-xs">{r.status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
