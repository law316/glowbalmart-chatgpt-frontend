export const NGN = (n: number) =>
  "₦" + (n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });

export const fmtDate = (s?: string) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
};

export const fmtDateTime = (s?: string) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("en-NG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
export const uid = (prefix = "id") =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
