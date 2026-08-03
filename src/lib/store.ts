import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  User, Order, Customer, Product, Package, SalesForm, Expense,
  Commission, InventoryMovement, DeliveryAgent, AffiliateAgent,
  Campaign, MessageTemplate, Settings, CallLog, CallOutcome, OrderStatus, TimelineEvent,
  ActivityEntry,
} from "./types";
import {
  SEED_USERS, SEED_PRODUCTS, SEED_PACKAGES, SEED_FORM, SEED_EXPENSES,
  SEED_DELIVERY, SEED_TEMPLATES, SEED_AFFILIATES,
  DEFAULT_SETTINGS, makeSeedCustomersAndOrders,
} from "./seed";
import { uid, today, addDays } from "./format";
import { apiMe, clearToken, getToken, mapBackendRole, setToken, type BackendUser } from "./api";

interface State {
  hydrated: boolean;
  restoring: boolean;
  users: User[];
  customers: Customer[];
  orders: Order[];
  calls: CallLog[];
  products: Product[];
  packages: Package[];
  forms: SalesForm[];
  expenses: Expense[];
  commissions: Commission[];
  movements: InventoryMovement[];
  deliveryAgents: DeliveryAgent[];
  affiliates: AffiliateAgent[];
  campaigns: Campaign[];
  templates: MessageTemplate[];
  settings: Settings;
  activityLog: ActivityEntry[];
  currentUserId: string | null;

  // actions
  setHydrated: () => void;
  login: (email: string, password: string) => User | null;
  setSession: (token: string, backendUser: BackendUser) => User;
  restoreSession: () => Promise<void>;
  logout: () => void;
  createUser: (u: Omit<User, "id" | "createdAt">) => User;
  updateUser: (id: string, patch: Partial<User>) => void;
  deleteUser: (id: string) => void;

  submitForm: (slug: string, data: { fullName: string; phone: string; whatsapp: string; address: string; state: string; packageId: string; notes?: string }) => Order | null;
  createOrder: (o: Partial<Order>) => Order;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  reassignOrder: (id: string, staffId: string) => void;
  logCall: (orderId: string, outcome: CallOutcome, notes?: string) => void;

  upsertProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  upsertPackage: (p: Package) => void;
  deletePackage: (id: string) => void;
  upsertForm: (f: SalesForm) => void;
  deleteForm: (id: string) => void;
  addExpense: (e: Omit<Expense, "id" | "createdAt">) => void;
  deleteExpense: (id: string) => void;
  upsertCustomer: (c: Customer) => void;
  payCommission: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  resetDemo: () => void;
}

function initialSeed() {
  const { customers, orders, calls } = makeSeedCustomersAndOrders();
  return {
    users: SEED_USERS,
    customers,
    orders,
    calls,
    products: SEED_PRODUCTS,
    packages: SEED_PACKAGES,
    forms: [SEED_FORM],
    expenses: SEED_EXPENSES,
    commissions: [],
    movements: [],
    deliveryAgents: SEED_DELIVERY,
    affiliates: SEED_AFFILIATES,
    campaigns: [],
    templates: SEED_TEMPLATES,
    settings: DEFAULT_SETTINGS,
    activityLog: [] as ActivityEntry[],
  };
}

const ACTIVE_STATUSES_PICK: OrderStatus[] = ["new","assigned","first_call_due","second_call_due","third_call_due","on_hold","not_reached","callback_later"];
let robinIdx = 0;
function pickStaff(users: User[], orders: Order[], settings: Settings): string | undefined {
  if (settings.assignmentMode === "manual") return undefined;
  const sales = users.filter((u) => u.active && (u.role === "staff" || u.role === "manager"));
  if (!sales.length) return undefined;
  const counts = new Map<string, number>();
  orders.forEach((o) => {
    if (o.assignedTo && ACTIVE_STATUSES_PICK.includes(o.status)) counts.set(o.assignedTo, (counts.get(o.assignedTo) || 0) + 1);
  });
  const eligible = sales.filter((u) => (counts.get(u.id) || 0) < settings.maxActivePerStaff);
  if (!eligible.length) return undefined;
  if (settings.assignmentMode === "least_active") {
    return [...eligible].sort((a, b) => (counts.get(a.id) || 0) - (counts.get(b.id) || 0))[0].id;
  }
  // round-robin among eligible
  const pick = eligible[robinIdx % eligible.length];
  robinIdx++;
  return pick.id;
}

function statusForAttempt(attempt: number): OrderStatus {
  if (attempt === 0) return "first_call_due";
  if (attempt === 1) return "second_call_due";
  if (attempt === 2) return "third_call_due";
  return "closed_max";
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      restoring: false,
      ...initialSeed(),
      currentUserId: null,

      setHydrated: () => set({ hydrated: true }),

      login: (email, password) => {
        const u = get().users.find(
          (x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password && x.active
        );
        if (u) set({ currentUserId: u.id });
        return u || null;
      },

      setSession: (token, backendUser) => {
        setToken(token);
        const role = mapBackendRole(backendUser.roleName);
        const existing = get().users.find((u) => u.id === backendUser.id);
        const user: User = {
          id: backendUser.id,
          name: backendUser.name,
          email: backendUser.email,
          password: existing?.password ?? "",
          phone: backendUser.phone,
          role,
          roleName: backendUser.roleName,
          active: backendUser.active,
          commissionRate: existing?.commissionRate,
          notes: existing?.notes,
          createdAt: backendUser.createdAt || existing?.createdAt || new Date().toISOString(),
        };
        set((s) => ({
          users: s.users.find((u) => u.id === user.id)
            ? s.users.map((u) => (u.id === user.id ? user : u))
            : [...s.users, user],
          currentUserId: user.id,
        }));
        return user;
      },

      restoreSession: async () => {
        const token = getToken();
        if (!token) {
          set({ currentUserId: null, restoring: false });
          return;
        }
        set({ restoring: true });
        try {
          const be = await apiMe();
          get().setSession(token, be);
        } catch {
          clearToken();
          set({ currentUserId: null });
        } finally {
          set({ restoring: false });
        }
      },

      logout: () => { clearToken(); set({ currentUserId: null }); },

      createUser: (u) => {
        const user: User = { ...u, id: uid("u"), createdAt: new Date().toISOString() };
        set((s) => ({ users: [...s.users, user] }));
        return user;
      },
      updateUser: (id, patch) =>
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
      deleteUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),

      submitForm: (slug, data) => {
        const form = get().forms.find((f) => f.slug === slug && f.active);
        if (!form) return null;
        const pkg = get().packages.find((p) => p.id === data.packageId);
        if (!pkg) return null;
        const assigned = pickStaff(get().users, get().orders, get().settings);
        const order = get().createOrder({
          customerName: data.fullName,
          phone: data.phone,
          whatsapp: data.whatsapp,
          address: data.address,
          state: data.state,
          packageId: pkg.id,
          packageName: pkg.name,
          price: pkg.price,
          gift: pkg.gift,
          source: slug,
          assignedTo: assigned,
          notes: data.notes,
        });
        // create customer
        const cust: Customer = {
          id: uid("c"), name: data.fullName, phone: data.phone, whatsapp: data.whatsapp,
          state: data.state, address: data.address, tags: ["form"], assignedTo: assigned,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ customers: [cust, ...s.customers] }));
        return order;
      },

      createOrder: (o) => {
        const now = new Date().toISOString();
        const order: Order = {
          id: uid("o"),
          code: "GBM-" + (1000 + get().orders.length + 1),
          customerId: o.customerId || uid("c"),
          customerName: o.customerName || "Customer",
          phone: o.phone || "",
          whatsapp: o.whatsapp || o.phone || "",
          address: o.address || "",
          state: o.state || "Lagos",
          packageId: o.packageId || "",
          packageName: o.packageName || "",
          price: o.price || 0,
          gift: o.gift,
          source: o.source || "manual",
          assignedTo: o.assignedTo,
          status: o.assignedTo ? "first_call_due" : "new",
          paymentStatus: "unpaid",
          deliveryStatus: "not_dispatched",
          callAttempts: 0,
          nextFollowUp: today(),
          notes: o.notes,
          timeline: [
            { id: uid("t"), type: "created", message: `Order created via ${o.source || "manual"}`, at: now },
            ...(o.assignedTo ? [{ id: uid("t"), type: "assigned" as const, message: `Assigned to staff`, at: now }] : []),
          ],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          orders: [order, ...s.orders],
          activityLog: o.assignedTo ? [
            { id: uid("a"), type: "auto_assign", message: `Order ${order.code} auto-assigned to ${get().users.find((u) => u.id === o.assignedTo)?.name || "staff"} (${get().settings.assignmentMode})`, orderId: order.id, staffId: o.assignedTo, at: now },
            ...s.activityLog,
          ] : s.activityLog,
        }));
        return order;
      },

      updateOrder: (id, patch) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o
          ),
        })),

      reassignOrder: (id, staffId) => {
        const now = new Date().toISOString();
        const order = get().orders.find((o) => o.id === id);
        const staffName = get().users.find((u) => u.id === staffId)?.name || "staff";
        const ev: TimelineEvent = { id: uid("t"), type: "assigned", message: `Reassigned to ${staffName}`, at: now };
        set((s) => ({
          orders: s.orders.map((o) => o.id === id
            ? { ...o, assignedTo: staffId, timeline: [...o.timeline, ev], updatedAt: now }
            : o),
          activityLog: [
            { id: uid("a"), type: "reassign", message: `Order ${order?.code || id} reassigned to ${staffName}`, orderId: id, staffId, at: now },
            ...s.activityLog,
          ],
        }));
      },

      logCall: (orderId, outcome, notes) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return;
        const attempt = order.callAttempts + 1;
        const maxA = get().settings.followUpMaxAttempts;
        const closing: CallOutcome[] = ["deal_successful", "cancelled", "duplicate", "wrong_number"];
        const isClosing = closing.includes(outcome);
        let nextStatus: OrderStatus = order.status;
        let nextFollow: string | undefined = order.nextFollowUp;

        if (outcome === "deal_successful") {
          nextStatus = "deal_successful";
          nextFollow = undefined;
          // deduct inventory
          const pkg = get().packages.find((p) => p.id === order.packageId);
          if (pkg) {
            const moves: InventoryMovement[] = [];
            const products = get().products.map((pr) => {
              const it = pkg.items.find((i) => i.productId === pr.id);
              if (it) {
                moves.push({ id: uid("m"), productId: pr.id, type: "out", qty: it.qty, reason: `Order ${order.code}`, createdAt: new Date().toISOString() });
                return { ...pr, stock: Math.max(0, pr.stock - it.qty) };
              }
              return pr;
            });
            set((s) => ({ products, movements: [...moves, ...s.movements] }));
          }
          // commission
          const staff = get().users.find((u) => u.id === order.assignedTo);
          if (staff?.commissionRate) {
            const comm: Commission = {
              id: uid("cm"), orderId: order.id, staffId: staff.id,
              amount: Math.round((order.price * staff.commissionRate) / 100),
              paid: false, createdAt: new Date().toISOString(),
            };
            set((s) => ({ commissions: [comm, ...s.commissions] }));
          }
        } else if (outcome === "cancelled") {
          nextStatus = "cancelled"; nextFollow = undefined;
        } else if (outcome === "duplicate") {
          nextStatus = "duplicate"; nextFollow = undefined;
        } else if (outcome === "wrong_number") {
          nextStatus = "wrong_number"; nextFollow = undefined;
        } else if (isClosing) {
          nextFollow = undefined;
        } else {
          // not_reached, on_hold, callback_later
          if (attempt >= maxA) {
            nextStatus = "closed_max";
            nextFollow = undefined;
          } else {
            nextStatus = statusForAttempt(attempt); // next attempt status
            nextFollow = addDays(today(), 1);
          }
        }

        const log: CallLog = {
          id: uid("cl"), orderId, staffId: get().currentUserId || order.assignedTo || "",
          attempt, outcome, notes, createdAt: new Date().toISOString(),
        };
        const ev: TimelineEvent = {
          id: uid("t"), type: "call",
          message: `Call attempt ${attempt}/${maxA} → ${outcome.replace(/_/g, " ")}${notes ? ` — ${notes}` : ""}`,
          at: new Date().toISOString(),
        };

        set((s) => ({
          calls: [log, ...s.calls],
          orders: s.orders.map((o) => o.id === orderId ? {
            ...o,
            callAttempts: attempt,
            lastOutcome: outcome,
            status: nextStatus,
            nextFollowUp: nextFollow,
            timeline: [...o.timeline, ev],
            updatedAt: new Date().toISOString(),
          } : o),
        }));
      },

      upsertProduct: (p) => set((s) => ({
        products: s.products.find((x) => x.id === p.id)
          ? s.products.map((x) => x.id === p.id ? p : x)
          : [...s.products, p],
      })),
      deleteProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
      upsertPackage: (p) => set((s) => ({
        packages: s.packages.find((x) => x.id === p.id)
          ? s.packages.map((x) => x.id === p.id ? p : x)
          : [...s.packages, p],
      })),
      deletePackage: (id) => set((s) => ({ packages: s.packages.filter((p) => p.id !== id) })),
      upsertForm: (f) => set((s) => ({
        forms: s.forms.find((x) => x.id === f.id)
          ? s.forms.map((x) => x.id === f.id ? f : x)
          : [...s.forms, f],
      })),
      deleteForm: (id) => set((s) => ({ forms: s.forms.filter((f) => f.id !== id) })),
      addExpense: (e) => set((s) => ({
        expenses: [{ ...e, id: uid("e"), createdAt: new Date().toISOString() }, ...s.expenses],
      })),
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
      upsertCustomer: (c) => set((s) => ({
        customers: s.customers.find((x) => x.id === c.id)
          ? s.customers.map((x) => x.id === c.id ? c : x)
          : [c, ...s.customers],
      })),
      payCommission: (id) => set((s) => ({
        commissions: s.commissions.map((c) => c.id === id ? { ...c, paid: true, paidAt: new Date().toISOString() } : c),
      })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetDemo: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("glowbalmart-crm-v1");
          window.location.reload();
        }
      },
    }),
    {
      name: "glowbalmart-crm-v1",
      onRehydrateStorage: () => (state) => { state?.setHydrated(); },
      partialize: (s) => ({
        users: s.users, customers: s.customers, orders: s.orders, calls: s.calls,
        products: s.products, packages: s.packages, forms: s.forms,
        expenses: s.expenses, commissions: s.commissions, movements: s.movements,
        deliveryAgents: s.deliveryAgents, affiliates: s.affiliates,
        campaigns: s.campaigns, templates: s.templates, settings: s.settings,
        activityLog: s.activityLog,
        currentUserId: s.currentUserId,
      }),
    }
  )
);

export function useCurrentUser() {
  return useStore((s) => s.users.find((u) => u.id === s.currentUserId) || null);
}
