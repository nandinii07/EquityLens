import "server-only";

/**
 * Best-effort market price lookup — the one input SEC EDGAR fundamentally
 * cannot provide (filings contain no share price), needed only for the
 * four valuation ratios (P/E, P/S, P/B, EV/EBITDA).
 *
 * This is deliberately isolated and deliberately NOT treated as a
 * reliability-critical dependency:
 *
 * - Investigated during this migration: Alpha Vantage's own quote
 *   endpoint (the thing being removed — reintroducing it here would
 *   defeat the point), Stooq's public CSV endpoint (tested live during
 *   development and found to return 404 for the documented URL format —
 *   not usable), and Yahoo Finance's unofficial chart endpoint (tested
 *   live and does return current price data, no key required, but it is
 *   a widely-known unofficial/undocumented endpoint with no uptime or
 *   rate-limit guarantee and no formal terms covering this use). No
 *   source was found that is both free/keyless AND has a documented,
 *   dependable uptime guarantee the way data.sec.gov does.
 * - Given that, this app uses the Yahoo endpoint on a strictly
 *   best-effort basis: short timeout, never throws, and every caller
 *   treats a failure identically to "no price available" — never as an
 *   error. When it fails, `valuation.pe/ps/pb/evToEbitda` are `null` and
 *   lib/scoring.ts's existing null-safe category handling scores
 *   Valuation from whatever is actually available (or reports it as
 *   insufficient data) rather than ever substituting a guessed price.
 * - The rest of the platform — company identity, revenue, profitability,
 *   debt, cash flow, and the score categories built from them — has no
 *   dependency on this module at all and is fully unaffected if it is
 *   ever removed entirely.
 */

const TIMEOUT_MS = 4_000;

export interface LatestPrice {
  value: number;
  /** ISO date (YYYY-MM-DD) the price is as of — always shown to the user, per this app's "never a silent/undated number" rule. */
  asOf: string;
}

interface YahooChartResponse {
  chart?: {
    result?: {
      meta?: { regularMarketPrice?: number; regularMarketTime?: number };
    }[];
  };
}

export async function getLatestPrice(ticker: string): Promise<LatestPrice | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EquityLens/1.0)" },
    });
    if (!response.ok) return null;

    const json = (await response.json()) as YahooChartResponse;
    const meta = json.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const time = meta?.regularMarketTime;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;

    const asOf = typeof time === "number" ? new Date(time * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    return { value: price, asOf };
  } catch {
    // Network error, timeout, malformed response — all treated the same:
    // no price available. Never thrown, never logged as an app error.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
