import "server-only";

import type { CachedAnalysis } from "@/lib/company-cache";
import aapl from "@/data/sec-snapshots/AAPL.json";
import msft from "@/data/sec-snapshots/MSFT.json";
import googl from "@/data/sec-snapshots/GOOGL.json";
import nvda from "@/data/sec-snapshots/NVDA.json";
import amzn from "@/data/sec-snapshots/AMZN.json";

/**
 * Bundled, verified SEC financial snapshots for the five core demo
 * tickers (AAPL, MSFT, GOOGL, NVDA, AMZN) — the "core demo reliability"
 * guarantee: these five must always be servable even if data.sec.gov is
 * temporarily unreachable and no runtime cache entry exists yet (e.g. the
 * very first request to a freshly-deployed instance).
 *
 * These are not hand-written or approximated figures. Each file was
 * produced by scripts/generate-sec-snapshots.ts, which runs the exact
 * same normalization pipeline the live app uses
 * (lib/sec-financial-api.ts) against real SEC EDGAR data fetched during
 * development — see that script's doc comment for how to refresh them
 * (e.g. after one of these companies' next annual filing).
 *
 * Statically imported (not read from disk at request time) so they are
 * bundled directly into the build output and work identically in every
 * deployment target, including serverless functions with an ephemeral or
 * read-only filesystem — no runtime persistence is required for this
 * fallback to work.
 *
 * This is a distinct concept from the Stage 1 illustrative "demo data"
 * set (lib/mock-data.ts, `?mock=1`): these snapshots are real captured
 * SEC filings data with an honest, disclosed "as of" date, always
 * presented as `source: "recent"` ("Recent SEC snapshot"), never as
 * live and never mislabeled as the illustrative demo set.
 */

interface SecSnapshotFile {
  ticker: string;
  companyName: string;
  fetchedAt: string;
  financialData: CachedAnalysis["financialData"];
  score: CachedAnalysis["score"];
  insights: CachedAnalysis["insights"];
}

const SNAPSHOTS: Record<string, SecSnapshotFile> = {
  AAPL: aapl as SecSnapshotFile,
  MSFT: msft as SecSnapshotFile,
  GOOGL: googl as SecSnapshotFile,
  NVDA: nvda as SecSnapshotFile,
  AMZN: amzn as SecSnapshotFile,
};

export const SNAPSHOT_TICKERS = Object.keys(SNAPSHOTS);

/** Returns the bundled verified snapshot for a ticker, or null if it isn't one of the five core demo companies. */
export function getSecSnapshot(rawTicker: string): CachedAnalysis | null {
  const ticker = rawTicker.trim().toUpperCase();
  const snapshot = SNAPSHOTS[ticker];
  if (!snapshot) return null;

  return {
    ticker,
    companyName: snapshot.companyName,
    financialData: snapshot.financialData,
    score: snapshot.score,
    insights: snapshot.insights,
    fetchedAt: new Date(snapshot.fetchedAt).getTime(),
  };
}
