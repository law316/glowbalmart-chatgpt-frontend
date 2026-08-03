import { createFileRoute } from "@tanstack/react-router";
import { ProviderPage } from "@/components/ProviderPage";
export const Route = createFileRoute("/_app/connections/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp Provider — Glowbalmart CRM" }] }),
  component: () => <ProviderPage title="WhatsApp Provider" subtitle="Connect a WhatsApp Business API provider for outbound messages." storeKey="whatsappProvider" fromLabel="From / sender phone" providers={[{ id: "whatsapp_cloud", name: "WhatsApp Cloud API" }, { id: "twilio", name: "Twilio" }, { id: "wati", name: "WATI" }, { id: "respondio", name: "Respond.io" }]} />,
});
