"use server";

import { refreshCompanyData, type RefreshOutcome } from "@/lib/company-analysis";

/**
 * Thin Server Action wrapper — kept in its own "use server" file rather
 * than adding the directive to lib/company-analysis.ts, so that module
 * stays a plain server-side library (imported directly by Server
 * Components) without also becoming a client-callable action boundary
 * for every export in it.
 */
export async function refreshCompanyDataAction(ticker: string): Promise<RefreshOutcome> {
  return refreshCompanyData(ticker);
}
