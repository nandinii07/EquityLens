import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FinancialData } from "@/types/financial";
import type { InvestmentScore, Insight } from "@/types/scoring";

// `server-only` intentionally throws when imported outside Next's own
// build (its build-time-only guard against a Client Component pulling in
// server code) — mocked away here so lib/ai-analysis.ts is importable
// under plain Vitest/Node. Production behavior is unaffected.
vi.mock("server-only", () => ({}));

// Mocks the Anthropic SDK's default export so no real network call is ever
// made. `@anthropic-ai/sdk/helpers/zod` is intentionally left unmocked —
// the real zodOutputFormat + zod validation logic is exactly what several
// tests below (malformed/valid response) are checking.
const mockParse = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { parse: mockParse };
  },
}));

const { buildAIAnalysisInput, buildSystemPrompt, buildUserPrompt, validateAIAnalysis, generateAIAnalysis } =
  await import("@/lib/ai-analysis");

// ---------------------------------------------------------------------------
// Fixtures (mirrors the pattern used in tests/scoring.test.ts)
// ---------------------------------------------------------------------------

function makeFinancialData(overrides: Partial<FinancialData> = {}): FinancialData {
  const base: FinancialData = {
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
      description: "A synthetic company used for AI analysis tests.",
    },
    revenue: {
      history: [
        { year: "FY2023", value: 80 },
        { year: "FY2024", value: 90 },
        { year: "FY2025", value: 100 },
      ],
      yoyGrowth: 0.11,
      cagr3yr: 0.12,
    },
    profitability: {
      netIncomeHistory: [{ year: "FY2025", value: 10 }],
      netMargin: 0.1,
      operatingMargin: 0.12,
      roe: 0.15,
      netIncomeGrowth: 0.08,
    },
    valuation: { pe: 22, ps: 3.5, pb: 5, evToEbitda: 13 },
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
  };
  return { ...base, ...overrides };
}

const score: InvestmentScore = {
  overall: 63,
  maxScore: 100,
  rating: "Moderate",
  breakdown: [
    { category: "Revenue Growth", score: 12, maxScore: 20, rationale: "Solid but not exceptional growth." },
    { category: "Profitability", score: 10, maxScore: 20, rationale: "Middling margins." },
    { category: "Valuation", score: 15, maxScore: 20, rationale: "Reasonably priced." },
    { category: "Debt", score: 13, maxScore: 20, rationale: "Moderate leverage." },
    { category: "Cash Flow", score: 13, maxScore: 20, rationale: "Positive and growing." },
  ],
};

const insights: Insight[] = [
  { type: "strength", text: "Revenue grew 11% year-over-year." },
  { type: "risk", text: "Leverage is elevated." },
  { type: "watch", text: "Margin trend worth monitoring." },
];

const validAIResponse = {
  summary: "The company shows a moderate fundamental position with balanced strengths and risks.",
  strengths: ["Consistent revenue growth.", "Positive free cash flow.", "Reasonable valuation multiples."],
  risks: ["Elevated leverage relative to peers.", "Thin operating margin.", "Modest net income growth."],
  watchItems: ["Debt-to-equity trend.", "Margin trajectory.", "Free cash flow growth sustainability."],
  scoreExplanation:
    "The score is held back mainly by Profitability, while Valuation and Cash Flow contributed the most positive points.",
};

beforeEach(() => {
  mockParse.mockReset();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// AI input construction
// ---------------------------------------------------------------------------

describe("buildAIAnalysisInput", () => {
  it("carries over the company identity, score, and category breakdown unchanged", () => {
    const input = buildAIAnalysisInput(makeFinancialData(), score, insights);
    expect(input.companyName).toBe("Test Co");
    expect(input.ticker).toBe("TEST");
    expect(input.overallScore).toBe(63);
    expect(input.rating).toBe("Moderate");
    expect(input.categoryScores).toHaveLength(5);
    expect(input.categoryScores[0]).toEqual({
      category: "Revenue Growth",
      score: 12,
      maxScore: 20,
      rationale: "Solid but not exceptional growth.",
    });
  });

  it("formats metrics as display strings, e.g. percentages and multiples", () => {
    const input = buildAIAnalysisInput(makeFinancialData(), score, insights);
    expect(input.metrics["Revenue growth (YoY)"]).toBe("11.0%");
    expect(input.metrics["P/E"]).toBe("22.0x");
    expect(input.metrics["Debt-to-equity"]).toBe("0.50");
  });

  it("splits insights into strengths and risks, excluding watch-type items", () => {
    const input = buildAIAnalysisInput(makeFinancialData(), score, insights);
    expect(input.strengths).toEqual(["Revenue grew 11% year-over-year."]);
    expect(input.risks).toEqual(["Leverage is elevated."]);
  });

  it("includes a formatted historical trend series for revenue, income, FCF, and debt", () => {
    const input = buildAIAnalysisInput(makeFinancialData(), score, insights);
    const revenueTrend = input.historicalTrends.find((t) => t.label === "Revenue");
    expect(revenueTrend?.series).toBe("FY2023: $80.0B, FY2024: $90.0B, FY2025: $100.0B");
  });
});

describe("buildAIAnalysisInput — missing metrics", () => {
  it("formats unavailable metrics as N/A rather than fabricating a value", () => {
    const data = makeFinancialData({
      valuation: { pe: null, ps: null, pb: null, evToEbitda: null },
    });
    const input = buildAIAnalysisInput(data, score, insights);
    expect(input.metrics["P/E"]).toBe("N/A");
    expect(input.metrics["P/S"]).toBe("N/A");
    expect(input.metrics["P/B"]).toBe("N/A");
    expect(input.metrics["EV/EBITDA"]).toBe("N/A");
  });

  it("handles an empty history without crashing", () => {
    const data = makeFinancialData({
      revenue: { history: [], yoyGrowth: null, cagr3yr: null },
    });
    const input = buildAIAnalysisInput(data, score, insights);
    expect(input.metrics["Revenue growth (YoY)"]).toBe("N/A");
    expect(input.historicalTrends.find((t) => t.label === "Revenue")?.series).toBe("");
  });

  it("handles no strengths or risks being flagged", () => {
    const input = buildAIAnalysisInput(makeFinancialData(), score, []);
    expect(input.strengths).toEqual([]);
    expect(input.risks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

describe("prompt construction", () => {
  it("system prompt establishes the AI's role and forbids recalculating the score", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/not a financial advisor/i);
    expect(prompt).toMatch(/never recalculate/i);
    expect(prompt).toMatch(/N\/A/);
  });

  it("user prompt includes the company, score, and metrics but no raw provider data", () => {
    const input = buildAIAnalysisInput(makeFinancialData(), score, insights);
    const prompt = buildUserPrompt(input);
    expect(prompt).toContain("Test Co (TEST)");
    expect(prompt).toContain("63/100");
    expect(prompt).toContain("Revenue growth (YoY): 11.0%");
    // Alpha Vantage's raw field names should never leak into the prompt.
    expect(prompt).not.toMatch(/annualReports|fiscalDateEnding|MarketCapitalization/);
  });
});

// ---------------------------------------------------------------------------
// Response validation — malformed and valid
// ---------------------------------------------------------------------------

describe("validateAIAnalysis — malformed response", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a plain string", "not an object"],
    ["missing required fields", { summary: "ok" }],
    ["wrong field type for strengths", { ...validAIResponse, strengths: "should be an array" }],
    ["wrong field type for summary", { ...validAIResponse, summary: 12345 }],
  ])("returns null for %s", (_label, candidate) => {
    expect(validateAIAnalysis(candidate)).toBeNull();
  });

  it("strips an unexpected extra field (e.g. a smuggled-in score) rather than leaking it through", () => {
    // The scoring engine is the only source of the numeric score. Even if a
    // response somehow carried a stray numeric field, AIAnalysis has no slot
    // for it — Zod's default object parsing drops unrecognized keys.
    const result = validateAIAnalysis({ ...validAIResponse, overallScore: 99 });
    expect(result).not.toBeNull();
    expect(result && "overallScore" in result).toBe(false);
  });
});

describe("validateAIAnalysis — valid response", () => {
  it("parses a well-formed response and returns exactly the expected shape", () => {
    const result = validateAIAnalysis(validAIResponse);
    expect(result).toEqual(validAIResponse);
    expect(result && Object.keys(result).sort()).toEqual(
      ["risks", "scoreExplanation", "strengths", "summary", "watchItems"].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// generateAIAnalysis — network-facing behavior, fully mocked
// ---------------------------------------------------------------------------

describe("generateAIAnalysis", () => {
  it("returns the validated analysis on a successful call", async () => {
    mockParse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: validAIResponse });

    const result = await generateAIAnalysis(makeFinancialData(), score, insights);

    expect(result).toEqual({ ok: true, data: validAIResponse });
    expect(mockParse).toHaveBeenCalledTimes(1);
  });

  it("never calls the API when ANTHROPIC_API_KEY is not set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const result = await generateAIAnalysis(makeFinancialData(), score, insights);

    expect(result).toEqual({ ok: false, message: "AI analysis is temporarily unavailable." });
    expect(mockParse).not.toHaveBeenCalled();
  });

  it("degrades gracefully on API failure without leaking error details", async () => {
    mockParse.mockRejectedValue(new Error("connection reset by peer at 10.0.0.5:443, key=sk-ant-secret"));

    const result = await generateAIAnalysis(makeFinancialData(), score, insights);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("AI analysis is temporarily unavailable.");
      expect(result.message).not.toMatch(/sk-ant|10\.0\.0\.5|connection reset/);
    }
  });

  it("degrades gracefully on an empty/malformed response", async () => {
    mockParse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: {} });

    const result = await generateAIAnalysis(makeFinancialData(), score, insights);

    expect(result).toEqual({ ok: false, message: "AI analysis is temporarily unavailable." });
  });

  it("degrades gracefully when parsed_output is null", async () => {
    mockParse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: null });

    const result = await generateAIAnalysis(makeFinancialData(), score, insights);

    expect(result).toEqual({ ok: false, message: "AI analysis is temporarily unavailable." });
  });

  it("treats a safety refusal as unavailable rather than surfacing it raw", async () => {
    mockParse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });

    const result = await generateAIAnalysis(makeFinancialData(), score, insights);

    expect(result).toEqual({ ok: false, message: "AI analysis is temporarily unavailable." });
  });
});
