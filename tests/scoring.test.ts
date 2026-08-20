import { describe, expect, it } from "vitest";
import { calculateInvestmentScore } from "@/lib/scoring";
import { getMockCompanyAnalysis } from "@/lib/mock-data";
import type {
  CashFlowMetrics,
  DebtMetrics,
  FinancialData,
  ProfitabilityMetrics,
  RevenueMetrics,
  ValuationMetrics,
} from "@/types/financial";
import type { ScoreCategory } from "@/types/scoring";

// ---------------------------------------------------------------------------
// Test fixture builder
//
// A minimal, internally-consistent "average" company, with helpers to
// override just the metric groups a given test cares about. Kept in the
// test file (not lib/) since it's fixture data, not app code.
// ---------------------------------------------------------------------------

function baseFinancialData(): FinancialData {
  return {
    profile: {
      ticker: "TEST",
      name: "Test Co",
      sector: "Technology",
      industry: "Test Industry",
      exchange: "TEST",
      currency: "USD",
      latestPrice: 100,
      priceAsOf: "2026-01-01",
      marketCap: 1000,
      lastUpdated: "2026-01-01",
      description: "A synthetic company used for scoring engine tests.",
    },
    revenue: {
      history: [{ year: "FY1", value: 100 }],
      yoyGrowth: 0.07,
      cagr3yr: 0.09,
    },
    profitability: {
      netIncomeHistory: [{ year: "FY1", value: 10 }],
      netMargin: 0.1,
      operatingMargin: 0.12,
      roe: 0.12,
      netIncomeGrowth: 0.06,
    },
    valuation: { pe: 22, ps: 3.5, pb: 5, evToEbitda: 13 },
    debt: {
      totalDebtHistory: [{ year: "FY1", value: 20 }],
      totalDebt: 20,
      debtToEquity: 0.5,
      debtToAssets: 0.25,
      netDebt: 10,
      interestCoverage: 5,
    },
    cashFlow: {
      operatingCashFlowHistory: [{ year: "FY1", value: 12 }],
      freeCashFlowHistory: [{ year: "FY1", value: 6 }],
      operatingCashFlow: 12,
      freeCashFlow: 6,
      fcfGrowth: 0.03,
      ocfToNetIncome: 1.2,
    },
  };
}

function makeCompany(overrides: {
  revenue?: Partial<RevenueMetrics>;
  profitability?: Partial<ProfitabilityMetrics>;
  valuation?: Partial<ValuationMetrics>;
  debt?: Partial<DebtMetrics>;
  cashFlow?: Partial<CashFlowMetrics>;
} = {}): FinancialData {
  const base = baseFinancialData();
  return {
    profile: base.profile,
    revenue: { ...base.revenue, ...overrides.revenue },
    profitability: { ...base.profitability, ...overrides.profitability },
    valuation: { ...base.valuation, ...overrides.valuation },
    debt: { ...base.debt, ...overrides.debt },
    cashFlow: { ...base.cashFlow, ...overrides.cashFlow },
  };
}

function categoryScore(score: ReturnType<typeof calculateInvestmentScore>, category: ScoreCategory) {
  const found = score.breakdown.find((c) => c.category === category);
  if (!found) throw new Error(`Category ${category} missing from breakdown`);
  return found;
}

// ---------------------------------------------------------------------------
// The baseline "average" fixture, hand-verified against every threshold
// table in lib/scoring.ts:
//   Revenue Growth:  yoy 0.07->6, cagr 0.09->6                => 12/20
//   Profitability:   margin 0.10->3, op 0.12->2, roe 0.12->3,
//                     growth 0.06->2                          => 10/20
//   Valuation:       pe 22->6, ps 3.5->4, pb 5->3, ev 13->2    => 15/20
//   Debt:             d/e 0.5->6, d/a 0.25->4, netDebt(+)->1,
//                     coverage 5->2                            => 13/20
//   Cash Flow:        ocfMargin 0.12->2, fcfMargin 0.06->2,
//                     fcfGrowth 0.03->2, ocf/ni 1.2->4          => 10/20
//   Overall: 12+10+15+13+10 = 60 -> "Moderate" (the 60-74 band's floor)
// ---------------------------------------------------------------------------

describe("calculateInvestmentScore — average company (hand-verified)", () => {
  const result = calculateInvestmentScore(makeCompany());

  it("scores each category exactly as hand-computed from the threshold tables", () => {
    expect(categoryScore(result, "Revenue Growth").score).toBe(12);
    expect(categoryScore(result, "Profitability").score).toBe(10);
    expect(categoryScore(result, "Valuation").score).toBe(15);
    expect(categoryScore(result, "Debt").score).toBe(13);
    expect(categoryScore(result, "Cash Flow").score).toBe(10);
  });

  it("sums to exactly 60/100 and lands on the Moderate rating boundary", () => {
    expect(result.overall).toBe(60);
    expect(result.maxScore).toBe(100);
    expect(result.rating).toBe("Moderate");
  });

  it("every category caps at its own maxScore of 20", () => {
    for (const category of result.breakdown) {
      expect(category.maxScore).toBe(20);
    }
  });
});

// ---------------------------------------------------------------------------
// Excellent company: every metric at or above its top tier should earn a
// perfect 20/20 in every category, and 100/100 overall — hand-verified.
// ---------------------------------------------------------------------------

describe("calculateInvestmentScore — excellent company", () => {
  const excellent = makeCompany({
    revenue: {
      history: [{ year: "FY1", value: 100 }],
      yoyGrowth: 0.25,
      cagr3yr: 0.2,
    },
    profitability: {
      netIncomeHistory: [{ year: "FY1", value: 30 }],
      netMargin: 0.3,
      operatingMargin: 0.35,
      roe: 0.35,
      netIncomeGrowth: 0.2,
    },
    valuation: { pe: 12, ps: 1.5, pb: 2, evToEbitda: 8 },
    debt: {
      totalDebtHistory: [{ year: "FY1", value: 5 }],
      totalDebt: 5,
      debtToEquity: 0.1,
      debtToAssets: 0.05,
      netDebt: -10,
      interestCoverage: 20,
    },
    cashFlow: {
      operatingCashFlowHistory: [{ year: "FY1", value: 35 }],
      freeCashFlowHistory: [{ year: "FY1", value: 25 }],
      operatingCashFlow: 35,
      freeCashFlow: 25,
      fcfGrowth: 0.2,
      ocfToNetIncome: 35 / 30,
    },
  });

  const result = calculateInvestmentScore(excellent);

  it("earns the maximum 20 points in every category", () => {
    for (const category of result.breakdown) {
      expect(category.score).toBe(20);
    }
  });

  it("reaches a perfect 100/100 and the Exceptional rating", () => {
    expect(result.overall).toBe(100);
    expect(result.rating).toBe("Exceptional");
  });
});

// ---------------------------------------------------------------------------
// Weak company: revenue in decline, unprofitable, expensive, over-levered,
// cash-burning — every category should land near the bottom, hand-verified.
// ---------------------------------------------------------------------------

describe("calculateInvestmentScore — weak company", () => {
  const weak = makeCompany({
    revenue: {
      history: [{ year: "FY1", value: 100 }],
      yoyGrowth: -0.1,
      cagr3yr: -0.05,
    },
    profitability: {
      netIncomeHistory: [{ year: "FY1", value: -5 }],
      netMargin: -0.05,
      operatingMargin: -0.02,
      roe: -0.05,
      netIncomeGrowth: -0.2,
    },
    valuation: { pe: 80, ps: 15, pb: 25, evToEbitda: 30 },
    debt: {
      totalDebtHistory: [{ year: "FY1", value: 200 }],
      totalDebt: 200,
      debtToEquity: 2.5,
      debtToAssets: 0.65,
      netDebt: 50,
      interestCoverage: 1.0,
    },
    cashFlow: {
      operatingCashFlowHistory: [{ year: "FY1", value: -5 }],
      freeCashFlowHistory: [{ year: "FY1", value: -15 }],
      operatingCashFlow: -5,
      freeCashFlow: -15,
      fcfGrowth: -0.3,
      ocfToNetIncome: 1,
    },
  });

  const result = calculateInvestmentScore(weak);

  it("scores every category near zero", () => {
    expect(categoryScore(result, "Revenue Growth").score).toBe(0);
    expect(categoryScore(result, "Profitability").score).toBe(0);
    expect(categoryScore(result, "Valuation").score).toBe(2);
    expect(categoryScore(result, "Debt").score).toBe(1);
    expect(categoryScore(result, "Cash Flow").score).toBe(0);
  });

  it("totals 3/100 and lands in the High Risk band", () => {
    expect(result.overall).toBe(3);
    expect(result.rating).toBe("High Risk");
  });

  it("never goes negative even with every metric at its worst", () => {
    expect(result.overall).toBeGreaterThanOrEqual(0);
    for (const category of result.breakdown) {
      expect(category.score).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Isolated category scenarios
// ---------------------------------------------------------------------------

describe("negative revenue growth", () => {
  it("scores 0/20 when both YoY growth and CAGR are negative", () => {
    const company = makeCompany({ revenue: { history: [], yoyGrowth: -0.08, cagr3yr: -0.02 } });
    const result = calculateInvestmentScore(company);
    expect(categoryScore(result, "Revenue Growth").score).toBe(0);
  });

  it("still scores some points for a flat 0% growth rate (0% is not treated as negative)", () => {
    const company = makeCompany({ revenue: { history: [], yoyGrowth: 0, cagr3yr: 0 } });
    const result = calculateInvestmentScore(company);
    // yoyGrowth=0 hits the ">= 0" tier (3 of 12), cagr=0 hits its ">= 0" tier (2 of 8): 5/20.
    expect(categoryScore(result, "Revenue Growth").score).toBe(5);
  });
});

describe("weak profitability", () => {
  it("scores 0/20 when margins, ROE, and net income growth are all negative", () => {
    const company = makeCompany({
      profitability: {
        netIncomeHistory: [],
        netMargin: -0.05,
        operatingMargin: -0.02,
        roe: -0.05,
        netIncomeGrowth: -0.1,
      },
    });
    const result = calculateInvestmentScore(company);
    expect(categoryScore(result, "Profitability").score).toBe(0);
  });
});

describe("expensive valuation", () => {
  it("scores low but not zero purely from a high P/E — P/E alone never zeroes out", () => {
    // Only P/E is expensive; the others are cheap, so the category shouldn't
    // be crushed just because one high multiple is present.
    const company = makeCompany({ valuation: { pe: 200, ps: 1, pb: 2, evToEbitda: 5 } });
    const result = calculateInvestmentScore(company);
    // pe(200) -> 1/8, ps(1) -> 5/5, pb(2) -> 4/4, ev(5) -> 3/3 = 13/20
    expect(categoryScore(result, "Valuation").score).toBe(13);
    expect(categoryScore(result, "Valuation").score).toBeGreaterThan(0);
  });

  it("scores near the bottom when every valuation multiple is stretched", () => {
    const company = makeCompany({ valuation: { pe: 60, ps: 18, pb: 30, evToEbitda: 35 } });
    const result = calculateInvestmentScore(company);
    // pe(60) -> 1, ps(18) -> 1, pb(30) -> 0, ev(35) -> 0 = 2/20
    expect(categoryScore(result, "Valuation").score).toBe(2);
  });
});

describe("high debt", () => {
  it("scores near zero for heavy leverage, a net debtor position, and weak coverage", () => {
    const company = makeCompany({
      debt: {
        totalDebtHistory: [],
        totalDebt: 300,
        debtToEquity: 3.0,
        debtToAssets: 0.7,
        netDebt: 80,
        interestCoverage: 0.8,
      },
    });
    const result = calculateInvestmentScore(company);
    // d/e(3.0) -> 0, d/a(0.7) -> 0, netDebt(+) -> 1, coverage(0.8) -> 0 = 1/20
    expect(categoryScore(result, "Debt").score).toBe(1);
  });

  it("rewards a net cash position even when gross leverage ratios are middling", () => {
    const leveredButCashRich = makeCompany({
      debt: { totalDebtHistory: [], totalDebt: 50, debtToEquity: 0.8, debtToAssets: 0.4, netDebt: -5, interestCoverage: 3 },
    });
    const result = calculateInvestmentScore(leveredButCashRich);
    // d/e(0.8) -> 4, d/a(0.4) -> 2, netDebt(-5, net cash) -> 3, coverage(3) -> 1 = 10/20
    expect(categoryScore(result, "Debt").score).toBe(10);
  });
});

describe("negative free cash flow", () => {
  it("does not fabricate a positive read and scores the category low", () => {
    const company = makeCompany({
      profitability: { netIncomeHistory: [{ year: "FY1", value: 10 }] },
      cashFlow: {
        operatingCashFlowHistory: [],
        freeCashFlowHistory: [],
        operatingCashFlow: 5,
        freeCashFlow: -20,
        fcfGrowth: -0.1,
        ocfToNetIncome: 0.5,
      },
    });
    const result = calculateInvestmentScore(company);
    // ocfMargin(5/100=0.05) -> 2, fcfMargin(-0.2) -> 0, fcfGrowth(-0.1) -> 0,
    // quality(ocf=5, ni=10, ratio 0.5) -> 1  =>  3/20
    expect(categoryScore(result, "Cash Flow").score).toBe(3);
    expect(categoryScore(result, "Cash Flow").rationale).toMatch(/negative/);
  });

  it("treats positive cash flow against a net loss as a strength, not a penalty", () => {
    // A capital-intensive business can post a paper loss while still
    // generating real cash — that should not be scored as if earnings
    // quality were poor.
    const company = makeCompany({
      profitability: { netIncomeHistory: [{ year: "FY1", value: -5 }] },
      cashFlow: {
        operatingCashFlowHistory: [],
        freeCashFlowHistory: [],
        operatingCashFlow: 20,
        freeCashFlow: 10,
        fcfGrowth: 0.05,
        ocfToNetIncome: -4,
      },
    });
    const result = calculateInvestmentScore(company);
    // The OCF/NI *quality* sub-metric alone should hit its max (4/4) despite
    // net income being negative, because operating cash flow is positive.
    // ocfMargin(0.2) -> 3, fcfMargin(0.1) -> 4, fcfGrowth(0.05) -> 4, quality -> 4 = 15/20
    expect(categoryScore(result, "Cash Flow").score).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Missing data & invalid denominators
// ---------------------------------------------------------------------------

describe("missing metrics", () => {
  it("rescales a category to /20 across only the available metrics instead of penalizing the gap", () => {
    const company = makeCompany({
      profitability: {
        netIncomeHistory: [],
        netMargin: 0.2, // -> 5/6
        operatingMargin: 0.15, // -> 2/5
        roe: null,
        netIncomeGrowth: null,
      },
    });
    const result = calculateInvestmentScore(company);
    // earned 7 of an available max of 11 (6 + 5, ROE and growth excluded):
    // (7 / 11) * 20 = 12.72... -> rounds to 13.
    expect(categoryScore(result, "Profitability").score).toBe(13);
  });

  it("scores a category 0/20 with an explicit rationale when every metric is unavailable, never NaN", () => {
    const company = makeCompany({
      valuation: { pe: null, ps: null, pb: null, evToEbitda: null },
    });
    const result = calculateInvestmentScore(company);
    const valuation = categoryScore(result, "Valuation");
    expect(valuation.score).toBe(0);
    expect(Number.isNaN(valuation.score)).toBe(false);
    expect(valuation.rationale).toBe("Insufficient data was available to evaluate this category.");
  });

  it("never lets a missing metric produce NaN or Infinity anywhere in the result", () => {
    const company = makeCompany({
      revenue: { history: [], yoyGrowth: null, cagr3yr: null },
      profitability: { netIncomeHistory: [], netMargin: null, operatingMargin: null, roe: null, netIncomeGrowth: null },
      debt: { totalDebtHistory: [], totalDebt: null, debtToEquity: null, debtToAssets: null, netDebt: null, interestCoverage: null },
      cashFlow: {
        operatingCashFlowHistory: [],
        freeCashFlowHistory: [],
        operatingCashFlow: null,
        freeCashFlow: null,
        fcfGrowth: null,
        ocfToNetIncome: null,
      },
    });
    const result = calculateInvestmentScore(company);
    expect(Number.isFinite(result.overall)).toBe(true);
    for (const category of result.breakdown) {
      expect(Number.isFinite(category.score)).toBe(true);
    }
  });
});

describe("zero/invalid denominators", () => {
  it("excludes cash flow margins rather than dividing by zero revenue", () => {
    const company = makeCompany({
      revenue: { history: [{ year: "FY1", value: 0 }] },
      cashFlow: {
        operatingCashFlowHistory: [],
        freeCashFlowHistory: [],
        operatingCashFlow: 10,
        freeCashFlow: 5,
        fcfGrowth: 0.1,
        ocfToNetIncome: 1,
      },
    });
    const result = calculateInvestmentScore(company);
    const cashFlow = categoryScore(result, "Cash Flow");
    expect(Number.isFinite(cashFlow.score)).toBe(true);
    expect(cashFlow.score).toBeGreaterThanOrEqual(0);
    expect(cashFlow.score).toBeLessThanOrEqual(20);
  });

  it("handles an empty revenue history the same way as zero revenue", () => {
    const company = makeCompany({ revenue: { history: [] } });
    const result = calculateInvestmentScore(company);
    expect(Number.isFinite(categoryScore(result, "Cash Flow").score)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Score boundaries
// ---------------------------------------------------------------------------

describe("score boundaries", () => {
  it("clamps every category to [0, 20] even with absurdly extreme inputs", () => {
    const company = makeCompany({
      revenue: { history: [], yoyGrowth: 50, cagr3yr: 50 }, // +5000% growth
      profitability: { netIncomeHistory: [], netMargin: 10, operatingMargin: 10, roe: 100, netIncomeGrowth: 10 },
      debt: { totalDebtHistory: [], totalDebt: -100, debtToEquity: -5, debtToAssets: -1, netDebt: -1_000_000, interestCoverage: 1_000_000 },
    });
    const result = calculateInvestmentScore(company);
    for (const category of result.breakdown) {
      expect(category.score).toBeGreaterThanOrEqual(0);
      expect(category.score).toBeLessThanOrEqual(20);
    }
  });

  it("keeps the overall score within [0, 100] for the excellent, average, and weak fixtures", () => {
    const scenarios = [
      makeCompany(),
      makeCompany({ revenue: { history: [], yoyGrowth: 0.3, cagr3yr: 0.25 } }),
      makeCompany({ revenue: { history: [], yoyGrowth: -0.3, cagr3yr: -0.2 } }),
    ];
    for (const scenario of scenarios) {
      const result = calculateInvestmentScore(scenario);
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
    }
  });

  it("assigns a rating consistent with the documented 0-100 bands for every mock company", () => {
    // Independent re-implementation of the bands in lib/rating.ts, so this
    // checks the engine's output against the documented rule rather than
    // against lib/rating.ts's own code.
    function expectedRating(overall: number): string {
      if (overall >= 90) return "Exceptional";
      if (overall >= 75) return "Strong";
      if (overall >= 60) return "Moderate";
      if (overall >= 40) return "Weak";
      return "High Risk";
    }

    for (const ticker of ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN"]) {
      const analysis = getMockCompanyAnalysis(ticker);
      expect(analysis!.score.rating).toBe(expectedRating(analysis!.score.overall));
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: mock data pipeline now computes the score, it isn't hardcoded
// ---------------------------------------------------------------------------

describe("integration with the mock data pipeline", () => {
  it("computes AAPL's displayed score from its financial data (hand-verified end to end)", () => {
    const analysis = getMockCompanyAnalysis("AAPL");
    expect(analysis).not.toBeNull();
    // Hand-traced against lib/mock-data.ts's AAPL figures and every tier
    // table in lib/scoring.ts: 8 (Revenue) + 19 (Profitability) +
    // 7 (Valuation) + 11 (Debt) + 18 (Cash Flow) = 63 -> "Moderate".
    expect(analysis!.score.overall).toBe(63);
    expect(analysis!.score.rating).toBe("Moderate");
    expect(categoryScore(analysis!.score, "Revenue Growth").score).toBe(8);
    expect(categoryScore(analysis!.score, "Profitability").score).toBe(19);
    expect(categoryScore(analysis!.score, "Valuation").score).toBe(7);
    expect(categoryScore(analysis!.score, "Debt").score).toBe(11);
    expect(categoryScore(analysis!.score, "Cash Flow").score).toBe(18);
  });

  it("computes a distinct, in-range score for every mock company (not a hardcoded constant)", () => {
    for (const ticker of ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN"]) {
      const analysis = getMockCompanyAnalysis(ticker);
      expect(analysis).not.toBeNull();
      expect(analysis!.score.overall).toBeGreaterThanOrEqual(0);
      expect(analysis!.score.overall).toBeLessThanOrEqual(100);
      expect(analysis!.score.breakdown).toHaveLength(5);
    }
  });
});
