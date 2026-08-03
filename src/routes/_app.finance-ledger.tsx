import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { AccessDenied } from "@/components/AccessDenied";
import { useCurrentUser } from "@/lib/store";
import {
  ledgerSummary, ledgerAccounts, ledgerTransactions, ledgerCategories,
  createLedgerAccount, ledgerDeposit, ledgerWithdrawal, ledgerExpense, ledgerTransfer,
  type LedgerAccount, type LedgerTransaction, type LedgerSummary, type LedgerCategory, type LedgerAccountType,
} from "@/lib/api";
import { Loader2, RefreshCw, Plus, ArrowDownCircle, ArrowUpCircle, Receipt, ArrowLeftRight } from "lucide-react";
import { NGN } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/finance-ledger")({
  head: () => ({ meta: [{ title: "Finance Ledger — Glowbalmart CRM" }] }),
  component: FinanceLedgerPage,
});

const ACCOUNT_TYPES: LedgerAccountType[] = ["CASH","BANK","MOBILE_MONEY","POS","OTHER"];
const PAYMENT_METHODS = ["CASH","BANK_TRANSFER","POS","MOBILE_MONEY","OTHER"];

type Mode = "deposit" | "withdrawal" | "expense" | "transfer" | "account" | null;

function FinanceLedgerPage() {
  const current = useCurrentUser();
  const canManage = current?.role === "admin" || current?.role === "manager" || current?.role === "finance";

  const [sum, setSum] = useState<LedgerSummary | null>(null);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [cats, setCats] = useState<LedgerCategory[]>([]);
  const [txs, setTxs] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [s, a, c, t] = await Promise.all([
        ledgerSummary().catch(() => null),
        ledgerAccounts().catch(() => [] as LedgerAccount[]),
        ledgerCategories().catch(() => [] as LedgerCategory[]),
        ledgerTransactions().catch(() => [] as LedgerTransaction[]),
      ]);
      setSum(s); setAccounts(a); setCats(c); setTxs(t);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (canManage) load(); }, [canManage]);

  const openMode = (m: Mode) => { setForm({}); setMode(m); };

  const submit = async () => {
    setSaving(true);
    try {
      if (mode === "account") {
        await createLedgerAccount({
          name: form.name as string,
          accountType: (form.accountType || "CASH") as LedgerAccountType,
          bankName: form.bankName as string || undefined,
          accountNumber: form.accountNumber as string || undefined,
          accountHolderName: form.accountHolderName as string || undefined,
          openingBalance: Number(form.openingBalance) || 0,
          notes: form.notes as string || undefined,
        });
        toast.success("Account created");
      } else if (mode === "deposit") {
        await ledgerDeposit({
          accountId: form.accountId as string,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod as string || "BANK_TRANSFER",
          reference: form.reference as string || undefined,
          note: form.note as string || undefined,
        });
        toast.success("Deposit recorded");
      } else if (mode === "withdrawal") {
        await ledgerWithdrawal({
          accountId: form.accountId as string,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod as string || "CASH",
          reference: form.reference as string || undefined,
          note: form.note as string || undefined,
        });
        toast.success("Withdrawal recorded");
      } else if (mode === "expense") {
        await ledgerExpense({
          accountId: form.accountId as string,
          expenseCategoryId: form.expenseCategoryId as string || undefined,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod as string || "CASH",
          reference: form.reference as string || undefined,
          note: form.note as string || undefined,
        });
        toast.success("Expense recorded");
      } else if (mode === "transfer") {
        await ledgerTransfer({
          fromAccountId: form.fromAccountId as string,
          toAccountId: form.toAccountId as string,
          amount: Number(form.amount),
          reference: form.reference as string || undefined,
          note: form.note as string || undefined,
        });
        toast.success("Transfer recorded");
      }
      setMode(null); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name;

  const typeLabel = (t: LedgerTransaction): string => {
    const raw = (t.type || t.transactionType || t.direction || "").toUpperCase();
    if (raw.includes("DEPOSIT")) return "Deposit";
    if (raw.includes("WITHDRAW")) return "Withdrawal";
    if (raw.includes("EXPENSE")) return "Expense";
    if (raw.includes("TRANSFER")) return "Transfer";
    if (raw === "IN") return "Deposit";
    if (raw === "OUT") return "Withdrawal";
    return raw || "—";
  };

  const categoryLabel = (t: LedgerTransaction): string =>
    t.categoryName || t.expenseCategoryName || "—";

  const referenceLabel = (t: LedgerTransaction): string => {
    if (t.reference) return t.reference;
    const raw = (t.type || t.transactionType || "").toUpperCase();
    if (raw.includes("TRANSFER")) {
      const from = accountName((t as any).fromAccountId) || (t as any).fromAccountName;
      const to = accountName((t as any).toAccountId) || (t as any).toAccountName || t.accountName;
      if (from && to) return `Transfer ${from} → ${to}`;
    }
    return "—";
  };

  const byLabel = (t: LedgerTransaction): string => t.createdByName || t.recordedByName || "—";

  if (!canManage) return <AccessDenied allowed={["admin","manager","finance"]} role={current?.role ?? "staff"} />;

  return (
    <>
      <PageHeader title="Finance Ledger" subtitle="Accounts, deposits, withdrawals, expenses and transfers."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
            </button>
            <button onClick={() => openMode("account")} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border"><Plus size={14} /> Account</button>
            <button onClick={() => openMode("deposit")} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}><ArrowDownCircle size={14} /> Deposit</button>
            <button onClick={() => openMode("withdrawal")} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border"><ArrowUpCircle size={14} /> Withdraw</button>
            <button onClick={() => openMode("expense")} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border"><Receipt size={14} /> Expense</button>
            <button onClick={() => openMode("transfer")} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border"><ArrowLeftRight size={14} /> Transfer</button>
          </div>
        } />

      {sum && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Cash</div><div className="text-xl font-bold">{NGN(sum.totalCashBalance ?? 0)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Bank</div><div className="text-xl font-bold">{NGN(sum.totalBankBalance ?? 0)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Other</div><div className="text-xl font-bold">{NGN(sum.totalOtherBalance ?? 0)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Balance</div><div className="text-xl font-bold text-emerald-600">{NGN(sum.totalBalance ?? 0)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Deposits</div><div className="text-lg font-bold text-emerald-600">{NGN(sum.totalDeposits ?? 0)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Withdrawals</div><div className="text-lg font-bold text-rose-600">{NGN(sum.totalWithdrawals ?? 0)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Expenses</div><div className="text-lg font-bold text-rose-600">{NGN(sum.totalExpenses ?? 0)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Ledger Profit</div><div className={`text-lg font-bold ${(sum.ledgerProfit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{NGN(sum.ledgerProfit ?? 0)}</div></Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-3">
          <div className="font-semibold mb-2 text-sm">Accounts</div>
          {accounts.length === 0 ? <Empty title="No accounts" /> : (
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li key={a.id} className="p-2 rounded border">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.accountType}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{a.bankName || ""} {a.accountNumber ? `• ${a.accountNumber}` : ""}</div>
                  <div className="text-sm font-bold mt-1">{NGN(a.currentBalance ?? a.openingBalance ?? 0)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2 p-3">
          <div className="font-semibold mb-2 text-sm">Recent Transactions</div>
          {loading ? <div className="p-6 text-center"><Loader2 className="inline animate-spin" size={14} /></div>
            : txs.length === 0 ? <Empty title="No transactions" />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>{["Date","Account","Type","Amount","Category","Reference","Note","By"].map((h) => <th key={h} className="px-2 py-1.5 text-xs uppercase text-muted-foreground">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {txs.slice(0, 100).map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{t.createdAt ? new Date(t.createdAt).toLocaleString() : "—"}</td>
                        <td className="px-2 py-1.5 text-xs">{t.accountName || "—"}</td>
                        <td className="px-2 py-1.5 text-xs"><span className="px-2 py-0.5 rounded-full bg-muted text-[10px]">{typeLabel(t)}</span></td>
                        <td className={`px-2 py-1.5 font-semibold ${t.direction === "IN" || (t.type || "").includes("DEPOSIT") ? "text-emerald-600" : "text-rose-600"}`}>{NGN(t.amount || 0)}</td>
                        <td className="px-2 py-1.5 text-xs">{categoryLabel(t)}</td>
                        <td className="px-2 py-1.5 text-xs">{referenceLabel(t)}</td>
                        <td className="px-2 py-1.5 text-xs">{t.note || "—"}</td>
                        <td className="px-2 py-1.5 text-xs">{byLabel(t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>
      </div>

      {mode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setMode(null)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-3 capitalize">{mode}</div>
            <div className="space-y-2">
              {mode === "account" && (
                <>
                  <input className="w-full px-3 py-2 rounded border bg-background" placeholder="Account name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <select className="w-full px-3 py-2 rounded border bg-background" onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                    {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="w-full px-3 py-2 rounded border bg-background" placeholder="Bank name" onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                  <input className="w-full px-3 py-2 rounded border bg-background" placeholder="Account number" onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
                  <input className="w-full px-3 py-2 rounded border bg-background" placeholder="Account holder" onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })} />
                  <input type="number" className="w-full px-3 py-2 rounded border bg-background" placeholder="Opening balance" onChange={(e) => setForm({ ...form, openingBalance: +e.target.value })} />
                  <textarea className="w-full px-3 py-2 rounded border bg-background" placeholder="Notes" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </>
              )}
              {(mode === "deposit" || mode === "withdrawal" || mode === "expense") && (
                <>
                  <select className="w-full px-3 py-2 rounded border bg-background" onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                    <option value="">Select account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.accountType})</option>)}
                  </select>
                  {mode === "expense" && (
                    <select className="w-full px-3 py-2 rounded border bg-background" onChange={(e) => setForm({ ...form, expenseCategoryId: e.target.value })}>
                      <option value="">Select category…</option>
                      {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  <input type="number" className="w-full px-3 py-2 rounded border bg-background" placeholder="Amount" onChange={(e) => setForm({ ...form, amount: +e.target.value })} />
                  <select className="w-full px-3 py-2 rounded border bg-background" onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                    {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p.replace(/_/g," ")}</option>)}
                  </select>
                  <input className="w-full px-3 py-2 rounded border bg-background" placeholder="Reference" onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                  <textarea className="w-full px-3 py-2 rounded border bg-background" placeholder="Note" onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </>
              )}
              {mode === "transfer" && (
                <>
                  <select className="w-full px-3 py-2 rounded border bg-background" onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}>
                    <option value="">From account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <select className="w-full px-3 py-2 rounded border bg-background" onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}>
                    <option value="">To account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <input type="number" className="w-full px-3 py-2 rounded border bg-background" placeholder="Amount" onChange={(e) => setForm({ ...form, amount: +e.target.value })} />
                  <input className="w-full px-3 py-2 rounded border bg-background" placeholder="Reference" onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                  <textarea className="w-full px-3 py-2 rounded border bg-background" placeholder="Note" onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setMode(null)} disabled={saving} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm" style={{ background: "var(--gradient-electric)" }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
