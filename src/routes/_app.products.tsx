import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Empty } from "@/components/AppShell";
import { NGN } from "@/lib/format";
import { Plus, Loader2, RefreshCw, Package as PackageIcon, Boxes, Search } from "lucide-react";
import { toast } from "sonner";
import {
  listProducts, listActiveProducts,
  listForms, addFormPackage, updateFormPackage, deleteFormPackage,
  ownerDeleteProduct, getProductEnhancement,
  type ApiProduct, type ApiForm, type ApiPackage, type ProductEnhancement,
} from "@/lib/api";
import { ProductFormModal } from "@/components/ProductFormModal";
import { useCurrentUser } from "@/lib/store";

export const Route = createFileRoute("/_app/products")({
  head: () => ({ meta: [{ title: "Products & Packages — Glowbalmart CRM" }] }),
  component: ProductsPage,
});


type PkgForm = {
  formId: string; name: string; description: string;
  inventoryProductId: string; quantityPerOrder: number;
  price: number; currency: string; active: boolean;
};
const EMPTY_PKG: PkgForm = {
  formId: "", name: "", description: "", inventoryProductId: "",
  quantityPerOrder: 1, price: 0, currency: "NGN", active: true,
};

function cleanBackendError(e: unknown, kind: "product" | "package" = "product"): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  const s = raw.toLowerCase();
  if (/sku/.test(s) && /(exist|duplicate|unique|already)/.test(s)) return "A product with this SKU already exists.";
  if (/sku/.test(s) && /(required|blank|empty|null)/.test(s)) return "SKU is required.";
  if (/name/.test(s) && /(required|blank|empty|null)/.test(s)) return `${kind === "product" ? "Product" : "Package"} name is required.`;
  if (/validation failed/.test(s) || /methodargumentnotvalid/.test(s)) return `Please check the ${kind} details and try again.`;
  if (/internal server error|500/.test(s)) return "Server error. Please try again in a moment.";
  if (/network|fetch|failed to fetch/.test(s)) return "Network error. Check your connection and try again.";
  // Trim spring-boot noise
  const short = raw.split("\n")[0].replace(/^.*Exception:\s*/i, "").slice(0, 200);
  return short || "Something went wrong. Please try again.";
}

function ProductsPage() {
  const currentUser = useCurrentUser();
  const isOwner = currentUser?.role === "admin";
  const [tab, setTab] = useState<"products" | "packages">("products");

  const deleteProductOwner = async (p: ApiProduct) => {
    if (!confirm(`Delete product "${p.name}"? This cannot be undone.`)) return;
    try {
      await ownerDeleteProduct(p.id);
      toast.success("Product deleted");
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete product");
    }
  };

  // Products state
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loadingP, setLoadingP] = useState(true);
  const [pOpen, setPOpen] = useState(false);
  const [pEditing, setPEditing] = useState<ApiProduct | null>(null);
  const [pQuery, setPQuery] = useState("");
  const [pStatusFilter, setPStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [pCategoryFilter, setPCategoryFilter] = useState<string>("all");
  const [pLowOnly, setPLowOnly] = useState(false);
  const [pExtras, setPExtras] = useState<Record<string, ProductEnhancement>>({});

  // Packages state
  const [forms, setForms] = useState<ApiForm[]>([]);
  const [activeProducts, setActiveProducts] = useState<ApiProduct[]>([]);
  const [loadingF, setLoadingF] = useState(true);
  const [pkOpen, setPkOpen] = useState(false);
  const [pkEditing, setPkEditing] = useState<{ formId: string; pkg: ApiPackage } | null>(null);
  const [pkForm, setPkForm] = useState<PkgForm>(EMPTY_PKG);
  const [pkSaving, setPkSaving] = useState(false);
  const [pkPriceManuallyEdited, setPkPriceManuallyEdited] = useState(false);
  const [pkConfirmOpen, setPkConfirmOpen] = useState(false);

  const loadProducts = async () => {
    setLoadingP(true);
    try {
      const list = await listProducts();
      setProducts(list);
      // Extra product settings (country, tiers, agent alerts) — best effort only.
      Promise.all(list.map((p) => getProductEnhancement(p.id).then((x) => [p.id, x] as const).catch(() => [p.id, null] as const)))
        .then((pairs) => {
          const map: Record<string, ProductEnhancement> = {};
          pairs.forEach(([id, x]) => { if (x) map[id] = x; });
          setPExtras(map);
        })
        .catch(() => {});
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load products"); }
    finally { setLoadingP(false); }
  };

  const loadForms = async () => {
    setLoadingF(true);
    try {
      const [f, ap] = await Promise.all([listForms(), listActiveProducts().catch(() => [])]);
      setForms(f); setActiveProducts(ap);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load forms"); }
    finally { setLoadingF(false); }
  };
  useEffect(() => { loadProducts(); loadForms(); }, []);

  const openCreateProduct = () => { setPEditing(null); setPOpen(true); };
  const openEditProduct = (p: ApiProduct) => { setPEditing(p); setPOpen(true); };


  // Flatten packages across forms
  const allPackages = forms.flatMap((f) => (f.packages || []).map((pk) => ({ form: f, pkg: pk })));

  const openCreatePackage = () => {
    if (forms.length === 0) { toast.error("Create a sales form first"); return; }
    if (activeProducts.length === 0) { toast.error("Create an inventory product first"); return; }
    setPkEditing(null);
    setPkForm({ ...EMPTY_PKG, formId: forms[0].id });
    setPkPriceManuallyEdited(false);
    setPkOpen(true);
  };
  const openEditPackage = (formId: string, pk: ApiPackage) => {
    setPkEditing({ formId, pkg: pk });
    setPkForm({
      formId, name: pk.name || "", description: pk.description || "",
      inventoryProductId: pk.inventoryProductId || "",
      quantityPerOrder: pk.quantityPerOrder ?? 1,
      price: pk.price ?? 0, currency: pk.currency || "NGN",
      active: pk.active ?? true,
    });
    setPkPriceManuallyEdited(true); // preserve stored price when editing
    setPkOpen(true);
  };

  const linkedProduct = activeProducts.find((p) => p.id === pkForm.inventoryProductId);
  const suggestedPrice = linkedProduct ? (linkedProduct.sellingPrice ?? 0) * (pkForm.quantityPerOrder || 0) : 0;
  const unitCostTotal = linkedProduct ? (linkedProduct.costPrice ?? 0) * (pkForm.quantityPerOrder || 0) : 0;
  const belowCost = linkedProduct != null && pkForm.price > 0 && pkForm.price < unitCostTotal;
  const halfSelling = suggestedPrice / 2;
  const suspiciouslyLow = linkedProduct != null && suggestedPrice > 0 && pkForm.price > 0 && pkForm.price < halfSelling;

  // Auto-fill package price from linked product until user edits it manually
  useEffect(() => {
    if (!pkOpen) return;
    if (pkPriceManuallyEdited) return;
    if (!linkedProduct) return;
    setPkForm((prev) => ({ ...prev, price: suggestedPrice }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkForm.inventoryProductId, pkForm.quantityPerOrder, pkOpen]);


  const pkgErrors = (() => {
    const errs: { formId?: string; name?: string; inventoryProductId?: string; quantityPerOrder?: string; price?: string } = {};
    if (!pkForm.formId) errs.formId = "Choose a sales form";
    if (!pkForm.name.trim()) errs.name = "Package name is required";
    const linked = activeProducts.find((p) => p.id === pkForm.inventoryProductId);
    if (!pkForm.inventoryProductId) errs.inventoryProductId = "Link an active inventory product";
    else if (!linked || linked.active === false) errs.inventoryProductId = "Linked product must be an active inventory product";
    const qty = Number(pkForm.quantityPerOrder);
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1) errs.quantityPerOrder = "Whole number ≥ 1";
    const price = Number(pkForm.price);
    if (!Number.isFinite(price) || price <= 0) errs.price = "Must be greater than 0";
    return errs;
  })();
  const pkgValid = Object.keys(pkgErrors).length === 0;

  const requestSavePackage = () => {
    if (!pkgValid) { toast.error("Fix highlighted fields"); return; }
    setPkConfirmOpen(true);
  };
  const savePackage = async () => {
    setPkSaving(true);
    try {
      const payload: Partial<ApiPackage> = {
        name: pkForm.name, description: pkForm.description,
        inventoryProductId: pkForm.inventoryProductId,
        quantityPerOrder: pkForm.quantityPerOrder,
        price: pkForm.price, currency: pkForm.currency, active: pkForm.active,
      };
      if (pkEditing) { await updateFormPackage(pkEditing.formId, pkEditing.pkg.id, payload); toast.success("Package updated"); }
      else { await addFormPackage(pkForm.formId, payload); toast.success("Package created"); }
      setPkConfirmOpen(false);
      setPkOpen(false);
      await loadForms();
    } catch (e) { toast.error(cleanBackendError(e, "package")); }
    finally { setPkSaving(false); }
  };
  const removePackage = async (formId: string, pkgId: string) => {
    if (!confirm("Delete this package?")) return;
    try { await deleteFormPackage(formId, pkgId); toast.success("Package deleted"); await loadForms(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <>
      <PageHeader title="Products & Packages"
        subtitle="Central inventory products and sellable sales-form packages."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => { loadProducts(); loadForms(); }}
              className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-muted">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={tab === "products" ? openCreateProduct : openCreatePackage}
              className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg text-white"
              style={{ background: "var(--gradient-electric)" }}>
              <Plus size={14} /> New {tab === "products" ? "Product" : "Package"}
            </button>
          </div>
        } />

      <div className="flex gap-2 mb-4">
        {(["products", "packages"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-full border ${tab === t ? "text-white border-transparent" : "hover:bg-muted"}`}
            style={tab === t ? { background: "var(--gradient-electric)" } : undefined}>
            {t === "products" ? "Products" : "Packages / Bundles"}
          </button>
        ))}
      </div>

      {tab === "products" ? (
        <Card>
          <div className="p-3 border-b flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-2 top-2.5 text-muted-foreground" />
              <input value={pQuery} onChange={(e) => setPQuery(e.target.value)}
                placeholder="Search name, SKU, category…"
                className="w-full pl-7 pr-2 py-1.5 rounded border bg-background text-sm" />
            </div>
            <select value={pStatusFilter} onChange={(e) => setPStatusFilter(e.target.value as any)}
              className="px-2 py-1.5 rounded border bg-background text-sm">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select value={pCategoryFilter} onChange={(e) => setPCategoryFilter(e.target.value)}
              className="px-2 py-1.5 rounded border bg-background text-sm">
              <option value="all">All categories</option>
              {Array.from(new Set(products.map((p) => p.category).filter(Boolean))).map((c) => (
                <option key={c as string} value={c as string}>{c as string}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={pLowOnly} onChange={(e) => setPLowOnly(e.target.checked)} /> Low stock only
            </label>
          </div>
          {loadingP ? (
            <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading products…</div>
          ) : products.length === 0 ? (
            <Empty title="No products yet" hint="Create your first inventory product." />
          ) : (() => {
            const q = pQuery.trim().toLowerCase();
            const filtered = products.filter((p) => {
              if (pStatusFilter === "active" && !p.active) return false;
              if (pStatusFilter === "inactive" && p.active) return false;
              if (pCategoryFilter !== "all" && (p.category || "") !== pCategoryFilter) return false;
              if (pLowOnly && !((p.stockQuantity ?? 0) <= (p.lowStockThreshold ?? 0))) return false;
              if (q && ![p.name, p.sku, p.category].some((v) => (v || "").toLowerCase().includes(q))) return false;
              return true;
            });
            if (filtered.length === 0) {
              return <Empty title="No products match your filters" hint="Try clearing search or filters." />;
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>{["Name","SKU","Category","Cost","Price","Stock","Low Stock","Status",""].map((h) =>
                      <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const low = (p.stockQuantity ?? 0) <= (p.lowStockThreshold ?? 0);
                      return (
                        <tr key={p.id} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: "var(--gradient-electric)" }}><Boxes size={14} /></div>
                              <div>
                                <div>{p.name}</div>
                                {pExtras[p.id]?.countryName && (
                                  <div className="text-[11px] text-muted-foreground">{pExtras[p.id].countryName} ({pExtras[p.id].currency || "NGN"})</div>
                                )}
                                {p.description && <div className="text-[11px] text-muted-foreground line-clamp-1">{p.description}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs font-mono">{p.sku || "—"}</td>
                          <td className="px-3 py-2 text-xs">{p.category || "—"}</td>
                          <td className="px-3 py-2">{NGN(p.costPrice ?? 0)}</td>
                          <td className="px-3 py-2 font-semibold">
                            {NGN(p.sellingPrice ?? 0)}
                            {(pExtras[p.id]?.priceTiers || []).length > 0 && (
                              <div className="text-[10px] font-normal text-muted-foreground mt-0.5 space-y-0.5">
                                {(pExtras[p.id].priceTiers || []).map((t, i) => (
                                  <div key={i}>{t.quantity} {t.unitLabel || "Unit"} — Cost {NGN(t.costPrice || 0)} — Sell {NGN(t.sellingPrice || 0)}</div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className={`px-3 py-2 ${low ? "text-amber-600 font-semibold" : ""}`}>{p.stockQuantity ?? 0}</td>
                          <td className="px-3 py-2 text-xs">
                            {p.lowStockThreshold ?? 0}
                            {pExtras[p.id]?.lowStockThresholdAgents ? <div className="text-[10px] text-muted-foreground">Agents: {pExtras[p.id].lowStockThresholdAgents}</div> : null}
                          </td>

                          <td className="px-3 py-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                              {p.active ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td className="px-3 py-2 space-x-1">
                            <button onClick={() => openEditProduct(p)} className="text-xs px-2 py-1 rounded border hover:bg-muted">Edit</button>
                            {isOwner && (
                              <button onClick={() => deleteProductOwner(p)} className="text-xs px-2 py-1 rounded border hover:bg-rose-50 text-rose-600 border-rose-200">Delete</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </Card>
      ) : (
        <Card>
          {loadingF ? (
            <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading packages…</div>
          ) : forms.length === 0 ? (
            <Empty title="No sales forms yet" hint="Create a sales form first before adding packages." />
          ) : activeProducts.length === 0 ? (
            <Empty title="No active inventory products" hint="Create an inventory product first before adding packages." />
          ) : allPackages.length === 0 ? (
            <Empty title="No packages yet" hint="Create a sales form package linked to an inventory product." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>{["Package","Sales Form","Linked Product","Stock deducted","Package price","Currency","Status",""].map((h) =>
                    <th key={h} className="px-3 py-2 text-xs uppercase text-muted-foreground">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {allPackages.map(({ form, pkg }) => {
                    const linked = activeProducts.find((p) => p.id === pkg.inventoryProductId);
                    return (
                      <tr key={`${form.id}-${pkg.id}`} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: "var(--gradient-electric)" }}><PackageIcon size={14} /></div>
                            <div>
                              <div>{pkg.name}</div>
                              {pkg.description && <div className="text-[11px] text-muted-foreground line-clamp-1">{pkg.description}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">{form.name || form.title || form.slug}</td>
                        <td className="px-3 py-2 text-xs">{linked?.name || pkg.inventoryProductName || <span className="text-rose-600">Not linked</span>}</td>
                        <td className="px-3 py-2">{pkg.quantityPerOrder ?? 1}</td>
                        <td className="px-3 py-2 font-semibold">{NGN(pkg.price ?? 0)}</td>
                        <td className="px-3 py-2 text-xs">{pkg.currency || "NGN"}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${pkg.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                            {pkg.active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td className="px-3 py-2 flex gap-1">
                          <button onClick={() => openEditPackage(form.id, pkg)} className="text-xs px-2 py-1 rounded border hover:bg-muted">Edit</button>
                          <button onClick={() => removePackage(form.id, pkg.id)} className="text-xs px-2 py-1 rounded border hover:bg-muted text-rose-600">Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4 mt-4">
        <div className="font-semibold mb-3 text-sm">Ecommerce Extras</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { title: "Order Bumps", desc: "Add optional checkout offers to boost average order value." },
            { title: "Upsells", desc: "Offer related products after customer selection." },
            { title: "Cart Abandonment", desc: "Track and recover abandoned checkouts." },
          ].map((m) => (
            <div key={m.title} className="rounded-lg border p-3 bg-muted/20">
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium text-sm">{m.title}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Coming soon</span>
              </div>
              <div className="text-xs text-muted-foreground">{m.desc}</div>
              <div className="text-[11px] text-muted-foreground mt-2">Backend connection pending.</div>
            </div>
          ))}
        </div>
      </Card>

      <ProductFormModal
        open={pOpen}
        editing={pEditing}
        onClose={() => setPOpen(false)}
        onSaved={async () => { await Promise.all([loadProducts(), loadForms()]); }}
      />


      {pkOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !pkSaving && setPkOpen(false)}>
          <div className="bg-card w-full max-w-lg rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-3 flex items-center gap-2"><PackageIcon size={16} /> {pkEditing ? "Edit Package" : "New Package"}</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Sales Form *</label>
                <select disabled={!!pkEditing} value={pkForm.formId} onChange={(e) => setPkForm({ ...pkForm, formId: e.target.value })} className={`w-full mt-1 px-3 py-2 rounded border bg-background text-sm ${pkgErrors.formId ? "border-rose-500" : ""}`}>
                  <option value="">Select sales form…</option>
                  {forms.map((f) => <option key={f.id} value={f.id}>{f.name || f.title || f.slug}</option>)}
                </select>
                {pkgErrors.formId && <div className="text-[11px] text-rose-600 mt-1">{pkgErrors.formId}</div>}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Package Name *</label>
                <input value={pkForm.name} onChange={(e) => setPkForm({ ...pkForm, name: e.target.value })} className={`w-full mt-1 px-3 py-2 rounded border bg-background text-sm ${pkgErrors.name ? "border-rose-500" : ""}`} />
                {pkgErrors.name && <div className="text-[11px] text-rose-600 mt-1">{pkgErrors.name}</div>}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <textarea rows={2} value={pkForm.description} onChange={(e) => setPkForm({ ...pkForm, description: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Linked Inventory Product *</label>
                <select value={pkForm.inventoryProductId} onChange={(e) => { setPkForm({ ...pkForm, inventoryProductId: e.target.value }); setPkPriceManuallyEdited(false); }} className={`w-full mt-1 px-3 py-2 rounded border bg-background text-sm ${pkgErrors.inventoryProductId ? "border-rose-500" : ""}`}>
                  <option value="">Select product…</option>
                  {activeProducts.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
                </select>
                {pkgErrors.inventoryProductId && <div className="text-[11px] text-rose-600 mt-1">{pkgErrors.inventoryProductId}</div>}
                {activeProducts.length === 0 && <div className="text-[11px] text-amber-600 mt-1">No active inventory products available.</div>}
              </div>

              {linkedProduct && (
                <div className="rounded-lg border p-3 bg-muted/20 text-xs space-y-1">
                  <div className="font-semibold text-sm mb-1">{linkedProduct.name}{linkedProduct.sku ? ` · ${linkedProduct.sku}` : ""}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Product cost / unit</span><span>{NGN(linkedProduct.costPrice ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Product selling / unit</span><span>{NGN(linkedProduct.sellingPrice ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Quantity per order</span><span>{pkForm.quantityPerOrder || 0}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1"><span className="text-muted-foreground">Suggested package price</span><span className="font-semibold">{NGN(suggestedPrice)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total unit cost</span><span>{NGN(unitCostTotal)}</span></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Stock units deducted after delivery *</label>
                  <input type="number" min={1} value={pkForm.quantityPerOrder} onChange={(e) => { setPkForm({ ...pkForm, quantityPerOrder: +e.target.value }); setPkPriceManuallyEdited(false); }} className={`w-full mt-1 px-3 py-2 rounded border bg-background text-sm ${pkgErrors.quantityPerOrder ? "border-rose-500" : ""}`} />
                  <div className="text-[11px] text-muted-foreground mt-1">How many inventory units should be deducted when this package is delivered.</div>
                  {pkgErrors.quantityPerOrder && <div className="text-[11px] text-rose-600 mt-1">{pkgErrors.quantityPerOrder}</div>}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Package selling price shown to customer *</label>
                  <input type="number" min={0} value={pkForm.price} onChange={(e) => { setPkForm({ ...pkForm, price: +e.target.value }); setPkPriceManuallyEdited(true); }} className={`w-full mt-1 px-3 py-2 rounded border bg-background text-sm ${pkgErrors.price ? "border-rose-500" : ""}`} />
                  <div className="text-[11px] text-muted-foreground mt-1">Customers see this exact amount on the public form.</div>
                  {linkedProduct && !pkPriceManuallyEdited && suggestedPrice > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-1">Auto-filled from product selling price × quantity.</div>
                  )}
                  {linkedProduct && pkPriceManuallyEdited && suggestedPrice > 0 && pkForm.price !== suggestedPrice && (
                    <button type="button" onClick={() => { setPkForm({ ...pkForm, price: suggestedPrice }); setPkPriceManuallyEdited(false); }} className="text-[11px] text-blue-600 hover:underline mt-1">Reset to suggested {NGN(suggestedPrice)}</button>
                  )}
                  {pkgErrors.price && <div className="text-[11px] text-rose-600 mt-1">{pkgErrors.price}</div>}
                </div>
              </div>

              {belowCost && (
                <div className="text-[11px] text-rose-700 bg-rose-50 dark:bg-rose-500/10 border border-rose-300/50 rounded p-2">
                  Warning: This package price ({NGN(pkForm.price)}) is below product cost ({NGN(unitCostTotal)}). Customers will see this price on the public form.
                </div>
              )}
              {!belowCost && suspiciouslyLow && (
                <div className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-500/10 border border-amber-300/50 rounded p-2">
                  Possible pricing mistake: the public customer will see this low price ({NGN(pkForm.price)}). Suggested is {NGN(suggestedPrice)}.
                </div>
              )}
              {pkForm.price > 0 && pkForm.price < 100 && (
                <div className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-500/10 border border-amber-300/50 rounded p-2">
                  This package price is very low ({NGN(pkForm.price)}). Confirm this is intentional before saving.
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground">Currency</label>
                <input value={pkForm.currency} onChange={(e) => setPkForm({ ...pkForm, currency: e.target.value })} className="w-full mt-1 px-3 py-2 rounded border bg-background text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={pkForm.active} onChange={(e) => setPkForm({ ...pkForm, active: e.target.checked })} /> Active
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPkOpen(false)} disabled={pkSaving} className="px-3 py-2 rounded border text-sm">Cancel</button>
              <button onClick={requestSavePackage} disabled={pkSaving || !pkgValid} title={!pkgValid ? "Fix the highlighted fields to save" : undefined} className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--gradient-electric)" }}>
                {pkSaving && <Loader2 size={14} className="animate-spin" />} {pkEditing ? "Save Changes" : "Create Package"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pkConfirmOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => !pkSaving && setPkConfirmOpen(false)}>
          <div className="bg-card w-full max-w-md rounded-xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold mb-2">Confirm package price</div>
            <div className="text-sm text-muted-foreground mb-3">Customers will see this package price publicly:</div>
            <div className="rounded-lg border p-3 mb-3 text-center">
              <div className="text-[11px] uppercase text-muted-foreground">Public price</div>
              <div className="text-2xl font-bold mt-1">{NGN(pkForm.price)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{pkForm.name}{linkedProduct ? ` · ${linkedProduct.name}` : ""}</div>
            </div>
            {belowCost && (
              <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-300/50 rounded p-2 mb-3">
                This is below product cost of {NGN(unitCostTotal)}.
              </div>
            )}
            {!belowCost && suspiciouslyLow && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-300/50 rounded p-2 mb-3">
                This is under half the suggested price ({NGN(suggestedPrice)}).
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setPkConfirmOpen(false)} disabled={pkSaving} className="px-3 py-2 rounded border text-sm">Go back</button>
              <button onClick={savePackage} disabled={pkSaving} className="inline-flex items-center gap-1 px-3 py-2 rounded text-white text-sm" style={{ background: "var(--gradient-electric)" }}>
                {pkSaving && <Loader2 size={14} className="animate-spin" />} Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
