import { describe, expect, it } from "vitest";
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

describe("calculateGrowthRate", () => {
  it("computes net-income-style growth: 10 -> 12 is +20%", () => {
    expect(calculateGrowthRate(12, 10)).toBeCloseTo(0.2, 10);
  });

  it("handles a swing from a loss to a profit off the absolute prior value", () => {
    // -2.7 -> 30.4, matching the shape of AMZN's 2022 loss -> 2023 recovery:
    // (30.4 - (-2.7)) / |-2.7| ≈ 12.26
    expect(calculateGrowthRate(30.4, -2.7)).toBeCloseTo(12.26, 2);
  });

  it("returns null off a zero base or missing data", () => {
    expect(calculateGrowthRate(10, 0)).toBeNull();
    expect(calculateGrowthRate(null, 10)).toBeNull();
    expect(calculateGrowthRate(10, null)).toBeNull();
  });
});

describe("calculateRevenueGrowth", () => {
  it("computes positive growth: 100 -> 110 is +10%", () => {
    expect(calculateRevenueGrowth(110, 100)).toBeCloseTo(0.1, 10);
  });

  it("computes negative growth: 100 -> 90 is -10%", () => {
    expect(calculateRevenueGrowth(90, 100)).toBeCloseTo(-0.1, 10);
  });

  it("matches AAPL's mock revenue growth (391.0 -> 416.2 ~= 6.4%)", () => {
    // Cross-checked against lib/mock-data.ts AAPL.revenue.yoyGrowth (0.064).
    expect(calculateRevenueGrowth(416.2, 391.0)).toBeCloseTo(0.0644, 3);
  });

  it("returns null when the prior period is zero (undefined base)", () => {
    expect(calculateRevenueGrowth(100, 0)).toBeNull();
  });

  it("returns null when either input is missing", () => {
    expect(calculateRevenueGrowth(null, 100)).toBeNull();
    expect(calculateRevenueGrowth(100, null)).toBeNull();
  });

  it("signs growth off a negative prior period intuitively (loss -> profit)", () => {
    // -20 -> 10 is a $30 swing on a $20 base: (10 - (-20)) / |-20| = 1.5
    expect(calculateRevenueGrowth(10, -20)).toBeCloseTo(1.5, 10);
  });
});

describe("calculateRevenueCagr", () => {
  it("computes a clean 3-year CAGR: 100 -> 133.1 over 3 years is 10%", () => {
    // 1.1^3 = 1.331, so this is exact.
    expect(calculateRevenueCagr(100, 133.1, 3)).toBeCloseTo(0.1, 10);
  });

  it("computes decline as a negative CAGR: 100 -> 81 over 2 years is -10%", () => {
    // 0.9^2 = 0.81
    expect(calculateRevenueCagr(100, 81, 2)).toBeCloseTo(-0.1, 10);
  });

  it("returns -100% when revenue fell to zero", () => {
    expect(calculateRevenueCagr(100, 0, 3)).toBeCloseTo(-1, 10);
  });

  it("returns null for a zero or negative beginning value", () => {
    expect(calculateRevenueCagr(0, 100, 3)).toBeNull();
    expect(calculateRevenueCagr(-50, 100, 3)).toBeNull();
  });

  it("returns null for a negative ending value or non-positive year count", () => {
    expect(calculateRevenueCagr(100, -10, 3)).toBeNull();
    expect(calculateRevenueCagr(100, 133.1, 0)).toBeNull();
  });

  it("returns null when either value is missing", () => {
    expect(calculateRevenueCagr(null, 100, 3)).toBeNull();
    expect(calculateRevenueCagr(100, null, 3)).toBeNull();
  });
});

describe("calculateNetProfitMargin", () => {
  it("computes margin: 25 net income on 100 revenue is 25%", () => {
    expect(calculateNetProfitMargin(25, 100)).toBeCloseTo(0.25, 10);
  });

  it("handles a net loss: -10 net income on 100 revenue is -10%", () => {
    expect(calculateNetProfitMargin(-10, 100)).toBeCloseTo(-0.1, 10);
  });

  it("returns null for zero revenue", () => {
    expect(calculateNetProfitMargin(25, 0)).toBeNull();
  });

  it("returns null when data is missing", () => {
    expect(calculateNetProfitMargin(null, 100)).toBeNull();
    expect(calculateNetProfitMargin(25, null)).toBeNull();
  });
});

describe("calculateOperatingMargin", () => {
  it("computes margin: 30 operating income on 100 revenue is 30%", () => {
    expect(calculateOperatingMargin(30, 100)).toBeCloseTo(0.3, 10);
  });

  it("returns null for zero revenue", () => {
    expect(calculateOperatingMargin(30, 0)).toBeNull();
  });
});

describe("calculateROE", () => {
  it("computes ROE: 20 net income on 100 equity is 20%", () => {
    expect(calculateROE(20, 100)).toBeCloseTo(0.2, 10);
  });

  it("returns null for zero equity", () => {
    expect(calculateROE(20, 0)).toBeNull();
  });

  it("returns null for negative equity rather than a misleading ratio", () => {
    expect(calculateROE(20, -50)).toBeNull();
  });

  it("returns null when data is missing", () => {
    expect(calculateROE(null, 100)).toBeNull();
    expect(calculateROE(20, null)).toBeNull();
  });
});

describe("calculatePE", () => {
  it("computes P/E: 3100 market cap on 100 net income is 31x", () => {
    expect(calculatePE(3100, 100)).toBeCloseTo(31, 10);
  });

  it("returns null for a net loss (negative earnings)", () => {
    expect(calculatePE(3100, -50)).toBeNull();
  });

  it("returns null for zero net income", () => {
    expect(calculatePE(3100, 0)).toBeNull();
  });

  it("returns null when market cap is missing", () => {
    expect(calculatePE(null, 100)).toBeNull();
  });
});

describe("calculatePS", () => {
  it("computes P/S: 300 market cap on 100 revenue is 3x", () => {
    expect(calculatePS(300, 100)).toBeCloseTo(3, 10);
  });

  it("returns null for zero revenue", () => {
    expect(calculatePS(300, 0)).toBeNull();
  });
});

describe("calculatePB", () => {
  it("computes P/B: 500 market cap on 50 book value is 10x", () => {
    expect(calculatePB(500, 50)).toBeCloseTo(10, 10);
  });

  it("returns null for zero or negative book value", () => {
    expect(calculatePB(500, 0)).toBeNull();
    expect(calculatePB(500, -20)).toBeNull();
  });
});

describe("calculateDebtToEquity", () => {
  it("computes D/E: 40 debt on 100 equity is 0.4", () => {
    expect(calculateDebtToEquity(40, 100)).toBeCloseTo(0.4, 10);
  });

  it("returns null for zero or negative equity", () => {
    expect(calculateDebtToEquity(40, 0)).toBeNull();
    expect(calculateDebtToEquity(40, -10)).toBeNull();
  });
});

describe("calculateDebtToAssets", () => {
  it("computes D/A: 40 debt on 200 assets is 0.2", () => {
    expect(calculateDebtToAssets(40, 200)).toBeCloseTo(0.2, 10);
  });

  it("returns null for zero assets", () => {
    expect(calculateDebtToAssets(40, 0)).toBeNull();
  });
});

describe("calculateNetDebt", () => {
  it("computes positive net debt: 100 debt - 30 cash = 70", () => {
    expect(calculateNetDebt(100, 30)).toBe(70);
  });

  it("computes a net cash position as a negative number: 20 debt - 50 cash = -30", () => {
    expect(calculateNetDebt(20, 50)).toBe(-30);
  });

  it("returns null when data is missing", () => {
    expect(calculateNetDebt(null, 30)).toBeNull();
    expect(calculateNetDebt(100, null)).toBeNull();
  });
});

describe("calculateInterestCoverage", () => {
  it("computes coverage: 50 EBIT over 10 interest expense is 5x", () => {
    expect(calculateInterestCoverage(50, 10)).toBeCloseTo(5, 10);
  });

  it("returns null when interest expense is zero (no debt to cover)", () => {
    expect(calculateInterestCoverage(50, 0)).toBeNull();
  });

  it("returns null when interest expense isn't reported", () => {
    expect(calculateInterestCoverage(50, null)).toBeNull();
  });
});

describe("calculateOperatingCashFlow", () => {
  it("passes through a reported figure unchanged", () => {
    expect(calculateOperatingCashFlow(118.5)).toBe(118.5);
  });

  it("passes through null when not reported", () => {
    expect(calculateOperatingCashFlow(null)).toBeNull();
  });
});

describe("calculateFreeCashFlow", () => {
  it("computes FCF: 100 OCF - 30 capex = 70", () => {
    expect(calculateFreeCashFlow(100, 30)).toBe(70);
  });

  it("allows negative FCF when capex exceeds OCF: 50 OCF - 70 capex = -20", () => {
    expect(calculateFreeCashFlow(50, 70)).toBe(-20);
  });

  it("returns null when data is missing", () => {
    expect(calculateFreeCashFlow(null, 30)).toBeNull();
    expect(calculateFreeCashFlow(100, null)).toBeNull();
  });
});

describe("calculateFreeCashFlowGrowth", () => {
  it("matches AMZN's mock FCF trend worsening from -14.9 to -16.9", () => {
    // Cross-checked against lib/mock-data.ts AMZN.cashFlow.freeCashFlowHistory:
    // (-16.9 - (-14.9)) / |-14.9| = -2.0 / 14.9 ≈ -0.1342 (FCF got worse).
    expect(calculateFreeCashFlowGrowth(-16.9, -14.9)).toBeCloseTo(-0.1342, 3);
  });

  it("shows FCF improving while still negative: -14.9 -> -12 is positive growth", () => {
    // (-12 - (-14.9)) / |-14.9| = 2.9 / 14.9 ≈ 0.1946
    expect(calculateFreeCashFlowGrowth(-12, -14.9)).toBeCloseTo(0.1946, 3);
  });

  it("returns null off a zero base", () => {
    expect(calculateFreeCashFlowGrowth(10, 0)).toBeNull();
  });
});

describe("calculateOcfToNetIncome", () => {
  it("computes the ratio: 110 OCF on 100 net income is 1.1", () => {
    expect(calculateOcfToNetIncome(110, 100)).toBeCloseTo(1.1, 10);
  });

  it("allows a negative ratio when net income is a loss but cash flow is positive", () => {
    expect(calculateOcfToNetIncome(50, -20)).toBeCloseTo(-2.5, 10);
  });

  it("returns null for zero net income", () => {
    expect(calculateOcfToNetIncome(50, 0)).toBeNull();
  });

  it("returns null when data is missing", () => {
    expect(calculateOcfToNetIncome(null, 100)).toBeNull();
    expect(calculateOcfToNetIncome(50, null)).toBeNull();
  });
});
