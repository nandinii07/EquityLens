"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Re-runs the current route's server-side data fetch (the SEC EDGAR
 * pipeline in page.tsx) without a full page reload. Used on the
 * provider-error card — "Try again" literally retries the same live
 * request, it never silently swaps in mock data.
 */
export function RetryButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-busy={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className={className}
    >
      {isPending ? "Retrying…" : "Try again"}
    </button>
  );
}
