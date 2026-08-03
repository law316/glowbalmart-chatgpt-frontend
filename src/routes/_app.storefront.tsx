import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Card, PrimaryBtn } from "@/components/ModulePage";
import { useEffect, useState } from "react";
import { useLocal } from "@/lib/useLocal";
import { listProducts, type ApiProduct } from "@/lib/api";
import { Copy, ExternalLink, Palette, ShoppingBag, Sparkles, Flame } from "lucide-react";
import { toast } from "sonner";
import { NGN } from "@/lib/format";

export const Route = createFileRoute("/_app/storefront")({
  head: () => ({ meta: [{ title: "Storefront — Glowbalmart CRM" }] }),
  component: StorefrontPage,
});

export interface StoreConfig {
  name: string; tagline: string; url: string; visibility: "public" | "private";
  accent: string; font: string; buttonShape: "pill" | "rounded" | "square";
  announcement: string; heroTitle: string; heroSubtitle: string; heroButton: string;
  featuredTitle: string; trendingTitle: string; allTitle: string;
  footerHeading: string; footerDescription: string; newsletterText: string;
  contactEmail: string; contactPhone: string;
  instagram: string; whatsapp: string; facebook: string; tiktok: string;
  language: string; currency: string;
  searchBar: boolean; cartIcon: boolean; chargePayer: "owner" | "customer";
  categories: string[];
}

export const DEFAULT_STORE: StoreConfig = {
  name: "Glowbalmart Demo Store", tagline: "Buy Quality, Buy Luxury...",
  url: "https://demo.glowbalmartcrm.com/shop", visibility: "public",
  accent: "#2563eb", font: "Inter", buttonShape: "pill",
  announcement: "Free delivery on orders over ₦50,000",
  heroTitle: "Wear Glowbalmart Demo Store, Timeless Products",
  heroSubtitle: "Clean, modern shopping powered by Glowbalmart CRM.",
  heroButton: "Shop Now",
  featuredTitle: "Featured", trendingTitle: "Top Trending", allTitle: "All Products",
  footerHeading: "About this store",
  footerDescription: "Premium, curated products. Quality you can feel, design you will love.",
  newsletterText: "Subscribe for new arrivals, offers and updates.",
  contactEmail: "hello@glowbalmartcrm.com", contactPhone: "+234 800 000 0000",
  instagram: "", whatsapp: "", facebook: "", tiktok: "",
  language: "English", currency: "Nigerian Naira (₦)",
  searchBar: true, cartIcon: true, chargePayer: "owner",
  categories: ["Skincare", "Wellness", "Accessory"],
};

function StorefrontPage() {
  const [cfg] = useLocal<StoreConfig>("storefront", DEFAULT_STORE);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { listProducts().then((p) => setProducts(p.filter((x) => x.active))).catch(() => setProducts([])).finally(() => setLoading(false)); }, []);

  const copy = () => { navigator.clipboard.writeText(cfg.url); toast.success("Shop link copied"); };
  const radius = cfg.buttonShape === "pill" ? "9999px" : cfg.buttonShape === "rounded" ? "10px" : "4px";

  return (
    <>
      <PageHeader title="Storefront" subtitle="Preview and manage your live customer-facing shop."
        actions={<>
          <button onClick={copy} className="text-sm px-3 py-2 rounded-lg border hover:bg-muted inline-flex items-center gap-1"><Copy size={14} /> Copy shop link</button>
          <a href={cfg.url} target="_blank" rel="noreferrer" className="text-sm px-3 py-2 rounded-lg border hover:bg-muted inline-flex items-center gap-1"><ExternalLink size={14} /> Visit Store</a>
          <Link to="/storefront-customization"><PrimaryBtn><Palette size={14} /> Customize Storefront</PrimaryBtn></Link>
        </>} />

      <div className="grid lg:grid-cols-4 gap-4 mb-4">
        <Card className="p-4 lg:col-span-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Store name</div>
          <div className="mt-1 text-xl font-bold">{cfg.name}</div>
          <div className="text-sm text-muted-foreground mt-1">{cfg.tagline}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">URL</div>
          <div className="mt-1 text-sm font-mono break-all">{cfg.url}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Status</div>
          <div className="mt-2"><span className={`text-xs px-2 py-1 rounded-full ${cfg.visibility === "public" ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{cfg.visibility}</span></div>
        </Card>
      </div>

      <Card className="overflow-hidden mb-4">
        <div className="px-4 py-2 text-xs uppercase tracking-wide bg-muted/40 border-b">Storefront preview</div>
        <div className="p-6" style={{ fontFamily: cfg.font }}>
          <div className="text-xs text-center mb-3 py-1 rounded" style={{ background: cfg.accent + "20", color: cfg.accent }}>{cfg.announcement}</div>
          <div className="rounded-2xl p-8 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${cfg.accent}, #0f172a)` }}>
            <div className="text-2xl md:text-3xl font-bold max-w-xl">{cfg.heroTitle}</div>
            <div className="mt-2 opacity-90 max-w-xl">{cfg.heroSubtitle}</div>
            <button className="mt-4 px-5 py-2.5 font-semibold text-slate-900 bg-white" style={{ borderRadius: radius }}>{cfg.heroButton}</button>
          </div>

          {loading ? (
            <div className="mt-6 text-sm text-center text-muted-foreground py-8">Loading products…</div>
          ) : products.length === 0 ? (
            <div className="mt-6 text-sm text-center text-muted-foreground py-8">No storefront products yet.</div>
          ) : (
            <>
              <Section title={cfg.featuredTitle} icon={<Sparkles size={16} />} products={products.slice(0, 3)} accent={cfg.accent} radius={radius} />
              <Section title={cfg.trendingTitle} icon={<Flame size={16} />} products={products.slice(0, 3)} accent={cfg.accent} radius={radius} />
              <Section title={cfg.allTitle} icon={<ShoppingBag size={16} />} products={products} accent={cfg.accent} radius={radius} />
            </>
          )}

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4">
              <div className="font-semibold mb-2">Cart preview</div>
              <div className="text-sm text-muted-foreground">Cart is empty</div>
              <button className="mt-3 w-full py-2 text-white font-medium" style={{ background: cfg.accent, borderRadius: radius }}>Proceed to checkout</button>
            </div>
            <div className="rounded-xl border p-4">
              <div className="font-semibold mb-2">Checkout preview</div>
              <div className="space-y-1.5 text-sm">
                <div className="h-9 rounded border bg-background flex items-center px-3 text-muted-foreground">Full name</div>
                <div className="h-9 rounded border bg-background flex items-center px-3 text-muted-foreground">Phone</div>
                <div className="h-9 rounded border bg-background flex items-center px-3 text-muted-foreground">Delivery address</div>
                <button className="mt-1 w-full py-2 text-white font-medium" style={{ background: cfg.accent, borderRadius: radius }}>Place order</button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function Section({ title, icon, products, accent, radius }: any) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3"><span style={{ color: accent }}>{icon}</span><div className="font-semibold">{title}</div></div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {products.map((p: any) => (
          <div key={p.id} className="rounded-xl border overflow-hidden bg-card hover:shadow-lg transition-shadow">
            <div className="aspect-square bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-muted-foreground"><ShoppingBag size={28} /></div>
            <div className="p-3">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.category || "Uncategorized"}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-semibold text-sm">{NGN(p.sellingPrice || 0)}</span>
                <button className="text-[11px] px-2.5 py-1 text-white" style={{ background: accent, borderRadius: radius }}>Add</button>
              </div>
              <div className="text-[11px] mt-1 text-muted-foreground">{p.active ? `${p.stockQuantity ?? 0} in stock` : "Inactive"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
