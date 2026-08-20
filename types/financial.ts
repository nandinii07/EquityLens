/**
 * Normalized financial data types.
 *
 * These types are the internal shape the rest of the app works with,
 * regardless of where the numbers came from. lib/sec-financial-api.ts
 * translates raw SEC EDGAR XBRL facts into this shape; lib/mock-data.ts
 * builds it directly for the illustrative `?mock=1` demo path. This
 * shape has not changed since it was first introduced — swapping the
 * underlying data provider never required touching it.
 *
 * A value is `null` — never fabricated or estimated — whenever the
 * underlying data point is not available.
 */

/** One data point in a multi-year trend, e.g. { year: "FY2024", value: 391.0 }. */
export interface YearValue {
  year: string;
  value: number | null;
}

export interface CompanyProfile {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  currency: string;
  /** Most recent share price, if available. */
  latestPrice: number | null;
  /** ISO date the price quote is as of. */
  priceAsOf: string | null;
  marketCap: number | null;
  /** ISO date the underlying financial statements were last refreshed. */
  lastUpdated: string;
  description: string;
}

export interface RevenueMetrics {
  /** Annual revenue, oldest first, in the currency's base unit (billions here). */
  history: YearValue[];
  /** Most recent year-over-year growth, as a fraction (0.08 = 8%). */
  yoyGrowth: number | null;
  /** 3-year compound annual growth rate, as a fraction. */
  cagr3yr: number | null;
}

export interface ProfitabilityMetrics {
  netIncomeHistory: YearValue[];
  netMargin: number | null;
  operatingMargin: number | null;
  roe: number | null;
  netIncomeGrowth: number | null;
}

export interface ValuationMetrics {
  pe: number | null;
  ps: number | null;
  pb: number | null;
  evToEbitda: number | null;
}

export interface DebtMetrics {
  totalDebtHistory: YearValue[];
  totalDebt: number | null;
  debtToEquity: number | null;
  debtToAssets: number | null;
  netDebt: number | null;
  interestCoverage: number | null;
}

export interface CashFlowMetrics {
  operatingCashFlowHistory: YearValue[];
  freeCashFlowHistory: YearValue[];
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  fcfGrowth: number | null;
  ocfToNetIncome: number | null;
}

export interface FinancialData {
  profile: CompanyProfile;
  revenue: RevenueMetrics;
  profitability: ProfitabilityMetrics;
  valuation: ValuationMetrics;
  debt: DebtMetrics;
  cashFlow: CashFlowMetrics;
}
