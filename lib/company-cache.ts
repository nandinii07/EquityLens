import "server-only";

import type { FinancialData } from "@/types/financial";
import type { InvestmentScore, Insight } from "@/types/scoring";
import { createPersistentStore } from "@/lib/persistent-cache";

/**
 * Server-side cache of the NORMALIZED result of the pipeline — not raw
 * SEC EDGAR responses. This is deliberate: it's the same shape
 * lib/scoring.ts already produces, it's what the UI actually renders, and
 * it means a cache hit costs zero re-computation, not just zero network
 * calls. Never contains a raw provider payload.
 */
export interface CachedAnalysis {
  ticker: string;
  companyName: string;
  financialData: FinancialData;
  score: InvestmentScore;
  insights: Insight[];
  /** Epoch ms this record was actually fetched from SEC EDGAR — the single source of truth for freshness and for the "fetched <date>" UI copy. */
  fetchedAt: number;
}

/**
 * Freshness window: how long a cached record is served without even
 * attempting a live re-fetch.
 *
 * 24 hours, chosen because:
 * - The financial statements behind the score (annual/quarterly filings)
 *   do not change intraday, or even week to week — a same-day snapshot is
 *   not stale in any way that affects the analysis.
 * - SEC filers publish new annual/quarterly figures at most a few times a
 *   year, so a 24h window is already far more conservative than the data
 *   itself requires — it exists mainly to keep this app from re-fetching
 *   SEC EDGAR on every single page view of the same company.
 * - The share price is more time-sensitive than the statements, but this
 *   app already never labels a quote "real-time" — cached price data is
 *   always shown with its own "fetched <date>" timestamp (see
 *   CompanyHeader), so staleness is disclosed, never hidden.
 *
 * This is a freshness window, not an expiry: data older than this is
 * still served (see lib/company-analysis.ts's rate-limit fallback) if a
 * live re-fetch isn't possible — "best available data" always wins over
 * a blocking error.
 */
export const FRESH_TTL_MS = 24 * 60 * 60 * 1000;

export function isCacheFresh(entry: CachedAnalysis): boolean {
  return Date.now() - entry.fetchedAt < FRESH_TTL_MS;
}

/**
 * Storage: lib/persistent-cache.ts's store, which is an in-memory Map
 * backed by `globalThis` (survives Next.js dev's Fast Refresh module
 * reloads, and serves every request within one running process with zero
 * I/O) plus a best-effort JSON-file persistence layer for local
 * development. See that module's doc comment for exactly what
 * reliability guarantee this is — and isn't — in a serverless production
 * deployment, and lib/sec-snapshots.ts for how the app stays correct
 * even with an empty cache.
 *
 * In-flight request coalescing (`dedupe`, below) is kept as a plain
 * `globalThis`-backed Map rather than the persistent store: a Promise
 * can't be serialized to disk, and it only ever needs to dedupe
 * concurrent requests within one running process anyway.
 */
const analysisStore = createPersistentStore<CachedAnalysis>("company-analysis");

declare global {
  var __equityLensInFlight: Map<string, Promise<unknown>> | undefined;
}

function inFlightStore(): Map<string, Promise<unknown>> {
  if (!globalThis.__equityLensInFlight) {
    globalThis.__equityLensInFlight = new Map();
  }
  return globalThis.__equityLensInFlight;
}

/**
 * Looks up a cached record by ticker. Also validates that the record's
 * own `ticker` field matches the lookup key — defense in depth against
 * ever serving one ticker's cached financials under another ticker's
 * name, even if a future bug mis-keys the store.
 */
export function getCachedAnalysis(ticker: string): CachedAnalysis | null {
  const key = ticker.trim().toUpperCase();
  const entry = analysisStore.get(key);
  if (entry && entry.ticker === key) return entry;
  return null;
}

/**
 * Stores a record as one atomic unit — always a full replacement, never
 * a partial/merged update, so a cached entry can never end up combining
 * financial-statement years from two different fetches.
 */
export function setCachedAnalysis(entry: CachedAnalysis): void {
  analysisStore.set(entry.ticker.trim().toUpperCase(), entry);
}

/**
 * Coalesces concurrent callers of the same async operation into a single
 * in-flight promise. If two requests for the same ticker's live data
 * arrive close together, the second awaits the first's result instead of
 * starting a duplicate SEC EDGAR fetch.
 */
export async function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const store = inFlightStore();
  const existing = store.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => {
    store.delete(key);
  });
  store.set(key, promise);
  return promise;
}

/** Test-only: clears both stores so test cases don't leak cache state into each other. Not used by application code. */
export function __resetCacheForTests(): void {
  analysisStore.clear();
  inFlightStore().clear();
}
