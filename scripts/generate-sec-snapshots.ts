/**
 * Dev-only maintenance script — NOT part of the running app.
 *
 * Regenerates the bundled "verified SEC snapshot" fixtures under
 * data/sec-snapshots/*.json for the five demo tickers (AAPL, MSFT,
 * GOOGL, NVDA, AMZN). These are what lib/sec-snapshots.ts serves as an
 * absolute last-resort fallback when a live SEC EDGAR fetch fails AND no
 * runtime cache entry exists for one of these tickers — see that file's
 * doc comment for why this exists and how it fits into the overall
 * cache/fallback chain.
 *
 * This script runs the exact same normalization code the live app uses
 * (lib/sec-financial-api.ts's getLiveCompanyAnalysis) against real,
 * currently-published SEC EDGAR data — it is not hand-written or
 * approximated data. Re-run it periodically (e.g. after these
 * companies' next annual filing) to refresh the snapshots:
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/generate-sec-snapshots.ts
 *
 * The --conditions=react-server flag is required only for this
 * standalone script: it makes Node resolve the `server-only` package to
 * its no-op branch instead of throwing (the throw only exists to catch
 * accidental Client Component imports inside Next's own bundler, which
 * doesn't apply here). Next.js and Vitest each handle this on their own
 * (webpack/turbopack conditions and `vi.mock("server-only")`
 * respectively) — nothing in the app itself needs this flag.
 */
import { getLiveCompanyAnalysis } from "../lib/sec-financial-api";
import { resolveTicker } from "../lib/sec-ticker-map";
import fs from "node:fs";
import path from "node:path";

const TICKERS = ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN"];
const OUT_DIR = path.join(__dirname, "..", "data", "sec-snapshots");
const SCHEMA_VERSION = 1;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const ticker of TICKERS) {
    console.log(`Fetching ${ticker} from SEC EDGAR...`);
    const resolved = await resolveTicker(ticker);
    const result = await getLiveCompanyAnalysis(ticker);

    if (!result.ok) {
      console.error(`  FAILED (${result.error.reason}): ${result.error.message}`);
      process.exitCode = 1;
      continue;
    }

    const latestFiscalPeriod = result.data.financialData.revenue.history.at(-1)?.year ?? null;

    const snapshot = {
      schemaVersion: SCHEMA_VERSION,
      ticker,
      cik: resolved?.cik ?? null,
      companyName: result.data.financialData.profile.name,
      source: "sec-snapshot" as const,
      fetchedAt: new Date().toISOString(),
      latestFiscalPeriod,
      financialData: result.data.financialData,
      score: result.data.score,
      insights: result.data.insights,
    };

    const outPath = path.join(OUT_DIR, `${ticker}.json`);
    fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n", "utf-8");
    console.log(`  OK -> ${outPath} (latest fiscal period: ${latestFiscalPeriod}, score: ${result.data.score.overall}/100)`);

    // Sequential with a pacing gap between companies, not parallel —
    // same SEC fair-access reasoning as the live request path.
    await delay(500);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
