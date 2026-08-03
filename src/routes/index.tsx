import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Logo } from "@/components/Logo";
import {
  PhoneCall, ShoppingCart, FormInput, Wallet, BarChart3, Sparkles, Boxes,
  Users, ArrowRight, Check, Zap, Shield, Globe2, ChevronRight, Star,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Glowbalmart CRM — Sales Operations Built for African Ecommerce" },
      { name: "description", content: "Run your 3-call follow-up circle, embed order forms, manage finance, inventory and staff — from one premium command room built for serious sellers." },
    ],
  }),
  component: Landing,
});

function useCounter(target: number, duration = 1200) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.floor(p * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}

function Landing() {
  const userId = useStore((s) => s.currentUserId);
  const hydrated = useStore((s) => s.hydrated);
  if (hydrated && userId) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SiteNav />
      <Hero />
      <LogoStrip />
      <Stats />
      <Features />
      <FollowUpShowcase />
      <Workflow />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

function SiteNav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-background/70 border-b">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#followup" className="hover:text-foreground">Follow-up Engine</a>
          <a href="#workflow" className="hover:text-foreground">Workflow</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted">Sign in</Link>
          <Link to="/login" className="px-4 py-2 text-sm rounded-lg text-white font-medium shadow-lg"
            style={{ background: "var(--gradient-electric)" }}>
            Launch Console
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative">
      {/* gradient mesh */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl animate-glow"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.2 250 / 0.6), transparent 70%)" }} />
        <div className="absolute top-40 -right-32 w-[500px] h-[500px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.18 220 / 0.55), transparent 70%)" }} />
        <div className="absolute inset-0"
          style={{ backgroundImage: "linear-gradient(to right, oklch(0 0 0 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, oklch(0 0 0 / 0.04) 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "radial-gradient(circle at center, black, transparent 70%)" }} />
      </div>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-16 lg:pt-24 pb-20">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-card text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--electric)" }} />
              New · 3-Call Priority Follow-up Engine
            </div>
            <h1 className="mt-5 text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]">
              Close more orders.<br />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-electric)" }}>
                Lose zero leads.
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              Glowbalmart CRM is the enterprise sales operations platform built for serious African
              ecommerce teams. Embed order forms, auto-assign to staff, run the priority follow-up
              circle, and master finance — all from one premium command room.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-semibold shadow-xl"
                style={{ background: "var(--gradient-electric)" }}>
                Start Selling Smarter <ArrowRight size={18} />
              </Link>
              <a href="#followup" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border bg-card font-semibold hover:bg-muted">
                See the Follow-up Circle
              </a>
            </div>
            <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex -space-x-2">
                {["#3b82f6","#06b6d4","#22c55e","#f59e0b"].map((c, i) =>
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-background" style={{ background: c }} />)}
              </div>
              <div>Trusted by 1,200+ ecommerce sellers across Nigeria, Ghana & Kenya</div>
            </div>
          </div>

          {/* Hero visual */}
          <div className="lg:col-span-5 relative animate-fade-in-up">
            <DashboardPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <div className="relative rounded-3xl border bg-card shadow-2xl overflow-hidden" style={{ boxShadow: "0 30px 80px -20px oklch(0.18 0.04 260 / 0.35)" }}>
      <div className="px-4 py-2.5 flex items-center gap-2 border-b" style={{ background: "var(--gradient-navy)" }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="text-[10px] text-white/60 ml-2">glowbalmartcrm.com / call-queue</div>
      </div>
      <div className="p-5 space-y-3" style={{ background: "linear-gradient(180deg, oklch(0.99 0.005 240), oklch(0.96 0.01 255))" }}>
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: "Today's Calls", v: "47", c: "text-blue-600" },
            { l: "Deals Closed", v: "12", c: "text-emerald-600" },
            { l: "Revenue", v: "₦840K", c: "text-violet-600" },
          ].map((k) => (
            <div key={k.l} className="rounded-xl bg-white p-3 border">
              <div className="text-[10px] uppercase text-slate-500">{k.l}</div>
              <div className={`text-lg font-bold ${k.c}`}>{k.v}</div>
            </div>
          ))}
        </div>
        {[
          { name: "Customer A", pkg: "Couples Pack", state: "Lagos", priority: "Final Call", tone: "bg-red-500/15 text-red-600", attempt: 3 },
          { name: "Customer B", pkg: "Starter Pack", state: "Abuja", priority: "Second Call", tone: "bg-orange-500/15 text-orange-600", attempt: 2 },
          { name: "Customer C", pkg: "Family Pack", state: "Kano", priority: "New", tone: "bg-blue-500/15 text-blue-600", attempt: 1 },
        ].map((r) => (
          <div key={r.name} className="rounded-xl bg-white border p-3 flex items-center gap-3">
            <div className="relative w-10 h-10">
              <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="oklch(0.92 0.012 255)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="oklch(0.65 0.2 250)" strokeWidth="3"
                  strokeDasharray={`${(r.attempt / 3) * 94} 94`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-[10px] font-bold text-slate-700">{r.attempt}/3</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{r.name}</div>
              <div className="text-[11px] text-slate-500">{r.pkg} · {r.state}</div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.tone} font-medium`}>{r.priority}</span>
          </div>
        ))}
      </div>
      <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full blur-2xl opacity-50"
        style={{ background: "var(--gradient-electric)" }} />
    </div>
  );
}

function LogoStrip() {
  return (
    <div className="border-y bg-muted/30">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Built for teams using</div>
        {["Paystack","Flutterwave","Meta Pixel","WhatsApp Cloud","GIG Logistics"].map((b) => (
          <div key={b} className="text-sm font-semibold text-foreground/60">{b}</div>
        ))}
      </div>
    </div>
  );
}

function Stats() {
  const a = useCounter(98); const b = useCounter(3); const c = useCounter(1200); const d = useCounter(42);
  return (
    <section className="py-16 max-w-7xl mx-auto px-5 lg:px-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { l: "Conversion Lift", v: `${a}%`, s: "Average uplift in 90 days" },
          { l: "Call Attempts", v: `${b}-step`, s: "Priority follow-up circle" },
          { l: "Active Sellers", v: `${c.toLocaleString()}+`, s: "Across West Africa" },
          { l: "Hours Saved", v: `${d}h/wk`, s: "Per sales team" },
        ].map((s) => (
          <div key={s.l} className="text-center">
            <div className="text-4xl lg:text-5xl font-extrabold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-electric)" }}>{s.v}</div>
            <div className="mt-1 font-semibold text-sm">{s.l}</div>
            <div className="text-xs text-muted-foreground">{s.s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATS = [
  { icon: PhoneCall, t: "3-Call Follow-up Engine", d: "Today's priority calls auto-sorted by urgency. Yesterday's missed calls bubble to the top." },
  { icon: FormInput, t: "Embeddable Order Forms", d: "Create branded forms, embed on any site, and pipe leads straight into your queue." },
  { icon: ShoppingCart, t: "Smart Order Assignment", d: "Round-robin, least-active, or manual — with max-active limits per staff." },
  { icon: Wallet, t: "Finance & Commissions", d: "Track gross, confirmed, pending revenue. Commissions calculate automatically on close." },
  { icon: Boxes, t: "Inventory Sync", d: "Stock deducts on every successful deal. Low-stock alerts before you sell out." },
  { icon: BarChart3, t: "Reports & Exports", d: "Excel and PDF for orders, finance, inventory, follow-ups and manifests." },
  { icon: Sparkles, t: "Glow AI Assistant", d: "Ask plain questions — get sales reviews, risks and next-best actions." },
  { icon: Users, t: "Role-based Access", d: "Admin, Manager, Sales, Finance, Delivery — each sees only what they need." },
];

function Features() {
  return (
    <section id="features" className="py-20 max-w-7xl mx-auto px-5 lg:px-8">
      <div className="max-w-2xl">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--electric)" }}>Capabilities</div>
        <h2 className="mt-3 text-3xl lg:text-5xl font-extrabold tracking-tight">An entire sales operation, in one console.</h2>
        <p className="mt-4 text-muted-foreground">Every module is built around one belief: a paid order is only paid when it's delivered. Glowbalmart helps your team get there.</p>
      </div>
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATS.map((f) => (
          <div key={f.t} className="group rounded-2xl border bg-card p-5 hover:-translate-y-1 hover:shadow-xl transition-all">
            <div className="w-11 h-11 rounded-xl grid place-items-center text-white mb-4" style={{ background: "var(--gradient-electric)" }}>
              <f.icon size={20} />
            </div>
            <div className="font-semibold">{f.t}</div>
            <div className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FollowUpShowcase() {
  return (
    <section id="followup" className="py-20" style={{ background: "var(--gradient-navy)" }}>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-12 items-center text-white">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-white/60">Signature Feature</div>
          <h2 className="mt-3 text-3xl lg:text-5xl font-extrabold tracking-tight">The 3-Call Priority Circle.</h2>
          <p className="mt-4 text-white/70 leading-relaxed">
            We turn the messy reality of follow-ups into a clean, automated discipline. Every order
            moves through up to three attempts — auto-promoted by urgency, auto-closed when ready.
          </p>
          <div className="mt-8 space-y-4">
            {[
              { n: "01", t: "First Call Due", d: "New assignments enter the queue and surface today." },
              { n: "02", t: "Second Call — Priority", d: "Auto-promoted +1 day after on-hold or no-answer." },
              { n: "03", t: "Final Call — High Priority", d: "Last attempt before auto-close to keep the queue clean." },
            ].map((s) => (
              <div key={s.n} className="flex gap-4">
                <div className="text-2xl font-extrabold opacity-50 w-10">{s.n}</div>
                <div>
                  <div className="font-semibold">{s.t}</div>
                  <div className="text-sm text-white/60">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          <Link to="/login" className="mt-8 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold">
            Try the Call Queue <ChevronRight size={16} />
          </Link>
        </div>
        <div className="relative">
          <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur p-6">
            {[
              { label: "Final Call", tone: "bg-red-500", n: 3 },
              { label: "Second Call", tone: "bg-orange-500", n: 2 },
              { label: "First Call", tone: "bg-blue-500", n: 1 },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-3 flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${s.tone}`} />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-xs text-white/50">Attempt {s.n} of 3 · auto-prioritized</div>
                </div>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-white text-slate-900 font-medium">Save Result</button>
              </div>
            ))}
            <div className="mt-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200 flex items-center gap-2">
              <Check size={14} /> Closed — Max Follow-up · removed from queue automatically
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="workflow" className="py-20 max-w-7xl mx-auto px-5 lg:px-8">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--electric)" }}>How it works</div>
        <h2 className="mt-3 text-3xl lg:text-5xl font-extrabold tracking-tight">From form fill to delivered order.</h2>
      </div>
      <div className="mt-12 grid md:grid-cols-4 gap-6">
        {[
          { i: FormInput, t: "Customer submits", d: "Embedded form captures the lead." },
          { i: Users, t: "Auto-assigned", d: "Round-robin or least-active staff." },
          { i: PhoneCall, t: "Follow-up circle", d: "3-call priority queue closes the deal." },
          { i: Wallet, t: "Finance + Delivery", d: "Inventory deducts, commission posts, manifest prints." },
        ].map((s, i) => (
          <div key={s.t} className="relative">
            <div className="rounded-2xl border bg-card p-6">
              <div className="w-10 h-10 rounded-xl grid place-items-center text-white" style={{ background: "var(--gradient-electric)" }}><s.i size={18} /></div>
              <div className="mt-4 font-semibold">{s.t}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.d}</div>
            </div>
            {i < 3 && <ChevronRight className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />}
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    { q: "We stopped losing orders to forgotten follow-ups. The 3-call circle is sales discipline you can't get anywhere else.", a: "Adaeze O.", r: "Founder, Glow Naturals" },
    { q: "Embedding the order form on our landing page and watching leads land in the queue felt like cheating.", a: "Tunde B.", r: "Sales Manager" },
    { q: "Finance, commissions and inventory in one place. Our weekly close went from 6 hours to 40 minutes.", a: "Emeka N.", r: "Finance Officer" },
  ];
  return (
    <section className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight max-w-2xl">Loved by sellers who refuse to leave money on the table.</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {items.map((t) => (
            <div key={t.a} className="rounded-2xl border bg-card p-6">
              <div className="flex gap-1 text-amber-400 mb-3">{[1,2,3,4,5].map((s) => <Star key={s} size={14} fill="currentColor" />)}</div>
              <p className="text-sm leading-relaxed">"{t.q}"</p>
              <div className="mt-4 text-sm font-semibold">{t.a}</div>
              <div className="text-xs text-muted-foreground">{t.r}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-20 max-w-7xl mx-auto px-5 lg:px-8">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--electric)" }}>Pricing</div>
        <h2 className="mt-3 text-3xl lg:text-5xl font-extrabold tracking-tight">Simple plans. Serious power.</h2>
      </div>
      <div className="mt-12 grid md:grid-cols-3 gap-5">
        {[
          { n: "Starter", p: "₦15,000", s: "/mo", b: ["1 admin + 2 staff", "Up to 500 orders/mo", "Embed 2 forms", "Excel & PDF exports"] },
          { n: "Growth", p: "₦35,000", s: "/mo", b: ["1 admin + 8 staff", "Unlimited orders", "Unlimited forms", "Finance + Commissions", "WhatsApp templates"], featured: true },
          { n: "Enterprise", p: "Custom", s: "", b: ["Unlimited staff", "Multi-store", "API + Webhooks", "Dedicated success"] },
        ].map((p) => (
          <div key={p.n} className={`rounded-2xl border p-6 ${p.featured ? "text-white" : "bg-card"}`}
            style={p.featured ? { background: "var(--gradient-navy)", borderColor: "transparent" } : undefined}>
            <div className="font-semibold">{p.n}</div>
            <div className="mt-3 text-4xl font-extrabold">{p.p}<span className="text-base font-medium opacity-60">{p.s}</span></div>
            <ul className="mt-6 space-y-2 text-sm">
              {p.b.map((f) => <li key={f} className="flex items-center gap-2"><Check size={14} /> {f}</li>)}
            </ul>
            <Link to="/login" className={`mt-6 block text-center px-4 py-2.5 rounded-xl font-semibold ${p.featured ? "bg-white text-slate-900" : "border"}`}>
              {p.featured ? "Start free trial" : "Get started"}
            </Link>
          </div>
        ))}
      </div>
      <div className="mt-10 grid sm:grid-cols-3 gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2"><Zap size={16} className="text-amber-500" /> Setup in under 10 minutes</div>
        <div className="flex items-center gap-2"><Shield size={16} className="text-emerald-500" /> Role-based access · audit logs</div>
        <div className="flex items-center gap-2"><Globe2 size={16} className="text-blue-500" /> Naira-first · all African states</div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-20">
      <div className="max-w-5xl mx-auto px-5 lg:px-8">
        <div className="rounded-3xl p-10 lg:p-16 text-center text-white relative overflow-hidden" style={{ background: "var(--gradient-navy)" }}>
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-40 animate-glow"
            style={{ background: "radial-gradient(circle, oklch(0.65 0.2 250 / 0.7), transparent 70%)" }} />
          <h2 className="relative text-3xl lg:text-5xl font-extrabold tracking-tight">Your sales floor, finally organised.</h2>
          <p className="relative mt-4 text-white/70 max-w-2xl mx-auto">Stop juggling spreadsheets, WhatsApp threads and missed follow-ups. Run your entire ecommerce operation from one premium console.</p>
          <Link to="/login" className="relative mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-slate-900 font-semibold">
            Launch Glowbalmart CRM <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t py-10">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <Logo />
        <div>© {new Date().getFullYear()} Glowbalmart CRM. Built for serious sellers.</div>
        <div className="flex gap-4">
          <Link to="/login" className="hover:text-foreground">Sign in</Link>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
        </div>
      </div>
    </footer>
  );
}
