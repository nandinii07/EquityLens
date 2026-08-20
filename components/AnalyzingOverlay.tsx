"use client";

import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Full-screen transition shown the instant a ticker is submitted (from
 * the hero or the dashboard SearchBar), so a live lookup — several
 * seconds of sequential SEC EDGAR calls — never feels like a dead
 * click or an abrupt page swap. It knows the ticker immediately (no
 * server round-trip needed), unlike app/company/[ticker]/loading.tsx,
 * which is Next's route-level fallback for direct navigations and
 * doesn't receive the ticker as a prop.
 *
 * The five small bars below the ticker are a purely decorative "an
 * analysis is being assembled" motif (echoing the five scoring
 * categories) — not a progress meter. It loops for as long as `show` is
 * true and simply fades out via AnimatePresence whenever the real page
 * is ready, whether that's 200ms or several seconds later, so it never
 * claims specific progress it can't observe.
 */
export function AnalyzingOverlay({ show, ticker }: { show: boolean; ticker: string }) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.15 : 0.4, ease: "easeOut" }}
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-mkt-bg"
        >
          <div className="flex flex-col items-center gap-3">
            <motion.div
              initial={{ opacity: 0, y: reduce ? 0 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="num text-sm uppercase tracking-[0.3em] text-mkt-ink-subtle"
            >
              Analyzing
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: reduce ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl font-semibold tracking-tight text-mkt-ink sm:text-5xl"
            >
              {ticker.toUpperCase() || "…"}
            </motion.div>
          </div>

          {/* Five bars, one per scoring category — a decorative "assembling
              the analysis" motif, not a real progress indicator. */}
          <div className="flex items-end gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 rounded-full bg-mkt-accent"
                initial={{ height: 6, opacity: 0.35 }}
                animate={
                  reduce
                    ? { height: 20, opacity: 0.6 }
                    : { height: [6, 26, 10, 22, 6], opacity: [0.35, 0.9, 0.5, 0.85, 0.35] }
                }
                transition={
                  reduce
                    ? { duration: 0.3, delay: 0.2 }
                    : { duration: 1.6, repeat: Infinity, delay: 0.25 + i * 0.1, ease: "easeInOut" }
                }
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
