import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, KpiCard, Empty, ComingSoon } from "@/components/ModulePage";
import { listAbandonedCarts } from "@/lib/api";
import { NGN } from "@/lib/format";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/abandoned-cart")({
  head: () => ({ meta: [{ title: "Abandoned Cart — Glowbalmart CRM" }] }),
  component: AbandonedPage,
});

function AbandonedPage() {
  const [carts, setCarts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAbandonedCarts().then((d) => setCarts(d || [])).finally(() => setLoading(false));
  }, []);

  const value = carts.reduce((s, o) => s + (o.price || o.value || 0), 0);

  return (
    <>
      <PageHeader title="Abandoned Cart Follow-up" subtitle="Recover orders started but never confirmed." />
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <KpiCard label="Open carts" value={carts.length} />
        <KpiCard label="Recovery value" value={NGN(value)} accent="var(--electric)" />
        <KpiCard label="Recovery rate" value="—" />
      </div>
      <ComingSoon what="Automated abandoned-cart messaging" />
      <Card className="mt-4">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
        ) : carts.length === 0 ? <Empty title="No abandoned carts yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>{["Code","Customer","Phone","Package","Price"].map(h => <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {carts.map((o, i) => (
                  <tr key={o.id || i} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{o.code || "—"}</td>
                    <td className="px-3 py-2">{o.customerName || "—"}</td>
                    <td className="px-3 py-2 text-xs">{o.phone || "—"}</td>
                    <td className="px-3 py-2">{o.packageName || "—"}</td>
                    <td className="px-3 py-2">{NGN(o.price || o.value || 0)}</td>
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
