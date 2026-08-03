import { createFileRoute } from "@tanstack/react-router";
import AutomationPage from "@/components/AutomationPage";
export const Route = createFileRoute("/_app/sms-automation")({
  head: () => ({ meta: [{ title: "SMS Automation — Glowbalmart CRM" }] }),
  component: () => <AutomationPage title="SMS Automation" subtitle="Send transactional and promotional SMS automatically." channel="sms" />,
});
