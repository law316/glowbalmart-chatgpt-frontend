import { createFileRoute } from "@tanstack/react-router";
import AutomationPage from "@/components/AutomationPage";
export const Route = createFileRoute("/_app/whatsapp-automation")({
  head: () => ({ meta: [{ title: "WhatsApp Automation — Glowbalmart CRM" }] }),
  component: () => <AutomationPage title="WhatsApp Automation" subtitle="Trigger-based WhatsApp messages from your store." channel="whatsapp" />,
});
