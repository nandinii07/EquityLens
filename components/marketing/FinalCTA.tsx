"use client";

import { ArrowRight } from "lucide-react";
import { useTickerSearch } from "@/hooks/use-ticker-search";
import { MagneticButton } from "@/components/motion/interactive";
import { AnalyzingOverlay } from "@/components/AnalyzingOverlay";
import { Reveal } from "@/components/motion/primitives";

export function FinalCTA() {
  const { value, setValue, error, isPending, handleSubmit } = useTickerSearch();

  return (
    <section className="relative overflow-hidden bg-mkt-bg px-6 py-28 sm:py-36">
      <AnalyzingOverlay show={isPending} ticker={value} />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-mkt-accent/10 blur-[140px]" />

      <Reveal className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-mkt-ink sm:text-5xl">
          Analyze your next company.
        </h2>
        <p className="mt-4 text-mkt-ink-muted">Enter a ticker and see the full picture in minutes.</p>

        <form onSubmit={handleSubmit} className="mt-8 w-full max-w-md">
          <div className="flex items-stretch overflow-hidden rounded-xl border border-mkt-border-strong bg-mkt-surface transition-colors focus-within:border-mkt-accent">
            <input
              type="text"
              name="ticker"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter ticker (e.g. AAPL)"
              aria-label="Company ticker"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={isPending}
              className="num flex-1 bg-transparent px-4 py-3 text-base text-mkt-ink outline-none placeholder:text-mkt-ink-subtle disabled:opacity-60"
            />
            <MagneticButton
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="flex items-center gap-1.5 whitespace-nowrap bg-mkt-accent px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "Analyzing…" : "Analyze"}
              <ArrowRight size={15} />
            </MagneticButton>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-mkt-negative">
              {error}
            </p>
          )}
        </form>
      </Reveal>
    </section>
  );
}
