"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Reveal, EASE } from "@/components/motion/primitives";

const STATUS_STEPS = ["Analyzing fundamentals…", "Identifying strengths…", "Evaluating risks…"];

const STRENGTHS = ["Consistent multi-year revenue growth", "Best-in-class operating margins", "Strong free cash flow generation"];
const RISKS = ["Valuation is elevated relative to growth", "Leverage trending upward", "Margin durability under scrutiny"];
const WATCH = ["Next quarterly margin trend", "Debt issuance activity", "Guidance versus consensus"];

/**
 * Marketing-only illustration of what an AI Analysis looks like. This is
 * NOT a live Claude call — no API request is made here, nothing is
 * computed from real data, and the section is explicitly labeled
 * "Simulated preview" throughout so it's never mistaken for a real
 * result. The real AI analysis (lib/ai-analysis.ts, a genuine Claude API
 * call) only ever runs on an actual /company/[ticker] page.
 */
export function AIShowcase() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const [step, setStep] = useState(-1);

  // Same reasoning as components/motion/primitives.tsx's CountUp: `reduce`
  // is always `false` on the render that matches SSR, so seeding `step`
  // from it in the initializer above would leave reduced-motion users
  // stuck on `-1` forever once `reduce` later resolves to `true` (the
  // effect below never starts the step timer in that case). Snapping
  // straight to the final "result" step synchronously during render, the
  // moment `reduce` is known to be true, avoids that stuck state without
  // waiting an extra frame.
  if (reduce && step < STATUS_STEPS.length) {
    setStep(STATUS_STEPS.length);
  }

  useEffect(() => {
    if (reduce || !inView) return;
    if (step >= STATUS_STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === -1 ? 300 : 700);
    return () => clearTimeout(t);
  }, [inView, reduce, step]);

  const showResult = step >= STATUS_STEPS.length;

  return (
    <section className="bg-mkt-bg px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-3xl">
        <Reveal className="text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-mkt-accent-strong">AI-assisted analysis</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-mkt-ink sm:text-4xl">
            Numbers tell the story.
            <br />
            AI helps you understand it.
          </h2>
        </Reveal>

        <div ref={ref} className="mt-14 rounded-2xl border border-mkt-border-strong bg-mkt-surface p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-mkt-border pb-4">
            <span className="text-xs font-medium uppercase tracking-wide text-mkt-ink-subtle">AI Analysis</span>
            <span className="rounded-full border border-mkt-border-strong px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-mkt-ink-subtle">
              Simulated preview
            </span>
          </div>

          <div className="mt-5 min-h-[220px]">
            <AnimatePresence mode="wait">
              {!showResult ? (
                <motion.div
                  key="status"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-3"
                >
                  {STATUS_STEPS.map((label, i) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: i <= step ? 1 : 0.2, x: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="num flex items-center gap-2.5 text-sm text-mkt-ink-muted"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${i <= step ? "bg-mkt-accent" : "bg-mkt-border-strong"}`}
                      />
                      {label}
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="flex flex-col gap-6"
                >
                  <div>
                    <h3 className="text-sm font-medium text-mkt-ink">Overall Assessment</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-mkt-ink-muted">
                      Strong underlying fundamentals, with valuation representing the primary concern.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <AIList heading="Strengths" items={STRENGTHS} tone="var(--mkt-positive)" />
                    <AIList heading="Risks" items={RISKS} tone="var(--mkt-negative)" />
                    <AIList heading="What to Watch" items={WATCH} tone="var(--mkt-ink-subtle)" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-mkt-ink-subtle">
          Illustrative example — not generated by the Claude API. Every real analysis page runs a live request
          against your ticker&rsquo;s actual computed metrics.
        </p>
      </div>
    </section>
  );
}

function AIList({ heading, items, tone }: { heading: string; items: string[]; tone: string }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-mkt-ink-subtle">{heading}</h4>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm text-mkt-ink-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5">
            <span aria-hidden="true" style={{ color: tone }}>
              •
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
