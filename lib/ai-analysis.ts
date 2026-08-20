import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { FinancialData } from "@/types/financial";
import type { AIAnalysis, InvestmentScore, Insight } from "@/types/scoring";
import { formatBillions, formatDecimal, formatPercent, formatRatio } from "@/lib/format";

/**
 * Claude-powered explanation layer.
 *
 * The flow through this file is strictly one-directional:
 *
 *   FinancialData + InvestmentScore + Insight[]   (already computed)
 *     -> buildAIAnalysisInput                      (pure, this file)
 *     -> Claude API                                (interprets only)
 *     -> validateAIAnalysis                        (pure, this file)
 *     -> AIAnalysis                                (returned to the page)
 *
 * Claude never sees raw SEC EDGAR data and never computes or is asked
 * to compute a number — it receives the investment score and every
 * category score as fixed, already-decided input and is instructed
 * (system prompt below) never to recalculate or contradict them. The
 * numerical score always comes exclusively from lib/scoring.ts.
 *
 * Security: `import "server-only"` makes it a build error for a Client
 * Component to import this module. `ANTHROPIC_API_KEY` is read once from
 * `process.env`, passed directly to the SDK client, and never logged,
 * echoed in an error message, or returned to a caller — every failure
 * path below returns the same fixed, generic message.
 */

const MODEL = "claude-opus-5";
const UNAVAILABLE_MESSAGE = "AI analysis is temporarily unavailable.";

// ---------------------------------------------------------------------------
// Structured input construction (pure, no network — the "Structured Analysis"
// step of the pipeline described in the module doc above)
// ---------------------------------------------------------------------------

export interface AIAnalysisInput {
  companyName: string;
  ticker: string;
  overallScore: number;
  rating: string;
  categoryScores: { category: string; score: number; maxScore: number; rationale: string }[];
  /** Pre-formatted display strings ("6.4%", "31.2x", "N/A", ...) so Claude reads facts, not raw numbers to reformat. */
  metrics: Record<string, string>;
  historicalTrends: { label: string; series: string }[];
  strengths: string[];
  risks: string[];
}

/**
 * Builds the structured payload sent to Claude from this app's own
 * already-normalized data — never from raw SEC EDGAR responses, and
 * never inventing a value: any unavailable metric is formatted as "N/A"
 * by the lib/format.ts helpers reused here, the same ones the dashboard
 * itself renders with.
 */
export function buildAIAnalysisInput(
  financialData: FinancialData,
  score: InvestmentScore,
  insights: Insight[],
): AIAnalysisInput {
  const { profile, revenue, profitability, valuation, debt, cashFlow } = financialData;

  return {
    companyName: profile.name,
    ticker: profile.ticker,
    overallScore: score.overall,
    rating: score.rating,
    categoryScores: score.breakdown.map((c) => ({
      category: c.category,
      score: c.score,
      maxScore: c.maxScore,
      rationale: c.rationale,
    })),
    metrics: {
      "Revenue growth (YoY)": formatPercent(revenue.yoyGrowth),
      "Revenue CAGR (3yr)": formatPercent(revenue.cagr3yr),
      "Net margin": formatPercent(profitability.netMargin),
      "Operating margin": formatPercent(profitability.operatingMargin),
      "Return on equity": formatPercent(profitability.roe),
      "Net income growth": formatPercent(profitability.netIncomeGrowth),
      "P/E": formatRatio(valuation.pe),
      "P/S": formatRatio(valuation.ps),
      "P/B": formatRatio(valuation.pb),
      "EV/EBITDA": formatRatio(valuation.evToEbitda),
      "Debt-to-equity": formatDecimal(debt.debtToEquity),
      "Debt-to-assets": formatDecimal(debt.debtToAssets),
      "Net debt": formatBillions(debt.netDebt),
      "Interest coverage": formatRatio(debt.interestCoverage),
      "Operating cash flow": formatBillions(cashFlow.operatingCashFlow),
      "Free cash flow": formatBillions(cashFlow.freeCashFlow),
      "Free cash flow growth": formatPercent(cashFlow.fcfGrowth),
      "Operating cash flow / net income": formatDecimal(cashFlow.ocfToNetIncome),
    },
    historicalTrends: [
      { label: "Revenue", series: formatSeries(revenue.history) },
      { label: "Net income", series: formatSeries(profitability.netIncomeHistory) },
      { label: "Free cash flow", series: formatSeries(cashFlow.freeCashFlowHistory) },
      { label: "Total debt", series: formatSeries(debt.totalDebtHistory) },
    ],
    strengths: insights.filter((i) => i.type === "strength").map((i) => i.text),
    risks: insights.filter((i) => i.type === "risk").map((i) => i.text),
  };
}

function formatSeries(history: { year: string; value: number | null }[]): string {
  return history.map((point) => `${point.year}: ${formatBillions(point.value)}`).join(", ");
}

// ---------------------------------------------------------------------------
// Output schema (also the contract Claude's response is validated against)
// ---------------------------------------------------------------------------

const AIAnalysisSchema = z.object({
  summary: z
    .string()
    .describe(
      "A concise 2-4 sentence overall assessment of the company's fundamental position, in plain language. Do not just restate the score number.",
    ),
  strengths: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe("3 to 5 specific strengths, each grounded in one of the supplied metrics or facts."),
  risks: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe("3 to 5 specific risks or concerns, each grounded in one of the supplied metrics or facts."),
  watchItems: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe("3 to 5 specific things an investor should investigate further before forming a view."),
  scoreExplanation: z
    .string()
    .describe(
      "2-4 sentences explaining why the score is what it is, referencing which categories helped or hurt it most. Do not simply repeat the category numbers.",
    ),
});

/**
 * Re-validates a candidate response against the schema before it's ever
 * returned to a caller — defense in depth on top of the API's own
 * structured-output constraint, and the seam this module's tests exercise
 * for malformed/valid responses without any network call.
 */
export function validateAIAnalysis(candidate: unknown): AIAnalysis | null {
  const result = AIAnalysisSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

// ---------------------------------------------------------------------------
// Prompt construction (pure, no network)
// ---------------------------------------------------------------------------

export function buildSystemPrompt(): string {
  return `You are a financial research assistant providing first-level fundamental analysis of public companies for a research and education tool.

You are not a financial advisor. You must never give investment advice, recommend buying or selling a security, or make definitive claims about future stock price direction.

A separate, deterministic scoring engine has already calculated the Investment Score and every category score you are given below, directly from the company's financial statements. That score is fixed, ground-truth input. You must never recalculate it, second-guess its arithmetic, or state a different number — your only job is to explain, in plain language, what the already-computed data means.

Rules you must follow:
- Only reference metrics explicitly present in the data you are given. Any metric marked "N/A" was unavailable — say so plainly rather than guessing, estimating, or inventing a plausible-sounding figure.
- Never invent financial facts, metrics, or events that are not present in the supplied data.
- Never state or imply certainty about future stock performance. Do not use phrases like "will rise", "will fall", "buy this stock", or "sell this stock". Prefer careful, hedged language such as "the fundamentals appear relatively strong", "the primary concern is...", or "further investigation of valuation may be warranted".
- Clearly distinguish objective facts (a specific supplied metric and its value) from your own interpretation of what that metric means.
- Identify both positive and negative signals — a one-sided assessment is not useful.
- Respond only in the structured format requested, with no commentary outside it.`;
}

export function buildUserPrompt(input: AIAnalysisInput): string {
  const metricLines = Object.entries(input.metrics)
    .map(([label, value]) => `- ${label}: ${value}`)
    .join("\n");
  const categoryLines = input.categoryScores
    .map((c) => `- ${c.category}: ${c.score}/${c.maxScore} — ${c.rationale}`)
    .join("\n");
  const trendLines = input.historicalTrends.map((t) => `- ${t.label}: ${t.series}`).join("\n");
  const strengthLines = input.strengths.length ? input.strengths.map((s) => `- ${s}`).join("\n") : "- None flagged";
  const riskLines = input.risks.length ? input.risks.map((r) => `- ${r}`).join("\n") : "- None flagged";

  return `Analyze the following company using only the data provided below.

Company: ${input.companyName} (${input.ticker})
Overall Investment Score: ${input.overallScore}/100 — ${input.rating}

Category scores:
${categoryLines}

Key metrics:
${metricLines}

Historical trends (oldest to latest):
${trendLines}

Strengths already surfaced by the deterministic scoring pipeline:
${strengthLines}

Risks already surfaced by the deterministic scoring pipeline:
${riskLines}

Provide: an overall summary, 3-5 key strengths, 3-5 key risks, 3-5 things an investor should investigate further, and an explanation of why the score is what it is (referencing which categories drove it, not just repeating the numbers).`;
}

// ---------------------------------------------------------------------------
// Claude call (network, server-only)
// ---------------------------------------------------------------------------

export type AIAnalysisResult = { ok: true; data: AIAnalysis } | { ok: false; message: string };

/**
 * Generates the AI explanation for one company. Never throws — every
 * failure (missing key, network error, refusal, malformed response)
 * resolves to `{ ok: false, message: "AI analysis is temporarily
 * unavailable." }` so a Claude outage can never break the dashboard.
 */
export async function generateAIAnalysis(
  financialData: FinancialData,
  score: InvestmentScore,
  insights: Insight[],
): Promise<AIAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, message: UNAVAILABLE_MESSAGE };
  }

  const input = buildAIAnalysisInput(financialData, score, insights);
  const client = new Anthropic({ apiKey });

  let response: Awaited<ReturnType<typeof client.messages.parse>>;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(input) }],
      output_config: { format: zodOutputFormat(AIAnalysisSchema) },
    });
  } catch {
    // Deliberately discard the original error — an SDK error can carry
    // request details that shouldn't reach the client.
    return { ok: false, message: UNAVAILABLE_MESSAGE };
  }

  if (response.stop_reason === "refusal") {
    return { ok: false, message: UNAVAILABLE_MESSAGE };
  }

  const validated = validateAIAnalysis(response.parsed_output);
  if (!validated) {
    return { ok: false, message: UNAVAILABLE_MESSAGE };
  }

  return { ok: true, data: validated };
}
