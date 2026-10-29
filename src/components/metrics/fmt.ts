export const fmtNum = (n: number | null | undefined) => (n == null ? "–" : Math.round(n).toLocaleString("en-US"));
export const fmtMoney = (n: number | null | undefined, currency = "USD") =>
  n == null ? "–" : n.toLocaleString("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: n < 100 ? 2 : 0 });
export const fmtPct = (n: number | null | undefined, digits = 1) => (n == null ? "–" : `${n.toFixed(digits)}%`);
export const RANGES = [7, 30, 90] as const;
export const parseDays = (v: string | undefined) => (RANGES.some((r) => String(r) === v) ? Number(v) : 30);
