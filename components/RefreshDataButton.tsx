"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshCompanyDataAction } from "@/app/company/[ticker]/actions";

/**
 * Explicit, optional "get the latest data" control. Always attempts a
 * real SEC EDGAR request (never a client-side illusion) and never
 * destroys the existing cached analysis if that attempt fails — a
 * failed refresh shows a small non-blocking message and the page stays
 * exactly as it was.
 */
export function RefreshDataButton({ ticker }: { ticker: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const outcome = await refreshCompanyDataAction(ticker);
      if (outcome.liveSucceeded) {
        router.refresh();
        return;
      }
      setMessage(
        outcome.hasFallback
          ? "Couldn't refresh right now — still showing your most recent data."
          : "Couldn't refresh right now.",
      );
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-busy={isPending}
        className="flex items-center gap-1.5 text-xs font-medium text-subtle transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw size={12} className={isPending ? "animate-spin" : ""} aria-hidden="true" />
        {isPending ? "Refreshing…" : "Refresh data"}
      </button>
      {message && (
        <p role="status" className="text-xs text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
