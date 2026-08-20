/**
 * Display formatting helpers. All financial values in this app are stored
 * in raw units (dollars, or fractions for percentages); components format
 * them at render time so the underlying numbers stay precise and testable.
 */

const NA = "N/A";

/** Formats a dollar figure stored in billions, e.g. 416.2 -> "$416.2B". */
export function formatBillions(value: number | null): string {
  if (value === null || Number.isNaN(value)) return NA;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}T`;
  return `${sign}$${abs.toFixed(1)}B`;
}

/** Formats a plain share price, e.g. 231.5 -> "$231.50". */
export function formatPrice(value: number | null): string {
  if (value === null || Number.isNaN(value)) return NA;
  return `$${value.toFixed(2)}`;
}

/** Formats a fraction as a percentage, e.g. 0.084 -> "8.4%". */
export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return NA;
  return `${(value * 100).toFixed(digits)}%`;
}

/** Formats a plain ratio/multiple, e.g. 31.2 -> "31.2x". */
export function formatRatio(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return NA;
  return `${value.toFixed(digits)}x`;
}

/** Formats a decimal ratio without a unit, e.g. 0.42 -> "0.42". */
export function formatDecimal(value: number | null, digits = 2): string {
  if (value === null || Number.isNaN(value)) return NA;
  return value.toFixed(digits);
}

export function formatDate(iso: string | null): string {
  if (!iso) return NA;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** true if value is present and >= 0, used to color trend arrows. */
export function isPositive(value: number | null): boolean | null {
  if (value === null || Number.isNaN(value)) return null;
  return value >= 0;
}
