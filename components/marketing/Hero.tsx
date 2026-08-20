"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowRight } from "lucide-react";
import { HeroBackground } from "@/components/marketing/HeroBackground";
import { MagneticButton } from "@/components/motion/interactive";
import { AnalyzingOverlay } from "@/components/AnalyzingOverlay";
import { useTickerSearch } from "@/hooks/use-ticker-search";
import { EASE } from "@/components/motion/primitives";
import { MOCK_TICKERS } from "@/lib/mock-data";

const HEADLINE_WORDS = ["Understand", "a", "company", "in", "minutes."];

/**
 * The hero's entrance is one deliberately choreographed timeline, not
 * independent per-element animations — background → nav → eyebrow →
 * headline → supporting copy → search → the decorative financial visual
 * as a final flourish (see HeroBackground's own delays, tuned to start
 * after this point). The search input itself is interactive from t=0
 * regardless of the animation — nothing here blocks typing or submitting
 * early.
 */
const T = {
  eyebrow: 0.25,
  headline: 0.42,
  headlineStagger: 0.055,
  subtext: 1.05,
  search: 1.25,
};

export function Hero() {
  const reduce = useReducedMotion();
  const { value, setValue, error, isPending, submit, handleSubmit } = useTickerSearch();

  return (
    <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden bg-mkt-bg px-6 pb-20 pt-28">
      <AnalyzingOverlay show={isPending} ticker={value} />
      <HeroBackground />

      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <motion.span
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: T.eyebrow, ease: EASE }}
          className="mb-5 text-xs uppercase tracking-[0.35em] text-mkt-accent-strong"
        >
          Fundamental analysis, transparently scored
        </motion.span>

        <motion.h1
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: T.headlineStagger, delayChildren: T.headline } } }}
          className="text-5xl font-semibold tracking-tight text-mkt-ink sm:text-6xl md:text-7xl"
        >
          {HEADLINE_WORDS.map((word, i) => (
            <motion.span
              key={i}
              className="mr-[0.28em] inline-block overflow-hidden py-1 align-top last:mr-0"
              variants={{ hidden: {}, show: {} }}
            >
              <motion.span
                className="inline-block"
                variants={{
                  hidden: { opacity: 0, y: reduce ? 0 : 32, filter: reduce ? "none" : "blur(8px)" },
                  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.75, ease: EASE } },
                }}
              >
                {word}
              </motion.span>
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: T.subtext, ease: EASE }}
          className="mt-6 max-w-2xl text-balance text-lg text-mkt-ink-muted sm:text-xl"
        >
          Analyze growth, profitability, valuation, debt and cash flow — and turn financial complexity into one
          clear picture.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 16, scale: reduce ? 1 : 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: T.search, ease: EASE }}
          className="mt-10 w-full max-w-lg"
        >
          <form onSubmit={handleSubmit} className="w-full">
            <div className="group flex items-stretch overflow-hidden rounded-xl border border-mkt-border-strong bg-mkt-surface shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-colors duration-300 focus-within:border-mkt-accent focus-within:shadow-[0_0_0_4px_rgba(76,130,255,0.12)]">
              <input
                type="text"
                name="ticker"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="AAPL"
                aria-label="Company ticker"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={isPending}
                className="num flex-1 bg-transparent px-5 py-4 text-lg text-mkt-ink outline-none placeholder:text-mkt-ink-subtle disabled:opacity-60"
              />
              <MagneticButton
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
                className="group/btn flex items-center gap-2 whitespace-nowrap bg-mkt-accent px-6 py-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? "Analyzing…" : "Analyze"}
                <ArrowRight size={16} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
              </MagneticButton>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm text-mkt-negative">
                {error}
              </p>
            )}
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-mkt-ink-subtle">
            <span>Try</span>
            {MOCK_TICKERS.map((ticker) => (
              <button
                key={ticker}
                type="button"
                onClick={() => submit(ticker)}
                disabled={isPending}
                className="num rounded-md border border-mkt-border px-2.5 py-1 text-mkt-ink-muted transition-colors duration-200 hover:border-mkt-accent hover:text-mkt-ink disabled:opacity-50"
              >
                {ticker}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.9 }}
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-mkt-ink-subtle"
      >
        <span className="text-[11px] uppercase tracking-[0.3em]">Scroll</span>
        <motion.span
          animate={reduce ? undefined : { y: [0, 6, 0] }}
          transition={reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="h-8 w-px bg-gradient-to-b from-mkt-ink-subtle to-transparent"
        />
      </motion.div>
    </section>
  );
}
