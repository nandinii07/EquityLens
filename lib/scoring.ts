/**
 * Deterministic investment scoring engine.
 *
 * Turns an already-normalized `FinancialData` object (the output of the
 * calculation layer, lib/calculations.ts) into a 100-point `InvestmentScore`
 * — five categories, 20 points each. There is no LLM in this file and no
 * randomness: the same input always produces the same output, and every
 * point awarded traces back to an explicit threshold table below. The AI
 * (Stage 5) only ever explains this score after the fact; it cannot see
 * or influence the numbers.
 *
 * Missing-data policy: a metric that is `null` (not reported, or not
 * computable — see lib/calculations.ts) is excluded from its category
 * rather than fabricated or defaulted to zero. The category is then
 * rescaled to /20 across whichever metrics *were* available. If every
 * metric in a category is unavailable, that category scores 0/20 with an
 * explicit "insufficient data" rationale — it is never left as NaN or
 * silently dropped from the total.
 *
 * This is a general-purpose, first-level fundamental model. The
 * thresholds below are calibrated for large, established public
 * companies and are not sector-tuned — a capital-intensive utility, an
 * early-stage biotech, and a bank carry different "normal" ranges for
 * leverage, margins, and valuation than the mega-cap technology
 * companies in the current mock data set. Sector-specific threshold
 * tables are a natural future extension (see the module-level TODO at
 * the bottom of this file) and are out of scope for this stage. Two
 * known distortions worth flagging explicitly: (1) heavy share
 * buybacks can shrink a company's book equity toward zero, inflating
 * ROE and P/B into figures that look extreme without reflecting
 * distress — Apple's mock data is a real example of this; (2) valuation
 * here is judged in isolation, not growth-adjusted (no PEG-style
 * blending with the Revenue Growth category) — see the Valuation
 * section below for how that's partially mitigated.
 */

import type {
  CashFlowMetrics,
  DebtMetrics,
  FinancialData,
  ProfitabilityMetrics,
  RevenueMetrics,
  ValuationMetrics,
  YearValue,
} from "@/types/financial";
import type { CategoryScore, InvestmentScore } from "@/types/scoring";
import { getRatingFromScore } from "@/lib/rating";
import { formatDecimal, formatPercent, formatRatio } from "@/lib/format";

// ---------------------------------------------------------------------------
// Shared tier-scoring helpers
// ---------------------------------------------------------------------------

interface Tier {
  points: number;
}

/** For metrics where a higher value is better (growth, margins, coverage). */
interface MinTier extends Tier {
  min: number;
}

/** For metrics where a lower value is better (P/E, leverage ratios). */
interface MaxTier extends Tier {
  max: number;
}

/** Tiers must be sorted highest-`min`-first; the first satisfied tier wins. */
function scoreHigherIsBetter(value: number, tiers: MinTier[]): number {
  for (const tier of tiers) {
    if (value >= tier.min) return tier.points;
  }
  return 0;
}

/** Tiers must be sorted lowest-`max`-first; the first satisfied tier wins. */
function scoreLowerIsBetter(value: number, tiers: MaxTier[]): number {
  for (const tier of tiers) {
    if (value <= tier.max) return tier.points;
  }
  return 0;
}

/** One metric's contribution to a category: its point value, or null if unavailable. */
interface ScoredMetric {
  points: number | null;
  max: number;
}

/**
 * Rescales earned points to a /20 category score across only the metrics
 * that were actually available, so a company isn't penalized for a data
 * gap. Returns 0 (never NaN) if nothing in the category was available.
 */
function combineCategory(metrics: ScoredMetric[]): number {
  const available = metrics.filter(
    (m): m is { points: number; max: number } => m.points !== null,
  );
  const maxAvailable = available.reduce((sum, m) => sum + m.max, 0);
  if (maxAvailable === 0) return 0;

  const earned = available.reduce((sum, m) => sum + m.points, 0);
  const scaled = (earned / maxAvailable) * 20;
  return clamp(Math.round(scaled), 0, 20);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Qualitative word for how much of a metric's own max it earned — used in rationale text. */
function tierWord(points: number, max: number): string {
  const fraction = max > 0 ? points / max : 0;
  if (fraction >= 0.9) return "excellent";
  if (fraction >= 0.7) return "strong";
  if (fraction >= 0.45) return "moderate";
  if (fraction >= 0.2) return "weak";
  return "poor";
}

function latestValue(history: YearValue[]): number | null {
  if (history.length === 0) return null;
  return history[history.length - 1].value;
}

const INSUFFICIENT_DATA_RATIONALE =
  "Insufficient data was available to evaluate this category.";

// ---------------------------------------------------------------------------
// 1. Revenue Growth (20 pts) — YoY growth (12 pts) + 3yr CAGR (8 pts)
// ---------------------------------------------------------------------------

const YOY_GROWTH_TIERS: MinTier[] = [
  { min: 0.2, points: 12 },
  { min: 0.1, points: 9 },
  { min: 0.05, points: 6 },
  { min: 0, points: 3 },
];

const CAGR_TIERS: MinTier[] = [
  { min: 0.15, points: 8 },
  { min: 0.08, points: 6 },
  { min: 0.03, points: 4 },
  { min: 0, points: 2 },
];

function scoreRevenueGrowth(revenue: RevenueMetrics): CategoryScore {
  const yoyPoints =
    revenue.yoyGrowth === null ? null : scoreHigherIsBetter(revenue.yoyGrowth, YOY_GROWTH_TIERS);
  const cagrPoints =
    revenue.cagr3yr === null ? null : scoreHigherIsBetter(revenue.cagr3yr, CAGR_TIERS);

  const score = combineCategory([
    { points: yoyPoints, max: 12 },
    { points: cagrPoints, max: 8 },
  ]);

  const parts: string[] = [];
  if (yoyPoints !== null) {
    parts.push(
      `revenue grew ${formatPercent(revenue.yoyGrowth)} year-over-year (${tierWord(yoyPoints, 12)})`,
    );
  }
  if (cagrPoints !== null) {
    parts.push(`the 3-year CAGR is ${formatPercent(revenue.cagr3yr)} (${tierWord(cagrPoints, 8)})`);
  }

  return {
    category: "Revenue Growth",
    score,
    maxScore: 20,
    rationale: parts.length ? capitalize(parts.join(", and ")) + "." : INSUFFICIENT_DATA_RATIONALE,
  };
}

// ---------------------------------------------------------------------------
// 2. Profitability (20 pts) — net margin (6) + operating margin (5) + ROE (6)
//    + net income growth (3)
// ---------------------------------------------------------------------------

const NET_MARGIN_TIERS: MinTier[] = [
  { min: 0.25, points: 6 },
  { min: 0.15, points: 5 },
  { min: 0.08, points: 3 },
  { min: 0, points: 1 },
];

const OPERATING_MARGIN_TIERS: MinTier[] = [
  { min: 0.3, points: 5 },
  { min: 0.18, points: 4 },
  { min: 0.1, points: 2 },
  { min: 0, points: 1 },
];

const ROE_TIERS: MinTier[] = [
  { min: 0.3, points: 6 },
  { min: 0.18, points: 5 },
  { min: 0.1, points: 3 },
  { min: 0, points: 1 },
];

const NET_INCOME_GROWTH_TIERS: MinTier[] = [
  { min: 0.15, points: 3 },
  { min: 0.05, points: 2 },
  { min: 0, points: 1 },
];

function scoreProfitability(profitability: ProfitabilityMetrics): CategoryScore {
  const netMarginPoints =
    profitability.netMargin === null ? null : scoreHigherIsBetter(profitability.netMargin, NET_MARGIN_TIERS);
  const opMarginPoints =
    profitability.operatingMargin === null
      ? null
      : scoreHigherIsBetter(profitability.operatingMargin, OPERATING_MARGIN_TIERS);
  const roePoints = profitability.roe === null ? null : scoreHigherIsBetter(profitability.roe, ROE_TIERS);
  const growthPoints =
    profitability.netIncomeGrowth === null
      ? null
      : scoreHigherIsBetter(profitability.netIncomeGrowth, NET_INCOME_GROWTH_TIERS);

  const score = combineCategory([
    { points: netMarginPoints, max: 6 },
    { points: opMarginPoints, max: 5 },
    { points: roePoints, max: 6 },
    { points: growthPoints, max: 3 },
  ]);

  const parts: string[] = [];
  if (netMarginPoints !== null) {
    parts.push(`net margin is ${tierWord(netMarginPoints, 6)} at ${formatPercent(profitability.netMargin)}`);
  }
  if (roePoints !== null) {
    parts.push(`ROE is ${tierWord(roePoints, 6)} at ${formatPercent(profitability.roe)}`);
  }
  if (growthPoints !== null) {
    parts.push(`net income growth is ${formatPercent(profitability.netIncomeGrowth)}`);
  }

  return {
    category: "Profitability",
    score,
    maxScore: 20,
    rationale: parts.length ? capitalize(parts.join("; ")) + "." : INSUFFICIENT_DATA_RATIONALE,
  };
}

// ---------------------------------------------------------------------------
// 3. Valuation (20 pts) — P/E (8) + P/S (5) + P/B (4) + EV/EBITDA (3)
//
// A high multiple is not automatically scored as "bad": every ratio uses a
// graduated ladder of tiers instead of one pass/fail cutoff. P/E in
// particular never drops to an absolute zero on its own — an elevated
// multiple funded by genuinely exceptional growth is a normal market
// outcome, and that growth is already judged on its own merits in the
// Revenue Growth category, so this file avoids double-punishing it here.
// P/S, P/B, and EV/EBITDA *can* reach zero, since each is an independent
// read on how richly the business is priced regardless of growth.
// ---------------------------------------------------------------------------

const PE_TIERS: MaxTier[] = [
  { max: 15, points: 8 },
  { max: 25, points: 6 },
  { max: 35, points: 4 },
  { max: 50, points: 2 },
  { max: Infinity, points: 1 },
];

const PS_TIERS: MaxTier[] = [
  { max: 2, points: 5 },
  { max: 4, points: 4 },
  { max: 7, points: 3 },
  { max: 12, points: 2 },
  { max: Infinity, points: 1 },
];

const PB_TIERS: MaxTier[] = [
  { max: 3, points: 4 },
  { max: 6, points: 3 },
  { max: 10, points: 2 },
  { max: 20, points: 1 },
  { max: Infinity, points: 0 },
];

const EV_EBITDA_TIERS: MaxTier[] = [
  { max: 10, points: 3 },
  { max: 15, points: 2 },
  { max: 25, points: 1 },
  { max: Infinity, points: 0 },
];

function scoreValuation(valuation: ValuationMetrics): CategoryScore {
  const pePoints = valuation.pe === null ? null : scoreLowerIsBetter(valuation.pe, PE_TIERS);
  const psPoints = valuation.ps === null ? null : scoreLowerIsBetter(valuation.ps, PS_TIERS);
  const pbPoints = valuation.pb === null ? null : scoreLowerIsBetter(valuation.pb, PB_TIERS);
  const evEbitdaPoints =
    valuation.evToEbitda === null ? null : scoreLowerIsBetter(valuation.evToEbitda, EV_EBITDA_TIERS);

  const score = combineCategory([
    { points: pePoints, max: 8 },
    { points: psPoints, max: 5 },
    { points: pbPoints, max: 4 },
    { points: evEbitdaPoints, max: 3 },
  ]);

  const parts: string[] = [];
  if (pePoints !== null) {
    parts.push(`P/E of ${formatRatio(valuation.pe)} is ${tierWord(pePoints, 8)}`);
  }
  if (psPoints !== null) {
    parts.push(`P/S of ${formatRatio(valuation.ps)} is ${tierWord(psPoints, 5)}`);
  }
  if (pbPoints !== null) {
    parts.push(`P/B of ${formatRatio(valuation.pb)} is ${tierWord(pbPoints, 4)}`);
  }

  return {
    category: "Valuation",
    score,
    maxScore: 20,
    rationale: parts.length ? capitalize(parts.join("; ")) + "." : INSUFFICIENT_DATA_RATIONALE,
  };
}

// ---------------------------------------------------------------------------
// 4. Debt (20 pts) — D/E (8) + D/A (5) + net debt sign (3) + interest coverage (4)
//
// Net debt is scored as a simple sign check (net cash vs. net debtor)
// rather than against a dollar-amount threshold, since an absolute
// dollar figure isn't comparable across companies of very different size.
// A magnitude-aware version (e.g. net debt / EBITDA) is a natural future
// upgrade once EBITDA is tracked as its own field.
// ---------------------------------------------------------------------------

const DEBT_TO_EQUITY_TIERS: MaxTier[] = [
  { max: 0.3, points: 8 },
  { max: 0.6, points: 6 },
  { max: 1.0, points: 4 },
  { max: 2.0, points: 2 },
  { max: Infinity, points: 0 },
];

const DEBT_TO_ASSETS_TIERS: MaxTier[] = [
  { max: 0.15, points: 5 },
  { max: 0.3, points: 4 },
  { max: 0.45, points: 2 },
  { max: 0.6, points: 1 },
  { max: Infinity, points: 0 },
];

const INTEREST_COVERAGE_TIERS: MinTier[] = [
  { min: 15, points: 4 },
  { min: 8, points: 3 },
  { min: 4, points: 2 },
  { min: 1.5, points: 1 },
];

function scoreNetDebt(netDebt: number): number {
  if (netDebt < 0) return 3; // net cash position
  if (netDebt === 0) return 2; // debt exactly offset by cash
  return 1; // net debtor — not automatically penalized to zero; see module doc
}

function scoreDebt(debt: DebtMetrics): CategoryScore {
  const dePoints = debt.debtToEquity === null ? null : scoreLowerIsBetter(debt.debtToEquity, DEBT_TO_EQUITY_TIERS);
  const daPoints = debt.debtToAssets === null ? null : scoreLowerIsBetter(debt.debtToAssets, DEBT_TO_ASSETS_TIERS);
  const netDebtPoints = debt.netDebt === null ? null : scoreNetDebt(debt.netDebt);
  const coveragePoints =
    debt.interestCoverage === null ? null : scoreHigherIsBetter(debt.interestCoverage, INTEREST_COVERAGE_TIERS);

  const score = combineCategory([
    { points: dePoints, max: 8 },
    { points: daPoints, max: 5 },
    { points: netDebtPoints, max: 3 },
    { points: coveragePoints, max: 4 },
  ]);

  const parts: string[] = [];
  if (dePoints !== null) {
    parts.push(`debt-to-equity of ${formatDecimal(debt.debtToEquity)} is ${tierWord(dePoints, 8)}`);
  }
  if (netDebtPoints !== null && debt.netDebt !== null) {
    parts.push(debt.netDebt < 0 ? "the company holds a net cash position" : "the company carries net debt");
  }
  if (coveragePoints !== null) {
    parts.push(`interest is covered ${formatRatio(debt.interestCoverage)} by operating income`);
  }

  return {
    category: "Debt",
    score,
    maxScore: 20,
    rationale: parts.length ? capitalize(parts.join("; ")) + "." : INSUFFICIENT_DATA_RATIONALE,
  };
}

// ---------------------------------------------------------------------------
// 5. Cash Flow (20 pts) — OCF margin (4) + FCF margin (6) + FCF growth (6)
//    + OCF/Net Income quality (4)
//
// OCF and FCF are scored relative to revenue (margins) rather than as raw
// dollar figures, so companies of different sizes are compared fairly.
// ---------------------------------------------------------------------------

const OCF_MARGIN_TIERS: MinTier[] = [
  { min: 0.3, points: 4 },
  { min: 0.15, points: 3 },
  { min: 0.05, points: 2 },
  { min: 0, points: 1 },
];

const FCF_MARGIN_TIERS: MinTier[] = [
  { min: 0.2, points: 6 },
  { min: 0.1, points: 4 },
  { min: 0.03, points: 2 },
  { min: 0, points: 1 },
];

const FCF_GROWTH_TIERS: MinTier[] = [
  { min: 0.15, points: 6 },
  { min: 0.05, points: 4 },
  { min: 0, points: 2 },
];

/**
 * OCF/Net Income "quality of earnings" score. Positive cash flow against
 * a reported net loss (common for capital-intensive, high-depreciation
 * businesses) is treated as a strength, not a penalty — the raw ratio's
 * sign alone would otherwise misread that case as badly negative.
 */
function scoreOcfQuality(operatingCashFlow: number, netIncome: number): number {
  if (netIncome <= 0) return operatingCashFlow > 0 ? 4 : 0;
  const ratio = operatingCashFlow / netIncome;
  if (ratio >= 1.1) return 4;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.6) return 2;
  if (ratio >= 0) return 1;
  return 0;
}

function scoreCashFlow(data: FinancialData): CategoryScore {
  const { cashFlow, revenue, profitability }: { cashFlow: CashFlowMetrics; revenue: RevenueMetrics; profitability: ProfitabilityMetrics } = data;
  const latestRevenue = latestValue(revenue.history);
  const latestNetIncome = latestValue(profitability.netIncomeHistory);

  const ocfMargin =
    cashFlow.operatingCashFlow !== null && latestRevenue !== null && latestRevenue > 0
      ? cashFlow.operatingCashFlow / latestRevenue
      : null;
  const fcfMargin =
    cashFlow.freeCashFlow !== null && latestRevenue !== null && latestRevenue > 0
      ? cashFlow.freeCashFlow / latestRevenue
      : null;

  const ocfPoints = ocfMargin === null ? null : scoreHigherIsBetter(ocfMargin, OCF_MARGIN_TIERS);
  const fcfPoints = fcfMargin === null ? null : scoreHigherIsBetter(fcfMargin, FCF_MARGIN_TIERS);
  const fcfGrowthPoints =
    cashFlow.fcfGrowth === null ? null : scoreHigherIsBetter(cashFlow.fcfGrowth, FCF_GROWTH_TIERS);
  const qualityPoints =
    cashFlow.operatingCashFlow !== null && latestNetIncome !== null
      ? scoreOcfQuality(cashFlow.operatingCashFlow, latestNetIncome)
      : null;

  const score = combineCategory([
    { points: ocfPoints, max: 4 },
    { points: fcfPoints, max: 6 },
    { points: fcfGrowthPoints, max: 6 },
    { points: qualityPoints, max: 4 },
  ]);

  const parts: string[] = [];
  if (fcfPoints !== null && cashFlow.freeCashFlow !== null) {
    parts.push(
      cashFlow.freeCashFlow >= 0
        ? `free cash flow is positive at ${formatPercent(fcfMargin)} of revenue`
        : "free cash flow is negative",
    );
  }
  if (fcfGrowthPoints !== null) {
    parts.push(`FCF growth is ${formatPercent(cashFlow.fcfGrowth)} year-over-year`);
  }
  if (qualityPoints !== null) {
    parts.push(
      qualityPoints >= 3
        ? "cash generation comfortably backs reported earnings"
        : "cash generation is a weaker match for reported earnings",
    );
  }

  return {
    category: "Cash Flow",
    score,
    maxScore: 20,
    rationale: parts.length ? capitalize(parts.join("; ")) + "." : INSUFFICIENT_DATA_RATIONALE,
  };
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Computes the full 100-point deterministic investment score for a
 * company from its normalized financial data. Pure function: same input,
 * same output, no network calls, no AI.
 */
export function calculateInvestmentScore(data: FinancialData): InvestmentScore {
  const breakdown: CategoryScore[] = [
    scoreRevenueGrowth(data.revenue),
    scoreProfitability(data.profitability),
    scoreValuation(data.valuation),
    scoreDebt(data.debt),
    scoreCashFlow(data),
  ];

  // Each category score is already clamped to [0, 20] by combineCategory,
  // so this sum is always within [0, 100] — the extra clamp below is
  // cheap, defensive documentation of that guarantee rather than a fix
  // for a case that can currently occur.
  const overall = clamp(
    breakdown.reduce((sum, category) => sum + category.score, 0),
    0,
    100,
  );

  return {
    overall,
    maxScore: 100,
    rating: getRatingFromScore(overall),
    breakdown,
  };
}

// TODO (future stage): sector-specific threshold tables. The tiers above
// are tuned for large, established public companies; a REIT, a bank, or
// a pre-revenue biotech would need different "normal" ranges for
// leverage, margins, and valuation to be scored fairly.
