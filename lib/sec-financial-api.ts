import "server-only";

import type { FinancialData, YearValue } from "@/types/financial";
import type { CompanyAnalysis } from "@/types/scoring";
import {
  calculateDebtToAssets,
  calculateDebtToEquity,
  calculateFreeCashFlow,
  calculateFreeCashFlowGrowth,
  calculateGrowthRate,
  calculateInterestCoverage,
  calculateNetDebt,
  calculateNetProfitMargin,
  calculateOcfToNetIncome,
  calculateOperatingCashFlow,
  calculateOperatingMargin,
  calculatePB,
  calculatePE,
  calculatePS,
  calculateROE,
  calculateRevenueCagr,
  calculateRevenueGrowth,
} from "@/lib/calculations";
import { calculateInvestmentScore } from "@/lib/scoring";
import { generateInsights } from "@/lib/insights";
import { isValidTickerFormat } from "@/lib/ticker";
import { resolveTicker } from "@/lib/sec-ticker-map";
import { fetchSecJson, SecFetchError, type ProviderError, type ProviderErrorReason } from "@/lib/sec-client";
import { getLatestPrice } from "@/lib/market-data";

/**
 * SEC EDGAR financial-data service — the primary (and, once verified,
 * only) source of fundamental financial data for this app, replacing the
 * Alpha Vantage integration used through Stage 10.
 *
 * Pipeline: ticker -> CIK (lib/sec-ticker-map.ts) -> SEC submissions +
 * companyfacts (data.sec.gov, no API key) -> normalized `FinancialData`
 * (this file) -> lib/calculations.ts -> lib/scoring.ts -> dashboard.
 * `FinancialData` itself is completely unchanged from the Alpha Vantage
 * era, so nothing above this file needed to change shape.
 *
 * SEC provides no market price. Valuation (P/E, P/S, P/B, EV/EBITDA)
 * therefore depends on lib/market-data.ts, a deliberately isolated,
 * best-effort adapter — see that file's doc comment for why. When it
 * can't produce a price, every valuation metric here is `null`, and
 * lib/scoring.ts's existing null-safe category handling (already built
 * in Stage 3, unchanged) scores that category from whatever's actually
 * available rather than ever fabricating a number.
 */

type FetchResult = { ok: true; data: FinancialData } | { ok: false; error: ProviderError };
type AnalysisFetchResult = { ok: true; data: CompanyAnalysis } | { ok: false; error: ProviderError };

// ---------------------------------------------------------------------------
// XBRL shapes (only the fields this app reads)
// ---------------------------------------------------------------------------

interface XbrlFact {
  end: string;
  start?: string;
  val: number;
  fy?: number;
  fp?: string;
  form: string;
  filed: string;
}

interface XbrlConcept {
  units?: Record<string, XbrlFact[]>;
}

interface CompanyFactsJson {
  entityName?: string;
  facts?: {
    "us-gaap"?: Record<string, XbrlConcept>;
    dei?: Record<string, XbrlConcept>;
  };
}

interface SubmissionsJson {
  name?: string;
  sicDescription?: string;
  sic?: string;
  exchanges?: string[];
  description?: string;
}

// ---------------------------------------------------------------------------
// Concept fallback chains
//
// SEC filers do not all use the same XBRL tag for the same line item —
// confirmed directly against real companyfacts data for AAPL, MSFT,
// GOOGL, NVDA, and AMZN during development (e.g. AMZN reports revenue
// under SalesRevenueNet/RevenueFromContractWithCustomer... but has no
// Revenues tag at all; MSFT/GOOGL/NVDA prefer different debt-current
// tags). Each metric tries its listed tags in order and uses the first
// one that yields any usable annual facts — never mixing tags across
// years for the same metric within one company, which would risk
// combining incompatible definitions.
// ---------------------------------------------------------------------------

const REVENUE_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
];
const NET_INCOME_CONCEPTS = ["NetIncomeLoss", "ProfitLoss"];
const OPERATING_INCOME_CONCEPTS = ["OperatingIncomeLoss"];
const OCF_CONCEPTS = [
  "NetCashProvidedByUsedInOperatingActivities",
  "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
];
const CAPEX_CONCEPTS = [
  "PaymentsToAcquirePropertyPlantAndEquipment",
  "PaymentsToAcquireProductiveAssets",
  "PaymentsForCapitalImprovements",
];
const ASSETS_CONCEPTS = ["Assets"];
const EQUITY_CONCEPTS = ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"];
const CASH_CONCEPTS = [
  "CashAndCashEquivalentsAtCarryingValue",
  "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
];
const INTEREST_EXPENSE_CONCEPTS = ["InterestExpense", "InterestExpenseDebt", "InterestExpenseNonoperating"];
const LT_DEBT_NONCURRENT_CONCEPTS = ["LongTermDebtNoncurrent", "LongTermDebt"];
const LT_DEBT_CURRENT_CONCEPTS = ["LongTermDebtCurrent", "DebtCurrent", "ShortTermBorrowings"];
const DEPRECIATION_AMORTIZATION_CONCEPTS = [
  "DepreciationDepletionAndAmortization",
  "DepreciationAmortizationAndAccretionNet",
  "DepreciationAndAmortization",
];
const SHARES_OUTSTANDING_CONCEPTS_DEI = ["EntityCommonStockSharesOutstanding"];
const SHARES_OUTSTANDING_CONCEPTS_GAAP = ["CommonStockSharesOutstanding"];

// ---------------------------------------------------------------------------
// Fact extraction & normalization
// ---------------------------------------------------------------------------

function isAnnualForm(form: string): boolean {
  return form === "10-K" || form === "10-K/A";
}

/** A 52/53-week fiscal year can run a few days short/long of 365 — accept a generous window rather than assuming a strict calendar year. */
function isAnnualDuration(start: string, end: string): boolean {
  const days = (Date.parse(end) - Date.parse(start)) / (1000 * 60 * 60 * 24);
  return days >= 340 && days <= 386;
}

/**
 * Merges facts from every concept in `chain` into one series, rather than
 * picking a single "winning" tag for the whole company. This matters
 * because filers routinely switch tags mid-history — confirmed directly
 * against real data during development: NVIDIA reported revenue under
 * `RevenueFromContractWithCustomerExcludingAssessedTax` through fiscal
 * 2022 and under the plain `Revenues` tag from fiscal 2023 onward. Taking
 * only the first non-empty tag would silently truncate the series at the
 * switchover point instead of covering the company's full recent history.
 * When two concepts both report the same period (rare, but possible
 * across a transition year), the most-recently-*filed* fact wins, same
 * rule `extractAnnualSeries` already applies within one concept.
 */
function resolveSeries(
  gaap: Record<string, XbrlConcept> | undefined,
  chain: string[],
  kind: "duration" | "instant",
): Map<string, number> {
  const merged: XbrlFact[] = [];
  for (const tag of chain) {
    merged.push(...(gaap?.[tag]?.units?.USD ?? []));
  }
  const byEnd = new Map<string, XbrlFact>();
  for (const fact of merged) {
    if (!isAnnualForm(fact.form)) continue;
    if (kind === "duration") {
      if (fact.fp !== "FY" || !fact.start || !isAnnualDuration(fact.start, fact.end)) continue;
    }
    const existing = byEnd.get(fact.end);
    if (!existing || fact.filed > existing.filed) {
      byEnd.set(fact.end, fact);
    }
  }
  const result = new Map<string, number>();
  for (const [end, fact] of byEnd) result.set(end, fact.val);
  return result;
}

function toBillions(rawUsd: number | undefined): number | null {
  return rawUsd === undefined ? null : rawUsd / 1_000_000_000;
}

/** One fiscal year's worth of figures, in USD billions — deliberately the same shape lib/financial-api.ts used, for a minimal-diff migration. */
interface AnnualFigures {
  end: string;
  revenue: number | null;
  netIncome: number | null;
  operatingIncome: number | null;
  interestExpense: number | null;
  totalEquity: number | null;
  totalAssets: number | null;
  totalDebt: number | null;
  cash: number | null;
  operatingCashFlow: number | null;
  capitalExpenditures: number | null;
  depreciationAmortization: number | null;
}

function buildAnnualFigures(facts: CompanyFactsJson): AnnualFigures[] {
  const gaap = facts.facts?.["us-gaap"];

  const revenue = resolveSeries(gaap, REVENUE_CONCEPTS, "duration");
  const netIncome = resolveSeries(gaap, NET_INCOME_CONCEPTS, "duration");
  const operatingIncome = resolveSeries(gaap, OPERATING_INCOME_CONCEPTS, "duration");
  const interestExpense = resolveSeries(gaap, INTEREST_EXPENSE_CONCEPTS, "duration");
  const ocf = resolveSeries(gaap, OCF_CONCEPTS, "duration");
  const capex = resolveSeries(gaap, CAPEX_CONCEPTS, "duration");
  const depreciation = resolveSeries(gaap, DEPRECIATION_AMORTIZATION_CONCEPTS, "duration");
  const equity = resolveSeries(gaap, EQUITY_CONCEPTS, "instant");
  const assets = resolveSeries(gaap, ASSETS_CONCEPTS, "instant");
  const cash = resolveSeries(gaap, CASH_CONCEPTS, "instant");
  const ltDebtNoncurrent = resolveSeries(gaap, LT_DEBT_NONCURRENT_CONCEPTS, "instant");
  const ltDebtCurrent = resolveSeries(gaap, LT_DEBT_CURRENT_CONCEPTS, "instant");

  // Revenue anchors which fiscal periods this company is analyzed over —
  // it's the one figure virtually every operating company reports. If a
  // company genuinely has no annual revenue facts (extremely rare for an
  // operating company that still files 10-Ks), fall back to net income's
  // periods rather than producing no data at all.
  const backbone = revenue.size > 0 ? revenue : netIncome;
  const ends = Array.from(backbone.keys()).sort().slice(-5);

  return ends.map((end) => {
    const noncurrent = ltDebtNoncurrent.get(end);
    const current = ltDebtCurrent.get(end);
    const totalDebt = noncurrent !== undefined || current !== undefined ? (noncurrent ?? 0) + (current ?? 0) : undefined;

    return {
      end,
      revenue: toBillions(revenue.get(end)),
      netIncome: toBillions(netIncome.get(end)),
      operatingIncome: toBillions(operatingIncome.get(end)),
      interestExpense: toBillions(interestExpense.get(end)),
      totalEquity: toBillions(equity.get(end)),
      totalAssets: toBillions(assets.get(end)),
      totalDebt: toBillions(totalDebt),
      cash: toBillions(cash.get(end)),
      operatingCashFlow: toBillions(ocf.get(end)),
      // XBRL "Payments to Acquire..." tags report the cash outflow as a
      // positive magnitude by convention, but this normalizes with Math.abs
      // regardless — matching lib/calculations.ts's documented expectation
      // and staying correct even against a filer that tags it negatively.
      capitalExpenditures: capex.has(end) ? Math.abs(toBillions(capex.get(end))!) : null,
      depreciationAmortization: toBillions(depreciation.get(end)),
    };
  });
}

function fiscalYearLabel(end: string): string {
  const year = end.slice(0, 4);
  return year ? `FY${year}` : end;
}

function toYearValues(figures: AnnualFigures[], pick: (f: AnnualFigures) => number | null): YearValue[] {
  return figures.map((f) => ({ year: fiscalYearLabel(f.end), value: pick(f) }));
}

/** Latest reported shares outstanding, in raw share count — the cover-page `dei` fact is reported on every 10-K/10-Q, so this takes the single most-recently-filed value rather than a fiscal-year series. */
function latestSharesOutstanding(facts: CompanyFactsJson): number | null {
  const dei = facts.facts?.dei;
  const gaap = facts.facts?.["us-gaap"];
  const candidates: XbrlFact[] = [];
  for (const tag of SHARES_OUTSTANDING_CONCEPTS_DEI) {
    candidates.push(...(dei?.[tag]?.units?.shares ?? []));
  }
  for (const tag of SHARES_OUTSTANDING_CONCEPTS_GAAP) {
    candidates.push(...(gaap?.[tag]?.units?.shares ?? []));
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.filed.localeCompare(b.filed));
  return candidates[candidates.length - 1].val;
}

// ---------------------------------------------------------------------------
// Sector classification — SEC provides an official SIC code, not a GICS
// sector. This maps the common large-cap SIC ranges to a readable sector
// label; anything outside the mapped ranges honestly falls back to the
// SIC description itself rather than guessing.
// ---------------------------------------------------------------------------

// Non-overlapping by construction (each range's lower bound picks up
// exactly where the previous one leaves off) — deliberately so a code
// can never match two entries depending on array order.
const SIC_SECTOR_RANGES: [number, number, string][] = [
  [100, 999, "Agriculture"],
  [1000, 1499, "Energy & Mining"],
  [1500, 1799, "Industrials"],
  [2000, 2199, "Consumer Staples"],
  [2200, 2799, "Consumer Discretionary"],
  [2800, 2899, "Materials"],
  [2900, 2999, "Energy & Mining"],
  [3000, 3199, "Consumer Discretionary"],
  [3200, 3399, "Materials"],
  [3400, 3559, "Industrials"],
  [3560, 3599, "Technology"], // e.g. 3571 Electronic Computers
  [3600, 3660, "Industrials"],
  [3661, 3699, "Technology"], // e.g. 3674 Semiconductors
  [3700, 3799, "Industrials"],
  [3800, 3843, "Health Care"],
  [3844, 3999, "Industrials"],
  [4000, 4799, "Industrials"],
  [4800, 4899, "Communication Services"],
  [4900, 4999, "Utilities"],
  [5000, 5999, "Consumer Discretionary"],
  [6000, 6799, "Financials"],
  [7000, 7099, "Real Estate"],
  [7100, 7299, "Consumer Discretionary"],
  [7300, 7379, "Technology"], // e.g. 7370-7372 computer services/prepackaged software
  [7380, 7999, "Consumer Discretionary"],
  [8000, 8099, "Health Care"],
  [8100, 8999, "Industrials"],
];

function sectorFromSic(sic: string | undefined): string {
  const code = sic ? Number(sic) : NaN;
  if (!Number.isFinite(code)) return "Diversified";
  const match = SIC_SECTOR_RANGES.find(([min, max]) => code >= min && code <= max);
  return match ? match[2] : "Diversified";
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function buildFinancialData(
  ticker: string,
  submissions: SubmissionsJson,
  facts: CompanyFactsJson,
  marketCapBillions: number | null,
  price: { value: number; asOf: string } | null,
): FinancialData {
  const figures = buildAnnualFigures(facts);
  const latest = figures.length > 0 ? figures[figures.length - 1] : null;
  const prior = figures.length > 1 ? figures[figures.length - 2] : null;
  const threeYearsAgo = figures.length > 3 ? figures[figures.length - 4] : null;

  const latestFcf = latest ? calculateFreeCashFlow(latest.operatingCashFlow, latest.capitalExpenditures) : null;
  const priorFcf = prior ? calculateFreeCashFlow(prior.operatingCashFlow, prior.capitalExpenditures) : null;

  // EBITDA reconstruction: SEC has no direct EBITDA/EV-to-EBITDA figure
  // (Alpha Vantage's OVERVIEW endpoint used to supply this precomputed).
  // Built here, once, from operating income + D&A rather than in
  // lib/calculations.ts, matching this app's existing precedent of
  // keeping ratios it can't yet fully generalize local to the adapter
  // that needs them (see the Alpha Vantage adapter's identical comment
  // this replaces). Enterprise value needs market cap, which itself
  // depends on the best-effort price lookup — missing either input
  // leaves this (like every other valuation metric) `null`.
  const ebitda =
    latest && latest.operatingIncome !== null && latest.depreciationAmortization !== null
      ? latest.operatingIncome + latest.depreciationAmortization
      : null;
  const enterpriseValue =
    latest && marketCapBillions !== null && latest.totalDebt !== null && latest.cash !== null
      ? marketCapBillions + latest.totalDebt - latest.cash
      : null;
  const evToEbitda = enterpriseValue !== null && ebitda !== null && ebitda > 0 ? enterpriseValue / ebitda : null;

  return {
    profile: {
      ticker,
      name: submissions.name ?? facts.entityName ?? ticker,
      sector: sectorFromSic(submissions.sic),
      industry: submissions.sicDescription ?? "Unknown",
      exchange: submissions.exchanges?.[0] ?? "Unknown",
      currency: "USD",
      latestPrice: price?.value ?? null,
      priceAsOf: price?.asOf ?? null,
      marketCap: marketCapBillions,
      lastUpdated: new Date().toISOString().slice(0, 10),
      description: submissions.description ?? "",
    },
    revenue: {
      history: toYearValues(figures, (f) => f.revenue),
      yoyGrowth: latest && prior ? calculateRevenueGrowth(latest.revenue, prior.revenue) : null,
      cagr3yr: latest && threeYearsAgo ? calculateRevenueCagr(threeYearsAgo.revenue, latest.revenue, 3) : null,
    },
    profitability: {
      netIncomeHistory: toYearValues(figures, (f) => f.netIncome),
      netMargin: latest ? calculateNetProfitMargin(latest.netIncome, latest.revenue) : null,
      operatingMargin: latest ? calculateOperatingMargin(latest.operatingIncome, latest.revenue) : null,
      roe: latest ? calculateROE(latest.netIncome, latest.totalEquity) : null,
      netIncomeGrowth: latest && prior ? calculateGrowthRate(latest.netIncome, prior.netIncome) : null,
    },
    valuation: {
      pe: latest ? calculatePE(marketCapBillions, latest.netIncome) : null,
      ps: latest ? calculatePS(marketCapBillions, latest.revenue) : null,
      pb: latest ? calculatePB(marketCapBillions, latest.totalEquity) : null,
      evToEbitda,
    },
    debt: {
      totalDebtHistory: toYearValues(figures, (f) => f.totalDebt),
      totalDebt: latest?.totalDebt ?? null,
      debtToEquity: latest ? calculateDebtToEquity(latest.totalDebt, latest.totalEquity) : null,
      debtToAssets: latest ? calculateDebtToAssets(latest.totalDebt, latest.totalAssets) : null,
      netDebt: latest ? calculateNetDebt(latest.totalDebt, latest.cash) : null,
      interestCoverage: latest ? calculateInterestCoverage(latest.operatingIncome, latest.interestExpense) : null,
    },
    cashFlow: {
      operatingCashFlowHistory: toYearValues(figures, (f) => f.operatingCashFlow),
      freeCashFlowHistory: figures.map((f) => ({
        year: fiscalYearLabel(f.end),
        value: calculateFreeCashFlow(f.operatingCashFlow, f.capitalExpenditures),
      })),
      operatingCashFlow: latest ? calculateOperatingCashFlow(latest.operatingCashFlow) : null,
      freeCashFlow: latestFcf,
      fcfGrowth: latest && prior ? calculateFreeCashFlowGrowth(latestFcf, priorFcf) : null,
      ocfToNetIncome: latest ? calculateOcfToNetIncome(latest.operatingCashFlow, latest.netIncome) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

function asProviderError(err: unknown, fallbackMessage: string): ProviderError {
  if (err instanceof SecFetchError) return { reason: err.reason, message: err.message };
  return { reason: "provider_error" as ProviderErrorReason, message: fallbackMessage };
}

/**
 * Fetches and normalizes one company's financial data from SEC EDGAR.
 * Sequenced (ticker->CIK, then submissions, then companyfacts) rather
 * than parallel — an invalid ticker costs only the cheap ticker-map
 * lookup, and this keeps SEC request concurrency at one in flight at a
 * time, well inside SEC's fair-access guidance.
 */
async function fetchNormalizedFinancialData(rawTicker: string): Promise<FetchResult> {
  const ticker = rawTicker.trim().toUpperCase();
  if (!ticker) {
    return { ok: false, error: { reason: "not_found", message: "Enter a ticker symbol." } };
  }
  if (!isValidTickerFormat(ticker)) {
    return { ok: false, error: { reason: "not_found", message: `"${ticker}" isn't a valid ticker symbol.` } };
  }

  let resolved;
  try {
    resolved = await resolveTicker(ticker);
  } catch (err) {
    return { ok: false, error: asProviderError(err, "Could not reach SEC EDGAR's company directory.") };
  }
  if (!resolved) {
    return { ok: false, error: { reason: "not_found", message: `No SEC-reporting company was found for "${ticker}".` } };
  }

  let submissions: SubmissionsJson;
  try {
    submissions = (await fetchSecJson(`https://data.sec.gov/submissions/CIK${resolved.cikPadded}.json`)) as SubmissionsJson;
  } catch (err) {
    return { ok: false, error: asProviderError(err, "Could not fetch this company's SEC filing history.") };
  }

  let facts: CompanyFactsJson;
  try {
    facts = (await fetchSecJson(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${resolved.cikPadded}.json`,
    )) as CompanyFactsJson;
  } catch (err) {
    return { ok: false, error: asProviderError(err, "Could not fetch this company's financial statements from SEC EDGAR.") };
  }

  if (!facts.facts?.["us-gaap"]) {
    return { ok: false, error: { reason: "not_found", message: `No US-GAAP financial statements are available for "${ticker}".` } };
  }

  // Best-effort market price, isolated from every failure mode above —
  // see lib/market-data.ts. Never throws, never blocks this pipeline.
  const shares = latestSharesOutstanding(facts);
  const price = await getLatestPrice(ticker);
  const marketCapBillions = price && shares ? (price.value * shares) / 1_000_000_000 : null;

  const data = buildFinancialData(resolved.ticker, submissions, facts, marketCapBillions, price);

  if (data.revenue.history.length === 0) {
    return { ok: false, error: { reason: "not_found", message: `No usable annual financial statements were found for "${ticker}".` } };
  }

  return { ok: true, data };
}

/**
 * Full pipeline for one ticker: SEC EDGAR -> normalized FinancialData ->
 * calculations -> scoring engine -> `CompanyAnalysis`. Same shape and
 * same name as the Alpha Vantage era's `getLiveCompanyAnalysis`, so
 * lib/company-analysis.ts only needed an import-path change to switch
 * providers. The AI explanation is fetched separately by the page (see
 * app/company/[ticker]/page.tsx) and is unaffected by this migration.
 */
export async function getLiveCompanyAnalysis(ticker: string): Promise<AnalysisFetchResult> {
  const result = await fetchNormalizedFinancialData(ticker);
  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      financialData: result.data,
      score: calculateInvestmentScore(result.data),
      insights: generateInsights(result.data),
    },
  };
}
