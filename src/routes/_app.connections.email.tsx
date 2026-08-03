import { createFileRoute } from "@tanstack/react-router";
import { ProviderPage } from "@/components/ProviderPage";
export const Route = createFileRoute("/_app/connections/email")({
  head: () => ({ meta: [{ title: "Email Provider — Glowbalmart CRM" }] }),
  component: () => <ProviderPage title="Email Provider" subtitle="Connect an email provider for transactional and marketing email." storeKey="emailProvider" fromLabel="From email" providers={[{ id: "resend", name: "Resend" }, { id: "sendgrid", name: "SendGrid" }, { id: "mailgun", name: "Mailgun" }, { id: "postmark", name: "Postmark" }]} />,
});
