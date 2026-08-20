import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { CloudOff, SearchX, ServerCrash } from "lucide-react";
import { CompanyHeader } from "@/components/CompanyHeader";
import { InvestmentScore } from "@/components/InvestmentScore";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { MetricCard } from "@/components/MetricCard";
import { FinancialChart } from "@/components/FinancialChart";
import { Insights } from "@/components/Insights";
import { AIAnalysisSkeleton } from "@/components/AIAnalysis";
import { AIAnalysisSection } from "@/components/AIAnalysisSection";
import { getMockCompanyAnalysis, MOCK_TICKERS } from "@/lib/mock-data";
import { getCompanyAnalysis, type CompanyAnalysisResult } from "@/lib/company-analysis";
import { getCachedAnalysis } from "@/lib/company-cache";
import { formatBillions, formatDecimal, formatPercent, formatRatio } from "@/lib/format";
import { Reveal } from "@/components/motion/primitives";
import { RetryButton } from "@/components/RetryButton";

interface PageProps {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ mock?: string }>;
}

/**
 * `?mock=1` opts into the Stage 1 illustrative demo data set instead of
 * live SEC EDGAR data. This never triggers its own SEC fetch — for a
 * live ticker it only peeks at the existing server-side cache (a plain
 * in-memory read, not a network call), so a page view never spends two
 * provider requests instead of one just to render a nice <title>.
 */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { ticker } = await params;
  const { mock } = await searchParams;
  if (mock) {
    const analysis = getMockCompanyAnalysis(ticker);
    if (analysis) {
      return { title: `${analysis.financialData.profile.name} (${analysis.financialData.profile.ticker}) — EquityLens` };
    }
  } else {
    const cached = getCachedAnalysis(ticker);
    if (cached) {
      return { title: `${cached.companyName} (${cached.ticker}) — EquityLens` };
    }
  }
  return { title: `${ticker.toUpperCase()} — EquityLens` };
}

export default async function CompanyPage({ params, searchParams }: PageProps) {
  const { ticker } = await params;
  const { mock } = await searchParams;
  const useDemo = mock === "1" || mock === "true";

  const result = await getCompanyAnalysis(ticker, useDemo);

  if (!result.ok) {
    return <AnalysisError ticker={ticker} result={result} />;
  }

  const { financialData, score, insights } = result.data;
  const { revenue, profitability, valuation, debt, cashFlow } = financialData;

  const latestFiscalYear = revenue.history.length ? revenue.history[revenue.history.length - 1].year : null;
  const latestRevenue = last(revenue.history);
  const priorRevenue = secondToLast(revenue.history);
  const latestNetIncome = last(profitability.netIncomeHistory);
  const priorNetIncome = secondToLast(profitability.netIncomeHistory);
  const priorOcf = secondToLast(cashFlow.operatingCashFlowHistory);
  const priorFcf = secondToLast(cashFlow.freeCashFlowHistory);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {result.source === "demo" && <DemoDataBanner ticker={ticker} />}

      <Reveal delay={0}>
        <CompanyHeader
          profile={financialData.profile}
          source={result.source}
          latestFiscalYear={latestFiscalYear}
          fetchedAt={result.fetchedAt}
        />
      </Reveal>
      <Reveal delay={0.08}>
        <InvestmentScore score={score} />
      </Reveal>
      <Reveal delay={0.12}>
        <ScoreBreakdown breakdown={score.breakdown} />
      </Reveal>

      <Reveal>
        <section className="border-b border-border py-8">
          <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">
            Financial Overview
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Revenue"
              value={formatBillions(latestRevenue)}
              previousValue={formatBillions(priorRevenue)}
              change={{ text: formatPercent(revenue.yoyGrowth), positive: revenue.yoyGrowth !== null ? revenue.yoyGrowth >= 0 : null }}
              explanation="Total revenue for the most recent fiscal year."
            />
            <MetricCard
              label="Revenue Growth (YoY)"
              value={formatPercent(revenue.yoyGrowth)}
              previousValue={`3yr CAGR: ${formatPercent(revenue.cagr3yr)}`}
              explanation="Year-over-year change in total revenue."
            />
            <MetricCard
              label="Net Income"
              value={formatBillions(latestNetIncome)}
              previousValue={formatBillions(priorNetIncome)}
              change={{ text: formatPercent(profitability.netIncomeGrowth), positive: profitability.netIncomeGrowth !== null ? profitability.netIncomeGrowth >= 0 : null }}
              explanation="Bottom-line profit for the most recent fiscal year."
            />
            <MetricCard
              label="Net Margin"
              value={formatPercent(profitability.netMargin)}
              previousValue={`Operating: ${formatPercent(profitability.operatingMargin)}`}
              explanation="Net income as a share of revenue."
            />
            <MetricCard
              label="P/E Ratio"
              value={formatRatio(valuation.pe)}
              previousValue={`P/S: ${formatRatio(valuation.ps)}`}
              explanation="Price relative to trailing twelve-month earnings per share."
            />
            <MetricCard
              label="Debt-to-Equity"
              value={formatDecimal(debt.debtToEquity)}
              previousValue={`Net debt: ${formatBillions(debt.netDebt)}`}
              explanation="Total debt relative to shareholder equity."
            />
            <MetricCard
              label="Operating Cash Flow"
              value={formatBillions(cashFlow.operatingCashFlow)}
              previousValue={formatBillions(priorOcf)}
              explanation="Cash generated by core business operations."
            />
            <MetricCard
              label="Free Cash Flow"
              value={formatBillions(cashFlow.freeCashFlow)}
              previousValue={formatBillions(priorFcf)}
              change={{ text: formatPercent(cashFlow.fcfGrowth), positive: cashFlow.fcfGrowth !== null ? cashFlow.fcfGrowth >= 0 : null }}
              explanation="Operating cash flow after capital expenditures."
            />
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="border-b border-border py-8">
          <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">
            Historical Trends
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FinancialChart
              title="Revenue"
              data={revenue.history}
              color="var(--chart-revenue)"
            />
            <FinancialChart
              title="Net Income"
              data={profitability.netIncomeHistory}
              color="var(--chart-income)"
            />
            <FinancialChart
              title="Free Cash Flow"
              data={cashFlow.freeCashFlowHistory}
              color="var(--chart-fcf)"
            />
            <FinancialChart
              title="Total Debt"
              data={debt.totalDebtHistory}
              color="var(--chart-debt)"
            />
          </div>
        </section>
      </Reveal>

      <Reveal>
        <Insights insights={insights} />
      </Reveal>

      {/* Suspense lets the score and metrics above render immediately —
          this section streams in independently once Claude responds,
          and never blocks or fails the rest of the page. */}
      <Suspense fallback={<AIAnalysisSkeleton />}>
        <AIAnalysisSection financialData={financialData} score={score} insights={insights} />
      </Suspense>
    </div>
  );
}

function last(history: { value: number | null }[]): number | null {
  return history.length ? history[history.length - 1].value : null;
}

function secondToLast(history: { value: number | null }[]): number | null {
  return history.length > 1 ? history[history.length - 2].value : null;
}

/** A valid mock-data ticker to demo — the one actually searched if it's covered, otherwise a sensible default. */
function resolveDemoTicker(ticker: string): string {
  const upper = ticker.trim().toUpperCase();
  return MOCK_TICKERS.includes(upper) ? upper : "AAPL";
}

/**
 * Shown at the top of the page when viewing the Stage 1 demo data set
 * instead of live data — this label is the one place the user is told
 * which state they're in, so it's deliberately unmissable, never a
 * silent substitution.
 */
function DemoDataBanner({ ticker }: { ticker: string }) {
  return (
    <div className="mb-8 flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-warning">Demo data</span>
        <p className="text-sm text-muted">
          You&rsquo;re viewing sample financial data to explore the EquityLens experience. Live provider data is
          temporarily unavailable.
        </p>
      </div>
      <Link
        href={`/company/${ticker.trim().toUpperCase()}`}
        className="whitespace-nowrap text-sm font-medium text-brand transition-colors hover:text-brand-strong"
      >
        View live data →
      </Link>
    </div>
  );
}

/**
 * Shown when live data (or, if explicitly requested, demo data) could
 * not be retrieved for this ticker, AND no cached or bundled snapshot
 * exists to fall back to (see lib/company-analysis.ts — this is the
 * true last-resort state). The three provider-facing reasons
 * (rate_limited, provider_error, not_found) each get distinct, honest
 * copy — a capacity problem is never described as if the ticker itself
 * were invalid, and vice versa, and neither ever names the underlying
 * provider (SEC EDGAR) as if it were the thing at fault. "Explore demo
 * analysis" always lands on an explicit ?mock=1 URL; nothing here ever
 * silently renders mock data under a live-looking label.
 */
function AnalysisError({
  ticker,
  result,
}: {
  ticker: string;
  result: Extract<CompanyAnalysisResult, { ok: false }>;
}) {
  const demoTicker = resolveDemoTicker(ticker);
  const isDemoMiss = result.source === "demo";

  const copy = {
    rate_limited: {
      Icon: CloudOff,
      eyebrow: "Financial data temporarily unavailable",
      body: "The financial data source reached its request limit while fetching this company's filings. Your analysis wasn't completed — this is usually brief.",
      canRetry: true,
    },
    provider_error: {
      Icon: ServerCrash,
      eyebrow: "Financial data temporarily unavailable",
      body: "The financial data source couldn't be reached to complete this request. Your analysis wasn't completed — this is usually temporary.",
      canRetry: true,
    },
    not_found: {
      Icon: SearchX,
      eyebrow: `${ticker.trim().toUpperCase()} isn't available`,
      body: result.message,
      canRetry: false,
    },
  }[isDemoMiss ? "not_found" : result.reason];

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-strong bg-surface">
        <copy.Icon size={20} className="text-subtle" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-subtle">{copy.eyebrow}</h1>
      <p className="mt-4 text-base leading-relaxed text-foreground">{copy.body}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {copy.canRetry && (
          <RetryButton className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70" />
        )}
        <Link
          href={`/company/${demoTicker}?mock=1`}
          className="rounded-md border border-border-strong bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-brand hover:text-brand"
        >
          Explore demo analysis
        </Link>
      </div>

      <Link href="/" className="mt-8 text-sm text-subtle transition-colors hover:text-foreground">
        ← Back to search
      </Link>
    </div>
  );
}
