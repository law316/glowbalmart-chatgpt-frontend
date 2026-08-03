import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, Card } from "@/components/AppShell";
import { NGN } from "@/lib/format";

export const Route = createFileRoute("/_app/affiliates")({
  head: () => ({ meta: [{ title: "Affiliates — Glowbalmart CRM" }] }),
  component: AffiliatesPage,
});

function AffiliatesPage() {
  const affiliates = useStore((s) => s.affiliates);
  return (
    <>
      <PageHeader title="Affiliates & Agents" subtitle="Track referral codes, commissions and payouts." />
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>{["Agent","Code","Rate","Paid","Unpaid","Total Owed"].map((h) => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody>
            {affiliates.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 font-medium">{a.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{a.code}</td>
                <td className="px-3 py-2">{a.commissionRate}%</td>
                <td className="px-3 py-2 text-emerald-600">{NGN(a.paid)}</td>
                <td className="px-3 py-2 text-amber-600">{NGN(a.unpaid)}</td>
                <td className="px-3 py-2 font-medium">{NGN(a.paid + a.unpaid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
