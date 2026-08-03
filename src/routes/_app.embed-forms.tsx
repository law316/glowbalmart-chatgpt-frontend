import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/ModulePage";
import { listForms, type ApiForm } from "@/lib/api";
import { Copy, Code2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/embed-forms")({
  head: () => ({ meta: [{ title: "Embed Forms — Glowbalmart CRM" }] }),
  component: EmbedFormsPage,
});

function EmbedFormsPage() {
  const [forms, setForms] = useState<ApiForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState("");

  useEffect(() => {
    listForms()
      .then((f) => { setForms(f); setPicked((p) => p || f[0]?.slug || ""); })
      .catch(() => setForms([]))
      .finally(() => setLoading(false));
  }, []);

  const url = typeof window !== "undefined" ? `${window.location.origin}/form/${picked}` : `/form/${picked}`;
  const iframe = `<iframe src="${url}" style="width:100%;border:0;min-height:720px" loading="lazy"></iframe>`;
  const script = `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/embed.js" data-form="${picked}" async></script>`;

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  return (
    <>
      <PageHeader title="Embed Forms" subtitle="Drop a Glowbalmart sales form into any website with one snippet." />
      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading forms…</Card>
      ) : forms.length === 0 ? (
        <Card><Empty title="No forms yet." hint="Create a sales form first." /></Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground mb-2">Select form</div>
            <div className="space-y-1.5">
              {forms.map(f => (
                <button key={f.id} onClick={() => setPicked(f.slug)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${picked === f.slug ? "bg-muted font-medium" : "hover:bg-muted/50"}`}>
                  {f.name}
                  <div className="text-[11px] text-muted-foreground">/{f.slug}</div>
                </button>
              ))}
            </div>
            <Link to="/forms" className="block text-xs text-center mt-3 underline text-muted-foreground">Manage forms →</Link>
          </Card>

          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2"><div className="font-semibold flex items-center gap-2"><Code2 size={16} /> Iframe embed</div><button onClick={() => copy(iframe)} className="text-xs px-2 py-1 rounded border hover:bg-muted inline-flex gap-1"><Copy size={12} /> Copy</button></div>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{iframe}</pre>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2"><div className="font-semibold flex items-center gap-2"><Code2 size={16} /> Script embed</div><button onClick={() => copy(script)} className="text-xs px-2 py-1 rounded border hover:bg-muted inline-flex gap-1"><Copy size={12} /> Copy</button></div>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{script}</pre>
            </Card>
            <Card className="p-4">
              <div className="font-semibold mb-2">Live preview</div>
              <iframe src={url} className="w-full rounded-lg border" style={{ minHeight: 520 }} />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
