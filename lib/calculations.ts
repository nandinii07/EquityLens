/**
 * Financial metric calculation engine.
 *
 * Pure, deterministic functions that turn raw financial-statement figures
 * into the metrics used throughout the app. No React, no fetching, no
 * mock data — just formulas. Every function returns `null` (never a
 * fabricated or guessed number) when the inputs are missing or when the
 * ratio is not conventionally meaningful (e.g. a P/E off negative
 * earnings).
 *
 * Conventions used below:
 * - Inputs/outputs are plain numbers in a consistent unit (the caller's
 *   choice, e.g. USD billions) — no formatting or unit conversion here.
 * - Percentages/growth rates are returned as fractions (0.08 = 8%), not
 *   multiplied by 100.
 * - Capital expenditures are expected as a positive magnitude (cash
 *   spent), matching how it is normalized elsewhere in this app.
 */

/** Divides safely, returning null instead of Infinity/NaN for a zero or missing denominator. */
function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/**
 * Percentage change from `previous` to `current`.
 *
 * Uses `abs(previous)` as the base rather than `previous` itself so that
 * growth off a negative prior-year figure (e.g. free cash flow improving
 * from -$16.9B to -$14.9B) still produces an intuitively-signed result
 * (negative = worse, positive = better) instead of a sign flip. Returns
 * null when `previous` is zero, since growth off a zero base is undefined.
 */
function growthRate(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

/**
 * Public entry point for `growthRate`, for growth figures that don't have
 * their own named wrapper below (e.g. net income growth). Same formula,
 * same null/zero-base handling as `calculateRevenueGrowth` and
 * `calculateFreeCashFlowGrowth`.
 */
export function calculateGrowthRate(current: number | null, previous: number | null): number | null {
  return growthRate(current, previous);
}

// ---------------------------------------------------------------------------
// 1. Revenue Growth
// ---------------------------------------------------------------------------

/** Year-over-year revenue growth: (current - previous) / |previous|. */
export function calculateRevenueGrowth(
  currentRevenue: number | null,
  previousRevenue: number | null,
): number | null {
  return growthRate(currentRevenue, previousRevenue);
}

// ---------------------------------------------------------------------------
// 2. Revenue CAGR
// ---------------------------------------------------------------------------

/**
 * Compound annual growth rate between two revenue figures `years` apart:
 * (ending / beginning) ^ (1 / years) - 1.
 *
 * Requires a strictly positive beginning value (CAGR is undefined off a
 * zero or negative base) and a non-negative ending value.
 */
export function calculateRevenueCagr(
  beginningRevenue: number | null,
  endingRevenue: number | null,
  years: number,
): number | null {
  if (beginningRevenue === null || endingRevenue === null) return null;
  if (beginningRevenue <= 0 || endingRevenue < 0 || years <= 0) return null;
  const result = Math.pow(endingRevenue / beginningRevenue, 1 / years) - 1;
  return Number.isFinite(result) ? result : null;
}

// ---------------------------------------------------------------------------
// 3. Net Profit Margin
// ---------------------------------------------------------------------------

/** Net income as a share of revenue: netIncome / revenue. */
export function calculateNetProfitMargin(
  netIncome: number | null,
  revenue: number | null,
): number | null {
  return safeDivide(netIncome, revenue);
}

// ---------------------------------------------------------------------------
// 4. Operating Margin
// ---------------------------------------------------------------------------

/** Operating income as a share of revenue: operatingIncome / revenue. */
export function calculateOperatingMargin(
  operatingIncome: number | null,
  revenue: number | null,
): number | null {
  return safeDivide(operatingIncome, revenue);
}

// ---------------------------------------------------------------------------
// 5. Return on Equity
// ---------------------------------------------------------------------------

/**
 * Return on equity: netIncome / shareholderEquity.
 *
 * Requires positive shareholder equity — ROE off zero or negative equity
 * is not a meaningful ratio (the sign/magnitude no longer reflects
 * capital efficiency), so this returns null in that case rather than a
 * misleading number.
 */
export function calculateROE(
  netIncome: number | null,
  shareholderEquity: number | null,
): number | null {
  if (shareholderEquity === null || shareholderEquity <= 0) return null;
  return safeDivide(netIncome, shareholderEquity);
}

// ---------------------------------------------------------------------------
// 6. Price / Earnings
// ---------------------------------------------------------------------------

/**
 * P/E ratio, computed from market capitalization and net income
 * (equivalent to price / EPS when share counts are consistent):
 * marketCap / netIncome.
 *
 * Requires positive net income — a P/E on flat or negative earnings is
 * conventionally reported as N/A rather than a negative or infinite
 * multiple.
 */
export function calculatePE(
  marketCap: number | null,
  netIncome: number | null,
): number | null {
  if (netIncome === null || netIncome <= 0) return null;
  return safeDivide(marketCap, netIncome);
}

// ---------------------------------------------------------------------------
// 7. Price / Sales
// ---------------------------------------------------------------------------

/** P/S ratio: marketCap / revenue. Requires positive revenue. */
export function calculatePS(
  marketCap: number | null,
  revenue: number | null,
): number | null {
  if (revenue === null || revenue <= 0) return null;
  return safeDivide(marketCap, revenue);
}

// ---------------------------------------------------------------------------
// 8. Price / Book
// ---------------------------------------------------------------------------

/**
 * P/B ratio: marketCap / bookValue (total shareholder equity). Requires
 * positive book value, for the same reason as ROE above.
 */
export function calculatePB(
  marketCap: number | null,
  bookValue: number | null,
): number | null {
  if (bookValue === null || bookValue <= 0) return null;
  return safeDivide(marketCap, bookValue);
}

// ---------------------------------------------------------------------------
// 9. Debt-to-Equity
// ---------------------------------------------------------------------------

/**
 * Debt-to-equity: totalDebt / shareholderEquity. Requires positive
 * equity — the ratio's sign becomes misleading once equity is zero or
 * negative.
 */
export function calculateDebtToEquity(
  totalDebt: number | null,
  shareholderEquity: number | null,
): number | null {
  if (shareholderEquity === null || shareholderEquity <= 0) return null;
  return safeDivide(totalDebt, shareholderEquity);
}

// ---------------------------------------------------------------------------
// 10. Debt-to-Assets
// ---------------------------------------------------------------------------

/** Debt-to-assets: totalDebt / totalAssets. */
export function calculateDebtToAssets(
  totalDebt: number | null,
  totalAssets: number | null,
): number | null {
  return safeDivide(totalDebt, totalAssets);
}

// ---------------------------------------------------------------------------
// 11. Net Debt
// ---------------------------------------------------------------------------

/**
 * Net debt: totalDebt - cashAndEquivalents. Not a ratio, so no
 * denominator to guard — a negative result is a valid, meaningful "net
 * cash" position.
 */
export function calculateNetDebt(
  totalDebt: number | null,
  cashAndEquivalents: number | null,
): number | null {
  if (totalDebt === null || cashAndEquivalents === null) return null;
  return totalDebt - cashAndEquivalents;
}

// ---------------------------------------------------------------------------
// 12. Interest Coverage
// ---------------------------------------------------------------------------

/**
 * Interest coverage: operatingIncome (EBIT) / interestExpense.
 *
 * Returns null when interest expense is missing OR zero — a company
 * with no reported interest expense (typically because it carries no
 * debt) has no coverage ratio to compute, not an infinite one.
 */
export function calculateInterestCoverage(
  operatingIncome: number | null,
  interestExpense: number | null,
): number | null {
  return safeDivide(operatingIncome, interestExpense);
}

// ---------------------------------------------------------------------------
// 13. Operating Cash Flow
// ---------------------------------------------------------------------------

/**
 * Operating cash flow is a directly reported statement figure, not
 * derived from other metrics. This accessor exists so every metric in
 * this module — reported or derived — is reached through the same
 * null-safe interface.
 */
export function calculateOperatingCashFlow(
  cashFlowFromOperations: number | null,
): number | null {
  return cashFlowFromOperations;
}

// ---------------------------------------------------------------------------
// 14. Free Cash Flow
// ---------------------------------------------------------------------------

/**
 * Free cash flow: operatingCashFlow - capitalExpenditures.
 * `capitalExpenditures` is expected as a positive magnitude (cash spent).
 */
export function calculateFreeCashFlow(
  operatingCashFlow: number | null,
  capitalExpenditures: number | null,
): number | null {
  if (operatingCashFlow === null || capitalExpenditures === null) return null;
  return operatingCashFlow - capitalExpenditures;
}

// ---------------------------------------------------------------------------
// 15. Free Cash Flow Growth
// ---------------------------------------------------------------------------

/** Year-over-year free cash flow growth: same convention as calculateRevenueGrowth. */
export function calculateFreeCashFlowGrowth(
  currentFcf: number | null,
  previousFcf: number | null,
): number | null {
  return growthRate(currentFcf, previousFcf);
}

// ---------------------------------------------------------------------------
// 16. Operating Cash Flow / Net Income
// ---------------------------------------------------------------------------

/**
 * Cash flow quality ratio: operatingCashFlow / netIncome. A ratio near
 * or above 1.0 indicates earnings are backed by actual cash generation.
 */
export function calculateOcfToNetIncome(
  operatingCashFlow: number | null,
  netIncome: number | null,
): number | null {
  return safeDivide(operatingCashFlow, netIncome);
}
