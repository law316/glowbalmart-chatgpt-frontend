import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, SearchInput, PrimaryBtn } from "@/components/ModulePage";
import { useLocal } from "@/lib/useLocal";
import { DEFAULT_STORE, type StoreConfig } from "./_app.storefront";
import { Copy, ExternalLink, Search, Save, Upload, Plus, X, Type, Image, Settings as Cog, Store, Palette, CreditCard } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/storefront-customization")({
  head: () => ({ meta: [{ title: "Storefront Customization — Glowbalmart CRM" }] }),
  component: CustomizationPage,
});

const TABS = [
  { id: "all", label: "All Settings", Icon: Cog },
  { id: "identity", label: "Store Identity", Icon: Store },
  { id: "theme", label: "Theme & Fonts", Icon: Palette },
  { id: "homepage", label: "Homepage Content", Icon: Image },
  { id: "footer", label: "Footer & Contact", Icon: Type },
  { id: "commerce", label: "Commerce", Icon: CreditCard },
];

function CustomizationPage() {
  const [cfg, setCfg] = useLocal<StoreConfig>("storefront", DEFAULT_STORE);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const update = <K extends keyof StoreConfig>(k: K, v: StoreConfig[K]) => setCfg({ ...cfg, [k]: v });
  const save = () => toast.success("Changes saved");
  const copy = () => { navigator.clipboard.writeText(cfg.url); toast.success("Link copied"); };

  return (
    <>
      <PageHeader title="Storefront Customization" subtitle="Manage all live storefront settings"
        actions={<>
          <button onClick={copy} className="text-sm px-3 py-2 rounded-lg border hover:bg-muted inline-flex items-center gap-1"><Copy size={14} /> Copy shop link</button>
          <a href={cfg.url} target="_blank" rel="noreferrer" className="text-sm px-3 py-2 rounded-lg border hover:bg-muted inline-flex items-center gap-1"><ExternalLink size={14} /> Visit Store</a>
        </>} />

      <div className="grid lg:grid-cols-[240px_1fr] gap-4">
        <Card className="p-2 h-fit">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings…" className="w-full pl-8 pr-3 py-2 rounded border bg-background text-sm" />
          </div>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${tab === id ? "bg-muted font-medium" : "hover:bg-muted/50"}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </Card>

        <div className="space-y-4">
          {tab === "all" && <AllOverview onPick={setTab} />}
          {tab === "identity" && <Identity cfg={cfg} update={update} copy={copy} save={save} />}
          {tab === "theme" && <Theme cfg={cfg} update={update} save={save} />}
          {tab === "homepage" && <Homepage cfg={cfg} update={update} save={save} />}
          {tab === "footer" && <Footer cfg={cfg} update={update} save={save} />}
          {tab === "commerce" && <Commerce cfg={cfg} update={update} save={save} />}
        </div>
      </div>
    </>
  );
}

function Field({ label, hint, children }: any) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
const inp = "w-full px-3 py-2 rounded-lg border bg-background text-sm";

function AllOverview({ onPick }: { onPick: (id: string) => void }) {
  const cards = [
    { id: "identity", title: "Store logo and store identity", desc: "Business name, tagline, logo, cover, URL.", Icon: Store },
    { id: "theme", title: "Font and color theme", desc: "Accent color, font family, button shape.", Icon: Palette },
    { id: "homepage", title: "Homepage hero image and text", desc: "Hero, announcement, sections, categories.", Icon: Image },
    { id: "footer", title: "Footer, contact and social links", desc: "Footer copy, contact info, social profiles.", Icon: Type },
    { id: "commerce", title: "Checkout and commerce controls", desc: "Visibility, header features, gateway charge.", Icon: CreditCard },
  ];
  return (
    <>
      <Card className="p-4">
        <div className="font-semibold">Essential controls</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-3">
          {[{ id: "identity", t: "Identity" }, { id: "theme", t: "Theme" }, { id: "homepage", t: "Homepage" }, { id: "footer", t: "Footer" }, { id: "commerce", t: "Payments" }].map(x => (
            <button key={x.id} onClick={() => onPick(x.id)} className="px-3 py-2 rounded-lg border hover:bg-muted text-sm text-left">{x.t}</button>
          ))}
        </div>
      </Card>
      <div className="grid md:grid-cols-2 gap-3">
        {cards.map(c => (
          <button key={c.id} onClick={() => onPick(c.id)} className="text-left rounded-xl border bg-card p-4 hover:shadow-lg hover:border-transparent transition-all">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "color-mix(in oklab, var(--electric) 18%, transparent)", color: "var(--electric)" }}><c.Icon size={18} /></span>
              <div>
                <div className="font-semibold text-sm">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function Identity({ cfg, update, copy, save }: any) {
  return (
    <Card className="p-5 space-y-4">
      <div><div className="font-semibold">Store Identity</div><div className="text-xs text-muted-foreground">Logo, name and banner — appears on the public storefront header and homepage.</div></div>
      <Field label="Business Name"><input className={inp} value={cfg.name} onChange={e => update("name", e.target.value)} /></Field>
      <Field label="Store Tagline"><input className={inp} value={cfg.tagline} onChange={e => update("tagline", e.target.value)} /></Field>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Store Logo"><button className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm hover:bg-muted"><Upload size={14} /> Upload Logo</button></Field>
        <Field label="Fallback Cover Image"><button className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm hover:bg-muted"><Upload size={14} /> Upload Cover Image</button></Field>
      </div>
      <Field label="Store URL">
        <div className="flex gap-2">
          <input className={inp} value={cfg.url} onChange={e => update("url", e.target.value)} />
          <button onClick={copy} className="px-3 rounded-lg border hover:bg-muted"><Copy size={14} /></button>
          <a href={cfg.url} target="_blank" rel="noreferrer" className="px-3 rounded-lg border hover:bg-muted flex items-center"><ExternalLink size={14} /></a>
        </div>
      </Field>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Default Language"><select className={inp} value={cfg.language} onChange={e => update("language", e.target.value)}><option>English</option><option>French</option><option>Pidgin</option></select></Field>
        <Field label="Default Currency"><select className={inp} value={cfg.currency} onChange={e => update("currency", e.target.value)}><option>Nigerian Naira (₦)</option><option>US Dollar ($)</option><option>Ghana Cedi (₵)</option></select></Field>
      </div>
      <div className="flex justify-end"><PrimaryBtn onClick={save}><Save size={14} /> Save Changes</PrimaryBtn></div>
    </Card>
  );
}

function Theme({ cfg, update, save }: any) {
  const radius = cfg.buttonShape === "pill" ? "9999px" : cfg.buttonShape === "rounded" ? "10px" : "4px";
  return (
    <Card className="p-5 space-y-4">
      <div><div className="font-semibold">Theme & Fonts</div><div className="text-xs text-muted-foreground">Color theme — used for buttons, cart badges and highlights.</div></div>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Accent color"><div className="flex gap-2"><input type="color" value={cfg.accent} onChange={e => update("accent", e.target.value)} className="w-12 h-10 rounded border" /><input className={inp} value={cfg.accent} onChange={e => update("accent", e.target.value)} /></div></Field>
        <Field label="Storefront Font"><select className={inp} value={cfg.font} onChange={e => update("font", e.target.value)}>{["Inter","Poppins","Roboto","Lato","Montserrat"].map(f => <option key={f}>{f}</option>)}</select></Field>
        <Field label="Button Shape"><select className={inp} value={cfg.buttonShape} onChange={e => update("buttonShape", e.target.value)}><option value="pill">Pill</option><option value="rounded">Rounded</option><option value="square">Square</option></select></Field>
      </div>
      <Card className="p-4 bg-muted/30">
        <div className="text-xs uppercase text-muted-foreground mb-2">Preview</div>
        <div className="flex gap-3 items-center" style={{ fontFamily: cfg.font }}>
          <button className="px-4 py-2 text-white font-medium" style={{ background: cfg.accent, borderRadius: radius }}>Button</button>
          <button className="px-4 py-2 text-white font-medium" style={{ background: cfg.accent, borderRadius: radius }}>Add to Cart</button>
        </div>
      </Card>
      <div className="flex justify-end"><PrimaryBtn onClick={save}><Save size={14} /> Save Changes</PrimaryBtn></div>
    </Card>
  );
}

function Homepage({ cfg, update, save }: any) {
  const [newCat, setNewCat] = useState("");
  return (
    <Card className="p-5 space-y-4">
      <div><div className="font-semibold">Homepage Content</div><div className="text-xs text-muted-foreground">Announcement and hero section.</div></div>
      <Field label="Announcement Bar Text"><input className={inp} value={cfg.announcement} onChange={e => update("announcement", e.target.value)} /></Field>
      <Field label="Hero Image"><button className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm hover:bg-muted"><Upload size={14} /> Upload Hero Image</button></Field>
      <Field label="Hero Title"><input className={inp} value={cfg.heroTitle} onChange={e => update("heroTitle", e.target.value)} /></Field>
      <Field label="Hero Subtitle"><input className={inp} value={cfg.heroSubtitle} onChange={e => update("heroSubtitle", e.target.value)} /></Field>
      <Field label="Hero Button Text"><input className={inp} value={cfg.heroButton} onChange={e => update("heroButton", e.target.value)} /></Field>

      <div className="pt-2 border-t"><div className="font-medium text-sm mb-2">Product section titles</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Featured"><input className={inp} value={cfg.featuredTitle} onChange={e => update("featuredTitle", e.target.value)} /></Field>
          <Field label="Trending"><input className={inp} value={cfg.trendingTitle} onChange={e => update("trendingTitle", e.target.value)} /></Field>
          <Field label="All Products"><input className={inp} value={cfg.allTitle} onChange={e => update("allTitle", e.target.value)} /></Field>
        </div>
      </div>

      <div className="pt-2 border-t">
        <div className="font-medium text-sm mb-2">Categories</div>
        <div className="flex gap-2 mb-2">
          <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Enter category name" className={inp} />
          <button onClick={() => { if (newCat.trim()) { update("categories", [...cfg.categories, newCat.trim()]); setNewCat(""); } }} className="px-3 rounded-lg border hover:bg-muted inline-flex items-center gap-1"><Plus size={14} /> Add</button>
        </div>
        {cfg.categories.length === 0 ? <div className="text-xs text-muted-foreground">No categories yet.</div> : (
          <div className="flex flex-wrap gap-1.5">
            {cfg.categories.map((c: string, i: number) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted">
                {c} <button onClick={() => update("categories", cfg.categories.filter((_: any, j: number) => j !== i))}><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end"><PrimaryBtn onClick={save}><Save size={14} /> Save Changes</PrimaryBtn></div>
    </Card>
  );
}

function Footer({ cfg, update, save }: any) {
  return (
    <Card className="p-5 space-y-4">
      <div><div className="font-semibold">Footer & Contact</div><div className="text-xs text-muted-foreground">Footer content.</div></div>
      <Field label="Footer Heading"><input className={inp} value={cfg.footerHeading} onChange={e => update("footerHeading", e.target.value)} /></Field>
      <Field label="Footer Description"><textarea rows={3} className={inp} value={cfg.footerDescription} onChange={e => update("footerDescription", e.target.value)} /></Field>
      <Field label="Newsletter Text"><input className={inp} value={cfg.newsletterText} onChange={e => update("newsletterText", e.target.value)} /></Field>
      <div className="pt-2 border-t"><div className="font-medium text-sm mb-2">Contact information</div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Contact Email"><input className={inp} value={cfg.contactEmail} onChange={e => update("contactEmail", e.target.value)} /></Field>
          <Field label="Contact Phone"><input className={inp} value={cfg.contactPhone} onChange={e => update("contactPhone", e.target.value)} /></Field>
          <Field label="Instagram URL"><input className={inp} value={cfg.instagram} onChange={e => update("instagram", e.target.value)} /></Field>
          <Field label="WhatsApp Link"><input className={inp} value={cfg.whatsapp} onChange={e => update("whatsapp", e.target.value)} /></Field>
          <Field label="Facebook URL"><input className={inp} value={cfg.facebook} onChange={e => update("facebook", e.target.value)} /></Field>
          <Field label="TikTok URL"><input className={inp} value={cfg.tiktok} onChange={e => update("tiktok", e.target.value)} /></Field>
        </div>
      </div>
      <div className="flex justify-end"><PrimaryBtn onClick={save}><Save size={14} /> Save Changes</PrimaryBtn></div>
    </Card>
  );
}

function Commerce({ cfg, update, save }: any) {
  return (
    <Card className="p-5 space-y-4">
      <div><div className="font-semibold">Commerce Settings</div><div className="text-xs text-muted-foreground">Visibility and header features.</div></div>
      <Field label="Storefront Visibility">
        <div className="flex gap-2">
          {(["public","private"] as const).map(v => (
            <button key={v} onClick={() => update("visibility", v)} className={`px-4 py-2 rounded-lg border text-sm capitalize ${cfg.visibility === v ? "border-transparent text-white" : ""}`} style={cfg.visibility === v ? { background: "var(--gradient-electric)" } : undefined}>{v}</button>
          ))}
        </div>
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.searchBar} onChange={e => update("searchBar", e.target.checked)} /> Show search bar on storefront header</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.cartIcon} onChange={e => update("cartIcon", e.target.checked)} /> Show cart icon on storefront header</label>
      <Field label="Who pays the gateway charge?" hint="This setting will be used by the Glowbalmart storefront checkout.">
        <div className="flex gap-2">
          {(["owner","customer"] as const).map(v => (
            <button key={v} onClick={() => update("chargePayer", v)} className={`px-4 py-2 rounded-lg border text-sm capitalize ${cfg.chargePayer === v ? "border-transparent text-white" : ""}`} style={cfg.chargePayer === v ? { background: "var(--gradient-electric)" } : undefined}>{v === "owner" ? "Store Owner" : "Customer"}</button>
          ))}
        </div>
      </Field>
      <div className="flex justify-end"><PrimaryBtn onClick={save}><Save size={14} /> Save Changes</PrimaryBtn></div>
    </Card>
  );
}
