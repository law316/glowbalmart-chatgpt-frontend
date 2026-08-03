import { createFileRoute } from "@tanstack/react-router";
import { ProviderPage } from "@/components/ProviderPage";
export const Route = createFileRoute("/_app/connections/sms")({
  head: () => ({ meta: [{ title: "SMS Provider — Glowbalmart CRM" }] }),
  component: () => <ProviderPage title="SMS Provider" subtitle="Connect an SMS provider for transactional SMS." storeKey="smsProvider" fromLabel="Sender ID" providers={[{ id: "termii", name: "Termii" }, { id: "twilio", name: "Twilio" }, { id: "africastalking", name: "Africa's Talking" }, { id: "bulksms", name: "BulkSMS Nigeria" }]} />,
});
