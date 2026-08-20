import type { RatingLabel } from "@/types/scoring";

/**
 * Screener row shape + pure filter/sort/preset logic.
 *
 * Deliberately framework-agnostic and free of "server-only"/fetch/fs: this
 * file is imported by the server-side snapshot reader (lib/screener-snapshot.ts),
 * the ingestion script (lib/screener-ingest.ts), AND the client-side table
 * component (components/screener/ScreenerClient.tsx) — the exact same
 * predicate/sort/preset code runs wherever it's used, so there is never a
 * second definition of what "High Growth" or "Low Leverage" means.
 *
 * Every field here is a straight projection of the existing, already-computed
 * CompanyAnalysis (financialData + score from lib/scoring.ts /
 * lib/sec-financial-api.ts) — nothing in this file recomputes a ratio or a
 * score. See lib/screener-ingest.ts's `toScreenerRow` for the projection.
 */

export interface ScreenerCompanyRow {
  ticker: string;
  companyName: string;
  sector: string;
  score: number;
  rating: RatingLabel;
  /** Most recent YoY revenue growth, as a fraction (0.08 = 8%). Null if not computable. */
  revenueGrowth: number | null;
  /** Most recent net profit margin, as a fraction. Null if not computable. */
  netMargin: number | null;
  /** Most recent return on equity, as a fraction. Null if not computable. */
  roe: number | null;
  /** Most recent debt-to-equity ratio. Null if not computable. */
  debtToEquity: number | null;
  /** Most recent free cash flow, in USD billions. Null if not computable. */
  freeCashFlow: number | null;
  /** Most recent YoY free cash flow growth, as a fraction. Null if not computable. */
  fcfGrowth: number | null;
  /** ISO date the underlying financial statements were last refreshed (FinancialData.profile.lastUpdated). */
  dataDate: string;
}

export type SortField =
  | "score"
  | "revenueGrowth"
  | "netMargin"
  | "roe"
  | "debtToEquity"
  | "freeCashFlow"
  | "fcfGrowth";

export type SortDirection = "asc" | "desc";

export interface ScreenerFilters {
  query: string;
  minScore: number | null;
  minRevenueGrowth: number | null;
  minNetMargin: number | null;
  minRoe: number | null;
  maxDebtToEquity: number | null;
  minFreeCashFlow: number | null;
  minFcfGrowth: number | null;
}

export const EMPTY_FILTERS: ScreenerFilters = {
  query: "",
  minScore: null,
  minRevenueGrowth: null,
  minNetMargin: null,
  minRoe: null,
  maxDebtToEquity: null,
  minFreeCashFlow: null,
  minFcfGrowth: null,
};

/**
 * Matches a search query against ticker or company name, case-insensitively.
 * A row with no query never gets excluded.
 */
function matchesQuery(row: ScreenerCompanyRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return row.ticker.toLowerCase().includes(q) || row.companyName.toLowerCase().includes(q);
}

/**
 * A `null` metric (not reported / not computable — the existing "never
 * fabricate" policy from lib/calculations.ts and lib/scoring.ts) never
 * satisfies a numeric threshold filter. It also never satisfies a
 * `max`-style filter, since we cannot know whether it would have passed —
 * excluding is the honest choice, not silently including it as if it
 * passed.
 */
function meetsMin(value: number | null, min: number | null): boolean {
  if (min === null) return true;
  if (value === null) return false;
  return value >= min;
}

function meetsMax(value: number | null, max: number | null): boolean {
  if (max === null) return true;
  if (value === null) return false;
  return value <= max;
}

export function applyFilters(rows: ScreenerCompanyRow[], filters: ScreenerFilters): ScreenerCompanyRow[] {
  return rows.filter(
    (row) =>
      matchesQuery(row, filters.query) &&
      meetsMin(row.score, filters.minScore) &&
      meetsMin(row.revenueGrowth, filters.minRevenueGrowth) &&
      meetsMin(row.netMargin, filters.minNetMargin) &&
      meetsMin(row.roe, filters.minRoe) &&
      meetsMax(row.debtToEquity, filters.maxDebtToEquity) &&
      meetsMin(row.freeCashFlow, filters.minFreeCashFlow) &&
      meetsMin(row.fcfGrowth, filters.minFcfGrowth),
  );
}

/**
 * Sorts by the chosen field, always pushing rows with a `null` value for
 * that field to the bottom regardless of direction — a missing metric is
 * never treated as better or worse than a real (including negative) value,
 * it's simply unranked on that dimension.
 */
export function sortRows(rows: ScreenerCompanyRow[], field: SortField, direction: SortDirection): ScreenerCompanyRow[] {
  const withValue: ScreenerCompanyRow[] = [];
  const withoutValue: ScreenerCompanyRow[] = [];
  for (const row of rows) {
    (row[field] === null ? withoutValue : withValue).push(row);
  }
  withValue.sort((a, b) => {
    const diff = (a[field] as number) - (b[field] as number);
    return direction === "asc" ? diff : -diff;
  });
  return [...withValue, ...withoutValue];
}

export interface ScreenerPreset {
  id: string;
  label: string;
  description: string;
  filters: Partial<ScreenerFilters>;
}

/**
 * Named filter combinations shown as one-click buttons in the UI. Each is
 * just a preset value for the same `ScreenerFilters` shape the manual
 * filter controls use — not a separate scoring or ranking system.
 */
export const SCREENER_PRESETS: ScreenerPreset[] = [
  {
    id: "strong-fundamentals",
    label: "Strong Fundamentals",
    description: "Investment Score of 75+",
    filters: { minScore: 75 },
  },
  {
    id: "high-growth",
    label: "High Growth",
    description: "Revenue growth of 15%+ year-over-year",
    filters: { minRevenueGrowth: 0.15 },
  },
  {
    id: "high-profitability",
    label: "High Profitability",
    description: "Net margin of 15%+ and ROE of 15%+",
    filters: { minNetMargin: 0.15, minRoe: 0.15 },
  },
  {
    id: "low-leverage",
    label: "Low Leverage",
    description: "Debt-to-equity of 0.5 or below",
    filters: { maxDebtToEquity: 0.5 },
  },
  {
    id: "strong-cash-flow",
    label: "Strong Cash Flow",
    description: "Positive free cash flow with 10%+ growth",
    filters: { minFreeCashFlow: 0, minFcfGrowth: 0.1 },
  },
];

export function applyPreset(preset: ScreenerPreset): ScreenerFilters {
  return { ...EMPTY_FILTERS, ...preset.filters };
}
