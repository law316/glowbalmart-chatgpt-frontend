import { createFileRoute } from "@tanstack/react-router";
import { ProviderPage } from "@/components/ProviderPage";
export const Route = createFileRoute("/_app/connections/ai-provider")({
  head: () => ({ meta: [{ title: "AI Provider — Glowbalmart CRM" }] }),
  component: () => <ProviderPage title="AI Provider" subtitle="Power Glow AI assistant with your preferred provider." storeKey="aiProvider" fromLabel="Default model" providers={[{ id: "openai", name: "OpenAI" }, { id: "anthropic", name: "Anthropic Claude" }, { id: "gemini", name: "Google Gemini" }, { id: "groq", name: "Groq" }]} />,
});
