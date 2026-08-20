"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { InvestmentScore } from "@/types/scoring";
import { CountUp, Reveal, Stagger, StaggerItem, EASE } from "@/components/motion/primitives";
import { getRatingStyle } from "@/lib/rating";

const RING_SIZE = 280;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * A large, dramatic presentation of a real, already-computed
 * `InvestmentScore` — the numbers are props, sourced server-side (see
 * app/page.tsx) from lib/scoring.ts via the same mock-data pipeline the
 * analyzer itself uses (lib/mock-data.ts -> calculateInvestmentScore).
 * Nothing here invents or adjusts a number; only the reveal — a drawing
 * ring synchronized with the count-up, then the category bars, then the
 * rating tag last — is animated.
 */
export function ScoreShowcase({
  score,
  companyName,
  ticker,
}: {
  score: InvestmentScore;
  companyName: string;
  ticker: string;
}) {
  const reduce = useReducedMotion();
  const style = getRatingStyle(score.rating);
  const fraction = score.overall / score.maxScore;

  return (
    <section className="bg-mkt-bg px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-4xl">
        <Reveal className="text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-mkt-accent-strong">The investment score</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-mkt-ink sm:text-4xl">
            Five dimensions. One transparent number.
          </h2>
          <p className="mt-4 text-mkt-ink-muted">
            Demo · {companyName} ({ticker}) — computed live by the same deterministic scoring engine used on every
            company page, not a mockup number.
          </p>
        </Reveal>

        <Reveal delay={0.15} className="mt-14 flex flex-col items-center">
          <div className="relative flex items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
            <svg width={RING_SIZE} height={RING_SIZE} className="absolute -rotate-90">
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="var(--mkt-surface-2)"
                strokeWidth={RING_STROKE}
              />
              <motion.circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="var(--mkt-accent)"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                initial={reduce ? { strokeDashoffset: RING_CIRCUMFERENCE * (1 - fraction) } : { strokeDashoffset: RING_CIRCUMFERENCE }}
                whileInView={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - fraction) }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, ease: EASE }}
              />
            </svg>

            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1.5">
                <CountUp value={score.overall} className="num text-7xl font-semibold tracking-tight text-mkt-ink" />
                <span className="num text-lg text-mkt-ink-subtle">/ {score.maxScore}</span>
              </div>
              <motion.span
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 1.3, ease: EASE }}
                className="mt-3 rounded-full px-3.5 py-1 text-xs font-semibold tracking-wide"
                style={{ color: style.text, background: style.bg }}
              >
                {style.tagline}
              </motion.span>
            </div>
          </div>
        </Reveal>

        <Stagger className="mt-16 flex flex-col gap-6" stagger={0.12}>
          {score.breakdown.map((cat) => {
            const pct = (cat.score / cat.maxScore) * 100;
            return (
              <StaggerItem key={cat.category}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-mkt-ink">{cat.category}</span>
                    <span className="num text-sm text-mkt-ink-muted">
                      {cat.score} / {cat.maxScore}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-mkt-surface-2">
                    <motion.div
                      initial={reduce ? { width: `${pct}%` } : { width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: EASE }}
                      className="h-full rounded-full bg-mkt-accent"
                    />
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
