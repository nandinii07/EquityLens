import { redirect } from "next/navigation";
import { getMockCompanyAnalysis } from "@/lib/mock-data";
import { SiteNav } from "@/components/SiteNav";
import { Hero } from "@/components/marketing/Hero";
import { CredibilityStrip } from "@/components/marketing/CredibilityStrip";
import { ProblemSolution } from "@/components/marketing/ProblemSolution";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { ScoreShowcase } from "@/components/marketing/ScoreShowcase";
import { AIShowcase } from "@/components/marketing/AIShowcase";
import { ProductDemo } from "@/components/marketing/ProductDemo";
import { Methodology } from "@/components/marketing/Methodology";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ScrollProgressBar } from "@/components/motion/interactive";

/**
 * The marketing homepage. Every score/metric shown below (ScoreShowcase,
 * ProductDemo) is computed by the real pipeline — lib/mock-data.ts calls
 * lib/scoring.ts's calculateInvestmentScore exactly like the live
 * analyzer does — using AAPL as an illustrative, clearly-labeled demo
 * ticker. Nothing here is hardcoded. The AI showcase is the one
 * exception, and is explicitly labeled "Simulated preview" throughout
 * (see components/marketing/AIShowcase.tsx) rather than calling Claude
 * on every homepage view.
 *
 * `?ticker=` is a graceful-degradation fallback, not the primary search
 * path: the Hero/FinalCTA search forms normally navigate client-side via
 * useTickerSearch (hooks/use-ticker-search.ts) the instant they're
 * submitted, with no full page load. But a form submitted in the brief
 * window before React hydration attaches that handler falls back to the
 * browser's native (JS-free) form submission — a GET to this same page
 * with the field's `name` in the query string, since neither form
 * specifies an `action`. Redirecting from that query string here means
 * that race still lands on the right analysis page instead of silently
 * reloading the homepage with the typed ticker lost.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ ticker?: string }> }) {
  const { ticker } = await searchParams;
  if (ticker && ticker.trim()) {
    redirect(`/company/${encodeURIComponent(ticker.trim().toUpperCase())}`);
  }

  // AAPL is always present in the Stage 1 mock data set; this is a
  // developer-facing invariant check, not user-facing error handling.
  const demoAnalysis = getMockCompanyAnalysis("AAPL");
  if (!demoAnalysis) {
    throw new Error("Marketing homepage demo ticker AAPL is missing from lib/mock-data.ts.");
  }

  return (
    <div className="bg-mkt-bg">
      <ScrollProgressBar />
      <SiteNav />
      <div id="hero">
        <Hero />
      </div>
      <CredibilityStrip />
      <ProblemSolution />
      <HowItWorks />
      <ScoreShowcase
        score={demoAnalysis.score}
        companyName={demoAnalysis.financialData.profile.name}
        ticker={demoAnalysis.financialData.profile.ticker}
      />
      <AIShowcase />
      <ProductDemo analysis={demoAnalysis} />
      <Methodology />
      <FinalCTA />
      <MarketingFooter />
    </div>
  );
}
