import "server-only";

/**
 * Shared low-level fetch helper for every SEC EDGAR request in this app
 * (lib/sec-ticker-map.ts, lib/sec-financial-api.ts). Centralizing this
 * means the User-Agent header, timeout behavior, and error classification
 * are defined once and can't drift between the two SEC endpoints used.
 *
 * SEC's fair-access policy (https://www.sec.gov/os/webmaster-faq#developers)
 * requires a descriptive User-Agent identifying the requester and asks
 * callers not to hammer the service — this app additionally caches
 * aggressively (see lib/company-cache.ts, lib/sec-ticker-map.ts) and never
 * fires SEC requests in parallel for a single ticker lookup, well within
 * SEC's documented allowance.
 */

/**
 * SEC asks for "Sample Company Name AdminContact@sample.com" style
 * identification. This is configurable via an env var so a real deployer
 * can put their own contact info in without it ever being hardcoded into
 * source or touching any personal data this app doesn't otherwise handle.
 */
function userAgent(): string {
  const contact = process.env.SEC_USER_AGENT_CONTACT?.trim();
  return `EquityLens/1.0 (${contact && contact.length > 0 ? contact : "portfolio project; contact not configured, see SEC_USER_AGENT_CONTACT"})`;
}

export type ProviderErrorReason = "not_found" | "rate_limited" | "provider_error";

export interface ProviderError {
  reason: ProviderErrorReason;
  message: string;
}

/** Every external call in this app must resolve within this bound — see the "no infinite loading" requirement. */
const DEFAULT_TIMEOUT_MS = 8_000;

export class SecFetchError extends Error {
  reason: ProviderErrorReason;
  constructor(reason: ProviderErrorReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

/**
 * Fetches one SEC EDGAR JSON endpoint with a bounded timeout (AbortController)
 * and a compliant User-Agent header. Never leaves an unresolved promise —
 * a hung connection is aborted and turned into a `provider_error` after
 * `timeoutMs`, so this can never be the cause of an infinite loading state.
 *
 * `cache: "no-store"` mirrors the previous Alpha Vantage integration's
 * reasoning: correctness (never serving a stale error) matters more here
 * than Next's fetch cache, since this app has its own dedicated
 * normalized-result cache (lib/company-cache.ts) sitting above this layer.
 */
export async function fetchSecJson(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new SecFetchError("provider_error", "The SEC EDGAR request timed out.");
    }
    throw new SecFetchError("provider_error", "Could not reach SEC EDGAR.");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    throw new SecFetchError("not_found", "No SEC EDGAR record was found for this company.");
  }
  if (response.status === 429) {
    throw new SecFetchError("rate_limited", "SEC EDGAR's request limit was reached. Please try again shortly.");
  }
  if (!response.ok) {
    throw new SecFetchError("provider_error", `SEC EDGAR returned an unexpected response (${response.status}).`);
  }

  try {
    return await response.json();
  } catch {
    throw new SecFetchError("provider_error", "SEC EDGAR returned a response that could not be parsed.");
  }
}
