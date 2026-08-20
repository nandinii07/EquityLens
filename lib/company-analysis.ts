import "server-only";

import { getMockCompanyAnalysis } from "@/lib/mock-data";
import { getLiveCompanyAnalysis } from "@/lib/sec-financial-api";
import { getSecSnapshot } from "@/lib/sec-snapshots";
import { dedupe, getCachedAnalysis, isCacheFresh, setCachedAnalysis, type CachedAnalysis } from "@/lib/company-cache";
import type { CompanyAnalysis } from "@/types/scoring";

export type CompanyAnalysisSource = "live" | "recent" | "demo";

export type CompanyAnalysisResult =
  | { ok: true; data: CompanyAnalysis; source: CompanyAnalysisSource; fetchedAt: number }
  | { ok: false; reason: "not_found" | "rate_limited" | "provider_error"; message: string; source: CompanyAnalysisSource };

function toCompanyAnalysis(entry: CachedAnalysis): CompanyAnalysis {
  return { financialData: entry.financialData, score: entry.score, insights: entry.insights };
}

function toCacheEntry(ticker: string, data: CompanyAnalysis, fetchedAt: number): CachedAnalysis {
  return {
    ticker,
    companyName: data.financialData.profile.name,
    financialData: data.financialData,
    score: data.score,
    insights: data.insights,
    fetchedAt,
  };
}

/** One live SEC EDGAR fetch, deduped per ticker, caching the normalized result on success. Never throws. */
async function fetchLiveAndCache(ticker: string) {
  return dedupe(`live:${ticker}`, async () => {
    const result = await getLiveCompanyAnalysis(ticker);
    if (!result.ok) return result;

    const fetchedAt = Date.now();
    setCachedAnalysis(toCacheEntry(ticker, result.data, fetchedAt));
    return { ok: true as const, data: result.data, fetchedAt };
  });
}

/**
 * The one function the dashboard page calls, regardless of data source.
 *
 * Pipeline: request -> server-side cache -> if fresh, use it -> otherwise
 * SEC EDGAR -> normalize -> calculate -> score -> cache -> render. If the
 * live fetch fails for any reason and a cached record exists (fresh or
 * stale), that cached record is served rather than a blocking error —
 * the user always sees the best available analysis. If there is no
 * cached record either, but the ticker is one of the five core demo
 * companies, the bundled verified SEC snapshot (lib/sec-snapshots.ts) is
 * served instead — this is what guarantees AAPL/MSFT/GOOGL/NVDA/AMZN
 * never hit a blocking error page even on a cold instance with SEC EDGAR
 * temporarily unreachable. The blocking error state is reserved for the
 * one remaining case: a non-demo ticker with no live data, no cache, and
 * no snapshot available.
 *
 * The Stage 1 illustrative mock data set is a separate, distinct concept
 * from the above and is only used when explicitly requested via
 * `useDemo` — never as a silent substitute for a failed live/cache/
 * snapshot lookup.
 */
export async function getCompanyAnalysis(rawTicker: string, useDemo: boolean): Promise<CompanyAnalysisResult> {
  if (useDemo) {
    const analysis = getMockCompanyAnalysis(rawTicker);
    if (!analysis) {
      return {
        ok: false,
        reason: "not_found",
        message: `"${rawTicker.toUpperCase()}" is not in the demo data set.`,
        source: "demo",
      };
    }
    // The mock data's own hand-set "as of" date, not the current time —
    // demo data doesn't get fresher just because someone is viewing it.
    const fetchedAt = new Date(analysis.financialData.profile.lastUpdated).getTime();
    return { ok: true, data: analysis, source: "demo", fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : Date.now() };
  }

  const ticker = rawTicker.trim().toUpperCase();
  const cached = getCachedAnalysis(ticker);

  if (cached && isCacheFresh(cached)) {
    return { ok: true, data: toCompanyAnalysis(cached), source: "recent", fetchedAt: cached.fetchedAt };
  }

  const live = await fetchLiveAndCache(ticker);

  if (live.ok) {
    return { ok: true, data: live.data, source: "live", fetchedAt: live.fetchedAt };
  }

  // Live fetch failed (rate limit, provider error, or not_found) — fall
  // back to whatever cached record exists, however stale, rather than a
  // blocking error. The cache entry's own ticker was already validated
  // in lib/company-cache.ts, so this can never serve another company's
  // data under this ticker.
  if (cached) {
    return { ok: true, data: toCompanyAnalysis(cached), source: "recent", fetchedAt: cached.fetchedAt };
  }

  // Absolute last resort, only for the five core demo companies: a
  // bundled, verified SEC snapshot rather than a blocking error.
  const snapshot = getSecSnapshot(ticker);
  if (snapshot) {
    return { ok: true, data: toCompanyAnalysis(snapshot), source: "recent", fetchedAt: snapshot.fetchedAt };
  }

  return { ok: false, reason: live.error.reason, message: live.error.message, source: "live" };
}

export interface RefreshOutcome {
  liveSucceeded: boolean;
  /** Present when the live attempt failed — shown as a non-blocking message, never a page-replacing error. */
  failureMessage?: string;
  /** True if a cached record still exists to keep showing after a failed refresh. */
  hasFallback: boolean;
}

/**
 * Used by the "Refresh data" action (app/company/[ticker]/actions.ts).
 * Always attempts a live fetch — bypassing the freshness window, since
 * this is an explicit user request — but never destroys the existing
 * cache if that attempt fails.
 */
export async function refreshCompanyData(rawTicker: string): Promise<RefreshOutcome> {
  const ticker = rawTicker.trim().toUpperCase();
  const live = await fetchLiveAndCache(ticker);

  if (live.ok) {
    return { liveSucceeded: true, hasFallback: true };
  }

  const cached = getCachedAnalysis(ticker);
  const hasFallback = cached !== null || getSecSnapshot(ticker) !== null;
  return { liveSucceeded: false, failureMessage: live.error.message, hasFallback };
}
