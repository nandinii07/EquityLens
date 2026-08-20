import "server-only";

import { fetchSecJson, SecFetchError } from "@/lib/sec-client";
import { createPersistentStore } from "@/lib/persistent-cache";

/**
 * Resolves a ticker (or, best-effort, an exact company name) to the SEC
 * Central Index Key (CIK) it needs for the companyfacts/submissions APIs.
 *
 * SEC publishes the full ticker <-> CIK mapping as a single bulk JSON file
 * (https://www.sec.gov/files/company_tickers.json, ~10,000 entries, no API
 * key, no per-ticker lookup endpoint). This module fetches that file at
 * most once per TTL window and serves every ticker lookup out of memory —
 * never redownloading it per request, and never hardcoding a handful of
 * known tickers (any SEC-reporting US company in the file resolves).
 */

interface TickerEntry {
  cik: number;
  ticker: string;
  title: string;
}

interface TickerMap {
  byTicker: Map<string, TickerEntry>;
  /** Secondary, best-effort exact-title lookup — see resolveTicker's doc comment on its limits. */
  byTitle: Map<string, TickerEntry>;
  fetchedAt: number;
}

/** The mapping rarely changes (new IPOs/delistings only) — a week-long window keeps this to roughly one SEC request per week per running instance. */
const MAP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const NAMESPACE = "sec-ticker-map";
const store = createPersistentStore<{ entries: [string, TickerEntry][]; fetchedAt: number }>(NAMESPACE);
const STORE_KEY = "v1";

let inMemory: TickerMap | null = null;
let inFlight: Promise<TickerMap> | null = null;

function toMap(entries: [string, TickerEntry][], fetchedAt: number): TickerMap {
  const byTicker = new Map<string, TickerEntry>();
  const byTitle = new Map<string, TickerEntry>();
  for (const [, entry] of entries) {
    byTicker.set(entry.ticker, entry);
    byTitle.set(entry.title.toLowerCase(), entry);
  }
  return { byTicker, byTitle, fetchedAt };
}

async function fetchTickerMap(): Promise<TickerMap> {
  const raw = await fetchSecJson("https://www.sec.gov/files/company_tickers.json");
  // Shape: { "0": {cik_str, ticker, title}, "1": {...}, ... } — an object
  // keyed by array index, not by ticker, per SEC's own file format.
  const entries: [string, TickerEntry][] = [];
  if (raw && typeof raw === "object") {
    for (const value of Object.values(raw as Record<string, unknown>)) {
      if (
        value &&
        typeof value === "object" &&
        "cik_str" in value &&
        "ticker" in value &&
        "title" in value
      ) {
        const v = value as { cik_str: unknown; ticker: unknown; title: unknown };
        if (typeof v.cik_str === "number" && typeof v.ticker === "string" && typeof v.title === "string") {
          const ticker = v.ticker.toUpperCase();
          entries.push([ticker, { cik: v.cik_str, ticker, title: v.title }]);
        }
      }
    }
  }
  if (entries.length === 0) {
    throw new SecFetchError("provider_error", "SEC's ticker directory returned no entries.");
  }
  const fetchedAt = Date.now();
  store.set(STORE_KEY, { entries, fetchedAt });
  return toMap(entries, fetchedAt);
}

/** Loads the mapping: fresh in-memory copy -> fresh disk copy -> live SEC fetch, deduped across concurrent callers. */
async function getTickerMap(): Promise<TickerMap> {
  if (inMemory && Date.now() - inMemory.fetchedAt < MAP_TTL_MS) return inMemory;

  const onDisk = store.get(STORE_KEY);
  if (onDisk && Date.now() - onDisk.fetchedAt < MAP_TTL_MS) {
    inMemory = toMap(onDisk.entries, onDisk.fetchedAt);
    return inMemory;
  }

  if (inFlight) return inFlight;
  inFlight = fetchTickerMap()
    .then((map) => {
      inMemory = map;
      return map;
    })
    .catch((err) => {
      // A live refetch failed — serve stale data (in-memory or on-disk)
      // rather than a hard failure, exactly like the analysis-level cache
      // fallback in lib/company-analysis.ts. Only truly nothing-available
      // propagates the error.
      if (inMemory) return inMemory;
      if (onDisk) {
        inMemory = toMap(onDisk.entries, onDisk.fetchedAt);
        return inMemory;
      }
      throw err;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export interface ResolvedCompany {
  cik: number;
  /** Always 10 digits, zero-padded — the exact format the companyfacts/submissions URLs require. */
  cikPadded: string;
  ticker: string;
  title: string;
}

/**
 * Resolves a user-provided symbol to its CIK. Case-insensitive on the
 * ticker ("AAPL", "aapl" both resolve). As a secondary, best-effort path,
 * also tries an *exact* case-insensitive match against the company's
 * full legal title (so "Apple Inc." resolves even if typed lowercase) —
 * this is intentionally not a fuzzy/partial search ("Apple" alone will
 * not match "Apple Inc."): partial company-name search is a distinct,
 * larger feature (autocomplete/search-as-you-type) better solved at the
 * UI layer, not by guessing here and risking an ambiguous match.
 */
export async function resolveTicker(raw: string): Promise<ResolvedCompany | null> {
  const input = raw.trim();
  if (!input) return null;

  const map = await getTickerMap();
  const byTicker = map.byTicker.get(input.toUpperCase());
  const entry = byTicker ?? map.byTitle.get(input.toLowerCase());
  if (!entry) return null;

  return {
    cik: entry.cik,
    cikPadded: String(entry.cik).padStart(10, "0"),
    ticker: entry.ticker,
    title: entry.title,
  };
}

/** Test-only: clears both the module-local state and the underlying persistent store so tests don't leak the ticker map between cases. */
export function __resetTickerMapForTests(): void {
  inMemory = null;
  inFlight = null;
  store.clear();
}
