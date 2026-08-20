import "server-only";

import type { ScreenerCompanyRow } from "@/lib/screener-filters";
import raw from "@/data/screener-snapshot.json";

/**
 * Runtime reader for the precomputed multi-company screener data.
 *
 * Statically imported (not read from disk at request time), exactly like
 * lib/sec-snapshots.ts's five bundled demo snapshots — this means
 * data/screener-snapshot.json is baked into the build output, and
 * app/screener/page.tsx serving it costs zero network calls and zero SEC
 * requests, on every instance, including a cold serverless start. The file
 * itself is only ever produced offline by
 * scripts/generate-screener-snapshot.ts (run locally or by
 * .github/workflows/refresh-screener-snapshot.yml) — never generated or
 * refreshed inside a request.
 */

export interface ScreenerSnapshot {
  generatedAt: string;
  /** How many tickers the ingestion run attempted (data/screener-universe.json's length at generation time). */
  universeRequested: number;
  /** How many of those produced a usable, normalized analysis and are present in `companies`. */
  succeeded: number;
  /** How many were excluded (no usable statements, rate limited, etc.) — never included with fabricated data. */
  failed: number;
  companies: ScreenerCompanyRow[];
}

export function getScreenerSnapshot(): ScreenerSnapshot {
  return raw as ScreenerSnapshot;
}
