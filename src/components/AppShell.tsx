import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useCurrentUser, useStore } from "@/lib/store";
import { Logo, useTheme } from "./Logo";
import { AIAssistant } from "./AIAssistant";
import { InstallPrompt } from "./InstallPrompt";
import { AccessDenied } from "./AccessDenied";
import { roleLabel } from "@/lib/api";
import { CommandPalette } from "./CommandPalette";
import { FollowUpReminderPopup } from "./FollowUpReminderPopup";
import { NotificationCenter } from "./NotificationCenter";

import {
  LayoutDashboard, PhoneCall, ShoppingCart, FormInput, Package as PkgIcon,
  Users, UserCog, Wallet, Boxes, Truck, BarChart3, Megaphone, Activity,
  UsersRound, Sparkles, Settings as SettingsIcon, Search, Bell, Moon, Sun, LogOut, Menu, X,
  ChevronDown, Store, Briefcase, Plug, Headphones, CreditCard, Palette,
  TrendingUp, ShoppingBag, FileBox, AlertTriangle, ClipboardList, Mail,
  MessageSquare, Webhook, Bot, ListChecks, RotateCcw, StickyNote, ShieldCheck,
  BadgeDollarSign, Award, ScrollText, ShoppingBasket, MailOpen,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Role } from "@/lib/types";

interface NavItem { to: string; label: string; icon: React.ComponentType<{ size?: number }>; roles: Role[]; }
interface NavGroup { label: string; icon: React.ComponentType<{ size?: number }>; items: NavItem[]; }

const ALL_ROLES: Role[] = ["admin","manager","staff","finance","delivery"];
const ADMIN_MGR: Role[] = ["admin","manager"];
const SALES: Role[] = ["admin","manager","staff"];
const FIN: Role[] = ["admin","manager","finance"];

const SOLO_TOP: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  { to: "/call-queue", label: "Sales Rep Follow-Up", icon: PhoneCall, roles: SALES },
];

const GROUPS: NavGroup[] = [
  { label: "My Store", icon: Store, items: [
    { to: "/storefront", label: "Storefront", icon: Store, roles: ADMIN_MGR },
    { to: "/storefront-customization", label: "Customization", icon: Palette, roles: ADMIN_MGR },
    { to: "/products", label: "Products", icon: PkgIcon, roles: ADMIN_MGR },
    { to: "/checkout", label: "Checkout", icon: CreditCard, roles: ADMIN_MGR },
    { to: "/forms", label: "Sales Forms", icon: FormInput, roles: ADMIN_MGR },
    { to: "/embed-forms", label: "Embed Forms", icon: ScrollText, roles: ADMIN_MGR },
    { to: "/form-submissions", label: "Form Submissions", icon: MailOpen, roles: SALES },
  ]},
  { label: "Orders", icon: ShoppingCart, items: [
    { to: "/orders", label: "All Orders", icon: ShoppingCart, roles: SALES },
  ]},
  { label: "Inventory & Stock", icon: Boxes, items: [
    { to: "/inventory", label: "Inventory", icon: Boxes, roles: ADMIN_MGR },
    { to: "/product-analytics", label: "Product Analytics", icon: TrendingUp, roles: ADMIN_MGR },
    { to: "/buy-stock", label: "Buy Stock", icon: ShoppingBag, roles: ADMIN_MGR },
    { to: "/stock-record", label: "Stock Record", icon: FileBox, roles: ADMIN_MGR },
    { to: "/agent-stock", label: "Agent Stock", icon: Truck, roles: ADMIN_MGR },
    { to: "/waybill", label: "Waybill", icon: ClipboardList, roles: ADMIN_MGR },
    { to: "/faulty-stock", label: "Faulty Stock", icon: AlertTriangle, roles: ADMIN_MGR },
  ]},
  { label: "Agents", icon: Truck, items: [
    { to: "/agents", label: "Agent List", icon: Truck, roles: ADMIN_MGR },
    { to: "/agent-performance", label: "Agent Performance", icon: TrendingUp, roles: ADMIN_MGR },
    { to: "/agent-deliveries", label: "Agent Deliveries", icon: ListChecks, roles: ADMIN_MGR },
  ]},
  { label: "Finance", icon: Wallet, items: [
    { to: "/finance", label: "Accounts & Expenses", icon: Wallet, roles: FIN },
    { to: "/finance-ledger", label: "Finance Ledger", icon: ScrollText, roles: FIN },
    { to: "/profit-dashboard", label: "Profit Dashboard", icon: TrendingUp, roles: FIN },
    { to: "/wallet", label: "Wallet", icon: BadgeDollarSign, roles: FIN },
    { to: "/delivery", label: "Delivery Manifest", icon: Truck, roles: ["admin","manager","delivery"] },
  ]},
  { label: "Marketing", icon: Megaphone, items: [
    { to: "/campaigns", label: "Campaign Manager", icon: Megaphone, roles: ADMIN_MGR },
    { to: "/promoters", label: "Media Buyers", icon: Megaphone, roles: ADMIN_MGR },
    { to: "/promoter-targets", label: "Media Buyer Targets", icon: Award, roles: ADMIN_MGR },
    { to: "/campaign-attribution", label: "Campaign Attribution", icon: Activity, roles: ADMIN_MGR },
    { to: "/email-marketing", label: "Email Marketing", icon: Mail, roles: ADMIN_MGR },
    { to: "/whatsapp-automation", label: "WhatsApp Automation", icon: MessageSquare, roles: ADMIN_MGR },
    { to: "/sms-automation", label: "SMS Automation", icon: MessageSquare, roles: ADMIN_MGR },
    { to: "/message-templates", label: "Templates", icon: ScrollText, roles: ADMIN_MGR },
    { to: "/abandoned-cart", label: "Abandoned Cart", icon: ShoppingBasket, roles: ADMIN_MGR },
    { to: "/broadcast-history", label: "Broadcast History", icon: MailOpen, roles: ADMIN_MGR },
    { to: "/tracking", label: "Tracking / Pixel", icon: Activity, roles: ADMIN_MGR },
    { to: "/affiliates", label: "Affiliates", icon: UsersRound, roles: ADMIN_MGR },
  ]},
  { label: "Staff Management", icon: Briefcase, items: [
    { to: "/staff", label: "Staff List", icon: UserCog, roles: ["admin","manager"] },
    { to: "/roles-permissions", label: "Roles & Permissions", icon: ShieldCheck, roles: ["admin"] },
    { to: "/staff-performance", label: "Staff Performance", icon: TrendingUp, roles: ADMIN_MGR },
    { to: "/staff-earnings", label: "Staff Earnings", icon: Award, roles: ALL_ROLES },
    { to: "/assignment-rules", label: "Assignment Rules", icon: Activity, roles: ADMIN_MGR },
    { to: "/sales-cohorts", label: "Sales Cohorts", icon: UsersRound, roles: ADMIN_MGR },
    { to: "/sales-manager-office", label: "Sales Manager Office", icon: Briefcase, roles: ADMIN_MGR },
  ]},
  { label: "Reports", icon: BarChart3, items: [
    { to: "/reports", label: "Reports & Exports", icon: BarChart3, roles: FIN },
  ]},
  { label: "Connections", icon: Plug, items: [
    { to: "/connections/woocommerce", label: "WooCommerce", icon: Plug, roles: ["admin"] },
    { to: "/connections/elementor", label: "Elementor Form", icon: FormInput, roles: ["admin"] },
    { to: "/connections/webhooks", label: "Webhooks", icon: Webhook, roles: ["admin"] },
    { to: "/connections/payment-gateways", label: "Payment Gateways", icon: CreditCard, roles: ["admin"] },
    { to: "/connections/whatsapp", label: "WhatsApp Provider", icon: MessageSquare, roles: ["admin"] },
    { to: "/connections/sms", label: "SMS Provider", icon: MessageSquare, roles: ["admin"] },
    { to: "/connections/email", label: "Email Provider", icon: Mail, roles: ["admin"] },
    { to: "/connections/ai-provider", label: "AI Provider", icon: Bot, roles: ["admin"] },
    { to: "/state-whatsapp-groups", label: "State WhatsApp Groups", icon: MessageSquare, roles: ["admin","manager"] },
  ]},
  { label: "Customer Service", icon: Headphones, items: [
    { to: "/customers", label: "Customers", icon: Users, roles: SALES },
    { to: "/follow-ups", label: "Follow-ups", icon: PhoneCall, roles: SALES },
    { to: "/call-logs", label: "Call Logs", icon: ScrollText, roles: SALES },
    { to: "/complaints", label: "Complaints", icon: AlertTriangle, roles: SALES },
    { to: "/returns", label: "Returns", icon: RotateCcw, roles: SALES },
    { to: "/customer-notes", label: "Customer Notes", icon: StickyNote, roles: SALES },
  ]},

];

const SOLO_BOTTOM: NavItem[] = [
  { to: "/chat", label: "Team Chat", icon: MessageSquare, roles: ALL_ROLES },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ALL_ROLES },
  { to: "/activity-logs", label: "Activity Logs", icon: Activity, roles: ADMIN_MGR },
  { to: "/ai", label: "AI Assistant", icon: Sparkles, roles: ALL_ROLES },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: ["admin"] },
  { to: "/danger-zone", label: "Owner Danger Zone", icon: AlertTriangle, roles: ["admin"] },
  { to: "/api-test-center", label: "API Test Center", icon: Plug, roles: ["admin"] },
];

/** Backend-role specific allow-lists. When a role code is listed here the
 *  sidebar (and route guard) uses this exact path list instead of the coarse
 *  Role mapping, so e.g. Inventory Manager never sees finance pages. */
const ROLE_PATH_ALLOW: Record<string, string[]> = {
  INVENTORY_MANAGER: [
    "/dashboard", "/staff", "/agents", "/agent-stock", "/agent-performance",
    "/agent-deliveries", "/inventory", "/products", "/buy-stock", "/stock-record",
    "/waybill", "/faulty-stock", "/product-analytics",
    "/chat", "/notifications", "/ai",
  ],
  SALES_MANAGER: [
    "/dashboard", "/orders", "/call-queue", "/form-submissions", "/customers",
    "/staff", "/sales-cohorts", "/staff-performance", "/sales-manager-office",
    "/agent-deliveries", "/campaign-attribution", "/follow-ups", "/call-logs",
    "/complaints", "/returns", "/customer-notes",
    "/chat", "/notifications", "/ai",
  ],
  MEDIA_BUYER: [
    "/dashboard", "/campaigns", "/campaign-attribution", "/tracking",
    "/forms", "/email-marketing", "/broadcast-history",
    "/chat", "/notifications", "/ai",
  ],
  MEDIA_PROMOTER: [
    "/dashboard", "/campaigns", "/campaign-attribution", "/tracking",
    "/forms", "/email-marketing", "/broadcast-history",
    "/chat", "/notifications", "/ai",
  ],
  WHATSAPP_MARKETER: [
    "/dashboard", "/whatsapp-automation", "/message-templates",
    "/broadcast-history", "/customers",
    "/chat", "/notifications", "/ai",
  ],
};

const ALL_NAV: NavItem[] = [...SOLO_TOP, ...GROUPS.flatMap((g) => g.items), ...SOLO_BOTTOM];

export function AppShell({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    GROUPS.forEach((g) => { init[g.label] = g.items.some((i) => path === i.to || path.startsWith(i.to + "/")); });
    return init;
  });

  // keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!user) return <>{children}</>;
  const roleCode = (user.roleName || "").toUpperCase();
  const allowList = ROLE_PATH_ALLOW[roleCode];
  const canSee = (n: NavItem) => (allowList ? allowList.includes(n.to) : n.roles.includes(user.role));
  const matched = ALL_NAV.find((n) => path === n.to || path.startsWith(n.to + "/"));
  const denied = matched ? !canSee(matched) : false;
  const visibleSoloTop = SOLO_TOP.filter(canSee);
  const visibleSoloBottom = SOLO_BOTTOM.filter(canSee);
  const visibleGroups = GROUPS.map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0);

  const onLogout = () => { logout(); navigate({ to: "/login" }); };

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = path === item.to || path.startsWith(item.to + "/");
    const Icon = item.icon;
    return (
      <Link to={item.to} onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
          active
            ? "bg-white/15 text-white font-medium shadow-inner"
            : "text-white/65 hover:bg-white/10 hover:text-white"
        }`}>
        <Icon size={16} /> {item.label}
        {active && <span className="ml-auto w-1 h-4 rounded-full" style={{ background: "var(--electric)" }} />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className={`app-sidebar fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "var(--gradient-navy)" }}>
        <div className="flex items-center justify-between p-4 text-white">
          <Logo />
          <button className="lg:hidden text-white/70" onClick={() => setMobileOpen(false)}><X /></button>
        </div>
        <nav className="app-sidebar-nav px-2 py-2 space-y-0.5 overflow-y-auto h-[calc(100vh-64px)] pb-8">

          {visibleSoloTop.map((item) => <NavLink key={item.to} item={item} />)}

          {visibleGroups.map((g) => {
            const isOpen = openGroups[g.label] ?? false;
            const GIcon = g.icon;
            const hasActive = g.items.some((i) => path === i.to || path.startsWith(i.to + "/"));
            return (
              <div key={g.label} className="pt-1">
                <button onClick={() => setOpenGroups((s) => ({ ...s, [g.label]: !isOpen }))}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    hasActive ? "text-white" : "text-white/55 hover:text-white"
                  }`}>
                  <GIcon size={16} />
                  <span className="font-semibold tracking-wide text-[12px] uppercase">{g.label}</span>
                  <ChevronDown size={14} className={`ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-out ${isOpen ? "mt-0.5" : "max-h-0"}`}>
                  <div className="ml-3 pl-3 border-l border-white/10 space-y-0.5 py-1">
                    {g.items.map((item) => <NavLink key={item.to} item={item} />)}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-3 mt-3 border-t border-white/10 space-y-0.5">
            {visibleSoloBottom.map((item) => <NavLink key={item.to} item={item} />)}
          </div>
        </nav>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden animate-fade-in-up" onClick={() => setMobileOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="app-header sticky top-0 z-20 h-16 px-4 lg:px-6 flex items-center gap-3 border-b bg-background/80 backdrop-blur">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu /></button>
          <button onClick={() => setPaletteOpen(true)}
            className="flex-1 max-w-md flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-transparent text-sm text-muted-foreground hover:bg-background hover:border-border transition-colors text-left">
            <Search size={16} />
            <span className="flex-1">Search orders, customers, staff, products…</span>
            <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded border bg-background text-muted-foreground">Ctrl K</kbd>
          </button>
          <button onClick={toggle} className="p-2 rounded-lg hover:bg-muted" aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NotificationCenter />

          <div className="hidden sm:flex items-center gap-3 pl-3 border-l">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-[11px] text-muted-foreground">{roleLabel(user.roleName) || user.role}</div>
            </div>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: "var(--gradient-electric)" }}>
              {user.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
            </div>
            <button onClick={onLogout} className="p-2 rounded-lg hover:bg-muted" aria-label="Logout"><LogOut size={18} /></button>
          </div>
        </header>

        <main className="app-main flex-1 p-4 lg:p-6 min-w-0">
          {denied && matched ? <AccessDenied allowed={matched.roles} role={user.role} /> : children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <FollowUpReminderPopup />
      <AIAssistant />
      <InstallPrompt />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-card shadow-[var(--shadow-soft)] ${className}`}>{children}</div>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center text-2xl">✨</div>
      <div className="mt-3 font-medium">{title}</div>
      {hint && <div className="mt-1 text-sm text-muted-foreground">{hint}</div>}
    </div>
  );
}
