import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyAnalysis } from "@/types/scoring";

// `server-only` throws outside Next's own build — mocked away so these
// modules are importable under plain Vitest/Node.
vi.mock("server-only", () => ({}));

// lib/sec-financial-api.ts (the real SEC EDGAR caller) is mocked entirely
// — these tests exercise the caching/orchestration/fallback layer in
// lib/company-analysis.ts, not the provider integration itself (already
// covered by tests/sec-financial-api.test.ts), and must never make a
// real network request.
const mockGetLiveCompanyAnalysis = vi.fn();
vi.mock("@/lib/sec-financial-api", () => ({
  getLiveCompanyAnalysis: (ticker: string) => mockGetLiveCompanyAnalysis(ticker),
}));

const { getCompanyAnalysis, refreshCompanyData } = await import("@/lib/company-analysis");
const { __resetCacheForTests, getCachedAnalysis, setCachedAnalysis, FRESH_TTL_MS } = await import(
  "@/lib/company-cache"
);

function makeAnalysis(ticker: string, name: string): CompanyAnalysis {
  return {
    financialData: {
      profile: {
        ticker,
        name,
        sector: "Technology",
        industry: "Software",
        exchange: "TEST",
        currency: "USD",
        latestPrice: 100,
        priceAsOf: "2026-01-01",
        marketCap: 1000,
        lastUpdated: "2026-01-01",
        description: "",
      },
      revenue: { history: [{ year: "FY2025", value: 100 }], yoyGrowth: 0.1, cagr3yr: 0.1 },
      profitability: {
        netIncomeHistory: [{ year: "FY2025", value: 10 }],
        netMargin: 0.1,
        operatingMargin: 0.12,
        roe: 0.15,
        netIncomeGrowth: 0.08,
      },
      valuation: { pe: 20, ps: 3, pb: 4, evToEbitda: 12 },
      debt: {
        totalDebtHistory: [{ year: "FY2025", value: 20 }],
        totalDebt: 20,
        debtToEquity: 0.5,
        debtToAssets: 0.25,
        netDebt: 10,
        interestCoverage: 5,
      },
      cashFlow: {
        operatingCashFlowHistory: [{ year: "FY2025", value: 12 }],
        freeCashFlowHistory: [{ year: "FY2025", value: 6 }],
        operatingCashFlow: 12,
        freeCashFlow: 6,
        fcfGrowth: 0.03,
        ocfToNetIncome: 1.2,
      },
    },
    score: {
      overall: 60,
      maxScore: 100,
      rating: "Moderate",
      breakdown: [
        { category: "Revenue Growth", score: 12, maxScore: 20, rationale: "r" },
        { category: "Profitability", score: 10, maxScore: 20, rationale: "r" },
        { category: "Valuation", score: 15, maxScore: 20, rationale: "r" },
        { category: "Debt", score: 13, maxScore: 20, rationale: "r" },
        { category: "Cash Flow", score: 10, maxScore: 20, rationale: "r" },
      ],
    },
    insights: [],
  };
}

beforeEach(() => {
  __resetCacheForTests();
  mockGetLiveCompanyAnalysis.mockReset();
});

afterEach(() => {
  __resetCacheForTests();
});

describe("getCompanyAnalysis — cache miss", () => {
  it("fetches live when nothing is cached, and populates the cache on success", async () => {
    mockGetLiveCompanyAnalysis.mockResolvedValue({ ok: true, data: makeAnalysis("AAPL", "Apple Inc.") });

    const result = await getCompanyAnalysis("AAPL", false);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toBe("live");
    expect(mockGetLiveCompanyAnalysis).toHaveBeenCalledTimes(1);
    expect(getCachedAnalysis("AAPL")).not.toBeNull();
  });
});

describe("getCompanyAnalysis — cache hit", () => {
  it("serves a fresh cache entry without calling the provider at all", async () => {
    setCachedAnalysis({
      ticker: "AAPL",
      companyName: "Apple Inc.",
      financialData: makeAnalysis("AAPL", "Apple Inc.").financialData,
      score: makeAnalysis("AAPL", "Apple Inc.").score,
      insights: [],
      fetchedAt: Date.now(),
    });

    const result = await getCompanyAnalysis("AAPL", false);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toBe("recent");
    expect(mockGetLiveCompanyAnalysis).not.toHaveBeenCalled();
  });
});

describe("getCompanyAnalysis — stale cache", () => {
  it("attempts a live refetch once the cache is older than the freshness window", async () => {
    setCachedAnalysis({
      ticker: "AAPL",
      companyName: "Apple Inc. (old)",
      financialData: makeAnalysis("AAPL", "Apple Inc. (old)").financialData,
      score: makeAnalysis("AAPL", "Apple Inc. (old)").score,
      insights: [],
      fetchedAt: Date.now() - (FRESH_TTL_MS + 60_000),
    });
    mockGetLiveCompanyAnalysis.mockResolvedValue({ ok: true, data: makeAnalysis("AAPL", "Apple Inc. (fresh)") });

    const result = await getCompanyAnalysis("AAPL", false);

    expect(mockGetLiveCompanyAnalysis).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("live");
      expect(result.data.financialData.profile.name).toBe("Apple Inc. (fresh)");
    }
  });
});

describe("refreshCompanyData — successful provider refresh", () => {
  it("updates the cache and reports success", async () => {
    mockGetLiveCompanyAnalysis.mockResolvedValue({ ok: true, data: makeAnalysis("AAPL", "Apple Inc.") });

    const outcome = await refreshCompanyData("AAPL");

    expect(outcome).toEqual({ liveSucceeded: true, hasFallback: true });
    expect(getCachedAnalysis("AAPL")).not.toBeNull();
  });
});

describe("provider rate limit with cache available", () => {
  it("falls back to the cached analysis instead of a blocking error", async () => {
    const cachedEntry = {
      ticker: "AAPL",
      companyName: "Apple Inc.",
      financialData: makeAnalysis("AAPL", "Apple Inc.").financialData,
      score: makeAnalysis("AAPL", "Apple Inc.").score,
      insights: [],
      fetchedAt: Date.now() - (FRESH_TTL_MS + 60_000), // stale, so a live attempt is triggered
    };
    setCachedAnalysis(cachedEntry);
    mockGetLiveCompanyAnalysis.mockResolvedValue({
      ok: false,
      error: { reason: "rate_limited", message: "The financial data provider's rate limit was reached." },
    });

    const result = await getCompanyAnalysis("AAPL", false);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("recent");
      expect(result.fetchedAt).toBe(cachedEntry.fetchedAt);
      expect(result.data.financialData.profile.name).toBe("Apple Inc.");
    }
  });
});

describe("provider rate limit with no cache", () => {
  it("returns a blocking error only when there is truly nothing to fall back to", async () => {
    mockGetLiveCompanyAnalysis.mockResolvedValue({
      ok: false,
      error: { reason: "rate_limited", message: "The financial data provider's rate limit was reached." },
    });

    // Deliberately NOT one of the five core demo tickers — those always
    // have a bundled verified snapshot as a last-resort fallback (see the
    // "snapshot fallback for the core demo tickers" tests below), so this
    // test needs a ticker with truly nothing to fall back to.
    const result = await getCompanyAnalysis("TSLA", false);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("rate_limited");
  });
});

describe("snapshot fallback for the core demo tickers", () => {
  it("serves the bundled verified SEC snapshot when live fails and nothing is cached", async () => {
    mockGetLiveCompanyAnalysis.mockResolvedValue({
      ok: false,
      error: { reason: "provider_error", message: "Could not reach SEC EDGAR." },
    });

    const result = await getCompanyAnalysis("AAPL", false);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("recent");
      expect(result.data.financialData.profile.ticker).toBe("AAPL");
      // The bundled snapshot is real SEC-derived data, not a placeholder.
      expect(result.data.financialData.revenue.history.length).toBeGreaterThan(0);
      expect(result.data.score.breakdown).toHaveLength(5);
    }
  });

  it("never uses a snapshot for a ticker outside the five core demo companies", async () => {
    mockGetLiveCompanyAnalysis.mockResolvedValue({
      ok: false,
      error: { reason: "provider_error", message: "Could not reach SEC EDGAR." },
    });

    const result = await getCompanyAnalysis("TSLA", false);

    expect(result.ok).toBe(false);
  });
});

describe("invalid ticker", () => {
  it("propagates a not_found result when the provider reports one and no cache exists", async () => {
    mockGetLiveCompanyAnalysis.mockResolvedValue({
      ok: false,
      error: { reason: "not_found", message: '"ZZZZZZ" isn\'t a valid ticker symbol.' },
    });

    const result = await getCompanyAnalysis("ZZZZZZ", false);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });
});

describe("cache isolation between tickers", () => {
  it("never mixes one ticker's cached data into another ticker's result", async () => {
    setCachedAnalysis({
      ticker: "AAPL",
      companyName: "Apple Inc.",
      financialData: makeAnalysis("AAPL", "Apple Inc.").financialData,
      score: makeAnalysis("AAPL", "Apple Inc.").score,
      insights: [],
      fetchedAt: Date.now(),
    });
    mockGetLiveCompanyAnalysis.mockResolvedValue({ ok: true, data: makeAnalysis("MSFT", "Microsoft Corporation") });

    const msft = await getCompanyAnalysis("MSFT", false);

    expect(msft.ok).toBe(true);
    if (msft.ok) expect(msft.data.financialData.profile.name).toBe("Microsoft Corporation");

    // The pre-existing AAPL entry must be completely unaffected.
    const aaplCache = getCachedAnalysis("AAPL");
    expect(aaplCache?.companyName).toBe("Apple Inc.");
    expect(aaplCache?.ticker).toBe("AAPL");

    // A lookup for a ticker that was never cached must never accidentally
    // resolve to another ticker's entry.
    expect(getCachedAnalysis("GOOGL")).toBeNull();
  });
});

describe("refresh failure preserving cached data", () => {
  it("leaves the existing cache entry completely untouched when a refresh fails", async () => {
    const original = {
      ticker: "AAPL",
      companyName: "Apple Inc. (original)",
      financialData: makeAnalysis("AAPL", "Apple Inc. (original)").financialData,
      score: makeAnalysis("AAPL", "Apple Inc. (original)").score,
      insights: [],
      fetchedAt: Date.now() - 1000,
    };
    setCachedAnalysis(original);
    mockGetLiveCompanyAnalysis.mockResolvedValue({
      ok: false,
      error: { reason: "provider_error", message: "The financial data provider returned an unexpected response." },
    });

    const outcome = await refreshCompanyData("AAPL");

    expect(outcome.liveSucceeded).toBe(false);
    expect(outcome.hasFallback).toBe(true);
    expect(outcome.failureMessage).toBeTruthy();
    expect(getCachedAnalysis("AAPL")).toEqual(original);
  });

  it("reports no fallback available when a refresh fails and nothing was ever cached", async () => {
    mockGetLiveCompanyAnalysis.mockResolvedValue({
      ok: false,
      error: { reason: "rate_limited", message: "rate limited" },
    });

    const outcome = await refreshCompanyData("TSLA");

    expect(outcome).toEqual({
      liveSucceeded: false,
      hasFallback: false,
      failureMessage: "rate limited",
    });
  });
});

describe("explicit demo mode", () => {
  it("never calls the live provider and is clearly labeled", async () => {
    const result = await getCompanyAnalysis("AAPL", true);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toBe("demo");
    expect(mockGetLiveCompanyAnalysis).not.toHaveBeenCalled();
  });

  it("reports not_found for a ticker outside the demo data set, without touching the provider", async () => {
    const result = await getCompanyAnalysis("NOTREAL", true);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_found");
      expect(result.source).toBe("demo");
    }
    expect(mockGetLiveCompanyAnalysis).not.toHaveBeenCalled();
  });
});

describe("request deduplication", () => {
  it("coalesces two concurrent requests for the same uncached ticker into one provider call", async () => {
    let resolveFetch: (value: { ok: true; data: CompanyAnalysis }) => void;
    mockGetLiveCompanyAnalysis.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = getCompanyAnalysis("AAPL", false);
    const second = getCompanyAnalysis("AAPL", false);

    // Let both callers register before the fetch resolves.
    await new Promise((r) => setTimeout(r, 0));
    resolveFetch!({ ok: true, data: makeAnalysis("AAPL", "Apple Inc.") });

    const [a, b] = await Promise.all([first, second]);

    expect(mockGetLiveCompanyAnalysis).toHaveBeenCalledTimes(1);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });
});
