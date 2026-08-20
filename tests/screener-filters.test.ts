import { describe, expect, it } from "vitest";
import {
  applyFilters,
  applyPreset,
  EMPTY_FILTERS,
  SCREENER_PRESETS,
  sortRows,
  type ScreenerCompanyRow,
} from "@/lib/screener-filters";

function row(overrides: Partial<ScreenerCompanyRow> = {}): ScreenerCompanyRow {
  return {
    ticker: "TEST",
    companyName: "Test Co",
    sector: "Technology",
    score: 60,
    rating: "Moderate",
    revenueGrowth: 0.1,
    netMargin: 0.1,
    roe: 0.1,
    debtToEquity: 0.5,
    freeCashFlow: 5,
    fcfGrowth: 0.05,
    dataDate: "2026-01-01",
    ...overrides,
  };
}

describe("applyFilters", () => {
  it("returns every row when no filters are set", () => {
    const rows = [row({ ticker: "A" }), row({ ticker: "B" })];
    expect(applyFilters(rows, EMPTY_FILTERS)).toHaveLength(2);
  });

  it("matches the search query against ticker or company name, case-insensitively", () => {
    const rows = [row({ ticker: "AAPL", companyName: "Apple Inc." }), row({ ticker: "MSFT", companyName: "Microsoft Corp" })];
    expect(applyFilters(rows, { ...EMPTY_FILTERS, query: "apple" })).toEqual([rows[0]]);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, query: "MSFT" })).toEqual([rows[1]]);
  });

  it("applies a minimum-score threshold", () => {
    const rows = [row({ ticker: "LOW", score: 40 }), row({ ticker: "HIGH", score: 80 })];
    expect(applyFilters(rows, { ...EMPTY_FILTERS, minScore: 75 })).toEqual([rows[1]]);
  });

  it("applies a maximum debt-to-equity threshold", () => {
    const rows = [row({ ticker: "LEVERED", debtToEquity: 2 }), row({ ticker: "LEAN", debtToEquity: 0.2 })];
    expect(applyFilters(rows, { ...EMPTY_FILTERS, maxDebtToEquity: 0.5 })).toEqual([rows[1]]);
  });

  it("excludes a row with a null value for a filtered metric, rather than treating it as passing", () => {
    const rows = [row({ ticker: "UNKNOWN", roe: null }), row({ ticker: "KNOWN", roe: 0.2 })];
    expect(applyFilters(rows, { ...EMPTY_FILTERS, minRoe: 0.1 })).toEqual([rows[1]]);
  });

  it("excludes a row with a null value even for a max-style filter", () => {
    const rows = [row({ ticker: "UNKNOWN", debtToEquity: null }), row({ ticker: "KNOWN", debtToEquity: 0.1 })];
    expect(applyFilters(rows, { ...EMPTY_FILTERS, maxDebtToEquity: 1 })).toEqual([rows[1]]);
  });

  it("combines multiple filters with AND semantics", () => {
    const rows = [
      row({ ticker: "BOTH", score: 80, roe: 0.2 }),
      row({ ticker: "ONLY_SCORE", score: 80, roe: 0.05 }),
      row({ ticker: "NEITHER", score: 40, roe: 0.05 }),
    ];
    const result = applyFilters(rows, { ...EMPTY_FILTERS, minScore: 75, minRoe: 0.1 });
    expect(result.map((r) => r.ticker)).toEqual(["BOTH"]);
  });
});

describe("sortRows", () => {
  it("sorts descending by the chosen field", () => {
    const rows = [row({ ticker: "A", score: 50 }), row({ ticker: "B", score: 90 }), row({ ticker: "C", score: 70 })];
    expect(sortRows(rows, "score", "desc").map((r) => r.ticker)).toEqual(["B", "C", "A"]);
  });

  it("sorts ascending when requested", () => {
    const rows = [row({ ticker: "A", score: 50 }), row({ ticker: "B", score: 90 }), row({ ticker: "C", score: 70 })];
    expect(sortRows(rows, "score", "asc").map((r) => r.ticker)).toEqual(["A", "C", "B"]);
  });

  it("always places null values at the bottom, regardless of direction", () => {
    const rows = [row({ ticker: "HAS_VALUE", freeCashFlow: 10 }), row({ ticker: "NO_VALUE", freeCashFlow: null })];
    expect(sortRows(rows, "freeCashFlow", "desc").map((r) => r.ticker)).toEqual(["HAS_VALUE", "NO_VALUE"]);
    expect(sortRows(rows, "freeCashFlow", "asc").map((r) => r.ticker)).toEqual(["HAS_VALUE", "NO_VALUE"]);
  });
});

describe("presets", () => {
  it("every preset maps onto the same ScreenerFilters shape the manual controls use", () => {
    for (const preset of SCREENER_PRESETS) {
      const filters = applyPreset(preset);
      expect(filters).toMatchObject(preset.filters);
      // Every key not overridden by the preset falls back to the same
      // "no constraint" default the manual filter UI starts from — proof
      // presets are not a separate filtering mechanism.
      for (const key of Object.keys(EMPTY_FILTERS) as (keyof typeof EMPTY_FILTERS)[]) {
        if (!(key in preset.filters)) {
          expect(filters[key]).toEqual(EMPTY_FILTERS[key]);
        }
      }
    }
  });

  it("the five required presets are all present", () => {
    const ids = SCREENER_PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(["strong-fundamentals", "high-growth", "high-profitability", "low-leverage", "strong-cash-flow"]),
    );
  });
});
