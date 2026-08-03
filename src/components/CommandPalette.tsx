import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Search, ShoppingCart, Users, UserCog, Package, FormInput, BarChart3, ArrowRight } from "lucide-react";

type Item = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ComponentType<{ size?: number }>;
  onSelect: () => void;
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const users = useStore((s) => s.users);
  const products = useStore((s) => s.products);
  const forms = useStore((s) => s.forms);

  useEffect(() => { if (open) { setQ(""); setActive(0); } }, [open]);

  const items: Item[] = useMemo(() => {
    const list: Item[] = [];
    list.push(
      { id: "nav-orders", group: "Pages", label: "Orders", icon: ShoppingCart, onSelect: () => navigate({ to: "/orders" }) },
      { id: "nav-customers", group: "Pages", label: "Customers", icon: Users, onSelect: () => navigate({ to: "/customers" }) },
      { id: "nav-staff", group: "Pages", label: "Staff & Roles", icon: UserCog, onSelect: () => navigate({ to: "/staff" }) },
      { id: "nav-products", group: "Pages", label: "Products", icon: Package, onSelect: () => navigate({ to: "/products" }) },
      { id: "nav-forms", group: "Pages", label: "Forms", icon: FormInput, onSelect: () => navigate({ to: "/forms" }) },
      { id: "nav-reports", group: "Pages", label: "Reports", icon: BarChart3, onSelect: () => navigate({ to: "/reports" }) },
    );
    orders.slice(0, 30).forEach((o) => list.push({
      id: o.id, group: "Orders", label: `${o.code} · ${o.customerName}`, hint: o.packageName,
      icon: ShoppingCart, onSelect: () => navigate({ to: "/orders/$id", params: { id: o.id } }),
    }));
    customers.slice(0, 30).forEach((c) => list.push({
      id: c.id, group: "Customers", label: c.name, hint: c.phone,
      icon: Users, onSelect: () => navigate({ to: "/customers" }),
    }));
    users.forEach((u) => list.push({
      id: u.id, group: "Staff", label: u.name, hint: u.role,
      icon: UserCog, onSelect: () => navigate({ to: "/staff" }),
    }));
    products.forEach((p) => list.push({
      id: p.id, group: "Products", label: p.name, hint: p.sku,
      icon: Package, onSelect: () => navigate({ to: "/products" }),
    }));
    forms.forEach((f) => list.push({
      id: f.id, group: "Forms", label: f.name, hint: f.slug,
      icon: FormInput, onSelect: () => navigate({ to: "/forms" }),
    }));
    return list;
  }, [orders, customers, users, products, forms, navigate]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items.slice(0, 40);
    return items.filter((i) =>
      i.label.toLowerCase().includes(t) || (i.hint || "").toLowerCase().includes(t) || i.group.toLowerCase().includes(t)
    ).slice(0, 50);
  }, [items, q]);

  useEffect(() => { setActive(0); }, [q]);

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, Item[]>>((acc, it) => {
    (acc[it.group] ||= []).push(it); return acc;
  }, {});

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const it = filtered[active];
      if (it) { it.onSelect(); onClose(); }
    } else if (e.key === "Escape") { onClose(); }
  };

  let runningIdx = -1;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-[10vh]" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border overflow-hidden animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search size={18} className="text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search orders, customers, staff, products, forms…"
            className="flex-1 bg-transparent outline-none text-sm" />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No results for "{q}"</div>
          ) : Object.entries(grouped).map(([group, list]) => (
            <div key={group} className="py-2">
              <div className="px-4 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{group}</div>
              {list.map((it) => {
                runningIdx++;
                const isActive = runningIdx === active;
                const Icon = it.icon;
                return (
                  <button key={it.id} onMouseEnter={() => setActive(runningIdx)}
                    onClick={() => { it.onSelect(); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm ${isActive ? "bg-muted" : ""}`}>
                    <Icon size={16} />
                    <div className="flex-1 min-w-0 truncate">{it.label}</div>
                    {it.hint && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{it.hint}</div>}
                    {isActive && <ArrowRight size={14} className="text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex gap-3">
            <span><kbd className="px-1 rounded bg-muted">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 rounded bg-muted">↵</kbd> open</span>
          </div>
          <span>Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
