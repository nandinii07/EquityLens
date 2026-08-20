import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { ScreenerClient } from "@/components/screener/ScreenerClient";
import { getScreenerSnapshot } from "@/lib/screener-snapshot";
import { formatDate } from "@/lib/format";
import { Reveal } from "@/components/motion/primitives";

export const metadata: Metadata = {
  title: "Screener — EquityLens",
};

/**
 * The multi-company screener. Reads the precomputed
 * data/screener-snapshot.json (via lib/screener-snapshot.ts's static
 * import) and nothing else — no SEC EDGAR request, no per-company
 * computation, happens here. Every score/metric shown was produced by the
 * exact same pipeline /company/[ticker] uses (see
 * scripts/generate-screener-snapshot.ts), offline, ahead of time.
 *
 * Same shell (SiteNav + dark mkt-bg background) as app/company/layout.tsx,
 * inlined here rather than factored into a shared layout since this is
 * currently the route's only page.
 */
export default function ScreenerPage() {
  const snapshot = getScreenerSnapshot();

  return (
    <div className="min-h-screen bg-mkt-bg">
      <SiteNav linkHref="/" linkLabel="Search" />
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-32">
        <Reveal delay={0}>
          <h1 className="text-2xl font-semibold text-foreground">Screener</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Discover and compare U.S. SEC-reporting companies by Investment Score, growth, profitability, leverage, and
            cash flow — the same deterministic scoring engine used on every individual company page.
          </p>
          <FreshnessBanner snapshot={snapshot} />
        </Reveal>

        <Reveal delay={0.08} className="mt-8">
          <ScreenerClient rows={snapshot.companies} />
        </Reveal>
      </div>
    </div>
  );
}

function FreshnessBanner({
  snapshot,
}: {
  snapshot: { generatedAt: string; universeRequested: number; succeeded: number; failed: number };
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border bg-surface px-4 py-2.5 text-xs text-subtle">
      <span>
        Snapshot generated <span className="text-muted">{formatDate(snapshot.generatedAt)}</span>
      </span>
      <span className="text-border-strong">•</span>
      <span>
        {snapshot.succeeded} of {snapshot.universeRequested} companies normalized
        {snapshot.failed > 0 && ` (${snapshot.failed} excluded — no reliable SEC data)`}
      </span>
    </div>
  );
}
