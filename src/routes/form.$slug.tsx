import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { NGN } from "@/lib/format";
import { NIGERIAN_STATES } from "@/lib/states";
import { CheckCircle2, Loader2 } from "lucide-react";
import { apiSubmitPublicOrderTracked, getPublicForm, getPublicFormSettings, type ApiPackage, type PublicFormResponse, type FormSettings } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/form/$slug")({
  head: () => ({ meta: [{ title: "Order Form" }] }),
  component: PublicForm,
});

function PublicForm() {
  const { slug } = Route.useParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<PublicFormResponse | null>(null);
  const [cfg, setCfg] = useState<FormSettings>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [fields, setFields] = useState({ fullName: "", phone: "", whatsapp: "", email: "", address: "", state: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [trackingCode] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const p = new URLSearchParams(window.location.search);
    return p.get("trackingCode") || p.get("campaign") || p.get("utm_campaign") || p.get("ref") || "";
  });

  useEffect(() => {
    (async () => {
      try {
        const [f, st] = await Promise.all([getPublicForm(slug), getPublicFormSettings(slug).catch(() => ({} as FormSettings))]);
        if (!f || f.active === false) { setNotFound(true); return; }
        setForm(f);
        setCfg({ ...(f.settings || {}), ...(st || {}) });
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    })();
  }, [slug]);

  useEffect(() => {
    const post = () => { if (window.parent !== window) window.parent.postMessage({ gbmcrm_height: document.body.scrollHeight }, "*"); };
    post();
    const ro = new ResizeObserver(post);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground"><Loader2 className="animate-spin mr-2" size={16} /> Loading…</div>;
  if (notFound || !form) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Form not found or inactive.</div>;

  const packages: ApiPackage[] = (form.packages || []).filter((p) => p.active !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const selectedPkg = packages.find((p) => p.id === packageId);

  const show = (k: string, dflt = true) => (cfg[`show${k}`] as boolean | undefined) ?? dflt;
  const req = (k: string, dflt = true) => (cfg[`require${k}`] as boolean | undefined) ?? dflt;
  const lbl = (k: string, dflt: string) => (cfg[`label${k}`] as string | undefined) || dflt;
  const display = (cfg.packageDisplay || "CARDS").toUpperCase();
  const submitText = cfg.submitButtonText || "ORDER NOW";
  const btnStyle = {
    background: cfg.submitButtonBackgroundColor || "var(--gradient-electric)",
    color: cfg.submitButtonTextColor || "#fff",
    borderColor: cfg.submitButtonBorderColor || "transparent",
    fontSize: cfg.submitButtonFontSize ? `${cfg.submitButtonFontSize}px` : undefined,
    borderRadius: cfg.borderRadius !== undefined ? `${cfg.borderRadius}px` : undefined,
  } as React.CSSProperties;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!selectedPkg) { toast.error("Please select a package"); return; }
    const payload = {
      customerName: fields.fullName.trim(),
      phone: fields.phone.trim(),
      whatsappNumber: fields.whatsapp.trim(),
      customerEmail: fields.email.trim() || undefined,
      deliveryAddress: fields.address.trim(),
      state: fields.state,
      packageId: selectedPkg.id,
      notes: fields.notes.trim() || undefined,
      clientSubmissionId: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    };
    setSubmitting(true);
    try {
      const res = await apiSubmitPublicOrderTracked(slug, payload as any, trackingCode || undefined);
      const code = (res?.code as string) || (res?.order?.code as string) || (res?.id as string) || (res?.order?.id as string) || "";
      setOrderCode(code);
      setSubmitted(true);
      toast.success("Order submitted successfully.");
      setFields({ fullName: "", phone: "", whatsapp: "", email: "", address: "", state: "", notes: "" });
      if (form.redirectUrl) {
        if (window.parent !== window) window.parent.postMessage({ type: "gbmcrm_redirect", url: form.redirectUrl }, "*");
        else setTimeout(() => { window.location.href = form.redirectUrl!; }, 1500);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg || /failed to fetch|network/i.test(msg)) toast.error("Unable to submit order. Please check your connection and try again.");
      else toast.error(msg);
    } finally { setSubmitting(false); }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
      <div className="max-w-xl mx-auto">
        <div className="rounded-2xl bg-white shadow-xl overflow-hidden border">
          <div className="p-5 text-white" style={{ background: "var(--gradient-navy)" }}>
            <div className="text-xs uppercase tracking-widest text-white/60">Glowbalmart</div>
            <h1 className="text-2xl font-bold mt-1">{cfg.headerText || form.title || form.name || "Please Fill The Form Below To Place Your Order"}</h1>
            <p className="text-white/70 text-sm mt-1">{cfg.subHeaderText || form.description || "Only Serious Buyers Should Fill The Form Below"}</p>
          </div>

          {submitted ? (
            <div className="p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold">{form.thankYouMessage || "Your order has been received."}</h2>
              {orderCode && <p className="text-sm text-muted-foreground mt-2">Order reference: <span className="font-mono">{orderCode}</span></p>}
              <p className="text-sm text-muted-foreground mt-2">A sales representative will contact you shortly to confirm your order.</p>
              {form.redirectUrl && <p className="text-xs text-muted-foreground mt-3">Redirecting…</p>}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {show("Name") && <div className="sm:col-span-2"><label className="text-xs font-medium">{lbl("Name", "Full Name")} {req("Name") ? "*" : ""}</label><input required={req("Name")} value={fields.fullName} onChange={(e) => setFields({ ...fields, fullName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border outline-none focus:border-blue-500" /></div>}
                {show("Phone") && <div><label className="text-xs font-medium">{lbl("Phone", "Phone Number")} {req("Phone") ? "*" : ""}</label><input required={req("Phone")} type="tel" placeholder="08012345678" value={fields.phone} onChange={(e) => setFields({ ...fields, phone: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border outline-none focus:border-blue-500" /></div>}
                {show("Whatsapp") && <div><label className="text-xs font-medium">{lbl("Whatsapp", "WhatsApp Number")} {req("Whatsapp") ? "*" : ""}</label><input required={req("Whatsapp")} type="tel" placeholder="08012345678" value={fields.whatsapp} onChange={(e) => setFields({ ...fields, whatsapp: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border outline-none focus:border-blue-500" /></div>}
                {show("Email") && <div className="sm:col-span-2"><label className="text-xs font-medium">{lbl("Email", "Email Address")} {req("Email", false) ? "*" : ""}</label><input required={req("Email", false)} type="email" placeholder="you@example.com" value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border outline-none focus:border-blue-500" /></div>}
                {show("Address") && <div className="sm:col-span-2"><label className="text-xs font-medium">{lbl("Address", "Delivery Address")} {req("Address") ? "*" : ""}</label><textarea required={req("Address")} rows={2} value={fields.address} onChange={(e) => setFields({ ...fields, address: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border outline-none focus:border-blue-500" /></div>}
                {show("State") && <div className="sm:col-span-2"><label className="text-xs font-medium">{lbl("State", "State")} {req("State") ? "*" : ""}</label><select required={req("State")} value={fields.state} onChange={(e) => setFields({ ...fields, state: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background outline-none focus:border-blue-500"><option value="">Select state…</option>{NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium">{cfg.packageLabelText || "Select your package"} *</label>
                  {packages.length === 0 ? (
                    <div className="mt-1 px-3 py-2 rounded-lg border bg-muted/30 text-sm text-muted-foreground">No packages are available for this form.</div>
                  ) : display === "DROPDOWN" ? (
                    <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border bg-white">
                      <option value="">Select…</option>
                      {packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {NGN(p.price)}</option>)}
                    </select>
                  ) : display === "RADIO" ? (
                    <div className="mt-2 space-y-1">
                      {packages.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <input type="radio" name="pkg" checked={packageId === p.id} onChange={() => setPackageId(p.id)} />
                          <span className="font-medium">{p.name}</span>
                          <span className="text-blue-700 font-semibold">{NGN(p.price)}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {packages.map((p) => {
                        const sel = packageId === p.id;
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setPackageId(p.id)}
                            className={`text-left rounded-xl border p-3 transition-all ${sel ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50" : "hover:border-blue-300 hover:bg-slate-50"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold text-sm">{p.name}</div>
                                {p.description && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</div>}
                                {p.quantityPerOrder && p.quantityPerOrder > 1 && (
                                  <div className="text-[11px] text-muted-foreground mt-1">Quantity: {p.quantityPerOrder} units</div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className={`font-bold text-base ${sel ? "text-blue-700" : ""}`}>{NGN(p.price)}</div>
                                <div className="text-[10px] text-muted-foreground">{p.currency || "NGN"}</div>
                              </div>
                            </div>
                            {sel && <div className="mt-2 text-[11px] text-blue-700 font-medium">✓ Selected</div>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedPkg && (
                    <div className="mt-3 text-sm text-slate-700">
                      You selected <span className="font-semibold">{selectedPkg.name}</span> — <span className="font-bold text-blue-700">{NGN(selectedPkg.price)}</span>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2"><label className="text-xs font-medium">Optional Notes</label><textarea rows={2} value={fields.notes} onChange={(e) => setFields({ ...fields, notes: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border outline-none focus:border-blue-500" /></div>
              </div>

              {selectedPkg && (
                <div className="rounded-xl p-3 bg-slate-50 border flex items-center justify-between">
                  <div className="text-sm">Total</div>
                  <div className="text-xl font-bold">{NGN(selectedPkg.price)}</div>
                </div>
              )}

              {cfg.textBeforeSubmit && <div className="text-xs text-center text-slate-600">{cfg.textBeforeSubmit}</div>}
              <button type="submit" disabled={submitting || packages.length === 0} className="w-full rounded-xl py-3 font-semibold border hover:opacity-95 disabled:opacity-60 inline-flex items-center justify-center gap-2" style={btnStyle}>
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? "Submitting…" : submitText}
              </button>
              {cfg.termsAndConditions && <div className="text-[10px] text-center text-muted-foreground">{cfg.termsAndConditions}</div>}
              {(cfg.paymentMethods || cfg.accountNumber || cfg.afterPaymentInstruction) && (
                <div className="rounded-lg border p-3 text-xs text-slate-700 space-y-0.5">
                  {cfg.paymentMethods && <div><span className="font-medium">Payment:</span> {cfg.paymentMethods}</div>}
                  {(cfg.accountName || cfg.accountNumber || cfg.bankName) && <div>{[cfg.accountName, cfg.accountNumber, cfg.bankName].filter(Boolean).join(" · ")}</div>}
                  {cfg.afterPaymentInstruction && <div className="text-muted-foreground">{cfg.afterPaymentInstruction}</div>}
                </div>
              )}
              <div className="text-[10px] text-center text-muted-foreground">Powered by Glowbalmart CRM</div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
