import Link from "next/link";
import type { CompanyAnalysis } from "@/types/scoring";
import { CompanyHeader } from "@/components/CompanyHeader";
import { InvestmentScore } from "@/components/InvestmentScore";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { MetricCard } from "@/components/MetricCard";
import { FinancialChart } from "@/components/FinancialChart";
import { Reveal } from "@/components/motion/primitives";
import { formatBillions, formatPercent } from "@/lib/format";

/**
 * The actual dashboard components (CompanyHeader, InvestmentScore,
 * ScoreBreakdown, MetricCard, FinancialChart) rendered with real,
 * already-computed analysis data — not a redrawn mockup. This is
 * literally what /company/[ticker] renders; framed here as a preview
 * window so the marketing page shows the real product, not a picture of
 * it. See app/page.tsx for where `analysis` is sourced.
 */
export function ProductDemo({ analysis }: { analysis: CompanyAnalysis }) {
  const { financialData, score } = analysis;
  const { revenue, profitability } = financialData;
  const latestRevenue = revenue.history.at(-1)?.value ?? null;
  const priorRevenue = revenue.history.at(-2)?.value ?? null;

  return (
    <section className="bg-mkt-bg px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-mkt-accent-strong">The product</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-mkt-ink sm:text-4xl">
            This is the real analyzer.
          </h2>
          <p className="mt-4 text-mkt-ink-muted">Not a mockup — the same components and live pipeline you&rsquo;ll get for any ticker.</p>
        </Reveal>

        <Reveal delay={0.15} className="mt-14 overflow-hidden rounded-2xl border border-mkt-border-strong shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)]">
          {/* Browser-style chrome */}
          <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-mkt-negative/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-mkt-ink-subtle/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-mkt-positive/60" />
            <span className="num ml-3 rounded border border-border bg-surface px-2 py-0.5 text-xs text-muted">
              equitylens.app/company/{financialData.profile.ticker}
            </span>
            <span className="ml-auto rounded-full border border-border-strong px-2 py-0.5 text-[10px] uppercase tracking-wide text-subtle">
              Demo data
            </span>
          </div>

          {/* Real, live-themed dashboard content */}
          <div className="relative max-h-[720px] overflow-hidden bg-background">
            <div className="px-6 pt-8 sm:px-10">
              <CompanyHeader
                profile={financialData.profile}
                source="demo"
                latestFiscalYear={revenue.history.at(-1)?.year ?? null}
                fetchedAt={new Date(financialData.profile.lastUpdated).getTime()}
              />
              <InvestmentScore score={score} />
              <ScoreBreakdown breakdown={score.breakdown} />

              <section className="border-b border-border py-8">
                <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">Financial Overview</h2>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label="Revenue"
                    value={formatBillions(latestRevenue)}
                    previousValue={formatBillions(priorRevenue)}
                    change={{ text: formatPercent(revenue.yoyGrowth), positive: revenue.yoyGrowth !== null ? revenue.yoyGrowth >= 0 : null }}
                    explanation="Total revenue for the most recent fiscal year."
                  />
                  <MetricCard
                    label="Net Margin"
                    value={formatPercent(profitability.netMargin)}
                    previousValue={`Operating: ${formatPercent(profitability.operatingMargin)}`}
                    explanation="Net income as a share of revenue."
                  />
                  <MetricCard
                    label="Free Cash Flow"
                    value={formatBillions(financialData.cashFlow.freeCashFlow)}
                    previousValue={formatBillions(financialData.cashFlow.freeCashFlowHistory.at(-2)?.value ?? null)}
                    change={{
                      text: formatPercent(financialData.cashFlow.fcfGrowth),
                      positive: financialData.cashFlow.fcfGrowth !== null ? financialData.cashFlow.fcfGrowth >= 0 : null,
                    }}
                    explanation="Operating cash flow after capital expenditures."
                  />
                </div>
              </section>

              <section className="py-8">
                <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">Historical Trends</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FinancialChart title="Revenue" data={revenue.history} color="var(--chart-revenue)" />
                  <FinancialChart title="Free Cash Flow" data={financialData.cashFlow.freeCashFlowHistory} color="var(--chart-fcf)" />
                </div>
              </section>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
          </div>
        </Reveal>

        <div className="mt-8 flex justify-center">
          <Link
            href={`/company/${financialData.profile.ticker}`}
            className="rounded-md border border-mkt-border-strong px-5 py-2.5 text-sm font-medium text-mkt-ink transition-colors hover:border-mkt-accent hover:text-mkt-accent-strong"
          >
            Open the full {financialData.profile.ticker} analysis →
          </Link>
        </div>
      </div>
    </section>
  );
}
