import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { NGN, fmtDate } from "@/lib/format";
import { Loader2, Plus, RefreshCw, Download, FileText, TrendingUp, Receipt, Wallet, LineChart } from "lucide-react";
import { exportCSV, exportPDF } from "@/lib/export";
import {
  financeSummary, listPayments, listExpenses,
  ledgerSummary, ledgerAccounts, ledgerCategories, ledgerTransactions,
  ledgerDeposit, ledgerWithdrawal, ledgerExpense, ledgerTransfer,
  profitSummary, listOrders, earningsSummary, salesStatusLabel, recordOrderPayment,
  type FinanceSummary, type ApiPayment, type ApiExpense,
  type LedgerSummary, type LedgerAccount, type LedgerCategory, type LedgerTransaction,
  type ProfitSummary, type ApiOrder, type EarningsSummary,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/finance")({
  head: () => ({ meta: [{ title: "Finance — Glowbalmart CRM" }] }),
  component: FinancePage,
});

type Section = "revenue" | "expenses" | "ledger" | "profit";
type LedgerModalKind = null | "deposit" | "withdrawal" | "expense" | "transfer";

const PAYMENT_METHODS = ["CASH", "TRANSFER", "POS", "CARD", "WALLET", "PAYSTACK", "FLUTTERWAVE", "PAY_ON_DELIVERY", "OTHER"];

function extractErr(e: unknown, fallback = "Request failed"): string {
  const raw = e instanceof Error ? e.message : String(e || fallback);
  try {
    const p = JSON.parse(raw);
    const first = p?.errors?.[0]?.defaultMessage || p?.errors?.[0]?.message || p?.message || p?.error;
    if (first && typeof first === "string") return first;
  } catch { /* not json */ }
  return raw || fallback;
}

const PAY_METHODS = ["CASH", "BANK", "POS", "MOBILE_MONEY", "OTHER"];

function RecordPaymentModal({ order, accounts, onClose, onSaved }: {
  order: ApiOrder; accounts: LedgerAccount[]; onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(order.price || ""));
  const [method, setMethod] = useState("CASH");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    try {
      const res = await recordOrderPayment({
        orderId: order.id, amount: amt, method, accountId: accountId || undefined,
        paidAt: paidAt || undefined, reference: reference || undefined, note: note || undefined,
      });
      toast.success(accountId && !res.ledgerLinked
        ? "Payment recorded. Ledger account crediting is not connected yet."
        : "Payment recorded");
      onSaved();
      onClose();
    } catch (e) { toast.error(extractErr(e, "Failed to record payment")); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => !saving && onClose()}>
      <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold mb-3">Record Payment — {order.code || order.id.slice(0, 8)}</div>
        <div className="text-xs text-muted-foreground mb-3">{order.customerName} · {order.phone}</div>

        <label className="text-xs text-muted-foreground">Amount paid *</label>
        <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm" />

        <label className="text-xs text-muted-foreground">Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm">
          {PAY_METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
        </select>

        <label className="text-xs text-muted-foreground">Ledger account to receive money</label>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm">
          <option value="">Select account…</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.accountType}</option>)}
        </select>

        <label className="text-xs text-muted-foreground">Payment date</label>
        <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm" />

        <label className="text-xs text-muted-foreground">Reference (optional)</label>
        <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm" />

        <label className="text-xs text-muted-foreground">Note (optional)</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm" />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="px-3 py-2 text-sm rounded border">Cancel</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
            {saving && <Loader2 size={14} className="animate-spin" />} Save payment
          </button>
        </div>
      </div>
    </div>
  );
}

function FinancePage() {
  const [section, setSection] = useState<Section>("revenue");

  // Data
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [expenses, setExpenses] = useState<ApiExpense[]>([]);
  const [ledSum, setLedSum] = useState<LedgerSummary | null>(null);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [categories, setCategories] = useState<LedgerCategory[]>([]);
  const [txs, setTxs] = useState<LedgerTransaction[]>([]);
  const [profit, setProfit] = useState<ProfitSummary | null>(null);
  const [earn, setEarn] = useState<EarningsSummary | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUser = useCurrentUser();
  const canRecordPayment = ["admin", "manager", "finance"].includes(currentUser?.role || "");
  const [payOrder, setPayOrder] = useState<ApiOrder | null>(null);

  // Modals
  const [modal, setModal] = useState<LedgerModalKind>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ accountId: string; toAccountId: string; expenseCategoryId: string; amount: number; paymentMethod: string; reference: string; note: string; relatedOrderId: string }>({
    accountId: "", toAccountId: "", expenseCategoryId: "", amount: 0, paymentMethod: "CASH", reference: "", note: "", relatedOrderId: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [s, p, e, ls, la, lc, lt, ps, es, ords] = await Promise.all([
        financeSummary().catch(() => null),
        listPayments().catch(() => []),
        listExpenses().catch(() => []),
        ledgerSummary().catch(() => null),
        ledgerAccounts().catch(() => []),
        ledgerCategories(true).catch(() => []),
        ledgerTransactions().catch(() => []),
        profitSummary().catch(() => null),
        earningsSummary().catch(() => null),
        listOrders().catch(() => []),
      ]);
      setSummary(s); setPayments(p); setExpenses(e);
      setLedSum(ls); setAccounts(la); setCategories(lc); setTxs(lt);
      setProfit(ps); setEarn(es); setOrders(ords);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const orderMap = useMemo(() => {
    const m = new Map<string, ApiOrder>();
    for (const o of orders) m.set(o.id, o);
    return m;
  }, [orders]);

  const openModal = (kind: LedgerModalKind) => {
    setForm({
      accountId: accounts[0]?.id || "",
      toAccountId: accounts[1]?.id || "",
      expenseCategoryId: categories[0]?.id || "",
      amount: 0, paymentMethod: "CASH", reference: "", note: "", relatedOrderId: "",
    });
    setModal(kind);
  };

  const submit = async () => {
    if (!modal) return;
    if (!form.accountId) return toast.error("Select an account");
    if (!form.amount || form.amount <= 0) return toast.error("Amount must be greater than 0");
    setSaving(true);
    try {
      if (modal === "deposit") {
        await ledgerDeposit({ accountId: form.accountId, amount: form.amount, paymentMethod: form.paymentMethod, reference: form.reference, note: form.note });
        toast.success("Deposit recorded");
      } else if (modal === "withdrawal") {
        await ledgerWithdrawal({ accountId: form.accountId, amount: form.amount, paymentMethod: form.paymentMethod, reference: form.reference, note: form.note });
        toast.success("Withdrawal recorded");
      } else if (modal === "expense") {
        if (!form.expenseCategoryId) { setSaving(false); return toast.error("Select an expense category"); }
        await ledgerExpense({
          accountId: form.accountId,
          expenseCategoryId: form.expenseCategoryId,
          amount: form.amount,
          paymentMethod: form.paymentMethod,
          reference: form.reference || undefined,
          note: form.note || undefined,
          relatedOrderId: form.relatedOrderId || undefined,
        });
        toast.success("Expense recorded");
      } else if (modal === "transfer") {
        if (!form.toAccountId || form.toAccountId === form.accountId) { setSaving(false); return toast.error("Choose a different destination account"); }
        await ledgerTransfer({ fromAccountId: form.accountId, toAccountId: form.toAccountId, amount: form.amount, reference: form.reference, note: form.note });
        toast.success("Transfer recorded");
      }
      setModal(null);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  };

  // Expense breakdown from ledger transactions
  const expenseTxs = useMemo(() =>
    txs.filter((t) => (t.transactionType || t.type || "").toUpperCase() === "EXPENSE"),
  [txs]);

  const expenseByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of expenseTxs) {
      const k = t.expenseCategoryName || t.categoryName || "Uncategorised";
      m.set(k, (m.get(k) || 0) + Math.abs(Number(t.amount) || 0));
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenseTxs]);
  const totalExpenseTx = expenseByCategory.reduce((s, [, v]) => s + v, 0);
  const catAmount = (label: string) => {
    const l = label.toLowerCase();
    return expenseByCategory.filter(([k]) => k.toLowerCase().includes(l)).reduce((s, [, v]) => s + v, 0);
  };

  const Kpi = ({ l, v, tone = "" }: { l: string; v: string; tone?: string }) => (
    <Card className="p-3"><div className="text-xs text-muted-foreground uppercase">{l}</div><div className={`mt-1 text-xl font-bold ${tone}`}>{v}</div></Card>
  );

  const RevenueSection = () => {
    const confirmed = Number(summary?.confirmedPayments || 0);
    const unpaid = Number(summary?.unpaidOrderValue || 0);
    const pending = Number(summary?.pendingDeliveryValue || 0);
    const total = confirmed + unpaid + pending;
    const pct = (v: number) => total > 0 ? (v / total) * 100 : 0;
    const paidOrders = orders.filter((o) => (o.paymentStatus || "").toUpperCase() === "PAID").length;
    const unpaidOrders = orders.filter((o) => (o.paymentStatus || "").toUpperCase() !== "PAID").length;
    const deliveredUnpaid = orders.filter((o) => (o.status || "").toUpperCase() === "DELIVERED" && (o.paymentStatus || "").toUpperCase() !== "PAID");

    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3 mb-4">
          <Kpi l="Total Order Value" v={NGN(summary?.totalOrderValue || 0)} tone="text-emerald-600" />
          <Kpi l="Delivered Value" v={NGN(summary?.deliveredOrderValue || 0)} tone="text-emerald-600" />
          <Kpi l="Confirmed Payments" v={NGN(confirmed)} tone="text-emerald-600" />
          <Kpi l="Unpaid Value" v={NGN(unpaid)} tone="text-amber-600" />
          <Kpi l="Pending Delivery" v={NGN(pending)} tone="text-amber-600" />
          <Kpi l="Paid Orders" v={paidOrders.toString()} />
          <Kpi l="Unpaid Orders" v={unpaidOrders.toString()} />
        </div>

        <Card className="mb-4">
          <div className="p-4 border-b font-semibold">Delivered Unpaid Orders</div>
          {deliveredUnpaid.length === 0 ? <Empty title="No delivered unpaid orders" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr>{["Order code","Customer","Phone","Package","Amount","Payment status",""].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
                <tbody>
                  {deliveredUnpaid.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="px-3 py-2 text-xs font-mono">{o.code || o.id.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-xs">{o.customerName}</td>
                      <td className="px-3 py-2 text-xs">{o.phone}</td>
                      <td className="px-3 py-2 text-xs">{o.packageName || "—"}</td>
                      <td className="px-3 py-2 font-medium">{NGN(o.price)}</td>
                      <td className="px-3 py-2 text-xs">{o.paymentStatus || "UNPAID"}</td>
                      <td className="px-3 py-2 text-xs">
                        {canRecordPayment && (
                          <button onClick={() => setPayOrder(o)} className="text-xs px-2 py-1 rounded text-white" style={{ background: "var(--gradient-electric)" }}>Record Payment</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3"><LineChart size={16} /><div className="font-semibold">Revenue by status</div></div>
          {[
            { label: "Confirmed payments", value: confirmed, colour: "bg-emerald-500" },
            { label: "Unpaid value", value: unpaid, colour: "bg-amber-500" },
            { label: "Pending delivery value", value: pending, colour: "bg-sky-500" },
          ].map((r) => (
            <div key={r.label} className="mb-2">
              <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{r.label}</span><span className="font-medium">{NGN(r.value)}</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`${r.colour} h-full`} style={{ width: `${pct(r.value)}%` }} /></div>
            </div>
          ))}
        </Card>

        <Card>
          <div className="p-4 border-b font-semibold flex items-center justify-between">
            <span>Payments</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{payments.length} total</span>
              <button onClick={() => exportCSV("payments.csv", payments.map((p) => ({ Date: fmtDate(p.createdAt), OrderCode: orderMap.get(p.orderId || "")?.code || p.orderId?.slice(0,8) || "—", Customer: orderMap.get(p.orderId || "")?.customerName || "", Amount: p.amount, Method: p.method || "", Status: p.status || "" })))} className="text-xs px-2 py-1 rounded border inline-flex items-center gap-1"><Download size={12} /> CSV</button>
            </div>
          </div>
          {payments.length === 0 ? <Empty title="No payments recorded yet" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr>{["Date","Order Code","Customer","Amount","Method","Status"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
                <tbody>
                  {payments.slice(0, 50).map((p) => {
                    const o = orderMap.get(p.orderId || "");
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="px-3 py-2 text-xs">{fmtDate(p.createdAt)}</td>
                        <td className="px-3 py-2 text-xs font-mono">{o?.code || p.orderId?.slice(0, 8) || "—"}</td>
                        <td className="px-3 py-2 text-xs">{o?.customerName || "—"}</td>
                        <td className="px-3 py-2 font-medium">{NGN(p.amount)}</td>
                        <td className="px-3 py-2 text-xs">{p.method || "—"}</td>
                        <td className="px-3 py-2 text-xs">{p.status || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </>
    );
  };

  const ExpensesSection = () => {
    const buckets = [
      { key: "Delivery", tone: "text-sky-600" },
      { key: "Product Purchase", tone: "text-emerald-600" },
      { key: "Advertising", tone: "text-fuchsia-600" },
      { key: "Office", tone: "text-amber-600" },
      { key: "Software", tone: "text-indigo-600" },
      { key: "Miscellaneous", tone: "text-rose-600" },
    ];

    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Kpi l="Total Expenses (Ledger)" v={NGN(ledSum?.totalExpenses || totalExpenseTx || 0)} tone="text-rose-600" />
          {buckets.map((b) => <Kpi key={b.key} l={`${b.key} Expenses`} v={NGN(catAmount(b.key))} tone={b.tone} />)}
        </div>

        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm">Expense breakdown by category</div>
            <button onClick={() => openModal("expense")} className="text-xs px-3 py-1.5 rounded text-white inline-flex items-center gap-1" style={{ background: "var(--gradient-electric)" }}><Plus size={12} /> Record Expense</button>
          </div>
          {expenseByCategory.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              {categories.length === 0
                ? "No expense categories found. Ask owner to seed finance defaults."
                : "No ledger expenses recorded yet."}
            </div>
          ) : expenseByCategory.map(([k, v]) => (
            <div key={k} className="mb-2">
              <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{k}</span><span className="font-medium">{NGN(v)}</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="bg-rose-500 h-full" style={{ width: `${totalExpenseTx > 0 ? (v / totalExpenseTx) * 100 : 0}%` }} /></div>
            </div>
          ))}
        </Card>

        <Card>
          <div className="p-4 border-b font-semibold flex items-center justify-between">
            <span>Ledger expenses</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{expenseTxs.length} total</span>
              <button onClick={() => exportPDF("expenses.pdf", "Expenses", expenseTxs.map((t) => ({ Date: fmtDate(t.createdAt), Account: t.accountName || "", Category: t.expenseCategoryName || t.categoryName || "", Amount: t.amount, Order: t.relatedOrderCode || "", Method: t.paymentMethod || "", Reference: t.reference || "", Note: t.note || "", By: t.recordedByName || t.createdByName || "" })))} className="text-xs px-2 py-1 rounded border inline-flex items-center gap-1"><FileText size={12} /> PDF</button>
            </div>
          </div>
          {expenseTxs.length === 0 ? <Empty title="No expenses recorded yet" hint="Use Record Expense to add one from the ledger." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr>{["Date","Account","Category","Amount","Related Order","Method","Reference","Note","Recorded By"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
                <tbody>
                  {expenseTxs.slice(0, 100).map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-3 py-2 text-xs">{fmtDate(t.createdAt)}</td>
                      <td className="px-3 py-2 text-xs">{t.accountName || "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.expenseCategoryName || t.categoryName || "—"}</td>
                      <td className="px-3 py-2 font-medium text-rose-600">{NGN(Math.abs(t.amount || 0))}</td>
                      <td className="px-3 py-2 text-xs font-mono">{t.relatedOrderCode || "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.paymentMethod || "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.reference || "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[220px] truncate" title={t.note}>{t.note || "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.recordedByName || t.createdByName || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {expenses.length > 0 && (
          <Card className="mt-4">
            <div className="p-4 border-b font-semibold flex items-center justify-between"><span>Legacy /api/finance/expenses</span><span className="text-xs text-muted-foreground">{expenses.length} entries</span></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr>{["Date","Title","Category","Amount","Status"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
                <tbody>
                  {expenses.slice(0, 30).map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="px-3 py-2 text-xs">{fmtDate(e.createdAt)}</td>
                      <td className="px-3 py-2">{e.title}</td>
                      <td className="px-3 py-2 text-xs">{e.category}</td>
                      <td className="px-3 py-2 font-medium">{NGN(e.amount)}</td>
                      <td className="px-3 py-2 text-xs">{e.status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </>
    );
  };

  const LedgerSection = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi l="Total Balance" v={NGN(ledSum?.totalBalance || 0)} tone="text-emerald-600" />
        <Kpi l="Cash" v={NGN(ledSum?.totalCashBalance || 0)} />
        <Kpi l="Bank" v={NGN(ledSum?.totalBankBalance || 0)} />
        <Kpi l="Other" v={NGN(ledSum?.totalOtherBalance || 0)} />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => openModal("deposit")} className="text-sm px-3 py-2 rounded border">+ Deposit</button>
        <button onClick={() => openModal("withdrawal")} className="text-sm px-3 py-2 rounded border">− Withdrawal</button>
        <button onClick={() => openModal("expense")} className="text-sm px-3 py-2 rounded text-white" style={{ background: "var(--gradient-electric)" }}>Record Expense</button>
        <button onClick={() => openModal("transfer")} className="text-sm px-3 py-2 rounded border">Transfer</button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="p-4 border-b font-semibold">Accounts</div>
          {accounts.length === 0 ? <Empty title="No ledger accounts yet" hint="Ask owner to create Cash / Bank / Mobile Money accounts." /> : (
            <div className="divide-y">
              {accounts.map((a) => (
                <div key={a.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">{a.accountType}{a.bankName ? ` · ${a.bankName}` : ""}</div>
                  </div>
                  <div className="font-semibold">{NGN(a.currentBalance ?? a.openingBalance ?? 0)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <div className="p-4 border-b font-semibold">Recent transactions</div>
          {txs.length === 0 ? <Empty title="No ledger transactions yet" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr>{["Date","Account","Type","Amount","Note"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
                <tbody>
                  {txs.slice(0, 30).map((t) => {
                    const type = (t.transactionType || t.type || "").toUpperCase();
                    const isIn = type.includes("DEPOSIT") || type.includes("INCOME") || t.direction === "CREDIT";
                    return (
                      <tr key={t.id} className="border-t">
                        <td className="px-3 py-2 text-xs">{fmtDate(t.createdAt)}</td>
                        <td className="px-3 py-2 text-xs">{t.accountName || "—"}</td>
                        <td className="px-3 py-2 text-xs">{type || "—"}</td>
                        <td className={`px-3 py-2 font-medium ${isIn ? "text-emerald-600" : "text-rose-600"}`}>{isIn ? "+" : "-"}{NGN(Math.abs(t.amount || 0))}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate" title={t.note}>{t.note || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );

  const ProfitSection = () => {
    const confirmed = Number(summary?.confirmedPayments || 0);
    const delivered = Number(summary?.deliveredOrderValue || profit?.deliveredRevenue || 0);
    const invCost = Number(profit?.inventoryCost || 0);
    const totalExp = Number(ledSum?.totalExpenses || profit?.totalExpenses || 0);
    const staffPending = Number(summary?.staffPendingEarnings || earn?.totalPending || 0);
    const staffPaid = Number(summary?.staffPaidEarnings || earn?.totalPaid || 0);
    const staffEarnings = staffPending + staffPaid;
    const estimated = confirmed - totalExp - staffEarnings;
    const net = profit?.netProfit ?? (delivered - invCost - totalExp - staffEarnings);

    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          <Kpi l="Confirmed Payments" v={NGN(confirmed)} tone="text-emerald-600" />
          <Kpi l="Delivered Revenue" v={NGN(delivered)} tone="text-emerald-600" />
          <Kpi l="Inventory Cost" v={NGN(invCost)} />
          <Kpi l="Total Expenses" v={NGN(totalExp)} tone="text-rose-600" />
          <Kpi l="Staff Earnings" v={NGN(staffEarnings)} />
          <Kpi l="Estimated Profit" v={NGN(estimated)} tone={estimated >= 0 ? "text-emerald-600" : "text-rose-600"} />
        </div>

        <Card className="p-4 mb-4">
          <div className="font-semibold text-sm mb-2">How estimated profit is calculated</div>
          <div className="text-xs text-muted-foreground mb-2">Estimated Profit = Confirmed Payments − Total Expenses − Staff Earnings</div>
          <div className="font-mono text-sm">{NGN(confirmed)} − {NGN(totalExp)} − {NGN(staffEarnings)} = <span className={estimated >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>{NGN(estimated)}</span></div>
        </Card>

        {profit && (
          <Card className="p-4">
            <div className="font-semibold text-sm mb-2">Net profit (from /api/profit-report/summary)</div>
            <div className="text-xs text-muted-foreground mb-2">Net Profit = Delivered Revenue − Inventory Cost − Total Expenses − Staff Earnings</div>
            <div className="font-mono text-sm">{NGN(delivered)} − {NGN(invCost)} − {NGN(totalExp)} − {NGN(staffEarnings)} = <span className={(net || 0) >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>{NGN(net || 0)}</span></div>
            {profit.profitMarginPercent != null && (
              <div className="text-xs text-muted-foreground mt-2">Margin: {profit.profitMarginPercent.toFixed(1)}%</div>
            )}
          </Card>
        )}
      </>
    );
  };

  const sections: { key: Section; label: string; icon: any }[] = [
    { key: "revenue", label: "Revenue", icon: TrendingUp },
    { key: "expenses", label: "Expenses", icon: Receipt },
    { key: "ledger", label: "Wallet / Ledger", icon: Wallet },
    { key: "profit", label: "Profit", icon: LineChart },
  ];

  return (
    <>
      <PageHeader title="Finance & Accounting" subtitle="Revenue, expenses, ledger and profit — all from the real backend" actions={
        <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      } />

      <div className="flex flex-wrap gap-2 mb-4">
        {sections.map((s) => {
          const Icon = s.icon;
          const active = section === s.key;
          return (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border ${active ? "text-white border-transparent" : "hover:bg-muted"}`}
              style={active ? { background: "var(--gradient-electric)" } : undefined}>
              <Icon size={14} /> {s.label}
            </button>
          );
        })}
      </div>

      {section === "revenue" && <RevenueSection />}
      {section === "expenses" && <ExpensesSection />}
      {section === "ledger" && <LedgerSection />}
      {section === "profit" && <ProfitSection />}

      {payOrder && (
        <RecordPaymentModal order={payOrder} accounts={accounts} onClose={() => setPayOrder(null)} onSaved={load} />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => !saving && setModal(null)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-3 capitalize">
              {modal === "expense" ? "Record Ledger Expense" : modal === "transfer" ? "Transfer between accounts" : modal}
            </div>

            <label className="text-xs text-muted-foreground">{modal === "transfer" ? "From account *" : "Account *"}</label>
            <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm">
              <option value="">Select account…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.accountType}</option>)}
            </select>

            {modal === "transfer" && (
              <>
                <label className="text-xs text-muted-foreground">To account *</label>
                <select value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm">
                  <option value="">Select destination…</option>
                  {accounts.filter((a) => a.id !== form.accountId).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.accountType}</option>)}
                </select>
              </>
            )}

            {modal === "expense" && (
              <>
                <label className="text-xs text-muted-foreground">Expense category *</label>
                {categories.length === 0 ? (
                  <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-300/50 rounded p-2 mb-3">No active expense categories found.</div>
                ) : (
                  <select value={form.expenseCategoryId} onChange={(e) => setForm({ ...form, expenseCategoryId: e.target.value })} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm">
                    <option value="">Select category…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}

                <label className="text-xs text-muted-foreground">Related order (optional)</label>
                <select value={form.relatedOrderId} onChange={(e) => setForm({ ...form, relatedOrderId: e.target.value })} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm">
                  <option value="">— No related order —</option>
                  {orders.slice(0, 200).map((o) => (
                    <option key={o.id} value={o.id}>{o.code || o.id.slice(0, 8)} · {o.customerName} · {NGN(o.price || 0)}</option>
                  ))}
                </select>
              </>
            )}

            <label className="text-xs text-muted-foreground">Amount *</label>
            <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm" />

            {modal !== "transfer" && (
              <>
                <label className="text-xs text-muted-foreground">Payment method</label>
                <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm">
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </>
            )}

            <label className="text-xs text-muted-foreground">Reference</label>
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm" />

            <label className="text-xs text-muted-foreground">Note</label>
            <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full mt-1 mb-3 px-3 py-2 rounded border bg-background text-sm" />

            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(null)} disabled={saving} className="px-3 py-2 text-sm rounded border">Cancel</button>
              <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
