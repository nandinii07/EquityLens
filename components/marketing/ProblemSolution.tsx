"use client";

import { useRef } from "react";
import { motion, useTransform } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useScrollYProgress } from "@/components/motion/interactive";
import { Reveal } from "@/components/motion/primitives";

const DOCUMENTS = [
  { label: "Annual Report", x: -220, y: -80, rotate: -8 },
  { label: "Balance Sheet", x: 200, y: -40, rotate: 6 },
  { label: "Income Statement", x: -160, y: 90, rotate: 5 },
  { label: "Cash Flow Statement", x: 180, y: 110, rotate: -6 },
  { label: "Valuation Data", x: 0, y: -150, rotate: 2 },
];

// The same five names the deterministic scoring engine actually uses
// (types/scoring.ts ScoreCategory) — shown here as a closing visual
// thread into the next section, which reveals their real computed
// scores. Purely a narrative bridge; no numbers are shown or implied.
const CATEGORY_PREVIEW = ["Revenue Growth", "Profitability", "Valuation", "Debt", "Cash Flow"];

function DocumentCard({
  label,
  x,
  y,
  rotate,
  progress,
  reduce,
}: {
  label: string;
  x: number;
  y: number;
  rotate: number;
  progress: ReturnType<typeof useScrollYProgress>["scrollYProgress"];
  reduce: boolean;
}) {
  // Cards converge to the center and fade as scroll progresses through
  // the middle portion of the section's scroll runway.
  const cx = useTransform(progress, [0.15, 0.55], [x, 0]);
  const cy = useTransform(progress, [0.15, 0.55], [y, 0]);
  const crotate = useTransform(progress, [0.15, 0.55], [rotate, 0]);
  const scale = useTransform(progress, [0.15, 0.55], [1, 0.12]);
  const opacity = useTransform(progress, [0.15, 0.45, 0.58], [1, 1, 0]);

  return (
    <motion.div
      style={
        reduce
          ? undefined
          : { x: cx, y: cy, rotate: crotate, scale, opacity }
      }
      className="absolute flex h-32 w-24 flex-col justify-between rounded-lg border border-mkt-border-strong bg-mkt-surface p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] sm:h-40 sm:w-28"
    >
      <div className="flex flex-col gap-1">
        <div className="h-1 w-1/2 rounded-full bg-mkt-ink-subtle/60" />
        <div className="h-1 w-3/4 rounded-full bg-mkt-ink-subtle/40" />
        <div className="h-1 w-2/3 rounded-full bg-mkt-ink-subtle/40" />
      </div>
      <div className="text-[10px] font-medium leading-tight text-mkt-ink-muted">{label}</div>
    </motion.div>
  );
}

export function ProblemSolution() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScrollYProgress(ref);

  const markScale = useTransform(scrollYProgress, [0.45, 0.6], [0.7, 1]);
  const markOpacity = useTransform(scrollYProgress, [0.45, 0.6], [0, 1]);
  const resultOpacity = useTransform(scrollYProgress, [0.62, 0.78], [0, 1]);
  const resultY = useTransform(scrollYProgress, [0.62, 0.78], [16, 0]);
  const categoriesOpacity = useTransform(scrollYProgress, [0.82, 0.95], [0, 1]);
  const categoriesY = useTransform(scrollYProgress, [0.82, 0.95], [10, 0]);

  return (
    <section ref={ref} className="relative bg-mkt-bg" style={{ height: reduce ? undefined : "180vh" }}>
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden px-6">
        <Reveal className="mb-16 max-w-2xl text-balance text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-mkt-ink sm:text-4xl">
            Financial analysis shouldn&rsquo;t take hours.
          </h2>
          <p className="mt-4 text-lg text-mkt-ink-muted">
            Reports, statements, ratios, filings — reading through all of it manually, company by company, doesn&rsquo;t
            scale. EquityLens does the reading for you.
          </p>
        </Reveal>

        <div className="relative flex h-64 w-full max-w-md items-center justify-center">
          {reduce ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {DOCUMENTS.map((doc) => (
                <span
                  key={doc.label}
                  className="rounded-md border border-mkt-border-strong bg-mkt-surface px-3 py-2 text-xs text-mkt-ink-muted"
                >
                  {doc.label}
                </span>
              ))}
            </div>
          ) : (
            DOCUMENTS.map((doc) => (
              <DocumentCard key={doc.label} {...doc} progress={scrollYProgress} reduce={reduce ?? false} />
            ))
          )}

          <motion.div
            style={reduce ? { opacity: 1 } : { scale: markScale, opacity: markOpacity }}
            className="pointer-events-none absolute flex flex-col items-center gap-1"
          >
            <span className="text-xl font-semibold tracking-tight text-mkt-ink sm:text-2xl">EquityLens</span>
          </motion.div>
        </div>

        <motion.p
          style={reduce ? { opacity: 1 } : { opacity: resultOpacity, y: resultY }}
          className="mt-10 text-xl font-medium tracking-tight text-mkt-ink sm:text-2xl"
        >
          One clear analysis.
        </motion.p>

        <motion.div
          style={reduce ? { opacity: 1 } : { opacity: categoriesOpacity, y: categoriesY }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
        >
          {CATEGORY_PREVIEW.map((name) => (
            <span key={name} className="flex items-center gap-1.5 text-xs text-mkt-ink-subtle">
              <span className="h-1 w-1 rounded-full bg-mkt-accent" aria-hidden="true" />
              {name}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
