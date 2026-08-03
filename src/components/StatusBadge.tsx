import type { OrderStatus, PaymentStatus, DeliveryStatus } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  new: "New", assigned: "Assigned",
  first_call_due: "First Call Due", second_call_due: "Second Call Due", third_call_due: "Third Call Due",
  deal_successful: "Deal Successful", on_hold: "On Hold", not_reached: "Not Reached",
  callback_later: "Callback Later", wrong_number: "Wrong Number",
  cancelled: "Cancelled", duplicate: "Duplicate", closed_max: "Closed — Max Follow-up",
  unpaid: "Unpaid", pending: "Pending", paid: "Paid", part: "Part Payment", refunded: "Refunded",
  not_dispatched: "Not Dispatched", processing: "Processing", dispatched: "Dispatched",
  in_transit: "In Transit", delivered: "Delivered", returned: "Returned", failed: "Failed",
};

const COLOR: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30",
  assigned: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30",
  first_call_due: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30",
  second_call_due: "bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-500/30",
  third_call_due: "bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30",
  deal_successful: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  on_hold: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  not_reached: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  callback_later: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  wrong_number: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  cancelled: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  duplicate: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  closed_max: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  unpaid: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  part: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  refunded: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  dispatched: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  in_transit: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  processing: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  not_dispatched: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  returned: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  failed: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

export function StatusBadge({ status }: { status: OrderStatus | PaymentStatus | DeliveryStatus | string }) {
  const cls = COLOR[status] || "bg-zinc-500/10 text-zinc-700 border-zinc-500/30";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function AttemptRing({ attempt, max = 3, size = 36 }: { attempt: number; max?: number; size?: number }) {
  const pct = Math.min(attempt / max, 1);
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const color = attempt >= 3 ? "var(--destructive)" : attempt === 2 ? "oklch(0.65 0.18 60)" : "var(--electric)";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="oklch(0.85 0.02 250 / 0.3)" strokeWidth="3" fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth="3" fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[10px] font-bold">{attempt}/{max}</span>
    </div>
  );
}
