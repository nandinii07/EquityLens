/**
 * Investment score types.
 *
 * The score itself is always produced by the deterministic scoring engine
 * (lib/scoring.ts, arriving in Stage 3) — never by the AI. These types are
 * the contract between that engine, the mock data used before it exists,
 * and the dashboard UI.
 */

import type { FinancialData } from "./financial";

export type ScoreCategory =
  | "Revenue Growth"
  | "Profitability"
  | "Valuation"
  | "Debt"
  | "Cash Flow";

export interface CategoryScore {
  category: ScoreCategory;
  score: number;
  maxScore: 20;
  /** Plain-language reason the category scored the way it did. */
  rationale: string;
}

export type RatingLabel =
  | "Exceptional"
  | "Strong"
  | "Moderate"
  | "Weak"
  | "High Risk";

export interface InvestmentScore {
  overall: number;
  maxScore: 100;
  rating: RatingLabel;
  breakdown: CategoryScore[];
}

export type InsightType = "strength" | "risk" | "watch";

export interface Insight {
  type: InsightType;
  text: string;
}

/**
 * The AI's role is strictly explanatory: Claude (lib/ai-analysis.ts)
 * receives the already-computed score and metrics and narrates them. It
 * never produces or adjusts a number — the shape below has no numeric
 * score field for exactly that reason. Fetched separately from the rest
 * of `CompanyAnalysis` (see app/company/[ticker]/page.tsx) so a slow or
 * failed AI call never blocks the deterministic dashboard from rendering.
 */
export interface AIAnalysis {
  summary: string;
  strengths: string[];
  risks: string[];
  watchItems: string[];
  scoreExplanation: string;
}

/** Everything the company dashboard page needs to render, aside from the AI section. */
export interface CompanyAnalysis {
  financialData: FinancialData;
  score: InvestmentScore;
  insights: Insight[];
}
