"use client";

import { useParams } from "next/navigation";
import { AnalyzingOverlay } from "@/components/AnalyzingOverlay";

/**
 * Next.js automatically wraps the async page in a Suspense boundary using
 * this as the fallback, shown from the moment navigation starts until the
 * page's data (SEC EDGAR fetch -> calculations -> scoring) resolves —
 * that pipeline is sequential and can take several seconds.
 *
 * This reuses the exact same AnalyzingOverlay shown during a client-side
 * search submission (components/AnalyzingOverlay.tsx), so a direct link
 * or URL navigation to /company/[ticker] looks identical to submitting
 * the search form — one consistent transition, not two different ones.
 * `loading.tsx` has no props in Next's convention, but it renders inside
 * the [ticker] route segment, so `useParams()` still resolves the real
 * ticker here.
 */
export default function CompanyLoading() {
  const params = useParams<{ ticker: string }>();
  const ticker = typeof params?.ticker === "string" ? params.ticker : "";

  return <AnalyzingOverlay show ticker={ticker} />;
}
