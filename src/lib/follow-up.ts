import type { Order } from "./types";
import { today } from "./format";

export interface QueueItem {
  order: Order;
  priority: number; // higher = more urgent
  label: string;
  badgeClass: string;
  attemptLabel: string;
}

const ACTIVE_STATUSES: Order["status"][] = [
  "new", "assigned", "first_call_due", "second_call_due", "third_call_due",
  "on_hold", "not_reached", "callback_later",
];

export function buildCallQueue(orders: Order[], staffId?: string): QueueItem[] {
  const t = today();
  return orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .filter((o) => !staffId || o.assignedTo === staffId)
    .filter((o) => !o.nextFollowUp || o.nextFollowUp <= t)
    .map((o) => {
      const max = 3;
      const att = o.callAttempts;
      let priority = 0;
      let label = "New First Call";
      let badgeClass = "bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30";
      if (att >= 2) {
        priority = 100; label = "High Priority — Final Call";
        badgeClass = "bg-red-500/15 text-red-600 dark:text-red-300 border border-red-500/30";
      } else if (att === 1) {
        priority = 80; label = "Priority — Second Call";
        badgeClass = "bg-orange-500/15 text-orange-600 dark:text-orange-300 border border-orange-500/30";
      } else if (o.status === "on_hold") {
        priority = 20; label = "On Hold";
        badgeClass = "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30";
      } else if (att === 0) {
        priority = o.nextFollowUp && o.nextFollowUp < t ? 60 : 40;
      }
      return {
        order: o,
        priority,
        label,
        badgeClass,
        attemptLabel: `Attempt ${att + 1} of ${max}`,
      };
    })
    .sort((a, b) => b.priority - a.priority || a.order.createdAt.localeCompare(b.order.createdAt));
}
