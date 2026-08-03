import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { ExportButton, KpiCard, PrimaryBtn } from "@/components/ModulePage";
import { NGN, fmtDateTime } from "@/lib/format";
import { Loader2, RefreshCw, Info, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  ledgerSummary, ledgerTransactions, profitSummary,
  type LedgerSummary, type LedgerTransaction, type ProfitSummary,
} from "@/lib/api";

export const Route = createFileRoute("/_app/wallet")({
  head: () => ({ meta: [{ title: "Wallet — Glowbalmart CRM" }] }),
  component: WalletPage,
});

function WalletPage() {
  const [sum, setSum] = useState<LedgerSummary | null>(null);
  const [txs, setTxs] = useState<LedgerTransaction[]>([]);
  const [profit, setProfit] = useState<ProfitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, t, p] = await Promise.all([
        ledgerSummary().catch(() => null),
        ledgerTransactions().catch(() => []),
        profitSummary().catch(() => null),
      ]);
      setSum(s); setTxs(t); setProfit(p);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setLoadedOnce(true); }
  };
  useEffect(() => { load(); }, []);

  const available = sum?.totalBalance ?? 0;
  const cash = sum?.totalCashBalance ?? 0;
  const bank = sum?.totalBankBalance ?? 0;
  const deposits = sum?.totalDeposits ?? 0;
  const expenses = sum?.totalExpenses ?? 0;
  const net = profit?.netProfit ?? sum?.ledgerProfit;

  const sortedTx = useMemo(() =>
    [...txs].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
  [txs]);

  return (
    <>
      <PageHeader title="Wallet" subtitle="Real finance balances and transactions" actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <ExportButton filename="wallet-transactions.csv" rows={sortedTx.map((t) => ({ Date: t.createdAt || "", Account: t.accountName || "", Type: t.type || t.direction || "", Category: t.categoryName || "", Amount: t.amount, PaymentMethod: t.paymentMethod || "", Reference: t.reference || "", Note: t.note || "", By: t.createdByName || "" }))} />
        </div>
      } />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Available Balance" value={NGN(available)} accent="var(--electric)" />
        <KpiCard label="Cash Balance" value={NGN(cash)} />
        <KpiCard label="Bank Balance" value={NGN(bank)} />
        <KpiCard label="Total Deposits" value={NGN(deposits)} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Expenses" value={NGN(expenses)} />
        {net != null && <KpiCard label="Net Profit" value={NGN(net)} accent="var(--electric)" />}
        <KpiCard label="Ledger Income" value={NGN(sum?.ledgerIncome ?? 0)} />
        <KpiCard label="Total Withdrawals" value={NGN(sum?.totalWithdrawals ?? 0)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-2"><Wallet size={16} /><div className="font-semibold">Balance Overview</div></div>
          <div className="text-xs text-muted-foreground">Available balance is the sum of all active ledger accounts. Deposits, expenses and withdrawals come directly from finance ledger transactions.</div>
        </Card>
        <Card className="p-4">
          <div className="font-semibold mb-1">Request Payout</div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3"><Info size={12} className="mt-0.5" /><span>Payout backend not connected yet.</span></div>
          <PrimaryBtn onClick={() => toast.info("Payout backend not connected yet.")}>Request payout</PrimaryBtn>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b font-semibold">Recent Transactions</div>
        {loading && sortedTx.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : loadedOnce && sortedTx.length === 0 ? (
          <Empty title="No finance transactions yet." hint="Deposits, expenses and withdrawals recorded in the ledger will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Date","Account","Type","Category","Amount","Method","Reference","Note"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {sortedTx.slice(0, 100).map((t) => {
                  const dir = (t.direction || t.type || "").toUpperCase();
                  const isIn = dir.includes("DEPOSIT") || dir.includes("IN") || dir.includes("CREDIT");
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="px-3 py-2 text-xs">{t.createdAt ? fmtDateTime(t.createdAt) : "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.accountName || "—"}</td>
                      <td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${isIn ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700"}`}>{(t.type || t.direction || "—")}</span></td>
                      <td className="px-3 py-2 text-xs">{t.categoryName || "—"}</td>
                      <td className={`px-3 py-2 font-semibold ${isIn ? "text-emerald-600" : "text-rose-600"}`}>{isIn ? "+" : "-"}{NGN(Math.abs(t.amount || 0))}</td>
                      <td className="px-3 py-2 text-xs">{t.paymentMethod || "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.reference || "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[240px] truncate" title={t.note}>{t.note || "—"}</td>
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
}
