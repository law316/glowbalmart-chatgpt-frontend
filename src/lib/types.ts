export type Role = "admin" | "manager" | "staff" | "finance" | "delivery";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // mock only
  phone?: string;
  role: Role;
  roleName?: string;
  active: boolean;
  commissionRate?: number; // percent
  notes?: string;
  createdAt: string;
}

export type OrderStatus =
  | "new"
  | "assigned"
  | "first_call_due"
  | "second_call_due"
  | "third_call_due"
  | "deal_successful"
  | "on_hold"
  | "not_reached"
  | "callback_later"
  | "wrong_number"
  | "cancelled"
  | "duplicate"
  | "closed_max";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "part" | "refunded";

export type DeliveryStatus =
  | "not_dispatched"
  | "processing"
  | "dispatched"
  | "in_transit"
  | "delivered"
  | "returned"
  | "failed";

export type CallOutcome =
  | "deal_successful"
  | "on_hold"
  | "not_reached"
  | "callback_later"
  | "wrong_number"
  | "cancelled"
  | "duplicate";

export interface CallLog {
  id: string;
  orderId: string;
  staffId: string;
  attempt: number;
  outcome: CallOutcome;
  notes?: string;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  type: "created" | "assigned" | "call" | "status" | "payment" | "delivery" | "note";
  message: string;
  by?: string;
  at: string;
}

export interface Order {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  phone: string;
  whatsapp: string;
  address: string;
  state: string;
  packageId: string;
  packageName: string;
  price: number;
  gift?: string;
  source: string; // form slug or "manual"
  assignedTo?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  callAttempts: number;
  nextFollowUp?: string; // YYYY-MM-DD
  lastOutcome?: CallOutcome;
  notes?: string;
  timeline: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  state: string;
  address?: string;
  tags: string[];
  notes?: string;
  assignedTo?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  active: boolean;
  description?: string;
}

export interface PackageItem {
  productId: string;
  qty: number;
}
export interface Package {
  id: string;
  name: string;
  description?: string;
  items: PackageItem[];
  price: number;
  gift?: string;
  active: boolean;
  upsellPackageId?: string;
  bumpProductId?: string;
}

export interface FormField {
  key: string;
  label: string;
  type: "text" | "tel" | "textarea" | "email";
  required: boolean;
}

export interface SalesForm {
  id: string;
  slug: string;
  name: string;
  title: string;
  subtitle?: string;
  notice?: string;
  packageIds: string[];
  fields: FormField[];
  redirectUrl?: string;
  thankYou: string;
  assignTeam: "round_robin" | "manager";
  active: boolean;
  pixelId?: string;
  trackingEvents?: Record<string, boolean>;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  staffId?: string;
  notes?: string;
  createdAt: string;
}

export interface Commission {
  id: string;
  orderId: string;
  staffId: string;
  amount: number;
  paid: boolean;
  paidAt?: string;
  createdAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  type: "in" | "out" | "damaged" | "returned";
  qty: number;
  reason?: string;
  createdAt: string;
}

export interface DeliveryAgent {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

export interface AffiliateAgent {
  id: string;
  name: string;
  code: string;
  commissionRate: number;
  paid: number;
  unpaid: number;
}

export interface Campaign {
  id: string;
  name: string;
  channel: "whatsapp" | "sms" | "email";
  template: string;
  status: "draft" | "sent";
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: "whatsapp" | "sms" | "email";
  body: string;
}

export type AssignmentMode = "round_robin" | "least_active" | "manual";

export interface Settings {
  companyName: string;
  currency: string;
  logoUrl?: string;
  paystackKey?: string;
  flutterwaveKey?: string;
  aiProvider?: "openai" | "claude" | "gemini" | "custom";
  followUpMaxAttempts: number;
  assignmentMode: AssignmentMode;
  maxActivePerStaff: number;
}

export interface ActivityEntry {
  id: string;
  type: "assign" | "reassign" | "auto_assign";
  message: string;
  orderId?: string;
  staffId?: string;
  at: string;
}
