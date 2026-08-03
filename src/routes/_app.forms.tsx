import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { NGN } from "@/lib/format";
import { toast } from "sonner";
import { Copy, ExternalLink, Plus, Trash2, Loader2, RefreshCw } from "lucide-react";
import {
  listForms, createForm, updateForm, addFormPackage, updateFormPackage, deleteFormPackage,
  getForm, listActiveProducts, ownerDeleteForm, ownerDeletePackage,
  getFormSettings, updateFormSettings, createPackagesFromProduct, listProductPriceTiers,
  type ApiForm, type ApiPackage, type ApiProduct, type FormSettings, type ProductPriceTier,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/store";

export const Route = createFileRoute("/_app/forms")({
  head: () => ({ meta: [{ title: "Forms — Glowbalmart CRM" }] }),
  component: FormsPage,
});

function embedCode(slug: string) {
  const id = "gbmcrm_" + Math.floor(100 + Math.random() * 900);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `<iframe id="${id}" src="${origin}/form/${slug}?gbmcrm_embed=1" width="100%" frameborder="0" scrolling="no" style="border:none;display:block;min-height:500px;"></iframe>
<script>
window.addEventListener("message", function(e) {
  if (e.data && e.data.gbmcrm_height) {
    var fr = document.getElementById("${id}");
    if (fr) fr.style.height = e.data.gbmcrm_height + "px";
  }
  if (e.data && e.data.type === "gbmcrm_redirect" && e.data.url) {
    window.location.replace(e.data.url);
  }
});
</script>`;
}

function FormsPage() {
  const currentUser = useCurrentUser();
  const isOwner = currentUser?.role === "admin";
  const [forms, setForms] = useState<ApiForm[]>([]);
  const [selected, setSelected] = useState<ApiForm | null>(null);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openNew, setOpenNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", title: "", description: "", slug: "", thankYouMessage: "Thanks! We'll be in touch." });
  const [openPkg, setOpenPkg] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [pkgForm, setPkgForm] = useState<Partial<ApiPackage>>({ name: "", price: 0, description: "", quantityPerOrder: 1, currency: "NGN", active: true });
  const [priceTouched, setPriceTouched] = useState(false);
  const [settings, setSettings] = useState<FormSettings>({});
  const [tiers, setTiers] = useState<ProductPriceTier[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const setS = (patch: Partial<FormSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const saveSettings = async () => {
    if (!selected) return;
    setSavingSettings(true);
    try {
      const saved = await updateFormSettings(selected.id, settings);
      setSettings(saved || settings);
      toast.success("Form settings saved");
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save settings"); }
    finally { setSavingSettings(false); }
  };

  const useTiersAsPackages = async () => {
    if (!selected) return;
    if (!settings.productId) return toast.error("Select a product first");
    setBusy(true);
    try {
      await createPackagesFromProduct(selected.id, settings.productId, true);
      const saved = await updateFormSettings(selected.id, { ...settings, useProductPriceTiers: true }).catch(() => ({ ...settings, useProductPriceTiers: true }));
      setSettings(saved as FormSettings);
      toast.success("Product price tiers added as packages");
      await reload(selected.id);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to build packages from product"); }
    finally { setBusy(false); }
  };

  const linkedProduct = products.find((p) => p.id === pkgForm.inventoryProductId);
  const unitSelling = linkedProduct?.sellingPrice || 0;
  const unitCost = linkedProduct?.costPrice || 0;
  const qtyPer = Math.max(1, Number(pkgForm.quantityPerOrder) || 1);
  const suggestedPrice = unitSelling * qtyPer;
  const finalPrice = Number(pkgForm.price) || 0;
  const belowCost = linkedProduct ? finalPrice < unitCost * qtyPer : false;

  const resetPkg = () => {
    setPkgForm({ name: "", price: 0, description: "", quantityPerOrder: 1, currency: "NGN", active: true });
    setPriceTouched(false);
    setAdvanced(false);
  };

  const pickProduct = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    const q = Math.max(1, Number(pkgForm.quantityPerOrder) || 1);
    setPkgForm((f) => ({
      ...f,
      inventoryProductId: productId || undefined,
      name: f.name || (p ? `${p.name}${q > 1 ? ` × ${q}` : ""}` : ""),
      price: priceTouched ? f.price : (p ? (p.sellingPrice || 0) * q : f.price),
    }));
  };

  const setQty = (n: number) => {
    const q = Math.max(1, n || 1);
    setPkgForm((f) => ({ ...f, quantityPerOrder: q, price: priceTouched ? f.price : unitSelling * q }));
  };


  const load = async () => {
    setLoading(true);
    try {
      const [f, p] = await Promise.all([listForms().catch(() => []), listActiveProducts().catch(() => [])]);
      setForms(f); setProducts(p);
      if (f.length && !selected) reload(f[0].id);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };
  const reload = async (id: string) => {
    try {
      setSelected(await getForm(id));
      const st = await getFormSettings(id).catch(() => ({} as FormSettings));
      setSettings(st || {});
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  useEffect(() => {
    const pid = settings.productId;
    if (!pid) { setTiers([]); return; }
    listProductPriceTiers(pid).then((t) => setTiers(t || [])).catch(() => setTiers([]));
  }, [settings.productId]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied!"); };
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const saveNew = async () => {
    if (!newForm.name || !newForm.slug) return toast.error("Name and slug required");
    setBusy(true);
    try {
      const res = await createForm({ ...newForm, active: true });
      const created = (res.form || res) as ApiForm;
      toast.success("Form created");
      setOpenNew(false); setNewForm({ name: "", title: "", description: "", slug: "", thankYouMessage: "Thanks! We'll be in touch." });
      await load();
      if (created?.id) reload(created.id);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const savePkg = async () => {
    if (!selected) return;
    if (!pkgForm.name?.trim()) return toast.error("Package name is required");
    if (!advanced && !pkgForm.inventoryProductId) return toast.error("Choose the inventory product this package sells");
    if (!finalPrice || finalPrice <= 0) return toast.error("Final public package price is required");
    if (belowCost && !confirm(`Warning: this package price (${NGN(finalPrice)}) is below the product cost (${NGN(unitCost * qtyPer)}). Continue anyway?`)) return;
    if (!confirm(`Customers will see this package price publicly: ${NGN(finalPrice)}`)) return;
    setBusy(true);
    try {
      const linkedId = pkgForm.inventoryProductId || undefined;
      await addFormPackage(selected.id, {
        ...pkgForm,
        name: pkgForm.name,
        description: pkgForm.description,
        price: finalPrice,
        quantityPerOrder: qtyPer,
        stockUnitsDeductedAfterDelivery: qtyPer,
        currency: pkgForm.currency || "NGN",
        active: pkgForm.active ?? true,
        inventoryProductId: linkedId,
        productId: linkedId,
        linkedProductId: linkedId,
      } as Partial<ApiPackage>);
      toast.success("Package added");
      setOpenPkg(false); resetPkg();
      await load();
      await reload(selected.id);
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };


  const removePkg = async (id: string) => {
    if (!selected || !confirm("Delete this package? This cannot be undone.")) return;
    try {
      if (isOwner) await ownerDeletePackage(id);
      else await deleteFormPackage(selected.id, id);
      toast.success("Package deleted");
      reload(selected.id);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const removeForm = async (f: ApiForm) => {
    if (!confirm(`Delete form "${f.name}"? This cannot be undone.`)) return;
    try {
      await ownerDeleteForm(f.id || f.slug);
      toast.success("Form deleted");
      if (selected?.id === f.id) setSelected(null);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const patchForm = async (patch: Partial<ApiForm>) => {
    if (!selected) return;
    try {
      const payload = {
        name: selected.name,
        slug: selected.slug,
        title: selected.title || "",
        description: selected.description || "",
        thankYouMessage: selected.thankYouMessage || "",
        redirectUrl: selected.redirectUrl || "",
        active: selected.active,
        ...patch,
      };
      await updateForm(selected.id, payload);
      reload(selected.id);
      load();
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <>
      <PageHeader title="Sales Forms" subtitle="Backend-managed order forms with packages." actions={
        <>
          <button onClick={load} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <button onClick={() => setOpenNew(true)} className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white" style={{ background: "var(--gradient-electric)" }}><Plus size={14} /> New Form</button>
        </>
      } />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-3 lg:col-span-1">
          {loading && forms.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div>
            : forms.length === 0 ? <Empty title="No forms yet" hint="Click New Form to get started." /> : (
            <div className="space-y-1">
              {forms.map((f) => (
                <button key={f.id} onClick={() => reload(f.id)} className={`w-full text-left px-3 py-2 rounded-lg ${selected?.id === f.id ? "bg-muted" : "hover:bg-muted/50"}`}>
                  <div className="font-medium text-sm">{f.name}</div>
                  <div className="text-xs text-muted-foreground">/{f.slug} · {f.active ? "Active" : "Inactive"}</div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {selected && (
          <Card className="p-4 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{selected.title || selected.name}</div>
                <div className="text-xs text-muted-foreground">{selected.description}</div>
              </div>
              <a href={`/form/${selected.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border hover:bg-muted">
                <ExternalLink size={14} /> Preview
              </a>
              {isOwner && (
                <button onClick={() => removeForm(selected)} className="ml-2 inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50">
                  <Trash2 size={14} /> Delete Form
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="text-xs text-muted-foreground">Name<input className="w-full mt-0.5 px-2 py-1.5 rounded border bg-background" defaultValue={selected.name} onBlur={(e) => e.target.value !== selected.name && patchForm({ name: e.target.value })} /></label>
              <label className="text-xs text-muted-foreground">Slug<input className="w-full mt-0.5 px-2 py-1.5 rounded border bg-background" defaultValue={selected.slug} onBlur={(e) => e.target.value !== selected.slug && patchForm({ slug: e.target.value })} /></label>
              <label className="text-xs text-muted-foreground col-span-2">Title<input className="w-full mt-0.5 px-2 py-1.5 rounded border bg-background" defaultValue={selected.title || ""} onBlur={(e) => patchForm({ title: e.target.value })} /></label>
              <label className="text-xs text-muted-foreground col-span-2">Thank-you message<input className="w-full mt-0.5 px-2 py-1.5 rounded border bg-background" defaultValue={selected.thankYouMessage || ""} onBlur={(e) => patchForm({ thankYouMessage: e.target.value })} /></label>
              <label className="text-xs text-muted-foreground col-span-2">Redirect URL<input className="w-full mt-0.5 px-2 py-1.5 rounded border bg-background" defaultValue={selected.redirectUrl || ""} onBlur={(e) => patchForm({ redirectUrl: e.target.value })} /></label>
            </div>

            <div className="rounded-xl border p-3 space-y-3">
              <div className="text-sm font-semibold">Product & Packages</div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <label className="text-xs text-muted-foreground">Select Product
                  <select value={settings.productId || ""} onChange={(e) => setS({ productId: e.target.value || undefined })} className="w-full mt-0.5 px-2 py-1.5 rounded border bg-background">
                    <option value="">Select a product…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}</option>)}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">Use Product Price Tiers as Packages?
                  <select value={settings.useProductPriceTiers ? "yes" : "no"} onChange={(e) => setS({ useProductPriceTiers: e.target.value === "yes" })} className="w-full mt-0.5 px-2 py-1.5 rounded border bg-background">
                    <option value="yes">Yes</option><option value="no">No</option>
                  </select>
                </label>
              </div>

              {!!settings.productId && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Product price tiers</div>
                  {tiers.length === 0 ? (
                    <div className="text-xs text-muted-foreground p-2 border rounded">No price tiers on this product yet. Add tiers on the Product page.</div>
                  ) : (
                    <table className="w-full text-xs border rounded">
                      <thead className="bg-muted/50 text-left"><tr>{["Qty","Unit label","Cost","Selling"].map((h) => <th key={h} className="px-2 py-1">{h}</th>)}</tr></thead>
                      <tbody>
                        {tiers.map((t, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-2 py-1">{t.quantity}</td>
                            <td className="px-2 py-1">{t.unitLabel || "—"}</td>
                            <td className="px-2 py-1">{NGN(t.costPrice || 0)}</td>
                            <td className="px-2 py-1 font-medium">{NGN(t.sellingPrice || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <button onClick={useTiersAsPackages} disabled={busy} className="mt-2 text-sm px-3 py-2 rounded-lg text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
                    Use Product Tiers as Packages
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Current packages on this form</div>
              </div>
              {!selected.packages?.length ? <div className="text-xs text-muted-foreground p-3 border rounded">No packages yet. Add one to make this form live.</div> : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {selected.packages.map((p) => (
                    <div key={p.id} className="rounded-lg border p-2.5 flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{p.name}</div>
                        <div className="text-sm font-semibold" style={{ color: "var(--electric)" }}>{NGN(p.price)}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {(() => {
                            const anyP = p as ApiPackage & { productId?: string; linkedProductId?: string };
                            const linkedId = anyP.inventoryProductId || anyP.productId || anyP.linkedProductId;
                            const linkedName = p.inventoryProductName || (linkedId ? products.find((x) => x.id === linkedId)?.name : undefined);
                            return linkedName ? `Linked product: ${linkedName} × ${p.quantityPerOrder ?? 1}` : "Manual package (no inventory link)";
                          })()}
                        </div>
                      </div>
                      <button onClick={() => removePkg(p.id)} className="text-rose-600 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}

              <details className="rounded-lg border p-2" open={manualOpen} onToggle={(e) => setManualOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="text-xs cursor-pointer text-muted-foreground">Advanced / Manual package override</summary>
                <div className="mt-2">
                  <button onClick={() => { resetPkg(); setOpenPkg(true); }} className="text-xs px-2 py-1 rounded border hover:bg-muted"><Plus size={12} className="inline mr-1" />Add package manually</button>
                  <div className="text-[11px] text-muted-foreground mt-1">Only use this when a package is not backed by a product price tier.</div>
                </div>
              </details>
            </div>

            <FormSettingsPanel settings={settings} setS={setS} onSave={saveSettings} saving={savingSettings} />

            <div>
              <div className="text-xs text-muted-foreground mb-1">Public URL</div>
              <div className="flex gap-2">
                <input readOnly value={`${origin}/form/${selected.slug}`} className="flex-1 px-2 py-1.5 rounded border bg-muted text-sm" />
                <button onClick={() => copy(`${origin}/form/${selected.slug}`)} className="px-3 rounded border hover:bg-muted"><Copy size={14} /></button>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Embed code (iframe)</div>
              <textarea readOnly rows={8} value={embedCode(selected.slug)} className="w-full px-2 py-1.5 rounded border bg-muted text-xs font-mono" />
              <button onClick={() => copy(embedCode(selected.slug))} className="mt-2 text-sm px-3 py-1.5 rounded border hover:bg-muted inline-flex items-center gap-1">
                <Copy size={14} /> Copy embed
              </button>
            </div>
          </Card>
        )}
      </div>

      {openNew && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !busy && setOpenNew(false)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-3">Create Form</div>
            <div className="space-y-2 text-sm">
              <input placeholder="Name (internal)" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
              <input placeholder="Slug (URL)" value={newForm.slug} onChange={(e) => setNewForm({ ...newForm, slug: e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase() })} className="w-full px-3 py-2 rounded border bg-background font-mono" />
              <input placeholder="Public title" value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
              <textarea placeholder="Description" rows={2} value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
              <input placeholder="Thank-you message" value={newForm.thankYouMessage} onChange={(e) => setNewForm({ ...newForm, thankYouMessage: e.target.value })} className="w-full px-3 py-2 rounded border bg-background" />
            </div>
            <div className="mt-3 flex justify-end gap-2"><button onClick={() => setOpenNew(false)} disabled={busy} className="px-3 py-2 text-sm rounded border">Cancel</button><button onClick={saveNew} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>{busy && <Loader2 size={14} className="animate-spin" />} Create</button></div>
          </div>
        </div>
      )}

      {openPkg && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !busy && setOpenPkg(false)}>
          <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b">
              <div className="font-semibold">Add Package</div>
              <div className="text-xs text-muted-foreground">Sales form: {selected?.name}</div>
            </div>

            <div className="px-5 py-4 space-y-3 text-sm overflow-y-auto">
              {!advanced && (
                <label className="block">
                  <span className="text-xs font-medium">Linked inventory product *</span>
                  <select value={pkgForm.inventoryProductId || ""} onChange={(e) => pickProduct(e.target.value)} className="mt-1 w-full px-3 py-2 rounded border bg-background">
                    <option value="">Select a product…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}</option>)}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="text-xs font-medium">Package name *</span>
                <input value={pkgForm.name || ""} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} className="mt-1 w-full px-3 py-2 rounded border bg-background" />
              </label>

              <label className="block">
                <span className="text-xs font-medium">Description</span>
                <textarea rows={2} value={pkgForm.description || ""} onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })} className="mt-1 w-full px-3 py-2 rounded border bg-background" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium">Quantity per order *</span>
                  <input type="number" min={1} value={qtyPer} onChange={(e) => setQty(+e.target.value)} className="mt-1 w-full px-3 py-2 rounded border bg-background" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium">Currency</span>
                  <input value={pkgForm.currency || "NGN"} onChange={(e) => setPkgForm({ ...pkgForm, currency: e.target.value })} className="mt-1 w-full px-3 py-2 rounded border bg-background" />
                </label>
              </div>

              {linkedProduct && (
                <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Product cost per unit</div><div className="font-semibold">{NGN(unitCost)}</div></div>
                  <div><div className="text-muted-foreground">Product selling price per unit</div><div className="font-semibold">{NGN(unitSelling)}</div></div>
                  <div><div className="text-muted-foreground">Stock units deducted after delivery</div><div className="font-semibold">{qtyPer}</div></div>
                  <div><div className="text-muted-foreground">Suggested package price</div><div className="font-semibold">{NGN(suggestedPrice)}</div></div>
                </div>
              )}

              <label className="block">
                <span className="text-xs font-medium">Final public package price *</span>
                <input type="number" min={0} value={pkgForm.price ?? 0}
                  onChange={(e) => { setPriceTouched(true); setPkgForm({ ...pkgForm, price: +e.target.value }); }}
                  className="mt-1 w-full px-3 py-2 rounded border bg-background font-semibold" />
                <span className="text-[11px] text-muted-foreground">This is the price customers see on the public form. Override it for promo offers.</span>
              </label>

              {belowCost && (
                <div className="rounded-lg border border-rose-300 bg-rose-500/10 text-rose-700 text-xs px-3 py-2">
                  Warning: this price is below the product cost of {NGN(unitCost * qtyPer)} for {qtyPer} unit(s). You will sell at a loss.
                </div>
              )}

              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={pkgForm.active ?? true} onChange={(e) => setPkgForm({ ...pkgForm, active: e.target.checked })} />
                Active (visible on the public form)
              </label>

              <button type="button" onClick={() => setAdvanced((v) => !v)} className="text-[11px] underline text-muted-foreground">
                {advanced ? "Use inventory-linked package" : "Advanced manual package"}
              </button>
              {advanced && (
                <div className="rounded-lg border border-amber-300 bg-amber-500/10 text-amber-800 text-xs px-3 py-2">
                  Manual packages are not linked to inventory. Stock will not be deducted after delivery for this package.
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t flex justify-end gap-2 bg-card">
              <button onClick={() => setOpenPkg(false)} disabled={busy} className="px-3 py-2 text-sm rounded border">Cancel</button>
              <button onClick={savePkg} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>{busy && <Loader2 size={14} className="animate-spin" />} Save package</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

/* ---------------- Sales form settings panel ---------------- */
const sInput = "w-full mt-0.5 px-2 py-1.5 rounded border bg-background text-sm";

function Txt({ label, value, onChange, placeholder, type = "text" }: { label: string; value: any; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="text-xs text-muted-foreground block">{label}
      <input type={type} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={sInput} />
    </label>
  );
}
function YesNo({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="text-xs text-muted-foreground block">{label}
      <select value={value === false ? "no" : "yes"} onChange={(e) => onChange(e.target.value === "yes")} className={sInput}>
        <option value="yes">Yes</option><option value="no">No</option>
      </select>
    </label>
  );
}

function FieldRow({ name, sKey, settings, setS }: { name: string; sKey: string; settings: FormSettings; setS: (p: Partial<FormSettings>) => void }) {
  const show = `show${sKey}`, req = `require${sKey}`, lab = `label${sKey}`;
  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      <YesNo label={`${name} — show`} value={settings[show] as boolean | undefined} onChange={(v) => setS({ [show]: v })} />
      <YesNo label="Required" value={settings[req] as boolean | undefined} onChange={(v) => setS({ [req]: v })} />
      <Txt label="Label text" value={settings[lab]} placeholder={name} onChange={(v) => setS({ [lab]: v })} />
    </div>
  );
}

function FormSettingsPanel({ settings, setS, onSave, saving }: { settings: FormSettings; setS: (p: Partial<FormSettings>) => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="rounded-xl border p-3 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Form Settings</div>
        <button onClick={onSave} disabled={saving} className="text-sm px-3 py-1.5 rounded-lg text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
          {saving && <Loader2 size={13} className="inline animate-spin mr-1" />} Save settings
        </button>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Basic setup</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <YesNo label="Has website?" value={settings.hasWebsite} onChange={(v) => setS({ hasWebsite: v })} />
          <Txt label="Form Header Text" value={settings.headerText} placeholder="Please Fill The Form Below To Place Your Order" onChange={(v) => setS({ headerText: v })} />
          <Txt label="Form Sub Header Text" value={settings.subHeaderText} placeholder="Only Serious Buyers Should Fill The Form Below" onChange={(v) => setS({ subHeaderText: v })} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Field settings</div>
        <div className="space-y-2">
          <FieldRow name="Name" sKey="Name" settings={settings} setS={setS} />
          <FieldRow name="Phone Number" sKey="Phone" settings={settings} setS={setS} />
          <FieldRow name="WhatsApp Number" sKey="Whatsapp" settings={settings} setS={setS} />
          <FieldRow name="Email Address" sKey="Email" settings={settings} setS={setS} />
          <FieldRow name="Address" sKey="Address" settings={settings} setS={setS} />
          <FieldRow name="State" sKey="State" settings={settings} setS={setS} />
          <FieldRow name="Country Code" sKey="CountryCode" settings={settings} setS={setS} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Product / package display</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground block">Product Quantity Display As
            <select value={settings.packageDisplay || "CARDS"} onChange={(e) => setS({ packageDisplay: e.target.value as FormSettings["packageDisplay"] })} className={sInput}>
              <option value="DROPDOWN">Dropdown Options</option>
              <option value="CARDS">Cards</option>
              <option value="RADIO">Radio Buttons</option>
            </select>
          </label>
          <Txt label="Type Product Text" value={settings.packageLabelText} placeholder="Select your package" onChange={(v) => setS({ packageLabelText: v })} />
          <YesNo label="Show package options on top of form" value={settings.showPackagesOnTop} onChange={(v) => setS({ showPackagesOnTop: v })} />
          <YesNo label="Allow to type variation quantity" value={settings.allowTypeVariationQuantity} onChange={(v) => setS({ allowTypeVariationQuantity: v })} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Styling</div>
        <div className="grid sm:grid-cols-3 gap-2">
          <Txt label="Form Background Color" type="color" value={settings.formBackgroundColor || "#f8fafc"} onChange={(v) => setS({ formBackgroundColor: v })} />
          <Txt label="Inner Background Color" type="color" value={settings.innerBackgroundColor || "#ffffff"} onChange={(v) => setS({ innerBackgroundColor: v })} />
          <YesNo label="Show form field labels" value={settings.showFieldLabels} onChange={(v) => setS({ showFieldLabels: v })} />
          <Txt label="Form Label Color" type="color" value={settings.labelColor || "#0f172a"} onChange={(v) => setS({ labelColor: v })} />
          <Txt label="Font Type" value={settings.fontType} placeholder="Inter, system-ui" onChange={(v) => setS({ fontType: v })} />
          <Txt label="Submit Button Background" type="color" value={settings.submitButtonBackgroundColor || "#2563eb"} onChange={(v) => setS({ submitButtonBackgroundColor: v })} />
          <Txt label="Submit Button Text Color" type="color" value={settings.submitButtonTextColor || "#ffffff"} onChange={(v) => setS({ submitButtonTextColor: v })} />
          <Txt label="Submit Button Border Color" type="color" value={settings.submitButtonBorderColor || "#2563eb"} onChange={(v) => setS({ submitButtonBorderColor: v })} />
          <Txt label="Border Radius (px)" type="number" value={settings.borderRadius} onChange={(v) => setS({ borderRadius: Number(v) || 0 })} />
          <Txt label="Submit Button Font Size (px)" type="number" value={settings.submitButtonFontSize} onChange={(v) => setS({ submitButtonFontSize: Number(v) || 0 })} />
          <Txt label="Form Width (px)" type="number" value={settings.formWidth} onChange={(v) => setS({ formWidth: Number(v) || 0 })} />
          <Txt label="Form Fields Height (px)" type="number" value={settings.fieldHeight} onChange={(v) => setS({ fieldHeight: Number(v) || 0 })} />
          <Txt label="Form Label Font Size (px)" type="number" value={settings.labelFontSize} onChange={(v) => setS({ labelFontSize: Number(v) || 0 })} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Submit & notification</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Txt label="Submit Button Text" value={settings.submitButtonText} placeholder="ORDER NOW" onChange={(v) => setS({ submitButtonText: v })} />
          <Txt label="Text before submit button" value={settings.textBeforeSubmit} onChange={(v) => setS({ textBeforeSubmit: v })} />
          <Txt label="Notification emails (comma separated)" value={settings.notificationEmails} onChange={(v) => setS({ notificationEmails: v })} />
          <Txt label="Terms & Conditions" value={settings.termsAndConditions} onChange={(v) => setS({ termsAndConditions: v })} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Payment settings</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Txt label="Payment Methods" value={settings.paymentMethods} placeholder="Pay on delivery, Bank transfer" onChange={(v) => setS({ paymentMethods: v })} />
          <Txt label="Account Name" value={settings.accountName} onChange={(v) => setS({ accountName: v })} />
          <Txt label="Account Number" value={settings.accountNumber} onChange={(v) => setS({ accountNumber: v })} />
          <Txt label="Bank" value={settings.bankName} onChange={(v) => setS({ bankName: v })} />
          <Txt label="After Payment Instruction" value={settings.afterPaymentInstruction} onChange={(v) => setS({ afterPaymentInstruction: v })} />
        </div>
      </div>
    </div>
  );
}
