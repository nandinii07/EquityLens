import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyAnalysis } from "@/types/scoring";

// `server-only` throws outside Next's own build — mocked away, same
// pattern used by every other test file in this suite.
vi.mock("server-only", () => ({}));

// The ingestion orchestrator only ever talks to SEC EDGAR through
// getLiveCompanyAnalysis — mocking that one seam is enough to fully
// control every scenario below without a real network call, and proves
// lib/screener-ingest.ts does not itself duplicate any normalization or
// scoring logic (it only calls this function and projects the result).
const mockGetLiveCompanyAnalysis = vi.fn();
vi.mock("@/lib/sec-financial-api", () => ({
  getLiveCompanyAnalysis: (...args: unknown[]) => mockGetLiveCompanyAnalysis(...args),
}));

const { ingestScreenerUniverse } = await import("@/lib/screener-ingest");

function analysisFor(ticker: string, overrides: Partial<{ score: number }> = {}): { ok: true; data: CompanyAnalysis } {
  return {
    ok: true as const,
    data: {
      financialData: {
        profile: {
          ticker,
          name: `${ticker} Inc.`,
          sector: "Technology",
          industry: "Software",
          exchange: "NASDAQ",
          currency: "USD",
          latestPrice: 100,
          priceAsOf: "2026-01-01",
          marketCap: 500,
          lastUpdated: "2026-01-01",
          description: "",
        },
        revenue: { history: [{ year: "FY2025", value: 10 }], yoyGrowth: 0.12, cagr3yr: 0.1 },
        profitability: { netIncomeHistory: [{ year: "FY2025", value: 2 }], netMargin: 0.2, operatingMargin: 0.25, roe: 0.18, netIncomeGrowth: 0.1 },
        valuation: { pe: 20, ps: 5, pb: 6, evToEbitda: 12 },
        debt: { totalDebtHistory: [{ year: "FY2025", value: 1 }], totalDebt: 1, debtToEquity: 0.3, debtToAssets: 0.1, netDebt: -1, interestCoverage: 10 },
        cashFlow: {
          operatingCashFlowHistory: [{ year: "FY2025", value: 3 }],
          freeCashFlowHistory: [{ year: "FY2025", value: 2.5 }],
          operatingCashFlow: 3,
          freeCashFlow: 2.5,
          fcfGrowth: 0.08,
          ocfToNetIncome: 1.5,
        },
      },
      score: { overall: overrides.score ?? 78, maxScore: 100, rating: "Strong", breakdown: [] },
      insights: [],
    },
  };
}

describe("ingestScreenerUniverse", () => {
  beforeEach(() => {
    mockGetLiveCompanyAnalysis.mockReset();
  });

  it("projects a successful analysis into a screener row using only its already-computed fields", async () => {
    mockGetLiveCompanyAnalysis.mockResolvedValueOnce(analysisFor("AAPL", { score: 91 }));

    const { rows, failures } = await ingestScreenerUniverse(["AAPL"], { delayFn: async () => {} });

    expect(failures).toEqual([]);
    expect(rows).toEqual([
      {
        ticker: "AAPL",
        companyName: "AAPL Inc.",
        sector: "Technology",
        score: 91,
        rating: "Strong",
        revenueGrowth: 0.12,
        netMargin: 0.2,
        roe: 0.18,
        debtToEquity: 0.3,
        freeCashFlow: 2.5,
        fcfGrowth: 0.08,
        dataDate: "2026-01-01",
      },
    ]);
  });

  it("excludes a company whose data could not be normalized (ok: false) and records why, without fabricating a row", async () => {
    mockGetLiveCompanyAnalysis.mockResolvedValueOnce({
      ok: false,
      error: { reason: "not_found", message: "No US-GAAP financial statements are available for \"BADCO\"." },
    });

    const { rows, failures } = await ingestScreenerUniverse(["BADCO"], { delayFn: async () => {} });

    expect(rows).toEqual([]);
    expect(failures).toEqual([{ ticker: "BADCO", reason: expect.stringContaining("No US-GAAP financial statements") }]);
  });

  it("isolates a thrown failure to one ticker: the batch continues and later tickers still succeed", async () => {
    mockGetLiveCompanyAnalysis
      .mockResolvedValueOnce(analysisFor("FIRST"))
      .mockRejectedValueOnce(new Error("SEC EDGAR request timed out."))
      .mockResolvedValueOnce(analysisFor("THIRD"));

    const { rows, failures } = await ingestScreenerUniverse(["FIRST", "CRASHES", "THIRD"], { delayFn: async () => {} });

    expect(rows.map((r) => r.ticker)).toEqual(["FIRST", "THIRD"]);
    expect(failures).toEqual([{ ticker: "CRASHES", reason: "SEC EDGAR request timed out." }]);
    // All three tickers were attempted — the failure did not abort the loop.
    expect(mockGetLiveCompanyAnalysis).toHaveBeenCalledTimes(3);
  });

  it("never fabricates a value for a metric the source data reported as null", async () => {
    const analysis = analysisFor("PARTIAL");
    analysis.data.financialData.profitability.roe = null;
    analysis.data.financialData.debt.debtToEquity = null;
    mockGetLiveCompanyAnalysis.mockResolvedValueOnce(analysis);

    const { rows } = await ingestScreenerUniverse(["PARTIAL"], { delayFn: async () => {} });

    expect(rows[0].roe).toBeNull();
    expect(rows[0].debtToEquity).toBeNull();
  });

  it("normalizes and upper-cases the ticker before calling the pipeline", async () => {
    mockGetLiveCompanyAnalysis.mockResolvedValueOnce(analysisFor("AAPL"));
    await ingestScreenerUniverse([" aapl "], { delayFn: async () => {} });
    expect(mockGetLiveCompanyAnalysis).toHaveBeenCalledWith("AAPL");
  });

  it("reports progress for every ticker, success or failure", async () => {
    mockGetLiveCompanyAnalysis
      .mockResolvedValueOnce(analysisFor("A"))
      .mockResolvedValueOnce({ ok: false, error: { reason: "not_found", message: "nope" } });

    const progress: { ticker: string; ok: boolean }[] = [];
    await ingestScreenerUniverse(["A", "B"], {
      delayFn: async () => {},
      onProgress: (info) => progress.push({ ticker: info.ticker, ok: info.ok }),
    });

    expect(progress).toEqual([
      { ticker: "A", ok: true },
      { ticker: "B", ok: false },
    ]);
  });
});
