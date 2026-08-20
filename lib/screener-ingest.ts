import "server-only";

import type { CompanyAnalysis } from "@/types/scoring";
import { getLiveCompanyAnalysis } from "@/lib/sec-financial-api";
import type { ScreenerCompanyRow } from "@/lib/screener-filters";

/**
 * Multi-company screener ingestion — the only new code path that talks to
 * SEC EDGAR for more than one ticker. It is explicitly NOT part of the
 * running app's request path: this module is only ever invoked by
 * scripts/generate-screener-snapshot.ts (offline / CI), never by
 * app/screener/page.tsx, which only ever reads the already-generated
 * data/screener-snapshot.json (see lib/screener-snapshot.ts). This is what
 * guarantees a visitor opening /screener never triggers a single SEC
 * request, let alone hundreds.
 *
 * Reuses the exact same per-ticker pipeline the individual company page
 * uses — lib/sec-financial-api.ts's `getLiveCompanyAnalysis`, which itself
 * calls the shared XBRL fallback-chain normalization (lib/sec-financial-api.ts),
 * lib/calculations.ts, and lib/scoring.ts's `calculateInvestmentScore`.
 * Nothing here recomputes a ratio or a score — this file only orchestrates
 * calling that pipeline across a list of tickers and projects each result
 * down to the handful of fields the screener table needs
 * (lib/screener-filters.ts's `ScreenerCompanyRow`).
 */

export interface IngestFailure {
  ticker: string;
  reason: string;
}

export interface IngestResult {
  rows: ScreenerCompanyRow[];
  failures: IngestFailure[];
}

export interface IngestOptions {
  /** Delay between companies, matching scripts/generate-sec-snapshots.ts's existing SEC fair-access pacing. */
  pacingMs?: number;
  /** Test-only hook to skip the real delay between companies. */
  delayFn?: (ms: number) => Promise<void>;
  /** Called after each ticker (success or failure) — used for progress logging in the CLI script. */
  onProgress?: (info: { ticker: string; index: number; total: number; ok: boolean }) => void;
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Projects a full `CompanyAnalysis` (the same shape /company/[ticker]
 * renders) down to the handful of fields the screener table, filters, and
 * sorts need. Pure field selection — every value is either passed through
 * unchanged or left `null`, exactly as the source data reported it.
 */
function toScreenerRow(ticker: string, analysis: CompanyAnalysis): ScreenerCompanyRow {
  const { financialData, score } = analysis;
  return {
    ticker,
    companyName: financialData.profile.name,
    sector: financialData.profile.sector,
    score: score.overall,
    rating: score.rating,
    revenueGrowth: financialData.revenue.yoyGrowth,
    netMargin: financialData.profitability.netMargin,
    roe: financialData.profitability.roe,
    debtToEquity: financialData.debt.debtToEquity,
    freeCashFlow: financialData.cashFlow.freeCashFlow,
    fcfGrowth: financialData.cashFlow.fcfGrowth,
    dataDate: financialData.profile.lastUpdated,
  };
}

/**
 * Ingests one ticker at a time, sequentially — same SEC request-concurrency
 * reasoning as scripts/generate-sec-snapshots.ts and
 * lib/sec-financial-api.ts (never more than one SEC request in flight at a
 * time from this app). A failure on any single ticker (a thrown exception,
 * or `getLiveCompanyAnalysis` returning `ok: false` — e.g. no usable
 * annual US-GAAP statements, a delisted ticker, a rate limit) is recorded
 * in `failures` and the loop continues; it can never abort the batch.
 * Nothing is ever fabricated to paper over a failure — an excluded company
 * simply does not appear in `rows`.
 */
export async function ingestScreenerUniverse(tickers: string[], options: IngestOptions = {}): Promise<IngestResult> {
  const pacingMs = options.pacingMs ?? 500;
  const delay = options.delayFn ?? defaultDelay;

  const rows: ScreenerCompanyRow[] = [];
  const failures: IngestFailure[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i].trim().toUpperCase();
    let ok = false;

    try {
      const result = await getLiveCompanyAnalysis(ticker);
      if (result.ok) {
        rows.push(toScreenerRow(ticker, result.data));
        ok = true;
      } else {
        failures.push({ ticker, reason: `${result.error.reason}: ${result.error.message}` });
      }
    } catch (err) {
      failures.push({ ticker, reason: err instanceof Error ? err.message : "Unknown ingestion error." });
    }

    options.onProgress?.({ ticker, index: i, total: tickers.length, ok });

    if (i < tickers.length - 1) {
      await delay(pacingMs);
    }
  }

  return { rows, failures };
}
