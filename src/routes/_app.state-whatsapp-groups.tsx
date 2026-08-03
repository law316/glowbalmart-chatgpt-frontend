import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/AppShell";
import { MessageSquare } from "lucide-react";

const STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta",
  "Ebonyi","Edo","Ekiti","Enugu","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi",
  "Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto",
  "Taraba","Yobe","Zamfara","FCT",
];

export const Route = createFileRoute("/_app/state-whatsapp-groups")({
  head: () => ({ meta: [{ title: "State WhatsApp Delivery Groups — Glowbalmart CRM" }] }),
  component: () => (
    <>
      <PageHeader title="State WhatsApp Delivery Groups" subtitle="Route delivery details to per-state WhatsApp groups." />
      <Card className="p-6 mb-4 text-sm">
        <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
          <MessageSquare size={16} className="mt-0.5" />
          <div>
            <div className="font-semibold">Backend endpoint required for saved group configuration.</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              GET /api/settings/state-delivery-groups · PUT /api/settings/state-delivery-groups/{'{stateName}'} · GET /api/orders/{'{id}'}/share-text
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <div className="p-4 border-b font-semibold">Nigerian states</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 p-4">
          {STATES.map((s) => (
            <div key={s} className="text-xs p-2 rounded border bg-muted/30">{s}</div>
          ))}
        </div>
      </Card>
    </>
  ),
});
