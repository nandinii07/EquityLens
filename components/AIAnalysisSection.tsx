import { generateAIAnalysis } from "@/lib/ai-analysis";
import type { FinancialData } from "@/types/financial";
import type { InvestmentScore, Insight } from "@/types/scoring";
import { AIAnalysis, AIAnalysisUnavailable } from "@/components/AIAnalysis";

interface AIAnalysisSectionProps {
  financialData: FinancialData;
  score: InvestmentScore;
  insights: Insight[];
}

/**
 * Async Server Component — calls Claude (via lib/ai-analysis.ts) exactly
 * once per page render and streams its result in independently. The
 * parent page renders this inside a `<Suspense fallback={<AIAnalysisSkeleton />}>`,
 * so the deterministic score and financial metrics above it are never
 * blocked on this component's network call, and a Claude failure here
 * cannot fail the page — it only swaps in AIAnalysisUnavailable.
 */
export async function AIAnalysisSection({ financialData, score, insights }: AIAnalysisSectionProps) {
  const result = await generateAIAnalysis(financialData, score, insights);

  if (!result.ok) {
    return <AIAnalysisUnavailable />;
  }

  return <AIAnalysis analysis={result.data} />;
}
