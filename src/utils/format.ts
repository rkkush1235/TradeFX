// Fix: sanitize every numeric value before display/math to avoid NaN/Infinity leaks.
export const safeNumber = (value: unknown, fallback = 0, maxAbs = 1e12) => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  const bounded = Math.max(-maxAbs, Math.min(maxAbs, num));
  return Number.isFinite(bounded) ? bounded : fallback;
};

export const formatCurrency = (value: unknown, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(safeNumber(value));

// Market prices need more precision than balances: forex quotes to 5 decimals, small coins to 6.
export const formatPrice = (value: unknown) => {
  const num = Math.abs(safeNumber(value));
  const digits = num === 0 ? 2 : num < 0.1 ? 6 : num < 10 ? 5 : num < 1_000 ? 3 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safeNumber(value));
};

// P/L on small positions is often fractions of a cent; show enough digits that it visibly moves.
export const formatPnl = (value: unknown) => {
  const num = safeNumber(value);
  const abs = Math.abs(num);
  const digits = abs === 0 || abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
};

export const formatPercent = (value: unknown) => `${safeNumber(value).toFixed(2)}%`;

export const cn = (...classes: Array<string | undefined | false | null>) =>
  classes.filter(Boolean).join(" ");
