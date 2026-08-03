import type { Role } from "./types";

export const API_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "https://glowbarlmart.fly.dev";
export const TOKEN_KEY = "glowbalmart_token";

/* ---------------- token ---------------- */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

/* ---------------- fetch wrapper ---------------- */
export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function parseError(res: Response, fallback: string) {
  try {
    const data = await res.json();
    return data?.message || data?.error || fallback;
  } catch {
    return fallback;
  }
}

interface FetchOpts extends RequestInit {
  auth?: boolean; // default true
  json?: unknown;
}

export async function apiFetch<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { auth = true, json, headers, ...rest } = opts;
  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string> | undefined) };
  if (json !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (auth) {
    const t = getToken();
    if (t) finalHeaders["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && auth) {
    clearToken();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("glowbalmart:unauthorized"));
    }
    throw new ApiError("Session expired. Please sign in again.", 401);
  }
  if (!res.ok) {
    const msg = await parseError(res, res.statusText || "Request failed");
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

/* ---------------- auth ---------------- */
export interface BackendUser {
  id: string;
  staffNumber?: string;
  name: string;
  email: string;
  phone?: string;
  active: boolean;
  roleId?: string;
  roleName?: string;
  roleDisplayName?: string;
  permissions?: string[];
  createdAt?: string;
}

/** Short staff id (first 8 chars of user.id, or staffNumber if present). */
export function shortStaffId(u?: { id?: string; staffNumber?: string } | null): string {
  if (!u) return "";
  if (u.staffNumber) return u.staffNumber;
  return (u.id || "").slice(0, 8);
}

export interface LoginResponse { token: string; user: BackendUser; }

export const BACKEND_ROLES = [
  "OWNER", "ADMIN", "MANAGER", "SALES_MANAGER", "SALES_REP", "CUSTOMER_CARE",
  "MEDIA_BUYER", "MEDIA_PROMOTER", "WHATSAPP_MARKETER", "ACCOUNTANT",
  "INVENTORY_MANAGER", "DELIVERY_AGENT",
] as const;
export type BackendRoleName = (typeof BACKEND_ROLES)[number];

export function mapBackendRole(roleName?: string): Role {
  switch ((roleName || "").toUpperCase()) {
    case "OWNER": return "admin";
    case "ADMIN": return "admin";
    case "MANAGER": return "manager";
    case "SALES_MANAGER": return "manager";
    case "MEDIA_BUYER": return "staff";
    case "WHATSAPP_MARKETER": return "staff";
    case "INVENTORY_MANAGER": return "manager";
    case "SALES_REP": return "staff";
    case "CUSTOMER_CARE": return "staff";
    case "MEDIA_PROMOTER": return "staff";
    case "ACCOUNTANT": return "finance";
    case "DELIVERY_AGENT": return "delivery";
    default: return "staff";
  }
}

/** Friendly UI label for a backend role. No swapping. */
const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES_MANAGER: "Sales Manager",
  SALES_REP: "Sales Agent",
  CUSTOMER_CARE: "Customer Care",
  MEDIA_BUYER: "Media Buyer",
  MEDIA_PROMOTER: "Media Buyer",
  WHATSAPP_MARKETER: "WhatsApp Marketer",
  ACCOUNTANT: "Accountant",
  INVENTORY_MANAGER: "Inventory Manager",
  DELIVERY_AGENT: "Delivery Agent",
};
export function displayRole(roleName?: string | null): string {
  const r = (roleName || "").toUpperCase();
  return ROLE_LABELS[r] || roleName || "";
}
export function prettyRole(roleName?: string | null): string {
  return roleLabel(roleName);
}

export async function apiLogin(email: string, password: string) {
  return apiFetch<LoginResponse>("/api/auth/login", { method: "POST", auth: false, json: { email, password } });
}
export async function apiMe() {
  const data = await apiFetch<any>("/api/auth/me");
  return (data.user || data) as BackendUser;
}
export async function apiMeWithToken(token: string) {
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Session expired");
  const data = await res.json();
  return (data.user || data) as BackendUser;
}

/* ---------------- users & roles ---------------- */
export interface SignupPayload {
  name: string; email: string; password: string;
  phone?: string; roleName: BackendRoleName;
}
export async function apiSignup(_token: string, payload: SignupPayload) {
  const data = await apiFetch<any>("/api/auth/signup", { method: "POST", json: payload });
  return (data.user || data) as BackendUser;
}
export async function apiListUsers(_token?: string) {
  const data = await apiFetch<any>("/api/users");
  return (Array.isArray(data) ? data : data.users || data.data || []) as BackendUser[];
}
export interface UpdateUserPayload {
  name?: string; email?: string; phone?: string;
  roleName?: BackendRoleName; active?: boolean; password?: string;
}
export const apiUpdateUser = (id: string, payload: UpdateUserPayload) =>
  apiFetch<any>(`/api/users/${id}`, { method: "PUT", json: payload });
export const apiDeactivateUser = (id: string) =>
  apiFetch<any>(`/api/users/${id}/deactivate`, { method: "PATCH", json: {} });
export const apiActivateUser = (id: string) =>
  apiFetch<any>(`/api/users/${id}/activate`, { method: "PATCH", json: {} });
export const apiDeleteUser = (id: string) =>
  apiFetch<any>(`/api/users/${id}`, { method: "DELETE" });

// ---------------- Owner Maintenance / Danger Zone ----------------
export const ownerResetBusinessData = () =>
  apiFetch<any>("/api/owner-maintenance/reset-business-data", {
    method: "POST",
    json: { confirmation: "DELETE_GLOWBALMART_TEST_DATA" },
  });
export const ownerDeleteOrder = (idOrCode: string) =>
  apiFetch<any>(`/api/owner-maintenance/orders/${idOrCode}`, { method: "DELETE" });
export const ownerDeleteProduct = (productId: string) =>
  apiFetch<any>(`/api/owner-maintenance/products/${productId}`, { method: "DELETE" });
export const ownerDeleteForm = (idOrSlug: string) =>
  apiFetch<any>(`/api/owner-maintenance/forms/${idOrSlug}`, { method: "DELETE" });
export const ownerDeletePackage = (packageId: string) =>
  apiFetch<any>(`/api/owner-maintenance/packages/${packageId}`, { method: "DELETE" });
export const ownerDeleteCampaign = (idOrTrackingCode: string) =>
  apiFetch<any>(`/api/owner-maintenance/campaigns/${idOrTrackingCode}`, { method: "DELETE" });
export const ownerDeleteCohort = (cohortId: string) =>
  apiFetch<any>(`/api/owner-maintenance/cohorts/${cohortId}`, { method: "DELETE" });
export const ownerDeleteDeliveryAgent = (agentId: string) =>
  apiFetch<any>(`/api/owner-maintenance/delivery-agents/${agentId}`, { method: "DELETE" });

export interface BackendRole {
  id: string; name: string; displayName?: string;
  description?: string; active?: boolean; systemRole?: boolean; permissions?: string[];
}
export async function apiListRoles(_token?: string) {
  const data = await apiFetch<any>("/api/roles");
  return (Array.isArray(data) ? data : data.roles || data.data || []) as BackendRole[];
}
export async function apiCreateRole(_token: string, payload: { name: string; displayName: string; description?: string; permissions: string[] }) {
  const data = await apiFetch<any>("/api/roles", { method: "POST", json: payload });
  return (data.role || data) as BackendRole;
}
export async function apiUpdateRole(id: string, payload: { displayName?: string; description?: string; active?: boolean; permissions?: string[] }) {
  const data = await apiFetch<any>(`/api/roles/${id}`, { method: "PUT", json: payload });
  return (data.role || data) as BackendRole;
}
export async function apiActivateRole(id: string) {
  const data = await apiFetch<any>(`/api/roles/${id}/activate`, { method: "PATCH", json: {} });
  return (data.role || data) as BackendRole;
}
export async function apiDeactivateRole(id: string) {
  const data = await apiFetch<any>(`/api/roles/${id}/deactivate`, { method: "PATCH", json: {} });
  return (data.role || data) as BackendRole;
}

/* ---------------- orders ---------------- */
export interface ApiOrder {
  id: string;
  code?: string;
  formId?: string;
  formName?: string;
  formOwnerUserId?: string;
  customerName: string;
  phone: string;
  whatsappNumber?: string;
  deliveryAddress?: string;
  state?: string;
  packageId?: string;
  packageName?: string;
  packageDescription?: string;
  inventoryProductId?: string;
  inventoryProductName?: string;
  inventoryQuantity?: number;

  stockDeducted?: boolean;
  stockDeductedAt?: string;
  price: number;
  currency?: string;
  status?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  followUpStatus?: string;
  callAttempts?: number;
  nextFollowUpDate?: string;
  lastCallOutcome?: string;
  lastCallNote?: string;
  assignedCustomerCareId?: string;
  assignedCustomerCareName?: string;
  assignedTo?: string;
  assignedToName?: string;
  deliveryAssignedToId?: string;
  deliveryAssignedToName?: string;
  deliveryAssignedAt?: string;
  deliveredAt?: string;
  deliveryNote?: string;
  notes?: string;
  customerEmail?: string;
  trackingCode?: string;
  campaignName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const listOrders = () => apiFetch<any>("/api/orders").then((d) => (Array.isArray(d) ? d : d.orders || d.data || []) as ApiOrder[]);
export const getOrder = (id: string) => apiFetch<any>(`/api/orders/${id}`).then((d) => (d.order || d) as ApiOrder);
export const customerCareQueue = () => apiFetch<any>("/api/orders/customer-care-queue").then((d) => (Array.isArray(d) ? d : d.orders || []) as ApiOrder[]);
export const myCustomerCareQueue = () => apiFetch<any>("/api/orders/my-customer-care-queue").then((d) => (Array.isArray(d) ? d : d.orders || []) as ApiOrder[]);
export const assignOrderToMe = (orderId: string) => apiFetch(`/api/orders/${orderId}/assign-to-me`, { method: "PATCH", json: {} });

export type CustomerCareOutcome = "CLIENT_SERVICED" | "TRANSFER_FOR_DELIVERY" | "NOT_RESOLVED";
export const customerCareCall = (orderId: string, outcome: CustomerCareOutcome, note: string) =>
  apiFetch(`/api/orders/${orderId}/customer-care-call`, { method: "PATCH", json: { outcome, note } });

export interface CallLogEntry {
  id: string; orderId: string; staffId?: string; staffName?: string;
  outcome: string; note?: string; attempt?: number; callDate?: string; createdAt?: string;
}
export const orderCallLogs = (orderId: string) =>
  apiFetch<any>(`/api/orders/${orderId}/call-logs`).then((d) => (Array.isArray(d) ? d : d.logs || []) as CallLogEntry[]);

export type DeliveryOutcome = "OUT_FOR_DELIVERY" | "DELIVERED" | "DELIVERY_FAILED" | "RETURNED";
export const assignDeliveryToMe = (orderId: string) => apiFetch(`/api/orders/${orderId}/assign-delivery-to-me`, { method: "PATCH", json: {} });
export const deliveryUpdate = (orderId: string, outcome: DeliveryOutcome, note: string) =>
  apiFetch(`/api/orders/${orderId}/delivery-update`, { method: "PATCH", json: { outcome, note } });

/* ---------------- sales-rep treatment (new) ---------------- */
export type TreatmentOutcome =
  | "PENDING" | "IN_TRANSIT" | "RESCHEDULED" | "NOT_AVAILABLE" | "CALL_BACK"
  | "REJECTED" | "NUMBER_BUSY" | "SWITCHED_OFF" | "NOT_ANSWERING"
  | "NOT_READY" | "CANCELLED" | "DELIVERED" | "FOLLOW_UP";

export interface TreatmentPayload {
  outcome: TreatmentOutcome;
  note?: string;
  nextFollowUpAt?: string;
  customerMessage?: string;
  deliveryAgentId?: string;
}
export const salesTreatment = (orderId: string, payload: TreatmentPayload) =>
  apiFetch(`/api/orders/${orderId}/sales-treatment`, { method: "PATCH", json: payload });

/** Send order for delivery (marks IN_TRANSIT with an external delivery agent). Stock is NOT deducted yet. */
export const sendOrderForDelivery = (orderId: string, deliveryAgentId: string, note?: string) =>
  salesTreatment(orderId, { outcome: "IN_TRANSIT", deliveryAgentId, note });

/** Mark order delivered. Requires an existing delivery-agent assignment. */
export const markOrderDelivered = (orderId: string, note?: string) =>
  salesTreatment(orderId, { outcome: "DELIVERED", note });


export interface TreatmentLog {
  id: string; orderId: string; staffId?: string; staffName?: string;
  outcome: string; note?: string; customerMessage?: string;
  nextFollowUpAt?: string; createdAt?: string;
}
export const treatmentLogs = (orderId: string) =>
  apiFetch<any>(`/api/orders/${orderId}/treatment-logs`).then((d) => (Array.isArray(d) ? d : d.logs || d.treatmentLogs || []) as TreatmentLog[]);

/* ---------------- follow-up reminders ---------------- */
export interface FollowUpReminder {
  id: string; orderId: string; orderCode?: string;
  customerName?: string; phone?: string;
  outcome?: string; note?: string; scheduledAt: string;
  completed?: boolean; assignedToId?: string; assignedToName?: string;
  createdAt?: string;
}
export const followUps = () => apiFetch<any>("/api/follow-ups").then((d) => (Array.isArray(d) ? d : d.reminders || d.followUps || []) as FollowUpReminder[]);
export const myFollowUps = () => apiFetch<any>("/api/follow-ups/my").then((d) => (Array.isArray(d) ? d : d.reminders || d.followUps || []) as FollowUpReminder[]);
export const followUpsDue = () => apiFetch<any>("/api/follow-ups/due").then((d) => (Array.isArray(d) ? d : d.reminders || d.followUps || []) as FollowUpReminder[]);
export const myFollowUpsDue = () => apiFetch<any>("/api/follow-ups/my-due").then((d) => (Array.isArray(d) ? d : d.reminders || d.followUps || []) as FollowUpReminder[]);
export const completeFollowUp = (reminderId: string, note?: string) =>
  apiFetch<any>(`/api/follow-ups/${reminderId}/complete`, { method: "PATCH", json: { note: note || "" } });


/* ---------------- delivery ---------------- */
export const deliveryQueue = () => apiFetch<any>("/api/delivery/queue").then((d) => (Array.isArray(d) ? d : d.orders || []) as ApiOrder[]);
export const myDeliveryQueue = () => apiFetch<any>("/api/delivery/my-queue").then((d) => (Array.isArray(d) ? d : d.orders || []) as ApiOrder[]);

/* ---------------- inventory ---------------- */
export interface ApiProduct {
  id: string; name: string; sku?: string; description?: string; category?: string;
  stockQuantity: number; lowStockThreshold?: number; lowStock?: boolean;
  costPrice?: number; sellingPrice?: number; active: boolean; createdAt?: string;
}
export interface InventorySummary {
  totalProducts?: number; activeProducts?: number; lowStockProducts?: number;
  outOfStockProducts?: number; totalStockCostValue?: number; totalStockSellingValue?: number;
  lowStockList?: ApiProduct[]; recentMovements?: InventoryMove[];
  [k: string]: unknown;
}
export interface InventoryMove {
  id: string; productId: string; productName?: string; productSku?: string;
  movementType?: string; quantityChange: number; previousQuantity?: number; newQuantity?: number;
  reason?: string; note?: string; recordedByName?: string; createdAt?: string;
}

export const inventorySummary = () => apiFetch<InventorySummary>("/api/inventory/summary");
export const listProducts = () => apiFetch<any>("/api/inventory/products").then((d) => (Array.isArray(d) ? d : d.products || []) as ApiProduct[]);
export const listActiveProducts = () => apiFetch<any>("/api/inventory/products/active").then((d) => (Array.isArray(d) ? d : d.products || []) as ApiProduct[]);
export const getProduct = (id: string) => apiFetch<any>(`/api/inventory/products/${id}`).then((d) => (d.product || d) as ApiProduct);
export const createProduct = (payload: Partial<ApiProduct>) => apiFetch<any>("/api/inventory/products", { method: "POST", json: payload });
export const updateProduct = (id: string, payload: Partial<ApiProduct>) => apiFetch<any>(`/api/inventory/products/${id}`, { method: "PUT", json: payload });
export const adjustStock = (id: string, payload: { quantityChange: number; reason: string; note?: string; referenceType?: string; referenceId?: string }) =>
  apiFetch<any>(`/api/inventory/products/${id}/adjust-stock`, { method: "PATCH", json: payload });
export const listMovements = () => apiFetch<any>("/api/inventory/movements").then((d) => (Array.isArray(d) ? d : d.movements || []) as InventoryMove[]);
export const productMovements = (productId: string) => apiFetch<any>(`/api/inventory/products/${productId}/movements`).then((d) => (Array.isArray(d) ? d : d.movements || []) as InventoryMove[]);

/* ---------------- finance ---------------- */
export interface FinanceSummary {
  totalOrderValue?: number; deliveredOrderValue?: number; unpaidOrderValue?: number;
  pendingDeliveryValue?: number; confirmedPayments?: number; approvedExpenses?: number;
  staffPendingEarnings?: number; staffApprovedEarnings?: number; staffPaidEarnings?: number;
  staffOutstandingEarnings?: number; walletBalance?: number; realWalletBalance?: number;
  availableAfterStaffLiabilities?: number; estimatedProfit?: number; estimatedProfitAfterStaffCosts?: number;
  [k: string]: unknown;
}
export interface ApiPayment {
  id: string; orderId?: string; amount: number; method?: string; reference?: string;
  status?: string; note?: string; createdAt?: string;
}
export interface ApiExpense {
  id: string; title: string; category?: string; amount: number; currency?: string;
  status?: string; note?: string; createdAt?: string;
}

export const financeSummary = () => apiFetch<FinanceSummary>("/api/finance/summary");
export const listPayments = () => apiFetch<any>("/api/finance/payments").then((d) => (Array.isArray(d) ? d : d.payments || []) as ApiPayment[]);
export const listOrderPayments = (orderId: string) => apiFetch<any>(`/api/finance/payments/order/${orderId}`).then((d) => (Array.isArray(d) ? d : d.payments || []) as ApiPayment[]);
export const createPayment = (payload: Partial<ApiPayment>) => apiFetch<any>("/api/finance/payments", { method: "POST", json: payload });
export const listExpenses = () => apiFetch<any>("/api/finance/expenses").then((d) => (Array.isArray(d) ? d : d.expenses || []) as ApiExpense[]);
export const createExpense = (payload: Partial<ApiExpense>) => apiFetch<any>("/api/finance/expenses", { method: "POST", json: payload });

/* ---------------- staff earnings ---------------- */
export interface ApiEarning {
  id: string; staffId?: string; staffName?: string; orderId?: string;
  earningType?: string; amount: number; currency?: string; status?: string;
  note?: string; createdAt?: string; approvedAt?: string; paidAt?: string;
}
export interface EarningsSummary {
  totalPending?: number; totalApproved?: number; totalPaid?: number;
  totalOutstanding?: number; [k: string]: unknown;
}
export const listEarnings = () => apiFetch<any>("/api/staff-earnings").then((d) => (Array.isArray(d) ? d : d.earnings || []) as ApiEarning[]);
export const earningsSummary = () => apiFetch<EarningsSummary>("/api/staff-earnings/summary");
export const myEarnings = () => apiFetch<any>("/api/staff-earnings/my").then((d) => (Array.isArray(d) ? d : d.earnings || []) as ApiEarning[]);
export const createEarning = (payload: Partial<ApiEarning>) => apiFetch<any>("/api/staff-earnings", { method: "POST", json: payload });
export const approveEarning = (id: string, note?: string) => apiFetch<any>(`/api/staff-earnings/${id}/approve`, { method: "PATCH", json: { note: note || "" } });
export const markEarningPaid = (id: string, note?: string) => apiFetch<any>(`/api/staff-earnings/${id}/mark-paid`, { method: "PATCH", json: { note: note || "" } });
export const cancelEarning = (id: string, note?: string) => apiFetch<any>(`/api/staff-earnings/${id}/cancel`, { method: "PATCH", json: { note: note || "" } });

/* ---------------- forms ---------------- */
export interface ApiPackage {
  id: string; name: string; description?: string; price: number; currency?: string;
  active?: boolean; sortOrder?: number; inventoryProductId?: string; quantityPerOrder?: number;
  inventoryProductName?: string;
}
export interface ApiForm {
  id: string; name: string; title?: string; description?: string;
  thankYouMessage?: string; redirectUrl?: string; slug: string; active?: boolean;
  ownerUserId?: string; ownerName?: string; packages?: ApiPackage[]; createdAt?: string;
}

export const listForms = () => apiFetch<any>("/api/forms").then((d) => (Array.isArray(d) ? d : d.forms || []) as ApiForm[]);
export const getForm = (id: string) => apiFetch<any>(`/api/forms/${id}`).then((d) => (d.form || d) as ApiForm);
export const createForm = (payload: Partial<ApiForm> & { packages?: Partial<ApiPackage>[] }) => apiFetch<any>("/api/forms", { method: "POST", json: payload });
export const updateForm = (id: string, payload: Partial<ApiForm>) => apiFetch<any>(`/api/forms/${id}`, { method: "PUT", json: payload });
export const addFormPackage = (formId: string, payload: Partial<ApiPackage>) => apiFetch<any>(`/api/forms/${formId}/packages`, { method: "POST", json: payload });
export const updateFormPackage = (formId: string, packageId: string, payload: Partial<ApiPackage>) => apiFetch<any>(`/api/forms/${formId}/packages/${packageId}`, { method: "PUT", json: payload });
export const deleteFormPackage = (formId: string, packageId: string) => apiFetch<any>(`/api/forms/${formId}/packages/${packageId}`, { method: "DELETE" });

/* ---------------- form settings (builder) ---------------- */
export interface FormSettings {
  productId?: string;
  useProductPriceTiers?: boolean;
  hasWebsite?: boolean;
  headerText?: string;
  subHeaderText?: string;
  /* field settings */
  showName?: boolean; requireName?: boolean; labelName?: string;
  showPhone?: boolean; requirePhone?: boolean; labelPhone?: string;
  showWhatsapp?: boolean; requireWhatsapp?: boolean; labelWhatsapp?: string;
  showEmail?: boolean; requireEmail?: boolean; labelEmail?: string;
  showAddress?: boolean; requireAddress?: boolean; labelAddress?: string;
  showState?: boolean; requireState?: boolean; labelState?: string;
  showCountryCode?: boolean; requireCountryCode?: boolean; labelCountryCode?: string;
  /* package display */
  packageDisplay?: "DROPDOWN" | "CARDS" | "RADIO";
  packageLabelText?: string;
  showPackagesOnTop?: boolean;
  allowTypeVariationQuantity?: boolean;
  /* styling */
  formBackgroundColor?: string; innerBackgroundColor?: string;
  showFieldLabels?: boolean; labelColor?: string; fontType?: string;
  submitButtonBackgroundColor?: string; submitButtonTextColor?: string; submitButtonBorderColor?: string;
  borderRadius?: number; submitButtonFontSize?: number;
  formWidth?: number; fieldHeight?: number; labelFontSize?: number;
  /* submit + notification */
  submitButtonText?: string; textBeforeSubmit?: string;
  notificationEmails?: string; termsAndConditions?: string;
  /* payment */
  paymentMethods?: string; accountName?: string; accountNumber?: string; bankName?: string;
  afterPaymentInstruction?: string;
  [k: string]: unknown;
}
function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeFormSettings(raw: any): FormSettings {
  const d = raw?.settings || raw || {};
  const field = parseJsonObject(d.fieldSettingsJson);
  const style = parseJsonObject(d.styleSettingsJson);
  const submit = parseJsonObject(d.submitSettingsJson);
  const payment = parseJsonObject(d.paymentSettingsJson);
  const delivery = parseJsonObject(d.deliverySettingsJson);
  const useTemplate = String(d.usePriceVariationTemplate || "").toUpperCase();

  return {
    ...field,
    ...style,
    ...delivery,
    ...submit,
    ...payment,
    productId: d.productId || undefined,
    hasWebsite: Boolean(d.hasWebsite),
    useProductPriceTiers: useTemplate.includes("PRODUCT") || useTemplate.includes("TIER"),
    headerText: d.headerText || (submit.headerText as string | undefined),
    subHeaderText: d.subHeaderText || (submit.subHeaderText as string | undefined),
    notificationEmails: d.notificationEmails || (submit.notificationEmails as string | undefined),
    termsAndConditions: d.termsAndConditions || (submit.termsAndConditions as string | undefined),
  } as FormSettings;
}

function toBackendFormSettings(payload: FormSettings) {
  const fieldSettingsJson = JSON.stringify({
    showName: payload.showName, requireName: payload.requireName, labelName: payload.labelName,
    showPhone: payload.showPhone, requirePhone: payload.requirePhone, labelPhone: payload.labelPhone,
    showWhatsapp: payload.showWhatsapp, requireWhatsapp: payload.requireWhatsapp, labelWhatsapp: payload.labelWhatsapp,
    showEmail: payload.showEmail, requireEmail: payload.requireEmail, labelEmail: payload.labelEmail,
    showAddress: payload.showAddress, requireAddress: payload.requireAddress, labelAddress: payload.labelAddress,
    showState: payload.showState, requireState: payload.requireState, labelState: payload.labelState,
    showCountryCode: payload.showCountryCode, requireCountryCode: payload.requireCountryCode, labelCountryCode: payload.labelCountryCode,
  });
  const styleSettingsJson = JSON.stringify({
    formBackgroundColor: payload.formBackgroundColor, innerBackgroundColor: payload.innerBackgroundColor,
    showFieldLabels: payload.showFieldLabels, labelColor: payload.labelColor, fontType: payload.fontType,
    submitButtonBackgroundColor: payload.submitButtonBackgroundColor, submitButtonTextColor: payload.submitButtonTextColor,
    submitButtonBorderColor: payload.submitButtonBorderColor, borderRadius: payload.borderRadius,
    submitButtonFontSize: payload.submitButtonFontSize, formWidth: payload.formWidth, fieldHeight: payload.fieldHeight,
    labelFontSize: payload.labelFontSize,
  });
  const submitSettingsJson = JSON.stringify({
    submitButtonText: payload.submitButtonText, textBeforeSubmit: payload.textBeforeSubmit,
    notificationEmails: payload.notificationEmails, termsAndConditions: payload.termsAndConditions,
  });
  const paymentSettingsJson = JSON.stringify({
    paymentMethods: payload.paymentMethods, accountName: payload.accountName, accountNumber: payload.accountNumber,
    bankName: payload.bankName, afterPaymentInstruction: payload.afterPaymentInstruction,
  });
  const deliverySettingsJson = JSON.stringify({
    packageDisplay: payload.packageDisplay, packageLabelText: payload.packageLabelText,
    showPackagesOnTop: payload.showPackagesOnTop, allowTypeVariationQuantity: payload.allowTypeVariationQuantity,
  });

  return {
    productId: payload.productId || null,
    hasWebsite: Boolean(payload.hasWebsite),
    usePriceVariationTemplate: payload.useProductPriceTiers ? "PRODUCT_TIERS" : "NONE",
    headerText: payload.headerText,
    subHeaderText: payload.subHeaderText,
    fieldSettingsJson, styleSettingsJson, submitSettingsJson, paymentSettingsJson, deliverySettingsJson,
    notificationEmails: payload.notificationEmails,
    termsAndConditions: payload.termsAndConditions,
  };
}

export const getFormSettings = (formId: string) =>
  apiFetch<any>(`/api/forms/${formId}/settings`).then(normalizeFormSettings).catch(() => ({} as FormSettings));
export const updateFormSettings = (formId: string, payload: FormSettings) =>
  apiFetch<any>(`/api/forms/${formId}/settings`, { method: "PUT", json: toBackendFormSettings(payload) }).then(normalizeFormSettings);
export const createPackagesFromProduct = (formId: string, productId: string, clearExistingPackages = true) =>
  apiFetch<any>(`/api/forms/${formId}/packages/from-product`, { method: "POST", json: { productId, clearExistingPackages } });

/* ---------------- public form ---------------- */
export interface PublicFormResponse extends ApiForm { settings?: FormSettings }
export const getPublicForm = (slug: string) => apiFetch<any>(`/api/public/forms/${slug}`, { auth: false }).then((d) => (d.form || d) as PublicFormResponse);
export const getPublicFormSettings = (slug: string) =>
  apiFetch<any>(`/api/public/forms/${slug}/settings`, { auth: false })
    .then(normalizeFormSettings)
    .catch(() => ({} as FormSettings));

/** Human-friendly label for a stock movement (agent allocation vs receipt vs customer delivery). */
export function movementLabel(movementType?: string | null, reason?: string | null, quantityChange?: number): string {
  const s = `${movementType || ""} ${reason || ""}`.toUpperCase();
  if (s.includes("RECEIV")) return "Stock Received By Agent";
  if (s.includes("IN_TRANSIT") || s.includes("IN TRANSIT") || (s.includes("ALLOC") && !s.includes("RETURN"))) return "Stock Sent To Agent — In Transit";
  if (s.includes("DELIVER")) return "Delivered To Customer — Agent Stock Deducted";
  if (s.includes("RETURN")) return "Returned Stock";
  if (s.includes("PURCHASE") || s.includes("RESTOCK")) return "Stock Purchase / Restock";
  if (s.includes("DAMAGE")) return "Damaged Stock";
  if (s.includes("LOSS")) return "Lost Stock";
  if (s.includes("ADJUST") || s.includes("MANUAL")) return "Manual Adjustment";
  if (typeof quantityChange === "number") return quantityChange >= 0 ? "Stock In" : "Stock Out";
  return movementType || reason || "—";
}

export interface PublicOrderPayload {
  customerName: string;
  phone: string;
  whatsappNumber: string;
  deliveryAddress: string;
  state: string;
  packageId: string;
  notes?: string;
  clientSubmissionId: string;
}

export const apiSubmitPublicOrder = (slug: string, payload: PublicOrderPayload) =>
  apiFetch<any>(`/api/public/forms/${slug}/orders`, { method: "POST", auth: false, json: payload });

/* ---------------- staff duty ---------------- */
export interface StaffDutySummary {
  totalStaff?: number; activeStaff?: number;
  openCustomerCareOrders?: number; followUpDueOrders?: number;
  openDeliveryOrders?: number; deliveredOrders?: number;
  unpaidOrders?: number; lowStockProducts?: number;
  pendingEarnings?: number; approvedEarnings?: number;
  paidEarnings?: number; outstandingEarnings?: number;
  [k: string]: unknown;
}
export interface StaffDutyAgent {
  staffId: string; staffName?: string; email?: string; phone?: string;
  roleName?: string; roleDisplayName?: string; active?: boolean;
  openCustomerCareOrders?: number; followUpDue?: number;
  completedCustomerCareOrders?: number; openDeliveryOrders?: number;
  deliveredOrders?: number; failedDeliveries?: number;
  pendingEarnings?: number; approvedEarnings?: number;
  paidEarnings?: number; cancelledEarnings?: number;
  outstandingEarnings?: number; totalHandled?: number; performanceNote?: string;
  [k: string]: unknown;
}
export const staffDutySummary = () => apiFetch<StaffDutySummary>("/api/staff-duty/summary");
export const staffDutyAgents = () => apiFetch<any>("/api/staff-duty/agents").then((d) => (Array.isArray(d) ? d : d.agents || d.data || []) as StaffDutyAgent[]);
export const staffDutyAgent = (id: string) => apiFetch<any>(`/api/staff-duty/agents/${id}`).then((d) => (d.agent || d) as StaffDutyAgent);
export const myWorkspace = () => apiFetch<any>("/api/staff-duty/my-workspace");
export const staffDutyCustomerCare = () => apiFetch<any>("/api/staff-duty/customer-care");
export const staffDutyDelivery = () => apiFetch<any>("/api/staff-duty/delivery");

/* ---------------- marketing ---------------- */
export interface ApiCampaign {
  id: string; name: string; campaignType?: string; targetAudience?: string;
  message?: string; providerKey?: string; status?: string; active?: boolean;
  budget?: number; campaignCost?: number;
  expectedReach?: number; actualReach?: number;
  clickCount?: number; conversionCount?: number;
  ordersGenerated?: number; paidOrders?: number;
  revenueGenerated?: number; estimatedProfit?: number;
  promoterUserId?: string; promoterName?: string;
  mediaPromoterUserId?: string; mediaPromoterName?: string;
  trackingCode?: string; landingUrl?: string;
  scheduledDate?: string; launchedDate?: string; completedDate?: string;
  startDate?: string; endDate?: string;
  createdByName?: string; createdAt?: string; updatedAt?: string;
}
export interface MarketingSummary {
  totalCampaigns?: number; activeCampaigns?: number; draftCampaigns?: number;
  scheduledCampaigns?: number; runningCampaigns?: number; completedCampaigns?: number;
  [k: string]: unknown;
}
export const marketingSummary = () => apiFetch<MarketingSummary>("/api/marketing/campaigns/summary");
export const listCampaigns = (status?: string) => apiFetch<any>(`/api/marketing/campaigns${status ? `?status=${status}` : ""}`).then((d) => (Array.isArray(d) ? d : d.campaigns || []) as ApiCampaign[]);
export const getCampaign = (id: string) => apiFetch<any>(`/api/marketing/campaigns/${id}`).then((d) => (d.campaign || d) as ApiCampaign);
export const createCampaign = (payload: Partial<ApiCampaign>) => apiFetch<any>("/api/marketing/campaigns", { method: "POST", json: payload });
export const updateCampaign = (id: string, payload: Partial<ApiCampaign>) => apiFetch<any>(`/api/marketing/campaigns/${id}`, { method: "PUT", json: payload });
export const launchCampaign = (id: string) => apiFetch<any>(`/api/marketing/campaigns/${id}/launch`, { method: "PATCH", json: {} });
export const pauseCampaign = (id: string) => apiFetch<any>(`/api/marketing/campaigns/${id}/pause`, { method: "PATCH", json: {} });
export const completeCampaign = (id: string) => apiFetch<any>(`/api/marketing/campaigns/${id}/complete`, { method: "PATCH", json: {} });
export const cancelCampaign = (id: string) => apiFetch<any>(`/api/marketing/campaigns/${id}/cancel`, { method: "PATCH", json: {} });

/* ---------------- connections ---------------- */
export interface ApiConnection {
  id?: string; providerKey: string; providerName?: string; category?: string;
  description?: string; status?: string; active?: boolean; connected?: boolean;
  authType?: string; hasSecret?: boolean; secretPreview?: string;
  publicConfig?: Record<string, unknown> | string; webhookUrl?: string;
  lastTestStatus?: string; lastTestMessage?: string; lastTestedAt?: string;
  connectedAt?: string; disconnectedAt?: string; [k: string]: unknown;
}
export interface ConnectionsSummary {
  totalProviders?: number; connectedProviders?: number; activeProviders?: number;
  [k: string]: unknown;
}
export const listConnections = () => apiFetch<any>("/api/connections").then((d) => (Array.isArray(d) ? d : d.connections || []) as ApiConnection[]);
export const connectionsSummary = () => apiFetch<ConnectionsSummary>("/api/connections/summary");
export const getConnection = (key: string) => apiFetch<any>(`/api/connections/${key}`).then((d) => (d.connection || d) as ApiConnection);
export const updateConnection = (key: string, payload: Partial<ApiConnection> & { secretValue?: string }) => apiFetch<any>(`/api/connections/${key}`, { method: "PUT", json: payload });
export const testConnection = (key: string) => apiFetch<any>(`/api/connections/${key}/test`, { method: "PATCH", json: {} });
export const disconnectConnection = (key: string) => apiFetch<any>(`/api/connections/${key}/disconnect`, { method: "PATCH", json: {} });

/* ---------------- AI ---------------- */
export interface AiAskResponse { answer?: string; response?: string; message?: string; data?: unknown; [k: string]: unknown; }
export interface AiLog { id: string; question?: string; answer?: string; mode?: string; createdAt?: string; askedByName?: string; }
export const aiAsk = (question: string, mode: string = "general") => apiFetch<AiAskResponse>("/api/ai/ask", { method: "POST", json: { question, mode } });
export const aiSnapshot = () => apiFetch<any>("/api/ai/snapshot");
export const aiLogs = () => apiFetch<any>("/api/ai/logs").then((d) => (Array.isArray(d) ? d : d.logs || []) as AiLog[]);

/* ---------------- chat ---------------- */
export interface ChatUser { id: string; name?: string; email?: string; roleName?: string; role?: string; roleDisplayName?: string; active?: boolean; }
export interface ChatConversation {
  id: string; type?: string;
  otherUserId?: string; otherUserName?: string; otherUserEmail?: string; otherUserRole?: string;
  lastMessage?: string; lastMessageAt?: string; unreadCount?: number; updatedAt?: string;
}
export interface ChatMessage {
  id: string; conversationId?: string; senderId?: string; senderName?: string; recipientName?: string;
  content: string; createdAt?: string; readAt?: string;
}
const pickArr = (d: any, ...keys: string[]) => {
  if (Array.isArray(d)) return d;
  for (const k of keys) if (Array.isArray(d?.[k])) return d[k];
  if (Array.isArray(d?.data)) return d.data;
  return [];
};
const pickObj = (d: any, ...keys: string[]) => {
  for (const k of keys) if (d?.[k] && typeof d[k] === "object") return d[k];
  if (d?.data && typeof d.data === "object" && !Array.isArray(d.data)) return d.data;
  return d;
};

export const chatUsers = () => apiFetch<any>("/api/chat/users").then((d) => pickArr(d, "users") as ChatUser[]);
export const chatConversations = () => apiFetch<any>("/api/chat/conversations").then((d) => pickArr(d, "conversations") as ChatConversation[]);
export const chatOpenDirect = (userId: string) =>
  apiFetch<any>(`/api/chat/conversations/direct/${userId}`, { method: "POST", json: {} }).then((d) => {
    const conv = pickObj(d, "conversation") as ChatConversation;
    if (!conv || !conv.id) throw new Error("Backend did not return a valid conversation");
    return conv;
  });
export const chatMessages = (conversationId: string) => apiFetch<any>(`/api/chat/conversations/${conversationId}/messages`).then((d) => pickArr(d, "messages") as ChatMessage[]);
export const chatSend = (conversationId: string, content: string) =>
  apiFetch<any>(`/api/chat/conversations/${conversationId}/messages`, { method: "POST", json: { content } });
export const chatMarkRead = (conversationId: string) =>
  apiFetch<any>(`/api/chat/conversations/${conversationId}/read`, { method: "PATCH", json: {} });

/* ---------------- notifications ---------------- */
export interface ApiNotification {
  id: string; title: string; message?: string; type?: string;
  resourceType?: string; resourceId?: string; read?: boolean; createdAt?: string;
}
export const listNotifications = () => apiFetch<any>("/api/notifications").then((d) => (Array.isArray(d) ? d : d.notifications || []) as ApiNotification[]);
export const markNotificationRead = (id: string) => apiFetch<any>(`/api/notifications/${id}/read`, { method: "PATCH", json: {} });
export const markAllNotificationsRead = () => apiFetch<any>("/api/notifications/read-all", { method: "PATCH", json: {} });

/* ---------------- activity ---------------- */
export interface ActivityLog {
  id: string; activityType?: string; title?: string; message?: string;
  resourceType?: string; resourceId?: string;
  actorName?: string; actorRole?: string; metadata?: unknown; createdAt?: string;
}
export const activityLogs = () => apiFetch<any>("/api/activity/logs").then((d) => (Array.isArray(d) ? d : d.logs || d.activities || []) as ActivityLog[]);
export const resourceActivity = (resourceType: string, resourceId: string) =>
  apiFetch<any>(`/api/activity/resource/${resourceType}/${resourceId}`).then((d) => (Array.isArray(d) ? d : d.logs || d.activities || []) as ActivityLog[]);

/* ---------------- reports downloads ---------------- */
export async function downloadReport(endpoint: string, filename: string) {
  const t = getToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: t ? { Authorization: `Bearer ${t}` } : {},
  });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("glowbalmart:unauthorized"));
    throw new ApiError("Session expired", 401);
  }
  if (res.status === 404 || res.status === 501) {
    throw new ApiError("This report is not available on the server yet. Please try again later.", res.status);
  }
  if (!res.ok) {
    const msg = await parseError(res, "Download failed");
    if (/no static resource|not found|no handler/i.test(msg)) {
      throw new ApiError("This report is not available on the server yet. Please try again later.", res.status);
    }
    throw new ApiError(msg, res.status);
  }
  const ctype = res.headers.get("content-type") || "";
  if (/text\/html|application\/json/i.test(ctype)) {
    const text = await res.clone().text();
    if (/no static resource|"status"\s*:\s*(404|500)/i.test(text)) {
      throw new ApiError("This report is not available on the server yet. Please try again later.", 404);
    }
  }


  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- webhooks ---------------- */
export interface WebhookSource {
  id: string; name: string; description?: string; sourceKey?: string;
  secret?: string; active?: boolean; createdByName?: string; createdAt?: string; updatedAt?: string;
}
export const listWebhookSources = () => apiFetch<any>("/api/webhooks/sources").then((d) => (Array.isArray(d) ? d : d.sources || []) as WebhookSource[]);
export const getWebhookSource = (id: string) => apiFetch<any>(`/api/webhooks/sources/${id}`).then((d) => (d.source || d) as WebhookSource);
export const createWebhookSource = (payload: Partial<WebhookSource>) => apiFetch<any>("/api/webhooks/sources", { method: "POST", json: payload });
export const updateWebhookSource = (id: string, payload: Partial<WebhookSource>) => apiFetch<any>(`/api/webhooks/sources/${id}`, { method: "PUT", json: payload });

/* ---------------- store settings ---------------- */
export interface StoreSettings {
  businessName?: string; storeName?: string; tagline?: string; description?: string;
  logoUrl?: string; coverImageUrl?: string; businessEmail?: string; supportEmail?: string;
  phone?: string; whatsappNumber?: string; address?: string; city?: string; state?: string;
  country?: string; currency?: string; timezone?: string; websiteUrl?: string;
  socialLinks?: Record<string, string>; [k: string]: unknown;
}
export const getStoreSettings = () => apiFetch<any>("/api/settings/store").then((d) => (d.settings || d) as StoreSettings);
export const updateStoreSettings = (payload: Partial<StoreSettings>) => apiFetch<any>("/api/settings/store", { method: "PUT", json: payload });
export const getPublicStoreSettings = () => apiFetch<any>("/api/public/settings/store", { auth: false }).then((d) => (d.settings || d) as StoreSettings);

/* ---------------- public storefront ---------------- */
export interface StorefrontProduct {
  id: string; name: string; description?: string; category?: string;
  price: number; currency?: string; imageUrl?: string;
  stockQuantity?: number; lowStock?: boolean; inStock?: boolean;
}
export const storefrontHome = () => apiFetch<any>("/api/public/storefront/home", { auth: false });
export const storefrontProducts = (category?: string) => apiFetch<any>(`/api/public/storefront/products${category ? `?category=${encodeURIComponent(category)}` : ""}`, { auth: false }).then((d) => (Array.isArray(d) ? d : d.products || []) as StorefrontProduct[]);
export const storefrontProduct = (id: string) => apiFetch<any>(`/api/public/storefront/products/${id}`, { auth: false }).then((d) => (d.product || d) as StorefrontProduct);
export interface StorefrontCheckoutPayload {
  productId: string; quantity: number; customerName: string; phone: string;
  whatsappNumber?: string; deliveryAddress: string; state: string;
  notes?: string; clientSubmissionId: string;
}
export const storefrontCheckout = (payload: StorefrontCheckoutPayload) => apiFetch<any>("/api/public/storefront/checkout", { method: "POST", auth: false, json: payload });

/* ---------------- helpers ---------------- */
export function waLink(phone?: string) {
  if (!phone) return "#";
  let p = phone.replace(/[^\d]/g, "");
  if (p.startsWith("0") && p.length === 11) p = "234" + p.slice(1);
  return `https://wa.me/${p}`;
}

/* ---------------- agent stock ---------------- */
export interface AgentStockAgent {
  id: string; userId?: string; name: string; email?: string; phone?: string;
  roleName?: string; roleDisplayName?: string; active?: boolean;
  totalProducts?: number; totalQuantityRemaining?: number; totalQuantityAllocated?: number;
  lowStockProducts?: number; [k: string]: unknown;
}
export interface AgentStockRow {
  id: string; agentUserId: string; agentName?: string; agentEmail?: string; agentRoleName?: string;
  productId: string; productName?: string; productSku?: string;
  quantityAllocated?: number; quantityRemaining: number; lowStockThreshold?: number;
  lowStock?: boolean; active?: boolean; updatedAt?: string; createdAt?: string;
  [k: string]: unknown;
}
export interface AgentStockMovement {
  id: string; agentUserId?: string; agentName?: string;
  productId?: string; productName?: string; productSku?: string;
  movementType?: string; quantityChange?: number; quantity?: number;
  previousQuantity?: number; newQuantity?: number;
  orderId?: string; orderCode?: string; note?: string;
  recordedByName?: string; createdAt?: string; [k: string]: unknown;
}
export interface AgentStockSummary {
  totalAgents?: number; agentsWithStock?: number;
  totalAssignedRows?: number; totalQuantityRemaining?: number;
  lowStockRows?: number; [k: string]: unknown;
}

const arr = <T,>(d: any, ...keys: string[]): T[] => {
  if (Array.isArray(d)) return d as T[];
  for (const k of keys) if (Array.isArray(d?.[k])) return d[k] as T[];
  if (Array.isArray(d?.data)) return d.data as T[];
  return [];
};

export const agentStockAgents = () =>
  apiFetch<any>("/api/agent-stock/agents").then((d) => arr<AgentStockAgent>(d, "agents"));
export const agentStockSummary = () => apiFetch<AgentStockSummary>("/api/agent-stock/summary");
export const agentStockAll = () =>
  apiFetch<any>("/api/agent-stock/all").then((d) => arr<AgentStockRow>(d, "rows", "stock", "agentStock"));
export const agentStockLow = () =>
  apiFetch<any>("/api/agent-stock/low-stock").then((d) => arr<AgentStockRow>(d, "rows", "stock", "agentStock"));
export const agentStockMovements = () =>
  apiFetch<any>("/api/agent-stock/movements").then((d) => arr<AgentStockMovement>(d, "movements"));
export const agentStockAgentMovements = (agentId: string) =>
  apiFetch<any>(`/api/agent-stock/agent/${agentId}/movements`).then((d) => arr<AgentStockMovement>(d, "movements"));

export interface AllocatePayload { agentUserId: string; productId: string; quantity: number; lowStockThreshold?: number; note?: string; }
export interface AdjustPayload { agentUserId: string; productId: string; quantityChange: number; note?: string; }
export interface ReturnPayload { agentUserId: string; productId: string; quantity: number; note?: string; }
export const agentStockAllocate = (payload: AllocatePayload) => apiFetch<any>("/api/agent-stock/allocate", { method: "POST", json: payload });
export const agentStockAdjust = (payload: AdjustPayload) => apiFetch<any>("/api/agent-stock/adjust", { method: "POST", json: payload });
export const agentStockReturn = (payload: ReturnPayload) => apiFetch<any>("/api/agent-stock/return", { method: "POST", json: payload });

/* ---------------- external delivery agents ---------------- */
export type DeliveryAgentStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export interface DeliveryAgent {
  id: string;
  agentName: string;
  agentCode?: string;
  state?: string;
  status?: DeliveryAgentStatus;
  contactPhone?: string;
  email?: string;
  notes?: string;
  active?: boolean;
  totalProducts?: number;
  totalQuantityRemaining?: number;
  lowStockRows?: number;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: unknown;
}
export interface DeliveryAgentSummary {
  totalAgents?: number;
  activeAgents?: number;
  agentsWithStock?: number;
  totalQuantityRemaining?: number;
  lowStockRows?: number;
  [k: string]: unknown;
}
export interface DeliveryAgentStockRow {
  id: string;
  deliveryAgentId: string;
  agentName?: string;
  agentCode?: string;
  productId: string;
  productName?: string;
  productSku?: string;
  quantityAllocated?: number;
  quantityRemaining: number;
  lowStockThreshold?: number;
  lowStock?: boolean;
  updatedAt?: string;
  [k: string]: unknown;
}
export interface DeliveryAgentMovement {
  id: string;
  deliveryAgentId?: string;
  agentName?: string;
  productId?: string; productName?: string; productSku?: string;
  movementType?: string;
  quantityChange?: number; quantity?: number;
  previousQuantity?: number; newQuantity?: number;
  orderId?: string; orderCode?: string;
  note?: string; recordedByName?: string; createdAt?: string;
  [k: string]: unknown;
}
export interface DeliveryAgentAssignment {
  orderId: string;
  deliveryAgentId?: string;
  agentName?: string; agentCode?: string; state?: string;
  assignedByName?: string; assignedAt?: string;
  stockDeducted?: boolean; deliveredAt?: string;
  note?: string;
  [k: string]: unknown;
}

export const listDeliveryAgents = (params?: { activeOnly?: boolean; state?: string }) => {
  const q = new URLSearchParams();
  if (params?.activeOnly) q.set("activeOnly", "true");
  if (params?.state) q.set("state", params.state);
  const qs = q.toString();
  return apiFetch<any>(`/api/delivery-agents${qs ? "?" + qs : ""}`).then((d) => arr<DeliveryAgent>(d, "agents", "deliveryAgents"));
};
export const deliveryAgentsSummary = () => apiFetch<DeliveryAgentSummary>("/api/delivery-agents/summary");
export const getDeliveryAgent = (id: string) => apiFetch<DeliveryAgent>(`/api/delivery-agents/${id}`);
export const createDeliveryAgent = (payload: Partial<DeliveryAgent>) =>
  apiFetch<DeliveryAgent>("/api/delivery-agents", { method: "POST", json: payload });
export const updateDeliveryAgent = (id: string, payload: Partial<DeliveryAgent>) =>
  apiFetch<DeliveryAgent>(`/api/delivery-agents/${id}`, { method: "PUT", json: payload });

export const deliveryAgentStockAll = () =>
  apiFetch<any>("/api/delivery-agents/stock/all").then((d) => arr<DeliveryAgentStockRow>(d, "rows", "stock"));
export const deliveryAgentStockLow = () =>
  apiFetch<any>("/api/delivery-agents/stock/low-stock").then((d) => arr<DeliveryAgentStockRow>(d, "rows", "stock"));
export const deliveryAgentStockMovements = () =>
  apiFetch<any>("/api/delivery-agents/stock/movements").then((d) => arr<DeliveryAgentMovement>(d, "movements"));
export const deliveryAgentStock = (id: string) =>
  apiFetch<any>(`/api/delivery-agents/${id}/stock`).then((d) => arr<DeliveryAgentStockRow>(d, "rows", "stock"));
export const deliveryAgentMovements = (id: string) =>
  apiFetch<any>(`/api/delivery-agents/${id}/stock/movements`).then((d) => arr<DeliveryAgentMovement>(d, "movements"));

export interface DAAllocatePayload { deliveryAgentId: string; productId: string; quantity: number; lowStockThreshold?: number; note?: string; }
export interface DAAdjustPayload { deliveryAgentId: string; productId: string; quantityChange: number; note?: string; }
export interface DAReturnPayload { deliveryAgentId: string; productId: string; quantity: number; note?: string; }
export const deliveryAgentAllocate = (p: DAAllocatePayload) => apiFetch<any>("/api/delivery-agents/stock/allocate", { method: "POST", json: p });
export const deliveryAgentAdjust = (p: DAAdjustPayload) => apiFetch<any>("/api/delivery-agents/stock/adjust", { method: "POST", json: p });
export const deliveryAgentReturn = (p: DAReturnPayload) => apiFetch<any>("/api/delivery-agents/stock/return", { method: "POST", json: p });
export interface DATransferPayload { fromDeliveryAgentId: string; toDeliveryAgentId: string; productId: string; quantity: number; lowStockThreshold?: number; note?: string; }
export const deliveryAgentTransfer = (p: DATransferPayload) => apiFetch<any>("/api/delivery-agents/stock/transfer", { method: "POST", json: p });

/* ---------------- product enhancements (tiers, extras) ---------------- */
export interface ProductPriceTier {
  quantity: number;
  unitLabel: string;
  costPrice: number;
  sellingPrice: number;
  recurring?: string;
}
export interface ProductEnhancement {
  productId?: string;
  countryName?: string; countryCode?: string; currency?: string;
  productCategory?: string;
  hasVariations?: boolean;
  variations?: string;
  hasOffer?: boolean;
  offerText?: string;
  downloadUrl?: string;
  downloadText?: string;
  lowStockThresholdAgents?: number;
  lowStockAlertEmails?: string;
  priceTiers?: ProductPriceTier[];
}
export const getProductEnhancement = (productId: string) =>
  apiFetch<any>(`/api/product-enhancements/${productId}`).catch(() => null).then((d) => (d?.enhancement || d || null) as ProductEnhancement | null);
export const saveProductEnhancement = (productId: string, payload: ProductEnhancement) =>
  apiFetch<any>(`/api/product-enhancements/${productId}`, { method: "PUT", json: payload });
export const listProductPriceTiers = (productId: string) =>
  apiFetch<any>(`/api/product-enhancements/${productId}/price-tiers`).catch(() => null).then((d) => {
    if (!d) return [] as ProductPriceTier[];
    return (Array.isArray(d) ? d : d.tiers || d.priceTiers || []) as ProductPriceTier[];
  });

export const assignOrderToDeliveryAgent = (orderId: string, payload: { deliveryAgentId: string; note?: string }) =>
  apiFetch<any>(`/api/delivery-agents/orders/${orderId}/assign`, { method: "PATCH", json: payload });
export const getOrderDeliveryAssignment = (orderId: string) =>
  apiFetch<DeliveryAgentAssignment>(`/api/delivery-agents/orders/${orderId}/assignment`).catch(() => null as any);
export const listDeliveryAgentAssignments = () =>
  apiFetch<any>("/api/delivery-agents/assignments").then((d) => arr<DeliveryAgentAssignment>(d, "assignments", "rows")).catch(() => [] as DeliveryAgentAssignment[]);




/* ---------------- sales cohorts ---------------- */
export type CommissionType = "FIXED" | "PER_DELIVERY" | "PERCENT_OF_REVENUE" | "NONE";
export interface Cohort {
  id: string; name: string; description?: string;
  targetStartDate?: string; targetEndDate?: string;
  targetStartAt?: string; targetEndAt?: string;
  targetDeliveries?: number; targetFollowUps?: number; targetRevenue?: number;
  targetPercent?: number;
  assignedLeads?: number; deliveredLeads?: number; pendingLeads?: number;
  achievementPercent?: number; commissionEarned?: number; targetMet?: boolean;
  commissionType?: CommissionType; commissionValue?: number;
  active?: boolean; createdAt?: string;
  members?: CohortMember[];
}
export interface CohortMember { userId: string; name?: string; email?: string; roleName?: string; addedAt?: string; }
export interface CohortMemberPerformance extends CohortMember {
  assignedLeads?: number; deliveredLeads?: number; pendingLeads?: number;
  conversionRate?: number;
  deliveries?: number; followUps?: number; revenue?: number;
  deliveredOrders?: number; actualFollowUps?: number; actualRevenue?: number;
}
export interface CohortPerformance {
  cohort?: Cohort;
  actualDeliveries?: number; actualFollowUps?: number; actualRevenue?: number;
  progressPercent?: number; targetMet?: boolean;
  assignedLeads?: number; deliveredLeads?: number; pendingLeads?: number;
  achievementPercent?: number; targetPercent?: number; commissionValue?: number;
  deliveryTargetMet?: boolean; followUpTargetMet?: boolean;
  revenueTargetMet?: boolean; allTargetsMet?: boolean;
  commissionEarned?: number;
  members?: CohortMemberPerformance[];
  memberPerformances?: CohortMemberPerformance[];
  [k: string]: unknown;
}
export const listCohorts = (includeInactive = false) =>
  apiFetch<any>(`/api/cohorts${includeInactive ? "?includeInactive=true" : ""}`).then((d) => (Array.isArray(d) ? d : d.cohorts || []) as Cohort[]);
export const getCohort = (id: string) => apiFetch<any>(`/api/cohorts/${id}`).then((d) => (d.cohort || d) as Cohort);
export const createCohort = (payload: Partial<Cohort>) => apiFetch<any>("/api/cohorts", { method: "POST", json: payload });
export const updateCohortApi = (id: string, payload: Partial<Cohort>) => apiFetch<any>(`/api/cohorts/${id}`, { method: "PUT", json: payload });
export const addCohortMember = (id: string, userId: string) => apiFetch<any>(`/api/cohorts/${id}/members`, { method: "POST", json: { userId } });
export const addCohortMembersBulk = (id: string, userIds: string[]) => apiFetch<any>(`/api/cohorts/${id}/members/bulk`, { method: "POST", json: { userIds } });
export const removeCohortMember = (id: string, userId: string) => apiFetch<any>(`/api/cohorts/${id}/members/${userId}`, { method: "DELETE" });
export const cohortPerformance = (id: string) => apiFetch<any>(`/api/cohorts/${id}/performance`).then((d) => (d.performance || d) as CohortPerformance);

/* ---------------- promoter targets ---------------- */
export type PromoterCommissionType =
  | "FIXED" | "PER_CAMPAIGN" | "PER_ORDER" | "PER_PAID_ORDER"
  | "PERCENT_OF_REVENUE" | "PERCENT_OF_PROFIT" | "NONE";
export interface PromoterTarget {
  id: string; promoterUserId: string; promoterName?: string;
  name: string; description?: string;
  targetStartDate?: string; targetEndDate?: string;
  targetCampaigns?: number; targetReach?: number; targetClicks?: number;
  targetConversions?: number; targetOrders?: number; targetPaidOrders?: number;
  targetRevenue?: number; targetProfit?: number;
  commissionType?: PromoterCommissionType; commissionValue?: number;
  active?: boolean; createdAt?: string;
}
export interface PromoterTargetPerformance {
  target?: PromoterTarget;
  actualCampaigns?: number; actualReach?: number; actualClicks?: number;
  actualConversions?: number; actualOrders?: number; actualPaidOrders?: number;
  actualRevenue?: number; actualProfit?: number;
  targetMet?: boolean; commissionEarned?: number;
  campaigns?: ApiCampaign[]; [k: string]: unknown;
}
export const listPromoterTargets = (includeInactive = false) =>
  apiFetch<any>(`/api/promoter-targets${includeInactive ? "?includeInactive=true" : ""}`).then((d) => (Array.isArray(d) ? d : d.targets || []) as PromoterTarget[]);
export const getPromoterTarget = (id: string) => apiFetch<any>(`/api/promoter-targets/${id}`).then((d) => (d.target || d) as PromoterTarget);
export const promoterTargetPerformance = (id: string) => apiFetch<any>(`/api/promoter-targets/${id}/performance`).then((d) => (d.performance || d) as PromoterTargetPerformance);
export const promoterTargetsForPromoter = (promoterUserId: string) =>
  apiFetch<any>(`/api/promoter-targets/promoter/${promoterUserId}`).then((d) => (Array.isArray(d) ? d : d.targets || []) as PromoterTarget[]);
export const createPromoterTarget = (payload: Partial<PromoterTarget>) => apiFetch<any>("/api/promoter-targets", { method: "POST", json: payload });
export const updatePromoterTarget = (id: string, payload: Partial<PromoterTarget>) => apiFetch<any>(`/api/promoter-targets/${id}`, { method: "PUT", json: payload });

/* ---------------- campaign attribution ---------------- */
export interface AttributionSummary {
  totalAttributedOrders?: number; deliveredAttributedOrders?: number;
  paidAttributedOrders?: number; totalAttributedValue?: number;
  deliveredAttributedRevenue?: number;
  entries?: AttributionEntry[]; [k: string]: unknown;
}
export interface AttributionEntry {
  id: string; orderId?: string; orderCode?: string; customerName?: string;
  campaignId?: string; campaignName?: string; trackingCode?: string;
  promoterUserId?: string; promoterName?: string;
  orderValue?: number; createdCounted?: boolean;
  deliveredCounted?: boolean; paidCounted?: boolean;
  deliveredAt?: string; paidAt?: string; createdAt?: string;
}
export const attributionSummary = () => apiFetch<AttributionSummary>("/api/campaign-attribution/summary");
export const attributionByOrder = (orderId: string) => apiFetch<any>(`/api/campaign-attribution/order/${orderId}`).then((d) => (d.entry || d) as AttributionEntry);
export const attributionByCampaign = (campaignId: string) => apiFetch<any>(`/api/campaign-attribution/campaign/${campaignId}`).then((d) => (Array.isArray(d) ? d : d.entries || []) as AttributionEntry[]);
export const attributionByPromoter = (promoterUserId: string) => apiFetch<any>(`/api/campaign-attribution/promoter/${promoterUserId}`).then((d) => (Array.isArray(d) ? d : d.entries || []) as AttributionEntry[]);
export const attributionByTracking = (trackingCode: string) => apiFetch<any>(`/api/campaign-attribution/tracking/${trackingCode}`).then((d) => (Array.isArray(d) ? d : d.entries || []) as AttributionEntry[]);

/* ---------------- finance ledger ---------------- */
export type LedgerAccountType = "CASH" | "BANK" | "MOBILE_MONEY" | "POS" | "OTHER";
export interface LedgerAccount {
  id: string; name: string; accountType: LedgerAccountType;
  bankName?: string; accountNumber?: string; accountHolderName?: string;
  openingBalance?: number; currentBalance?: number; active?: boolean;
  notes?: string; createdAt?: string;
}
export interface LedgerCategory {
  id: string; name: string; type?: string; description?: string; active?: boolean;
}
export interface LedgerTransaction {
  id: string; accountId?: string; accountName?: string;
  type?: string; transactionType?: string; direction?: string; amount: number;
  categoryId?: string; categoryName?: string;
  expenseCategoryId?: string; expenseCategoryName?: string;
  relatedAgentUserId?: string; relatedAgentName?: string;
  relatedCampaignId?: string; relatedCampaignName?: string;
  relatedOrderId?: string; relatedOrderCode?: string;
  paymentMethod?: string; reference?: string; note?: string;
  createdByName?: string; recordedByName?: string; createdAt?: string;
}
export interface LedgerSummary {
  totalCashBalance?: number; totalBankBalance?: number; totalOtherBalance?: number;
  totalBalance?: number; totalDeposits?: number; totalWithdrawals?: number;
  totalExpenses?: number; agentExpenses?: number; campaignExpenses?: number;
  orderExpenses?: number; generalExpenses?: number;
  ledgerIncome?: number; ledgerProfit?: number; [k: string]: unknown;
}
export const ledgerSummary = () => apiFetch<LedgerSummary>("/api/finance-ledger/summary");
export const ledgerAccounts = (activeOnly = false) =>
  apiFetch<any>(`/api/finance-ledger/accounts${activeOnly ? "?activeOnly=true" : ""}`).then((d) => (Array.isArray(d) ? d : d.accounts || []) as LedgerAccount[]);
export const createLedgerAccount = (payload: Partial<LedgerAccount>) => apiFetch<any>("/api/finance-ledger/accounts", { method: "POST", json: payload });
export const updateLedgerAccount = (id: string, payload: Partial<LedgerAccount>) => apiFetch<any>(`/api/finance-ledger/accounts/${id}`, { method: "PUT", json: payload });
export const ledgerCategories = (activeOnly = false) =>
  apiFetch<any>(`/api/finance-ledger/categories${activeOnly ? "?activeOnly=true" : ""}`).then((d) => (Array.isArray(d) ? d : d.categories || []) as LedgerCategory[]);
export const createLedgerCategory = (payload: Partial<LedgerCategory>) => apiFetch<any>("/api/finance-ledger/categories", { method: "POST", json: payload });
export const ledgerTransactions = () => apiFetch<any>("/api/finance-ledger/transactions").then((d) => (Array.isArray(d) ? d : d.transactions || []) as LedgerTransaction[]);
export const ledgerAccountTransactions = (accountId: string) => apiFetch<any>(`/api/finance-ledger/accounts/${accountId}/transactions`).then((d) => (Array.isArray(d) ? d : d.transactions || []) as LedgerTransaction[]);
export const ledgerAgentExpenses = (agentUserId: string) => apiFetch<any>(`/api/finance-ledger/agents/${agentUserId}/expenses`).then((d) => (Array.isArray(d) ? d : d.transactions || []) as LedgerTransaction[]);
export const ledgerCampaignExpenses = (campaignId: string) => apiFetch<any>(`/api/finance-ledger/campaigns/${campaignId}/expenses`).then((d) => (Array.isArray(d) ? d : d.transactions || []) as LedgerTransaction[]);
export const ledgerDeposit = (payload: { accountId: string; amount: number; paymentMethod?: string; reference?: string; note?: string }) => apiFetch<any>("/api/finance-ledger/deposit", { method: "POST", json: payload });
export const ledgerWithdrawal = (payload: { accountId: string; amount: number; paymentMethod?: string; reference?: string; note?: string }) => apiFetch<any>("/api/finance-ledger/withdrawal", { method: "POST", json: payload });
export const ledgerExpense = (payload: { accountId: string; expenseCategoryId?: string; amount: number; relatedAgentUserId?: string | null; relatedCampaignId?: string | null; relatedOrderId?: string | null; paymentMethod?: string; reference?: string; note?: string }) => apiFetch<any>("/api/finance-ledger/expense", { method: "POST", json: payload });
export const ledgerTransfer = (payload: { fromAccountId: string; toAccountId: string; amount: number; reference?: string; note?: string }) => apiFetch<any>("/api/finance-ledger/transfer", { method: "POST", json: payload });

/* ---------------- profit report ---------------- */
export interface ProfitSummary {
  totalOrders?: number; deliveredOrders?: number; deliveredRevenue?: number;
  inventoryCost?: number; grossProfit?: number;
  agentExpenses?: number; campaignExpenses?: number; orderExpenses?: number; generalExpenses?: number;
  totalExpenses?: number; netProfit?: number; profitMarginPercent?: number;
  campaignRevenue?: number; campaignCost?: number; campaignProfit?: number;
  financeLedgerProfit?: number; [k: string]: unknown;
}
export interface ProfitOrderRow {
  orderId: string; orderCode?: string; customer?: string; packageName?: string;
  revenue?: number; inventoryCost?: number; grossProfit?: number;
  stockDeducted?: boolean; deliveredAt?: string;
}
export interface ProfitAgentRow {
  agentUserId: string; agentName?: string; deliveredOrders?: number;
  revenue?: number; inventoryCost?: number; grossProfit?: number;
  expenses?: number; netProfit?: number;
}
export interface ProfitCampaignRow {
  campaignId: string; campaignName?: string; promoterName?: string; trackingCode?: string;
  reach?: number; clicks?: number; conversions?: number;
  ordersGenerated?: number; paidOrders?: number; revenue?: number;
  campaignCost?: number; ledgerExpenses?: number; trueProfit?: number;
}
function qsRange(from?: string, to?: string) {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const s = q.toString(); return s ? `?${s}` : "";
}
export const profitSummary = (from?: string, to?: string) => apiFetch<ProfitSummary>(`/api/profit-report/summary${qsRange(from, to)}`);
export const profitOrders = (from?: string, to?: string) => apiFetch<any>(`/api/profit-report/orders${qsRange(from, to)}`).then((d) => (Array.isArray(d) ? d : d.orders || []) as ProfitOrderRow[]);
export const profitAgents = (from?: string, to?: string) => apiFetch<any>(`/api/profit-report/agents${qsRange(from, to)}`).then((d) => (Array.isArray(d) ? d : d.agents || []) as ProfitAgentRow[]);
export const profitCampaigns = (from?: string, to?: string) => apiFetch<any>(`/api/profit-report/campaigns${qsRange(from, to)}`).then((d) => (Array.isArray(d) ? d : d.campaigns || []) as ProfitCampaignRow[]);

/* ---------------- campaign extensions ---------------- */
export type ApiCampaignFull = ApiCampaign;
export const campaignsForPromoter = (promoterUserId: string) =>
  apiFetch<any>(`/api/marketing/campaigns/promoter/${promoterUserId}`).then((d) => (Array.isArray(d) ? d : d.campaigns || []) as ApiCampaign[]);

export function campaignShareLink(slug: string | undefined, trackingCode?: string, landingUrl?: string): string {
  const base = (typeof window !== "undefined" ? window.location.origin : "") || "";
  const url = landingUrl && /^https?:\/\//i.test(landingUrl)
    ? landingUrl
    : slug ? `${base}/form/${slug}` : "";
  if (!url) return "";
  if (!trackingCode) return url;
  return url + (url.includes("?") ? "&" : "?") + "trackingCode=" + encodeURIComponent(trackingCode);
}

/* ---------------- public form with tracking ---------------- */
export const apiSubmitPublicOrderTracked = (slug: string, payload: PublicOrderPayload, trackingCode?: string) => {
  const q = trackingCode ? `?trackingCode=${encodeURIComponent(trackingCode)}` : "";
  return apiFetch<any>(`/api/public/forms/${slug}/orders${q}`, { method: "POST", auth: false, json: payload });
};

/* ---------------- order payments (record payment) ---------------- */
export interface RecordPaymentPayload {
  orderId: string;
  amount: number;
  method: string;          // CASH | BANK | POS | MOBILE_MONEY | OTHER
  accountId?: string;      // mapped to ledgerAccountId for the backend
  paidAt?: string;         // mapped to paymentDate for the backend
  reference?: string;
  note?: string;
}

export interface RecordPaymentResult { data: any; ledgerLinked: boolean; }

/**
 * Record a payment. Calls only the real finance payment endpoint:
 * POST /api/finance/payments. If the backend DTO does not accept
 * ledgerAccountId yet, the call is retried once without it and the caller is
 * told that ledger crediting is not connected.
 */
export async function recordOrderPayment(p: RecordPaymentPayload): Promise<RecordPaymentResult> {
  const paidAtIso = p.paidAt
    ? (p.paidAt.includes("T") ? new Date(p.paidAt).toISOString() : new Date(`${p.paidAt}T12:00:00Z`).toISOString())
    : undefined;

  const base: Record<string, unknown> = {
    orderId: p.orderId,
    amount: p.amount,
    method: p.method,
    reference: p.reference,
    status: "CONFIRMED",
    note: p.note,
    paidAt: paidAtIso,
  };
  const withLedger = p.accountId ? { ...base, ledgerAccountId: p.accountId } : base;
  try {
    const data = await apiFetch<any>("/api/finance/payments", { method: "POST", json: withLedger });
    return { data, ledgerLinked: Boolean(p.accountId) };
  } catch (error) {
    const isValidation = error instanceof ApiError && (error.status === 400 || error.status === 422);
    if (p.accountId && isValidation) {
      // Backend DTO may not support ledgerAccountId yet — retry payment-only.
      const data = await apiFetch<any>("/api/finance/payments", { method: "POST", json: base });
      return { data, ledgerLinked: false };
    }
    throw error;
  }
}


/* ---------------- email marketing audience ---------------- */
export interface EmailAudienceRow {
  customerName: string;
  email: string;
  phone?: string;
  state?: string;
  lastPackage?: string;
  lastStatus?: string;
  campaign?: string;
  capturedAt?: string;
  orderId?: string;
  unsubscribed?: boolean;
}
/** Real customer emails. Uses the backend endpoint when present, otherwise derives from real orders. */
export async function emailAudience(): Promise<EmailAudienceRow[]> {
  try {
    const d = await apiFetch<any>("/api/email-marketing/customers");
    const rows = arr<any>(d, "customers", "rows");
    if (rows.length) {
      return rows.map((r) => ({
        customerName: r.customerName || r.name || "—",
        email: r.email || r.customerEmail || "",
        phone: r.phone,
        state: r.state,
        lastPackage: r.lastPackage || r.packageName,
        lastStatus: r.lastStatus || r.status,
        campaign: r.campaign || r.campaignName || r.trackingCode,
        capturedAt: r.capturedAt || r.createdAt,
        orderId: r.orderId,
        unsubscribed: !!r.unsubscribed,
      })).filter((r) => !!r.email);
    }
  } catch { /* fall through to derived audience */ }
  const orders = await listOrders().catch(() => [] as ApiOrder[]);
  const byEmail = new Map<string, EmailAudienceRow>();
  for (const o of orders) {
    const email = (o.customerEmail || "").trim().toLowerCase();
    if (!email) continue;
    const prev = byEmail.get(email);
    const row: EmailAudienceRow = {
      customerName: o.customerName,
      email,
      phone: o.phone,
      state: o.state,
      lastPackage: o.packageName,
      lastStatus: o.deliveryStatus || o.status,
      campaign: o.campaignName || o.trackingCode,
      capturedAt: o.createdAt,
      orderId: o.id,
    };
    if (!prev || (row.capturedAt || "") > (prev.capturedAt || "")) byEmail.set(email, row);
  }
  return [...byEmail.values()].sort((a, b) => (b.capturedAt || "").localeCompare(a.capturedAt || ""));
}

/** Sales-facing label: OUT_FOR_DELIVERY / IN_TRANSIT reads as "Confirmed". */
export function salesStatusLabel(status?: string | null): string {
  const s = (status || "").toUpperCase();
  if (s === "OUT_FOR_DELIVERY" || s === "IN_TRANSIT") return "Confirmed";
  return (status || "—").replace(/_/g, " ");
}

/** Resolve a readable "Product · SKU" label for an order using loaded inventory products. */
export function orderProductLabel(
  o: Partial<ApiOrder> & Record<string, any>,
  products: ApiProduct[] = [],
  packages: ApiPackage[] = [],
): string {
  const byId = new Map(products.map((p) => [p.id, p]));
  let pid = o?.inventoryProductId as string | undefined;
  if (!pid && o?.packageId) {
    pid = packages.find((k) => k.id === o.packageId)?.inventoryProductId;
  }
  if (!pid && o?.packageName) {
    pid = packages.find((k) => k.name === o.packageName)?.inventoryProductId;
  }
  const p = pid ? byId.get(pid) : undefined;
  if (p) return `${p.name}${p.sku ? ` · ${p.sku}` : ""}`;
  if (o?.inventoryProductName) return String(o.inventoryProductName);
  return "—";
}


/** Returns null when the backend endpoint does not exist yet (404/405/501). */
export async function tryFetch<T>(path: string, opts: FetchOpts = {}): Promise<T | null> {
  try {
    return await apiFetch<T>(path, opts);
  } catch (e) {
    if (e instanceof ApiError && [400, 404, 405, 500, 501].includes(e.status)) return null;
    throw e;
  }
}

/** Abandoned carts — real backend only, null means "endpoint not available". */
export async function listAbandonedCarts(): Promise<any[] | null> {
  const d = await tryFetch<any>("/api/abandoned-carts");
  if (d === null) return null;
  return arr<any>(d, "carts", "abandonedCarts", "rows");
}

/** Tracking / pixel settings per sales form. Null = tracking backend not connected. */
export interface TrackingConfig {
  formId: string; pixelId?: string; accessToken?: string;
  pageView?: boolean; lead?: boolean; initiateCheckout?: boolean; purchase?: boolean;
}
export async function getTrackingConfigs(): Promise<TrackingConfig[] | null> {
  const d = await tryFetch<any>("/api/tracking/forms");
  if (d === null) return null;
  return arr<TrackingConfig>(d, "forms", "configs", "rows");
}
export async function saveTrackingConfig(formId: string, payload: Omit<TrackingConfig, "formId">) {
  return tryFetch<any>(`/api/tracking/forms/${formId}`, { method: "PUT", json: payload });
}

/** Broadcast history. Null = endpoint not available yet. */
export interface BroadcastRecord {
  id: string; title?: string; subject?: string; channel?: string;
  sentByName?: string; recipientCount?: number; templateName?: string;
  campaignName?: string; status?: string; createdAt?: string;
}
export async function listBroadcasts(): Promise<BroadcastRecord[] | null> {
  const d = await tryFetch<any>("/api/broadcasts");
  if (d === null) return null;
  return arr<BroadcastRecord>(d, "broadcasts", "rows");
}
export async function createBroadcast(payload: Partial<BroadcastRecord> & { recipients?: string[] }) {
  return tryFetch<any>("/api/broadcasts", { method: "POST", json: payload });
}

/** All treatment/call activity for one order, merged into a single call-log shape. */
export interface MergedCallLog {
  id: string; orderId: string; attempt?: number; outcome?: string;
  note?: string; staffName?: string; createdAt?: string;
}
export async function orderAllCallLogs(orderId: string): Promise<MergedCallLog[]> {
  const [calls, treats] = await Promise.all([
    orderCallLogs(orderId).catch(() => [] as CallLogEntry[]),
    treatmentLogs(orderId).catch(() => [] as TreatmentLog[]),
  ]);
  const a: MergedCallLog[] = (calls || []).map((c: any) => ({
    id: c.id, orderId, attempt: c.attempt, outcome: c.outcome,
    note: c.note, staffName: c.staffName, createdAt: c.createdAt || c.callDate,
  }));
  const b: MergedCallLog[] = (treats || []).map((t: any) => ({
    id: t.id, orderId, attempt: t.attempt ?? t.attemptNumber,
    outcome: t.outcome || t.treatmentOutcome || t.action,
    note: t.note, staffName: t.staffName || t.actorName || t.recordedByName,
    createdAt: t.createdAt,
  }));
  const seen = new Set<string>();
  return [...a, ...b].filter((r) => (r.id && !seen.has(r.id) ? (seen.add(r.id), true) : !r.id));
}

/* ================= generic REST helpers (v2) ================= */
export const apiGet = <T = any>(path: string) => apiFetch<T>(path);
export const apiPost = <T = any>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", json: body ?? {} });
export const apiPut = <T = any>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", json: body ?? {} });
export const apiPatch = <T = any>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", json: body ?? {} });
export const apiDelete = <T = any>(path: string) => apiFetch<T>(path, { method: "DELETE" });

/* ================= role registry (v2) ================= */
export const BACKEND_ROLE_CODES = [
  "OWNER", "ADMIN", "MANAGER", "SALES_MANAGER", "SALES_REP", "CUSTOMER_CARE",
  "MEDIA_BUYER", "MEDIA_PROMOTER", "WHATSAPP_MARKETER", "ACCOUNTANT",
  "INVENTORY_MANAGER", "DELIVERY_AGENT",
] as const;
export type BackendRoleCode = (typeof BACKEND_ROLE_CODES)[number];

export const ROLE_DISPLAY: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES_MANAGER: "Sales Manager",
  SALES_REP: "Sales Agent",
  CUSTOMER_CARE: "Customer Care",
  MEDIA_BUYER: "Media Buyer",
  MEDIA_PROMOTER: "Media Buyer",
  WHATSAPP_MARKETER: "WhatsApp Marketer",
  ACCOUNTANT: "Accountant",
  INVENTORY_MANAGER: "Inventory Manager",
  DELIVERY_AGENT: "Delivery Agent",
};
export function roleLabel(roleName?: string | null): string {
  const r = (roleName || "").toUpperCase();
  return ROLE_DISPLAY[r] || displayRole(roleName);
}

/* ================= dashboard insights ================= */
export interface DashboardInsights {
  bestPerformingState?: string; bestPerformingStateDelivered?: number; bestPerformingStateRevenue?: number;
  bestSalesAgent?: string; bestSalesAgentAssigned?: number; bestSalesAgentDelivered?: number; bestSalesAgentConversionRate?: number;
  bestSalesCohort?: string; bestSalesCohortAssigned?: number; bestSalesCohortDelivered?: number; bestSalesCohortAchievementPercent?: number;
  bestDeliveryAgent?: string; bestDeliveryAgentDelivered?: number; bestDeliveryAgentUnits?: number;
  bestProduct?: string; bestProductUnits?: number; bestProductRevenue?: number;
  topCampaign?: string; topCampaignOrders?: number; topCampaignDelivered?: number; topCampaignRevenue?: number;
  totalAssignedLeads?: number; deliveredLeads?: number; pendingLeads?: number; conversionRate?: number;
  pendingPaymentFromDeliveryAgents?: number; paidRemittance?: number; pendingRemittance?: number;
  lowStockCount?: number; inTransitStockUnits?: number;
  topStates?: any[]; topSalesAgents?: any[]; topCohorts?: any[];
  topDeliveryAgents?: any[]; topProducts?: any[]; campaignSnapshot?: any[];
  [k: string]: unknown;
}
export const getDashboardInsights = () =>
  apiFetch<any>("/api/dashboard/insights").then((d) => (d?.insights || d || {}) as DashboardInsights).catch(() => null);

/* ================= sales manager office ================= */
export interface SalesManagerSummary {
  ordersAssignedToday?: number; deliveredToday?: number; pendingFollowUps?: number;
  failedOrCancelled?: number; conversionRate?: number;
  revenueExpected?: number; revenuePaid?: number; revenuePendingFromDeliveryAgents?: number;
  cohorts?: any[]; agents?: any[]; salesAgents?: any[];
  [k: string]: unknown;
}
export interface SMDailyReport {
  id?: string; reportDate?: string; date?: string; state?: string;
  deliveryAgentId?: string; deliveryAgentName?: string;
  productId?: string; productName?: string;
  orderCode?: string; customerName?: string;
  quantityDelivered?: number; unitPrice?: number; expectedRevenue?: number;
  paymentStatus?: string; amountPaid?: number; amountPending?: number;
  ledgerAccountId?: string; paymentMethod?: string; reference?: string; notes?: string;
  [k: string]: unknown;
}
export interface SMRemittance {
  id?: string; deliveryAgentId?: string; deliveryAgentName?: string;
  periodStart?: string; periodEnd?: string;
  expectedAmount?: number; paidAmount?: number; pendingAmount?: number;
  status?: string; ledgerAccountId?: string; paymentMethod?: string;
  reference?: string; notes?: string;
  [k: string]: unknown;
}
export const salesManagerSummary = () =>
  apiFetch<any>("/api/sales-manager/summary").then((d) => (d?.summary || d || {}) as SalesManagerSummary);
export const listSMDailyReports = () =>
  apiFetch<any>("/api/sales-manager/daily-reports").then((d) => arr<SMDailyReport>(d, "reports", "dailyReports"));
export const createSMDailyReport = (p: SMDailyReport) =>
  apiFetch<any>("/api/sales-manager/daily-reports", { method: "POST", json: p });
export const updateSMDailyReport = (id: string, p: Partial<SMDailyReport>) =>
  apiFetch<any>(`/api/sales-manager/daily-reports/${id}`, { method: "PATCH", json: p });
export const listSMRemittances = () =>
  apiFetch<any>("/api/sales-manager/remittances").then((d) => arr<SMRemittance>(d, "remittances"));
export const createSMRemittance = (p: SMRemittance) =>
  apiFetch<any>("/api/sales-manager/remittances", { method: "POST", json: p });
export const updateSMRemittance = (id: string, p: Partial<SMRemittance>) =>
  apiFetch<any>(`/api/sales-manager/remittances/${id}`, { method: "PATCH", json: p });

/* ================= agent stock allocations (in-transit flow) ================= */
export interface DAAllocation {
  id: string; allocationId?: string;
  deliveryAgentId?: string; deliveryAgentName?: string; agentName?: string;
  agentCode?: string; contactPhone?: string; phone?: string; email?: string;
  productId?: string; productName?: string; productSku?: string; sku?: string;
  quantity?: number; state?: string; location?: string;
  status?: string; sentByName?: string; sentAt?: string; createdAt?: string;
  receivedAt?: string; note?: string;
  [k: string]: unknown;
}
export const listDAAllocations = () =>
  apiFetch<any>("/api/delivery-agents/stock/allocations").then((d) => arr<DAAllocation>(d, "allocations", "rows")).catch(() => [] as DAAllocation[]);
export const listDAAllocationsInTransit = () =>
  apiFetch<any>("/api/delivery-agents/stock/allocations/in-transit").then((d) => arr<DAAllocation>(d, "allocations", "rows")).catch(() => [] as DAAllocation[]);
export interface DACreateAllocationPayload {
  deliveryAgentId: string; productId: string; quantity: number;
  state?: string; location?: string; lowStockThreshold?: number; note?: string;
}
export const createDAAllocation = (p: DACreateAllocationPayload) =>
  apiFetch<any>("/api/delivery-agents/stock/allocations", { method: "POST", json: p });
export const receiveDAAllocation = (allocationId: string, note = "Received by agent") =>
  apiFetch<any>(`/api/delivery-agents/stock/allocations/${allocationId}/receive`, { method: "PATCH", json: { note } });

/* ================= staff admin ================= */
export const updateUserApi = (id: string, payload: Record<string, unknown>) =>
  apiFetch<any>(`/api/users/${id}`, { method: "PUT", json: payload });
export const activateUser = (id: string) => apiFetch<any>(`/api/users/${id}/activate`, { method: "PATCH", json: {} });
export const deactivateUser = (id: string) => apiFetch<any>(`/api/users/${id}/deactivate`, { method: "PATCH", json: {} });
