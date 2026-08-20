import type { FinancialData, YearValue } from "@/types/financial";
import type { CompanyAnalysis } from "@/types/scoring";
import { generateInsights } from "@/lib/insights";
import { calculateInvestmentScore } from "@/lib/scoring";

/**
 * Realistic (illustrative, not real-time) mock data standing in for the
 * real financial-data pipeline (lib/sec-financial-api.ts, SEC EDGAR).
 * Every value here is shaped exactly like the real pipeline's output —
 * `FinancialData` — so wiring up the real data source never required
 * reshaping the UI. The Investment Score is not stored here: it is
 * calculated from this financial data by lib/scoring.ts every time a
 * company is requested (mock financial data -> scoring engine ->
 * dashboard), the same pipeline the real data source uses. The AI
 * Analysis section is likewise not stored here — app/company/[ticker]/
 * page.tsx calls the real Claude API (lib/ai-analysis.ts) against this
 * same financial data, so viewing a company with `?mock=1` is a
 * genuine, free (no SEC EDGAR or Claude quota concerns beyond the
 * normal Anthropic usage) end-to-end test of the AI layer.
 *
 * Figures are in USD billions unless noted. They approximate each
 * company's recent scale but are not sourced from actual filings.
 */

const FISCAL_YEARS = ["FY2021", "FY2022", "FY2023", "FY2024", "FY2025"];

function series(values: (number | null)[]): YearValue[] {
  return FISCAL_YEARS.map((year, i) => ({ year, value: values[i] }));
}

interface MockCompany {
  financialData: FinancialData;
}

const MOCK_COMPANIES: Record<string, MockCompany> = {
  AAPL: {
    financialData: {
      profile: {
        ticker: "AAPL",
        name: "Apple Inc.",
        sector: "Technology",
        industry: "Consumer Electronics",
        exchange: "NASDAQ",
        currency: "USD",
        latestPrice: 231.5,
        priceAsOf: "2026-08-18",
        marketCap: 3480,
        lastUpdated: "2026-07-28",
        description:
          "Apple designs, manufactures, and markets smartphones, personal computers, and wearables, and operates a large services business spanning the App Store, subscriptions, and payments.",
      },
      revenue: {
        history: series([365.8, 394.3, 383.3, 391.0, 416.2]),
        yoyGrowth: 0.064,
        cagr3yr: 0.018,
      },
      profitability: {
        netIncomeHistory: series([94.7, 99.8, 97.0, 101.9, 112.0]),
        netMargin: 0.269,
        operatingMargin: 0.315,
        roe: 1.5,
        netIncomeGrowth: 0.099,
      },
      valuation: { pe: 31.2, ps: 8.6, pb: 47.8, evToEbitda: 23.5 },
      debt: {
        totalDebtHistory: series([124.7, 120.1, 111.1, 106.6, 101.7]),
        totalDebt: 101.7,
        debtToEquity: 1.64,
        debtToAssets: 0.27,
        netDebt: 36.5,
        interestCoverage: 29.4,
      },
      cashFlow: {
        operatingCashFlowHistory: series([104.0, 122.2, 110.5, 118.3, 125.8]),
        freeCashFlowHistory: series([93.0, 111.4, 99.6, 108.8, 116.4]),
        operatingCashFlow: 125.8,
        freeCashFlow: 116.4,
        fcfGrowth: 0.07,
        ocfToNetIncome: 1.12,
      },
    },
  },

  MSFT: {
    financialData: {
      profile: {
        ticker: "MSFT",
        name: "Microsoft Corporation",
        sector: "Technology",
        industry: "Software & Cloud Infrastructure",
        exchange: "NASDAQ",
        currency: "USD",
        latestPrice: 421.8,
        priceAsOf: "2026-08-18",
        marketCap: 3135,
        lastUpdated: "2026-07-22",
        description:
          "Microsoft develops and licenses software and cloud services, including Windows, Office/Microsoft 365, Azure, and enterprise and gaming products.",
      },
      revenue: {
        history: series([198.3, 211.9, 245.1, 281.7, 315.4]),
        yoyGrowth: 0.12,
        cagr3yr: 0.142,
      },
      profitability: {
        netIncomeHistory: series([72.7, 72.4, 88.1, 105.9, 124.3]),
        netMargin: 0.394,
        operatingMargin: 0.452,
        roe: 0.34,
        netIncomeGrowth: 0.174,
      },
      valuation: { pe: 34.8, ps: 13.7, pb: 11.9, evToEbitda: 22.1 },
      debt: {
        totalDebtHistory: series([78.2, 71.3, 66.7, 60.9, 55.2]),
        totalDebt: 55.2,
        debtToEquity: 0.42,
        debtToAssets: 0.16,
        netDebt: -18.4,
        interestCoverage: 45.0,
      },
      cashFlow: {
        operatingCashFlowHistory: series([89.0, 89.0, 87.6, 118.5, 138.2]),
        freeCashFlowHistory: series([56.1, 65.1, 59.5, 74.1, 88.9]),
        operatingCashFlow: 138.2,
        freeCashFlow: 88.9,
        fcfGrowth: 0.2,
        ocfToNetIncome: 1.11,
      },
    },
  },

  GOOGL: {
    financialData: {
      profile: {
        ticker: "GOOGL",
        name: "Alphabet Inc.",
        sector: "Communication Services",
        industry: "Internet Content & Information",
        exchange: "NASDAQ",
        currency: "USD",
        latestPrice: 178.2,
        priceAsOf: "2026-08-18",
        marketCap: 2180,
        lastUpdated: "2026-07-23",
        description:
          "Alphabet is the parent of Google, generating most of its revenue from search and display advertising, alongside YouTube, Google Cloud, and other bets.",
      },
      revenue: {
        history: series([257.6, 282.8, 307.4, 350.0, 385.6]),
        yoyGrowth: 0.102,
        cagr3yr: 0.109,
      },
      profitability: {
        netIncomeHistory: series([76.0, 60.0, 73.8, 100.1, 108.9]),
        netMargin: 0.282,
        operatingMargin: 0.32,
        roe: 0.3,
        netIncomeGrowth: 0.088,
      },
      valuation: { pe: 24.6, ps: 6.9, pb: 6.8, evToEbitda: 15.2 },
      debt: {
        totalDebtHistory: series([28.4, 29.1, 28.0, 26.4, 24.8]),
        totalDebt: 24.8,
        debtToEquity: 0.11,
        debtToAssets: 0.06,
        netDebt: -95.0,
        interestCoverage: 55.0,
      },
      cashFlow: {
        operatingCashFlowHistory: series([91.7, 91.5, 101.7, 125.3, 137.4]),
        freeCashFlowHistory: series([67.0, 60.0, 69.5, 72.8, 78.1]),
        operatingCashFlow: 137.4,
        freeCashFlow: 78.1,
        fcfGrowth: 0.073,
        ocfToNetIncome: 1.26,
      },
    },
  },

  NVDA: {
    financialData: {
      profile: {
        ticker: "NVDA",
        name: "NVIDIA Corporation",
        sector: "Technology",
        industry: "Semiconductors",
        exchange: "NASDAQ",
        currency: "USD",
        latestPrice: 131.9,
        priceAsOf: "2026-08-18",
        marketCap: 3230,
        lastUpdated: "2026-07-15",
        description:
          "NVIDIA designs GPUs and accelerated-computing platforms used across gaming, data centers, and AI, and has become the dominant supplier of AI training and inference hardware.",
      },
      revenue: {
        history: series([26.9, 60.9, 96.3, 130.5, 187.2]),
        yoyGrowth: 0.434,
        cagr3yr: 0.454,
      },
      profitability: {
        netIncomeHistory: series([4.4, 30.0, 42.6, 60.9, 92.3]),
        netMargin: 0.493,
        operatingMargin: 0.55,
        roe: 0.91,
        netIncomeGrowth: 0.516,
      },
      valuation: { pe: 52.3, ps: 25.8, pb: 46.1, evToEbitda: 38.9 },
      debt: {
        totalDebtHistory: series([11.1, 9.7, 9.7, 8.5, 8.5]),
        totalDebt: 8.5,
        debtToEquity: 0.2,
        debtToAssets: 0.1,
        netDebt: -25.6,
        interestCoverage: 120.0,
      },
      cashFlow: {
        operatingCashFlowHistory: series([5.6, 28.1, 39.6, 55.4, 79.0]),
        freeCashFlowHistory: series([3.8, 26.9, 36.8, 49.9, 72.1]),
        operatingCashFlow: 79.0,
        freeCashFlow: 72.1,
        fcfGrowth: 0.445,
        ocfToNetIncome: 0.856,
      },
    },
  },

  AMZN: {
    financialData: {
      profile: {
        ticker: "AMZN",
        name: "Amazon.com, Inc.",
        sector: "Consumer Discretionary",
        industry: "Internet Retail & Cloud Computing",
        exchange: "NASDAQ",
        currency: "USD",
        latestPrice: 186.4,
        priceAsOf: "2026-08-18",
        marketCap: 1975,
        lastUpdated: "2026-07-24",
        description:
          "Amazon operates online and physical retail, third-party marketplace, subscription, and advertising businesses, alongside Amazon Web Services, its cloud computing segment.",
      },
      revenue: {
        history: series([469.8, 514.0, 574.8, 638.0, 695.1]),
        yoyGrowth: 0.089,
        cagr3yr: 0.106,
      },
      profitability: {
        netIncomeHistory: series([33.4, -2.7, 30.4, 59.2, 65.9]),
        netMargin: 0.095,
        operatingMargin: 0.107,
        roe: 0.21,
        netIncomeGrowth: 0.113,
      },
      valuation: { pe: 38.7, ps: 3.4, pb: 7.9, evToEbitda: 16.8 },
      debt: {
        totalDebtHistory: series([116.4, 140.1, 135.4, 130.9, 128.0]),
        totalDebt: 128.0,
        debtToEquity: 0.53,
        debtToAssets: 0.22,
        netDebt: 51.2,
        interestCoverage: 12.4,
      },
      cashFlow: {
        operatingCashFlowHistory: series([46.3, 46.8, 84.9, 107.0, 118.5]),
        freeCashFlowHistory: series([-14.9, -16.9, 32.2, 38.2, 41.6]),
        operatingCashFlow: 118.5,
        freeCashFlow: 41.6,
        fcfGrowth: 0.089,
        ocfToNetIncome: 1.8,
      },
    },
  },
};

/** Tickers currently covered by the mock data set (Stage 1). */
export const MOCK_TICKERS = Object.keys(MOCK_COMPANIES);

export function getMockCompanyAnalysis(rawTicker: string): CompanyAnalysis | null {
  const ticker = rawTicker.trim().toUpperCase();
  const company = MOCK_COMPANIES[ticker];
  if (!company) return null;

  return {
    financialData: company.financialData,
    // The Investment Score is computed here, not stored — same pipeline
    // the real data source uses.
    score: calculateInvestmentScore(company.financialData),
    insights: generateInsights(company.financialData),
  };
}
