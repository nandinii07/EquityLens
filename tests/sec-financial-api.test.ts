import { beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws outside Next's own build — mocked away, same
// pattern used by every other test file in this suite.
vi.mock("server-only", () => ({}));

// Every SEC EDGAR / market-data network call is mocked. This suite must
// never make a real request — see fetchSecJson / resolveTicker /
// getLatestPrice mocks below.
const mockFetchSecJson = vi.fn();
const mockResolveTicker = vi.fn();
const mockGetLatestPrice = vi.fn();

vi.mock("@/lib/sec-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sec-client")>("@/lib/sec-client");
  return {
    ...actual,
    fetchSecJson: (...args: unknown[]) => mockFetchSecJson(...args),
  };
});
vi.mock("@/lib/sec-ticker-map", () => ({
  resolveTicker: (...args: unknown[]) => mockResolveTicker(...args),
}));
vi.mock("@/lib/market-data", () => ({
  getLatestPrice: (...args: unknown[]) => mockGetLatestPrice(...args),
}));

const { getLiveCompanyAnalysis } = await import("@/lib/sec-financial-api");
const { SecFetchError } = await import("@/lib/sec-client");

// ---------------------------------------------------------------------------
// Fixture construction
// ---------------------------------------------------------------------------

function usdFact(
  start: string,
  end: string,
  val: number,
  overrides: Partial<{ form: string; fp: string; filed: string; fy: number }> = {},
) {
  return {
    start,
    end,
    val,
    fy: overrides.fy ?? Number(end.slice(0, 4)),
    fp: overrides.fp ?? "FY",
    form: overrides.form ?? "10-K",
    filed: overrides.filed ?? `${Number(end.slice(0, 4)) + 1}-02-01`,
  };
}

function instantFact(end: string, val: number, overrides: Partial<{ form: string; filed: string }> = {}) {
  return {
    end,
    val,
    form: overrides.form ?? "10-K",
    filed: overrides.filed ?? `${Number(end.slice(0, 4)) + 1}-02-01`,
  };
}

/**
 * A hand-built companyfacts fixture exercising every normalization case
 * called out by the migration spec:
 * - Revenue reported under an older tag (SalesRevenueNet) for the first
 *   two years, then a tag switch to the modern ASC-606 tag — this must
 *   merge into one continuous 4-year series, not truncate at the switch.
 * - FY2023 has both an original 10-K value and a later-filed 10-K/A
 *   (amended) value — the amendment must win.
 * - A quarterly 10-Q fact and a non-"FY" duration fact are present in the
 *   revenue series and must both be excluded.
 * - InterestExpense is entirely absent (missing-facts -> null downstream).
 * - NetIncomeLoss includes a genuine loss year (negative value preserved).
 * - Debt is split across LongTermDebtNoncurrent/-Current, with only the
 *   noncurrent tag present in the earliest year.
 */
const FIXTURE_FACTS = {
  entityName: "Test Company Inc.",
  facts: {
    "us-gaap": {
      SalesRevenueNet: {
        units: {
          USD: [usdFact("2021-01-01", "2022-01-01", 100_000_000_000), usdFact("2022-01-01", "2023-01-01", 110_000_000_000)],
        },
      },
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        units: {
          USD: [
            usdFact("2022-01-01", "2023-01-01", 120_000_000_000, { filed: "2024-11-01" }), // amended, later filed than the SalesRevenueNet fact for the same period (2024-02-01) — should win
            usdFact("2023-01-01", "2024-01-01", 130_000_000_000),
            usdFact("2024-01-01", "2025-01-01", 140_000_000_000),
            // Noise that must be excluded:
            usdFact("2024-10-01", "2025-01-01", 35_000_000_000, { form: "10-Q", fp: "Q4" }), // quarterly form
            usdFact("2024-01-01", "2024-04-01", 33_000_000_000, { fp: "Q1" }), // non-FY duration
          ],
        },
      },
      NetIncomeLoss: {
        units: {
          USD: [
            usdFact("2021-01-01", "2022-01-01", 10_000_000_000),
            usdFact("2022-01-01", "2023-01-01", -2_000_000_000), // genuine loss year
            usdFact("2023-01-01", "2024-01-01", 15_000_000_000),
            usdFact("2024-01-01", "2025-01-01", 20_000_000_000),
          ],
        },
      },
      OperatingIncomeLoss: {
        units: {
          USD: [
            usdFact("2021-01-01", "2022-01-01", 12_000_000_000),
            usdFact("2022-01-01", "2023-01-01", -1_000_000_000),
            usdFact("2023-01-01", "2024-01-01", 18_000_000_000),
            usdFact("2024-01-01", "2025-01-01", 24_000_000_000),
          ],
        },
      },
      NetCashProvidedByUsedInOperatingActivities: {
        units: {
          USD: [
            usdFact("2021-01-01", "2022-01-01", 14_000_000_000),
            usdFact("2022-01-01", "2023-01-01", 3_000_000_000),
            usdFact("2023-01-01", "2024-01-01", 20_000_000_000),
            usdFact("2024-01-01", "2025-01-01", 26_000_000_000),
          ],
        },
      },
      PaymentsToAcquirePropertyPlantAndEquipment: {
        units: {
          USD: [
            usdFact("2021-01-01", "2022-01-01", 4_000_000_000),
            usdFact("2022-01-01", "2023-01-01", 5_000_000_000),
            usdFact("2023-01-01", "2024-01-01", 6_000_000_000),
            usdFact("2024-01-01", "2025-01-01", 7_000_000_000),
          ],
        },
      },
      Assets: {
        units: { USD: [instantFact("2022-01-01", 200_000_000_000), instantFact("2023-01-01", 210_000_000_000), instantFact("2024-01-01", 230_000_000_000), instantFact("2025-01-01", 250_000_000_000)] },
      },
      StockholdersEquity: {
        units: { USD: [instantFact("2022-01-01", 80_000_000_000), instantFact("2023-01-01", 82_000_000_000), instantFact("2024-01-01", 95_000_000_000), instantFact("2025-01-01", 110_000_000_000)] },
      },
      CashAndCashEquivalentsAtCarryingValue: {
        units: { USD: [instantFact("2022-01-01", 30_000_000_000), instantFact("2023-01-01", 25_000_000_000), instantFact("2024-01-01", 40_000_000_000), instantFact("2025-01-01", 45_000_000_000)] },
      },
      LongTermDebtNoncurrent: {
        units: { USD: [instantFact("2022-01-01", 20_000_000_000), instantFact("2023-01-01", 21_000_000_000), instantFact("2024-01-01", 22_000_000_000), instantFact("2025-01-01", 23_000_000_000)] },
      },
      LongTermDebtCurrent: {
        // Only present from 2023 onward — 2022's total debt must still resolve using just the noncurrent tag, not become null.
        units: { USD: [instantFact("2023-01-01", 2_000_000_000), instantFact("2024-01-01", 2_500_000_000), instantFact("2025-01-01", 3_000_000_000)] },
      },
      CommonStockSharesOutstanding: {
        units: { shares: [{ end: "2025-01-01", val: 1_000_000_000, form: "10-K", filed: "2025-02-01" }] },
      },
      // InterestExpense deliberately absent entirely.
    },
    dei: {},
  },
};

beforeEach(() => {
  mockFetchSecJson.mockReset();
  mockResolveTicker.mockReset();
  mockGetLatestPrice.mockReset();

  mockResolveTicker.mockResolvedValue({ cik: 123, cikPadded: "0000000123", ticker: "TEST", title: "Test Company Inc." });
  mockFetchSecJson.mockImplementation(async (url: string) => {
    if (url.includes("/submissions/")) {
      return { name: "Test Company Inc.", sic: "3571", sicDescription: "Electronic Computers", exchanges: ["Nasdaq"], description: "A test company." };
    }
    if (url.includes("/companyfacts/")) {
      return FIXTURE_FACTS;
    }
    throw new Error(`Unexpected URL in test: ${url}`);
  });
  mockGetLatestPrice.mockResolvedValue(null);
});

describe("concept mapping and tag-switch merging", () => {
  it("merges revenue across a tag switch instead of truncating at the older tag's last period", async () => {
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Fiscal-year labels are keyed off each period's *end* date (see
    // fiscalYearLabel in lib/sec-financial-api.ts), so the period running
    // 2021-01-01 -> 2022-01-01 is labeled "FY2022", and so on.
    const years = result.data.financialData.revenue.history.map((v) => v.year);
    expect(years).toEqual(["FY2022", "FY2023", "FY2024", "FY2025"]);
  });

  it("prefers the later-filed (amended) value when two tags report the same period", async () => {
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The period ending 2023-01-01 ("FY2023") exists under both
    // SalesRevenueNet (110B, filed earlier) and the ASC-606 tag (120B,
    // filed later/amended) — the amendment must win.
    const fy2023 = result.data.financialData.revenue.history.find((v) => v.year === "FY2023");
    expect(fy2023?.value).toBeCloseTo(120, 5);
  });

  it("excludes quarterly (10-Q) and non-annual-duration facts from the annual series", async () => {
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // If the 10-Q or Q1 noise (both dated within the FY2025 period) had
    // leaked in, this period's revenue would not be exactly 140B.
    const fy2025 = result.data.financialData.revenue.history.find((v) => v.year === "FY2025");
    expect(fy2025?.value).toBeCloseTo(140, 5);
  });
});

describe("unit normalization and negative values", () => {
  it("converts raw USD to billions", async () => {
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.financialData.revenue.history.at(-1)?.value).toBeCloseTo(140, 5);
  });

  it("preserves a genuine loss year as a negative value, never clamped to zero or null", async () => {
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The loss (-2B) is reported for the period ending 2023-01-01, labeled "FY2023".
    const lossYear = result.data.financialData.profitability.netIncomeHistory.find((v) => v.year === "FY2023");
    expect(lossYear?.value).toBeCloseTo(-2, 5);
  });
});

describe("missing facts stay null, never fabricated", () => {
  it("leaves interestCoverage null when InterestExpense has no reported facts at all", async () => {
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.financialData.debt.interestCoverage).toBeNull();
  });
});

describe("debt aggregation across split concepts", () => {
  it("sums noncurrent + current debt when both are present", async () => {
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fy2024 = result.data.financialData.debt.totalDebtHistory.find((v) => v.year === "FY2024");
    expect(fy2024?.value).toBeCloseTo(22 + 2.5, 5);
  });

  it("falls back to just the noncurrent tag when current debt isn't reported that year, rather than nulling the total", async () => {
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // LongTermDebtCurrent has no fact for the period ending 2022-01-01 ("FY2022") in the fixture.
    const fy2022 = result.data.financialData.debt.totalDebtHistory.find((v) => v.year === "FY2022");
    expect(fy2022?.value).toBeCloseTo(20, 5);
  });
});

describe("valuation metrics without a market price", () => {
  it("leaves every valuation ratio null, and the score's Valuation category degrades to insufficient data rather than fabricating a number", async () => {
    mockGetLatestPrice.mockResolvedValue(null);
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.financialData.valuation).toEqual({ pe: null, ps: null, pb: null, evToEbitda: null });

    const valuationCategory = result.data.score.breakdown.find((c) => c.category === "Valuation");
    expect(valuationCategory?.score).toBe(0);
    expect(valuationCategory?.rationale).toMatch(/insufficient data/i);
  });
});

describe("valuation metrics with a market price available", () => {
  it("computes real ratios from price x shares once a price is available", async () => {
    mockGetLatestPrice.mockResolvedValue({ value: 200, asOf: "2026-01-15" });
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // marketCap = 200 * 1,000,000,000 shares = 200,000,000,000 = 200B
    expect(result.data.financialData.profile.marketCap).toBeCloseTo(200, 5);
    expect(result.data.financialData.valuation.pe).not.toBeNull();
    expect(result.data.financialData.valuation.ps).not.toBeNull();
  });
});

describe("score calculation from SEC-derived data", () => {
  it("produces a full 5-category deterministic score, not a placeholder", async () => {
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.score.breakdown).toHaveLength(5);
    expect(result.data.score.overall).toBeGreaterThanOrEqual(0);
    expect(result.data.score.overall).toBeLessThanOrEqual(100);
  });
});

describe("invalid ticker", () => {
  it("rejects a malformed ticker without ever calling resolveTicker", async () => {
    const result = await getLiveCompanyAnalysis("not-a-ticker!!");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("not_found");
    expect(mockResolveTicker).not.toHaveBeenCalled();
  });
});

describe("ticker not resolvable to a CIK", () => {
  it("reports not_found without attempting submissions/companyfacts fetches", async () => {
    mockResolveTicker.mockResolvedValue(null);
    const result = await getLiveCompanyAnalysis("ZZZZZ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("not_found");
    expect(mockFetchSecJson).not.toHaveBeenCalled();
  });
});

describe("provider failure", () => {
  it("propagates a provider_error when companyfacts fails", async () => {
    mockFetchSecJson.mockImplementation(async (url: string) => {
      if (url.includes("/submissions/")) return { name: "Test Company Inc.", exchanges: ["Nasdaq"] };
      throw new SecFetchError("provider_error", "SEC EDGAR returned an unexpected response.");
    });
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("provider_error");
  });
});

describe("provider timeout", () => {
  it("surfaces a timed-out SEC request as a provider_error, never an unresolved promise", async () => {
    mockFetchSecJson.mockImplementation(async (url: string) => {
      if (url.includes("/submissions/")) return { name: "Test Company Inc.", exchanges: ["Nasdaq"] };
      throw new SecFetchError("provider_error", "The SEC EDGAR request timed out.");
    });
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/timed out/i);
  });
});

describe("rate limited", () => {
  it("propagates a rate_limited reason distinctly from a generic provider error", async () => {
    mockFetchSecJson.mockImplementation(async (url: string) => {
      if (url.includes("/submissions/")) return { name: "Test Company Inc.", exchanges: ["Nasdaq"] };
      throw new SecFetchError("rate_limited", "SEC EDGAR's request limit was reached.");
    });
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("rate_limited");
  });
});

describe("no US-GAAP facts at all", () => {
  it("reports not_found rather than crashing or fabricating empty data", async () => {
    mockFetchSecJson.mockImplementation(async (url: string) => {
      if (url.includes("/submissions/")) return { name: "Empty Co", exchanges: ["Nasdaq"] };
      return { entityName: "Empty Co", facts: {} };
    });
    const result = await getLiveCompanyAnalysis("TEST");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("not_found");
  });
});
