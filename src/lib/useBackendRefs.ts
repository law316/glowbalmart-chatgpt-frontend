import { useEffect, useState } from "react";
import { apiListUsers, listOrders, listProducts, type BackendUser, type ApiOrder, type ApiProduct } from "@/lib/api";

/** Real staff accounts from the backend (used by Customer Service modules). */
export function useStaff() {
  const [staff, setStaff] = useState<BackendUser[]>([]);
  useEffect(() => { apiListUsers().then(setStaff).catch(() => setStaff([])); }, []);
  const nameOf = (id?: string) => staff.find((u) => u.id === id)?.name || "—";
  return { staff, nameOf };
}

export interface CustomerRef { name: string; phone: string; orderCode: string; orderId: string; packageName: string; }

/** Real customers derived from backend orders (no mock data). */
export function useCustomerRefs() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  useEffect(() => { listOrders().then(setOrders).catch(() => setOrders([])); }, []);
  const customers: CustomerRef[] = orders.map((o) => ({
    name: o.customerName,
    phone: o.phone,
    orderCode: o.code || o.id.slice(0, 8),
    orderId: o.id,
    packageName: o.packageName || "",
  }));
  return { orders, customers };
}

/** Real products from backend inventory. */
export function useProductRefs() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  useEffect(() => { listProducts().then(setProducts).catch(() => setProducts([])); }, []);
  return products;
}
