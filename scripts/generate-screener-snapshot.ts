/**
 * Dev/CI-only maintenance script — NOT part of the running app.
 *
 * Regenerates data/screener-snapshot.json, the precomputed data
 * app/screener/page.tsx reads via lib/screener-snapshot.ts. This is the
 * ONLY place in the whole feature that performs multi-company SEC EDGAR
 * ingestion — the deployed app never does this at request time (see
 * lib/screener-ingest.ts's doc comment).
 *
 * Run it manually:
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/generate-screener-snapshot.ts
 *
 * (--conditions=react-server is required only for this standalone script,
 * to resolve `server-only` to its no-op branch — see
 * scripts/generate-sec-snapshots.ts's doc comment for the full explanation.
 * Next.js and Vitest each handle this on their own.)
 *
 * In CI, .github/workflows/refresh-screener-snapshot.yml runs this on a
 * schedule and commits the refreshed data/screener-snapshot.json — that
 * commit is what keeps the deployed screener fresh, not a runtime fetch.
 *
 * The universe (data/screener-universe.json) is a plain, editable list of
 * tickers — currently ~550 well-known SEC-reporting companies as a bounded
 * V1 selection. Growing the screener's coverage (e.g. toward the full SEC
 * ticker/CIK map from lib/sec-ticker-map.ts) only means changing what this
 * script reads as `tickers` below; nothing in the ingestion, normalization,
 * scoring, or screener UI needs to change to support a larger universe.
 */
import { ingestScreenerUniverse } from "../lib/screener-ingest";
import universe from "../data/screener-universe.json";
import fs from "node:fs";
import path from "node:path";

const OUT_PATH = path.join(__dirname, "..", "data", "screener-snapshot.json");
const SCHEMA_VERSION = 1;

async function main() {
  const tickers = universe as string[];
  console.log(`Ingesting ${tickers.length} tickers from SEC EDGAR...`);

  const { rows, failures } = await ingestScreenerUniverse(tickers, {
    onProgress: ({ ticker, index, total, ok }) => {
      console.log(`  [${index + 1}/${total}] ${ticker}: ${ok ? "OK" : "SKIPPED"}`);
    },
  });

  for (const failure of failures) {
    console.warn(`  EXCLUDED ${failure.ticker}: ${failure.reason}`);
  }

  // Deterministic order regardless of any future universe-file reordering,
  // so the diff of a re-generated snapshot only reflects real data changes.
  rows.sort((a, b) => a.ticker.localeCompare(b.ticker));

  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    universeRequested: tickers.length,
    succeeded: rows.length,
    failed: failures.length,
    companies: rows,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf-8");
  console.log(
    `\nDone: ${rows.length} succeeded, ${failures.length} excluded, out of ${tickers.length} requested.`,
  );
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
