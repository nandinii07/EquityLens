import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Generic persisted key-value store used by lib/company-cache.ts (analysis
 * results) and lib/sec-ticker-map.ts (the ticker -> CIK mapping).
 *
 * Storage strategy, and why it's honestly scoped:
 * - The fast path is always an in-memory Map backed by `globalThis`, same
 *   as the original Stage 10 cache — this alone survives Next.js dev's
 *   Fast Refresh and serves every request within one running server
 *   process instantly, no I/O.
 * - In addition, every write is best-effort persisted to a JSON file
 *   under `.cache/` on disk, and the store is hydrated from that file on
 *   first use. This means a local `next dev`/`next start` process keeps
 *   its cache across restarts, which is genuinely useful in development
 *   and for a simple always-on Node deployment.
 * - This file-backed layer is NOT a production persistence guarantee on
 *   ephemeral/serverless platforms (e.g. Vercel functions): each cold
 *   start may get a fresh, empty filesystem, and concurrent instances
 *   don't share writes. It is deliberately treated as a *nice-to-have*,
 *   never as the thing correctness depends on — see
 *   lib/company-cache.ts and lib/sec-snapshots.ts for how the app stays
 *   fully correct with zero persistent cache at all (falls back to a
 *   live SEC fetch, and for the demo tickers, a bundled verified
 *   snapshot shipped with the app).
 * - The interface below is intentionally the entire surface a real KV
 *   (Vercel KV, Upstash Redis, etc.) would need to implement to become a
 *   true cross-instance production cache — swapping the implementation
 *   of `createPersistentStore` for one backed by such a service is a
 *   drop-in change; nothing else in the app would need to know.
 */

export interface PersistentStore<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
}

function cacheFilePath(namespace: string): string {
  return path.join(process.cwd(), ".cache", `${namespace}.json`);
}

/** Test runs never touch disk — cache state should be exactly what each test sets up, and tests must not leave files behind. */
function diskDisabled(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

/** Best-effort: never throws. A read-only or missing filesystem simply means no persistence this run. */
function readFromDisk<T>(namespace: string): Record<string, T> {
  if (diskDisabled()) return {};
  try {
    const raw = fs.readFileSync(cacheFilePath(namespace), "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, T>) : {};
  } catch {
    return {};
  }
}

/** Best-effort: never throws. Failing to persist to disk must never break a request. */
function writeToDisk<T>(namespace: string, data: Record<string, T>): void {
  if (diskDisabled()) return;
  try {
    const dir = path.dirname(cacheFilePath(namespace));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cacheFilePath(namespace), JSON.stringify(data), "utf-8");
  } catch {
    // Ephemeral/read-only filesystem (e.g. serverless) — the in-memory
    // store above is still fully functional for the life of this process.
  }
}

declare global {
  var __equityLensPersistentStores: Map<string, Map<string, unknown>> | undefined;
}

function registry(): Map<string, Map<string, unknown>> {
  if (!globalThis.__equityLensPersistentStores) {
    globalThis.__equityLensPersistentStores = new Map();
  }
  return globalThis.__equityLensPersistentStores;
}

/**
 * Returns the singleton store for a namespace, hydrating it from disk the
 * first time it's touched in this process. Tests should use a unique
 * namespace (or call `.clear()`) to avoid cross-test leakage, matching the
 * pattern the old in-memory-only cache used.
 */
export function createPersistentStore<T>(namespace: string): PersistentStore<T> {
  let map = registry().get(namespace) as Map<string, T> | undefined;
  if (!map) {
    map = new Map(Object.entries(readFromDisk<T>(namespace)));
    registry().set(namespace, map);
  }
  const liveMap = map;

  function persist(): void {
    writeToDisk(namespace, Object.fromEntries(liveMap.entries()));
  }

  return {
    get(key) {
      return liveMap.get(key);
    },
    set(key, value) {
      liveMap.set(key, value);
      persist();
    },
    delete(key) {
      liveMap.delete(key);
      persist();
    },
    clear() {
      liveMap.clear();
      persist();
    },
  };
}
