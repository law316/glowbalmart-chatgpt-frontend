import type {
  User, Order, Customer, Product, Package, SalesForm,
  Expense, DeliveryAgent, CallLog, Settings, MessageTemplate, AffiliateAgent
} from "./types";
import { uid, today, addDays } from "./format";

export const SEED_USERS: User[] = [
  { id: "u_admin", name: "Adaeze Okeke", email: "admin@glowbalmartcrm.com", password: "password123", role: "admin", active: true, createdAt: new Date().toISOString() },
  { id: "u_mgr", name: "Tunde Bello", email: "manager@glowbalmartcrm.com", password: "password123", role: "manager", active: true, createdAt: new Date().toISOString() },
  { id: "u_staff1", name: "Chioma Eze", email: "staff@glowbalmartcrm.com", password: "password123", role: "staff", active: true, commissionRate: 5, createdAt: new Date().toISOString() },
  { id: "u_staff2", name: "Ibrahim Musa", email: "ibrahim@glowbalmartcrm.com", password: "password123", role: "staff", active: true, commissionRate: 5, createdAt: new Date().toISOString() },
  { id: "u_staff3", name: "Funmi Adeyemi", email: "funmi@glowbalmartcrm.com", password: "password123", role: "staff", active: true, commissionRate: 5, createdAt: new Date().toISOString() },
  { id: "u_fin", name: "Emeka Nwosu", email: "finance@glowbalmartcrm.com", password: "password123", role: "finance", active: true, createdAt: new Date().toISOString() },
];

export const SEED_PRODUCTS: Product[] = [
  { id: "p_bundle", name: "Glow Skincare Bundle", sku: "GLW-001", category: "Skincare", costPrice: 12000, sellingPrice: 28000, stock: 120, lowStockThreshold: 20, active: true, description: "Demo bundle (synthetic)" },
  { id: "p_towel", name: "Demo Face Towel", sku: "GLW-002", category: "Accessory", costPrice: 800, sellingPrice: 2000, stock: 240, lowStockThreshold: 30, active: true },
  { id: "p_serum", name: "Demo Mini Serum", sku: "GLW-003", category: "Skincare", costPrice: 3500, sellingPrice: 7500, stock: 80, lowStockThreshold: 15, active: true },
  { id: "p_pouch", name: "Demo Beauty Pouch", sku: "GLW-004", category: "Accessory", costPrice: 1500, sellingPrice: 4000, stock: 50, lowStockThreshold: 10, active: true },
];

export const SEED_PACKAGES: Package[] = [
  { id: "pk_starter", name: "Starter Glow Pack", description: "1 Bundle + 1× Demo Face Towel", items: [{ productId: "p_bundle", qty: 1 }, { productId: "p_towel", qty: 1 }], price: 30000, gift: "Face Towel", active: true },
  { id: "pk_couples", name: "Couples Glow Pack", description: "2 Bundles + 1× Demo Mini Serum", items: [{ productId: "p_bundle", qty: 2 }, { productId: "p_serum", qty: 1 }], price: 55000, gift: "Mini Serum", active: true },
  { id: "pk_family", name: "Family Glow Pack", description: "4 Bundles + 2× Demo Beauty Pouch", items: [{ productId: "p_bundle", qty: 4 }, { productId: "p_pouch", qty: 2 }], price: 100000, gift: "2 Beauty Pouches", active: true },
];

export const SEED_FORM: SalesForm = {
  id: "f_glow",
  slug: "glow-bundle-order-form",
  name: "Glow Bundle Order Form",
  title: "Glow Bundle Order Form",
  subtitle: "Demo sales form",
  notice: "This is a synthetic Glowbalmart CRM demo form. Products, packages, gifts, and customers shown here are not real user data.",
  packageIds: ["pk_starter", "pk_couples", "pk_family"],
  fields: [
    { key: "fullName", label: "Full Name", type: "text", required: true },
    { key: "phone", label: "Phone Number", type: "tel", required: true },
    { key: "whatsapp", label: "WhatsApp Number", type: "tel", required: true },
    { key: "address", label: "Delivery Address", type: "textarea", required: true },
    { key: "state", label: "State", type: "text", required: true },
    { key: "notes", label: "Optional Notes", type: "textarea", required: false },
  ],
  thankYou: "Thank you! Your order has been received. A sales agent will call you shortly.",
  assignTeam: "round_robin",
  active: true,
  pixelId: "",
  trackingEvents: { PageView: true, Lead: true, InitiateCheckout: false, Purchase: false },
  createdAt: new Date().toISOString(),
};

const STATES = ["Lagos", "Abuja", "Rivers", "Kano", "Oyo", "Enugu", "Kaduna", "Delta", "Anambra", "Edo"];
const NAMES = ["Blessing Akin","Chinedu Okafor","Aisha Bello","Ngozi Obi","Yusuf Lawal","Hauwa Sani","Tobi Adeyemi","Ifeoma Eze","Sade Williams","Kelechi Onu","Maryam Yusuf","Daniel Eze","Joy Okonkwo","Samuel Idris","Hadiza Aliyu"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randPhone() { return "080" + Math.floor(10000000 + Math.random() * 89999999).toString(); }

export function makeSeedCustomersAndOrders(): { customers: Customer[]; orders: Order[]; calls: CallLog[] } {
  const customers: Customer[] = [];
  const orders: Order[] = [];
  const calls: CallLog[] = [];
  const staffIds = ["u_staff1", "u_staff2", "u_staff3"];
  const packages = SEED_PACKAGES;
  const statuses: Order["status"][] = ["new", "first_call_due", "second_call_due", "third_call_due", "deal_successful", "on_hold", "not_reached", "cancelled", "closed_max", "deal_successful", "deal_successful"];

  for (let i = 0; i < 25; i++) {
    const name = rand(NAMES) + " " + String.fromCharCode(65 + (i % 26));
    const phone = randPhone();
    const state = rand(STATES);
    const cust: Customer = {
      id: uid("c"), name, phone, whatsapp: phone, state,
      address: `${10 + i} Demo Street, ${state}`,
      tags: [], assignedTo: staffIds[i % 3],
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    };
    customers.push(cust);

    const pk = rand(packages);
    const status = statuses[i % statuses.length];
    const daysAgo = Math.floor(Math.random() * 5);
    const created = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const attempts = status === "second_call_due" ? 1 : status === "third_call_due" ? 2 : status === "closed_max" ? 3 : status === "deal_successful" ? 1 : status === "first_call_due" ? 0 : Math.floor(Math.random() * 3);

    const orderId = uid("o");
    const order: Order = {
      id: orderId,
      code: "GBM-" + (1000 + i),
      customerId: cust.id,
      customerName: name,
      phone, whatsapp: phone,
      address: cust.address!,
      state,
      packageId: pk.id, packageName: pk.name, price: pk.price, gift: pk.gift,
      source: "glow-bundle-order-form",
      assignedTo: staffIds[i % 3],
      status,
      paymentStatus: status === "deal_successful" ? (Math.random() > 0.4 ? "paid" : "pending") : "unpaid",
      deliveryStatus: status === "deal_successful" && Math.random() > 0.5 ? "dispatched" : "not_dispatched",
      callAttempts: attempts,
      nextFollowUp: status === "second_call_due" || status === "third_call_due" || status === "first_call_due" ? today() : undefined,
      lastOutcome: attempts > 0 ? (status === "on_hold" ? "on_hold" : status === "not_reached" ? "not_reached" : status === "deal_successful" ? "deal_successful" : "callback_later") : undefined,
      timeline: [
        { id: uid("t"), type: "created", message: "Order created from form", at: created },
        { id: uid("t"), type: "assigned", message: `Assigned to staff`, at: created },
      ],
      createdAt: created,
      updatedAt: created,
    };
    orders.push(order);

    if (attempts > 0) {
      for (let a = 1; a <= attempts; a++) {
        calls.push({
          id: uid("cl"), orderId, staffId: order.assignedTo!,
          attempt: a, outcome: a === attempts && status === "deal_successful" ? "deal_successful" : "not_reached",
          createdAt: new Date(Date.now() - (daysAgo - a + 1) * 86400000).toISOString(),
        });
      }
    }
  }
  return { customers, orders, calls };
}

export const SEED_EXPENSES: Expense[] = [
  { id: uid("e"), category: "Advertising", amount: 150000, date: today(), notes: "Meta Ads", staffId: "u_admin", createdAt: new Date().toISOString() },
  { id: uid("e"), category: "Delivery", amount: 45000, date: addDays(today(), -1), staffId: "u_admin", createdAt: new Date().toISOString() },
  { id: uid("e"), category: "Product Purchase", amount: 320000, date: addDays(today(), -3), staffId: "u_fin", createdAt: new Date().toISOString() },
  { id: uid("e"), category: "Packaging", amount: 18000, date: addDays(today(), -2), staffId: "u_fin", createdAt: new Date().toISOString() },
  { id: uid("e"), category: "Staff Salary", amount: 280000, date: addDays(today(), -5), staffId: "u_admin", createdAt: new Date().toISOString() },
  { id: uid("e"), category: "Staff Commission", amount: 32000, date: addDays(today(), -1), staffId: "u_admin", createdAt: new Date().toISOString() },
  { id: uid("e"), category: "Software/Tools", amount: 12000, date: addDays(today(), -4), staffId: "u_admin", createdAt: new Date().toISOString() },
  { id: uid("e"), category: "Office/Admin", amount: 22000, date: addDays(today(), -6), staffId: "u_admin", createdAt: new Date().toISOString() },
];

export const SEED_DELIVERY: DeliveryAgent[] = [
  { id: "d1", name: "Lekan Couriers", phone: "08011112222", active: true },
  { id: "d2", name: "GIG Express", phone: "08033334444", active: true },
  { id: "d3", name: "Speedaf Demo", phone: "08055556666", active: true },
];

export const SEED_TEMPLATES: MessageTemplate[] = [
  { id: "t1", name: "New Order Confirmation", channel: "whatsapp", body: "Hi {{name}}, we've received your order for {{package}}. We'll call you shortly to confirm." },
  { id: "t2", name: "Follow-up Reminder", channel: "whatsapp", body: "Hi {{name}}, just checking back about your {{package}} order. Should we proceed?" },
  { id: "t3", name: "Payment Reminder", channel: "sms", body: "Hi {{name}}, kindly complete payment for your order {{code}}." },
  { id: "t4", name: "Delivery Update", channel: "sms", body: "Your order {{code}} has been dispatched." },
  { id: "t5", name: "Thank You", channel: "email", body: "Thank you {{name}} for choosing Glowbalmart." },
  { id: "t6", name: "Abandoned Cart", channel: "whatsapp", body: "Hi {{name}}, you left {{package}} in your cart — complete now and enjoy a free gift!" },
];

export const SEED_AFFILIATES: AffiliateAgent[] = [
  { id: "a1", name: "Demo Affiliate One", code: "GLOW10", commissionRate: 10, paid: 25000, unpaid: 12000 },
  { id: "a2", name: "Demo Affiliate Two", code: "GLOW20", commissionRate: 12, paid: 50000, unpaid: 0 },
];

export const DEFAULT_SETTINGS: Settings = {
  companyName: "Glowbalmart CRM",
  currency: "₦",
  followUpMaxAttempts: 3,
  assignmentMode: "round_robin",
  maxActivePerStaff: 30,
};
