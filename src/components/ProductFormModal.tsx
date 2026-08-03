import { useEffect, useState } from "react";
import { Boxes, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NGN } from "@/lib/format";
import {
  createProduct, updateProduct, getProductEnhancement, saveProductEnhancement,
  type ApiProduct, type ProductEnhancement, type ProductPriceTier,
} from "@/lib/api";

const COUNTRIES = [
  { name: "Nigeria", code: "NG", currency: "NGN" },
  { name: "Ghana", code: "GH", currency: "GHS" },
  { name: "Kenya", code: "KE", currency: "KES" },
  { name: "South Africa", code: "ZA", currency: "ZAR" },
  { name: "United Kingdom", code: "GB", currency: "GBP" },
  { name: "United States", code: "US", currency: "USD" },
];

const CATEGORIES = ["Health", "Beauty", "Skincare", "Supplements", "Fashion", "Electronics", "Home", "Digital", "Other"];

export type ProductFormState = {
  countryName: string; countryCode: string; currency: string;
  name: string; description: string; category: string; sku: string;
  hasVariations: "" | "no" | "yes"; variations: string;
  hasOffer: "" | "no" | "yes"; offerText: string;
  priceTiers: ProductPriceTier[];
  stockQuantity: number;
  lowStockThreshold: number;
  lowStockThresholdAgents: number;
  lowStockAlertEmails: string;
  downloadUrl: string; downloadText: string;
  active: boolean;
};

export const EMPTY_PRODUCT_FORM: ProductFormState = {
  countryName: "Nigeria", countryCode: "NG", currency: "NGN",
  name: "", description: "", category: "", sku: "",
  hasVariations: "", variations: "",
  hasOffer: "", offerText: "",
  priceTiers: [{ quantity: 1, unitLabel: "Unit", costPrice: 0, sellingPrice: 0, recurring: "None" }],
  stockQuantity: 0,
  lowStockThreshold: 10,
  lowStockThresholdAgents: 5,
  lowStockAlertEmails: "",
  downloadUrl: "", downloadText: "",
  active: true,
};

function slugSku(name: string) {
  const base = (name || "PRD").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 12) || "PRD";
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function cleanBackendError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  const s = raw.toLowerCase();
  if (/sku/.test(s) && /(exist|duplicate|unique|already)/.test(s)) return "A product with this code/SKU already exists.";
  if (/validation failed/.test(s) || /methodargumentnotvalid/.test(s)) return "Please check the product details and try again.";
  if (/internal server error|500/.test(s)) return "Server error. Please try again in a moment.";
  if (/network|fetch|failed to fetch/.test(s)) return "Network error. Check your connection and try again.";
  return raw.split("\n")[0].replace(/^.*Exception:\s*/i, "").slice(0, 200) || "Something went wrong. Please try again.";
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium">{label}</label>
    {children}
    {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
  </div>
);

const inputCls = "w-full mt-1 px-3 py-2 rounded border bg-background text-sm";

export function ProductFormModal({
  open, editing, onClose, onSaved,
}: {
  open: boolean;
  editing?: ApiProduct | null;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}) {
  const [f, setF] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!editing) { setF(EMPTY_PRODUCT_FORM); return; }
    setF({
      ...EMPTY_PRODUCT_FORM,
      name: editing.name || "",
      description: editing.description || "",
      category: editing.category || "",
      sku: editing.sku || "",
      stockQuantity: editing.stockQuantity ?? 0,
      lowStockThreshold: editing.lowStockThreshold ?? 10,
      active: editing.active ?? true,
      priceTiers: [{ quantity: 1, unitLabel: "Unit", costPrice: editing.costPrice ?? 0, sellingPrice: editing.sellingPrice ?? 0, recurring: "None" }],
    });
    getProductEnhancement(editing.id).then((x) => {
      if (!x) return;
      setF((prev) => ({
        ...prev,
        countryName: x.countryName || prev.countryName,
        countryCode: x.countryCode || prev.countryCode,
        currency: x.currency || prev.currency,
        hasVariations: x.hasVariations ? "yes" : x.hasVariations === false ? "no" : prev.hasVariations,
        variations: x.variations || "",
        hasOffer: x.hasOffer ? "yes" : x.hasOffer === false ? "no" : prev.hasOffer,
        offerText: x.offerText || "",
        lowStockThresholdAgents: x.lowStockThresholdAgents ?? prev.lowStockThresholdAgents,
        lowStockAlertEmails: x.lowStockAlertEmails || "",
        downloadUrl: x.downloadUrl || "",
        downloadText: x.downloadText || "",
        priceTiers: x.priceTiers && x.priceTiers.length ? x.priceTiers : prev.priceTiers,
      }));
    }).catch(() => {});
  }, [open, editing]);

  if (!open) return null;

  const base = f.priceTiers[0] || { quantity: 1, unitLabel: "Unit", costPrice: 0, sellingPrice: 0 };
  const unitCost = base.quantity > 0 ? (base.costPrice || 0) / base.quantity : 0;
  const unitSell = base.quantity > 0 ? (base.sellingPrice || 0) / base.quantity : 0;
  const belowCost = unitSell > 0 && unitCost > 0 && unitSell < unitCost;

  const setTier = (i: number, patch: Partial<ProductPriceTier>) =>
    setF((p) => ({ ...p, priceTiers: p.priceTiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));

  const save = async () => {
    if (!f.name.trim()) { toast.error("Product name is required."); return; }
    if (belowCost) {
      if (!confirm("Selling price is below cost price. This product may lose money.\n\nSave anyway?")) return;
    }
    setSaving(true);
    const sku = f.sku.trim() || slugSku(f.name);
    try {
      const payload: any = {
        name: f.name.trim(),
        sku,
        category: f.category,
        description: f.description,
        stockQuantity: Number(f.stockQuantity) || 0,
        lowStockThreshold: Number(f.lowStockThreshold) || 0,
        costPrice: Math.round(unitCost * 100) / 100,
        sellingPrice: Math.round(unitSell * 100) / 100,
        price: Math.round(unitSell * 100) / 100,
        active: f.active,
      };
      let productId = editing?.id;
      if (editing) { await updateProduct(editing.id, payload); toast.success("Product updated"); }
      else {
        const created: any = await createProduct(payload);
        productId = created?.id || created?.product?.id;
        toast.success("Product created");
      }
      if (productId) {
        const extras: ProductEnhancement = {
          productId,
          countryName: f.countryName, countryCode: f.countryCode, currency: f.currency,
          productCategory: f.category || undefined,
          hasVariations: f.hasVariations === "yes",
          variations: f.variations || undefined,
          hasOffer: f.hasOffer === "yes",
          offerText: f.offerText || undefined,
          downloadUrl: f.downloadUrl || undefined,
          downloadText: f.downloadText || undefined,
          lowStockThresholdAgents: f.lowStockThresholdAgents || undefined,
          lowStockAlertEmails: f.lowStockAlertEmails || undefined,
          priceTiers: f.priceTiers.length ? f.priceTiers : undefined,
        };
        try { await saveProductEnhancement(productId, extras); }
        catch { toast.message("Product saved. Extra product settings are not connected yet."); }
      }
      onClose();
      await onSaved?.();
    } catch (e) {
      toast.error(cleanBackendError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => !saving && onClose()}>
      <div className="bg-card w-full max-w-2xl rounded-xl p-5 shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold mb-4 flex items-center gap-2"><Boxes size={16} /> {editing ? "Edit Product" : "Add Product"}</div>

        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product basic information</div>

          <Field label="Country to sell this product">
            <select
              value={f.countryCode}
              onChange={(e) => {
                const c = COUNTRIES.find((x) => x.code === e.target.value)!;
                setF({ ...f, countryCode: c.code, countryName: c.name, currency: c.currency });
              }}
              className={inputCls}
            >
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.currency})</option>)}
            </select>
          </Field>

          <Field label="Product name *">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} placeholder="Facemask" />
          </Field>

          <Field label="Product description" hint="For your view only">
            <textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inputCls} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Product category">
              <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inputCls}>
                <option value="">Select</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Product code / SKU (optional)" hint="Leave empty and we generate one automatically.">
              <input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} className={inputCls} placeholder="Auto-generated" />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Does this product have variations (colors, sizes etc)?">
              <select value={f.hasVariations} onChange={(e) => setF({ ...f, hasVariations: e.target.value as ProductFormState["hasVariations"] })} className={inputCls}>
                <option value="">Select</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
              {f.hasVariations === "yes" && (
                <input value={f.variations} onChange={(e) => setF({ ...f, variations: e.target.value })} placeholder="Red, Blue, Large, Small" className={inputCls} />
              )}
            </Field>
            <Field label="Do you have an offer for this product?">
              <select value={f.hasOffer} onChange={(e) => setF({ ...f, hasOffer: e.target.value as ProductFormState["hasOffer"] })} className={inputCls}>
                <option value="">Select</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
              {f.hasOffer === "yes" && (
                <input value={f.offerText} onChange={(e) => setF({ ...f, offerText: e.target.value })} placeholder="Buy 2 get 1 free" className={inputCls} />
              )}
            </Field>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost price and selling price tiers</div>
              <button type="button" onClick={() => setF({ ...f, priceTiers: [...f.priceTiers, { quantity: f.priceTiers.length + 1, unitLabel: "Units", costPrice: 0, sellingPrice: 0, recurring: "None" }] })} className="text-xs px-2 py-1 rounded border hover:bg-muted">+ Add price tier</button>
            </div>
            <div className="space-y-2">
              {f.priceTiers.map((t, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end rounded-lg border p-2">
                  <label className="text-[10px] text-muted-foreground">Quantity
                    <input type="number" min={1} value={t.quantity} onChange={(e) => setTier(i, { quantity: +e.target.value })} className={inputCls} /></label>
                  <label className="text-[10px] text-muted-foreground">Unit label
                    <input value={t.unitLabel} onChange={(e) => setTier(i, { unitLabel: e.target.value })} className={inputCls} placeholder="Unit" /></label>
                  <label className="text-[10px] text-muted-foreground">Cost price
                    <input type="number" min={0} value={t.costPrice} onChange={(e) => setTier(i, { costPrice: +e.target.value })} className={inputCls} /></label>
                  <label className="text-[10px] text-muted-foreground">Selling price
                    <input type="number" min={0} value={t.sellingPrice} onChange={(e) => setTier(i, { sellingPrice: +e.target.value })} className={inputCls} /></label>
                  <label className="text-[10px] text-muted-foreground">Recurring
                    <select value={t.recurring || "None"} onChange={(e) => setTier(i, { recurring: e.target.value })} className={inputCls}>
                      {["None", "Weekly", "Monthly", "Quarterly", "Yearly"].map((r) => <option key={r}>{r}</option>)}
                    </select></label>
                  <button type="button" disabled={f.priceTiers.length === 1} onClick={() => setF({ ...f, priceTiers: f.priceTiers.filter((_, j) => j !== i) })} className="text-xs px-2 py-2 rounded border hover:bg-muted disabled:opacity-40">Remove</button>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Tier 1 sets the unit cost/selling price used by inventory, packages and stock deduction. Unit cost {NGN(unitCost)} · unit selling {NGN(unitSell)}.
            </div>
            {belowCost && (
              <div className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-500/10 border border-amber-300/50 rounded p-2 mt-2">
                Selling price is below cost price. This product may lose money.
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Stock and alerts</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Opening stock quantity">
                <input type="number" min={0} value={f.stockQuantity} onChange={(e) => setF({ ...f, stockQuantity: +e.target.value })} className={inputCls} />
              </Field>
              <Field label="Low stock alert quantity (total)">
                <input type="number" min={0} value={f.lowStockThreshold} onChange={(e) => setF({ ...f, lowStockThreshold: +e.target.value })} className={inputCls} />
              </Field>
              <Field label="Low stock alert quantity (agents)">
                <input type="number" min={0} value={f.lowStockThresholdAgents} onChange={(e) => setF({ ...f, lowStockThresholdAgents: +e.target.value })} className={inputCls} />
              </Field>
              <Field label="Email(s) to receive low stock alert" hint="Separate each email with comma">
                <input value={f.lowStockAlertEmails} onChange={(e) => setF({ ...f, lowStockAlertEmails: e.target.value })} placeholder="glowbalmart@gmail.com" className={inputCls} />
              </Field>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Download link after delivery</div>
            <Field label="Link to file download for successful delivery" hint="If you have a PDF or Video file to share to customers that bought this product, paste the link here. It will appear on the invoice sent to customers email once you mark their order as Delivered.">
              <input value={f.downloadUrl} onChange={(e) => setF({ ...f, downloadUrl: e.target.value })} placeholder="https://…" className={inputCls} />
            </Field>
            <div className="mt-3">
              <Field label="Text to show">
                <input value={f.downloadText} onChange={(e) => setF({ ...f, downloadText: e.target.value })} placeholder="Click here to download your FREE PDF guide" className={inputCls} />
              </Field>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="px-3 py-2 text-sm rounded border">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-4 py-2 text-sm rounded text-white disabled:opacity-60" style={{ background: "var(--gradient-electric)" }}>
            {saving && <Loader2 size={14} className="animate-spin" />} Save product
          </button>
        </div>
      </div>
    </div>
  );
}
