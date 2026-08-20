/**
 * Shared ticker format validation — used by SearchBar (client) so a user
 * gets instant feedback, and by lib/sec-financial-api.ts (server) so an
 * obviously-invalid ticker never spends a SEC EDGAR request. Keeping
 * one definition avoids the two drifting apart.
 */

/** Accepts common US ticker formats: 1-5 letters, optionally with a .suffix or -class letter. */
export const TICKER_PATTERN = /^[A-Z]{1,5}([.-][A-Z]{1,2})?$/;

export function isValidTickerFormat(ticker: string): boolean {
  return TICKER_PATTERN.test(ticker);
}
