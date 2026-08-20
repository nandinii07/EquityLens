"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { isValidTickerFormat } from "@/lib/ticker";

/**
 * Shared ticker-search behavior for every "enter a ticker, go to its
 * analysis" entry point on the site (the marketing hero, the dashboard
 * SearchBar). Navigation always goes through the real
 * `/company/[ticker]` route — there is no shortcut here that bypasses
 * SEC EDGAR / the scoring pipeline; this hook only validates input
 * and triggers the same navigation a typed URL would.
 */
export function useTickerSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(rawTicker?: string) {
    const ticker = (rawTicker ?? value).trim().toUpperCase();

    if (!ticker) {
      setError("Enter a ticker symbol.");
      return;
    }
    if (!isValidTickerFormat(ticker)) {
      setError("That doesn't look like a valid ticker symbol.");
      return;
    }

    setError(null);
    // A live lookup takes several seconds (SEC EDGAR is fetched
    // sequentially) — startTransition keeps isPending in sync with the
    // navigation so callers can show an "Analyzing…" state immediately.
    startTransition(() => {
      router.push(`/company/${ticker}`);
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  return { value, setValue, error, isPending, submit, handleSubmit };
}
