"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { InvestmentScore as InvestmentScoreT } from "@/types/scoring";
import { getRatingStyle } from "@/lib/rating";
import { CountUp, EASE } from "@/components/motion/primitives";

const RING_SIZE = 220;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function InvestmentScore({ score }: { score: InvestmentScoreT }) {
  const style = getRatingStyle(score.rating);
  const reduce = useReducedMotion();
  const fraction = score.overall / score.maxScore;

  return (
    <section className="flex flex-col items-center border-b border-border py-10 text-center">
      <h2 className="text-xs font-medium uppercase tracking-[0.3em] text-subtle">
        Investment Score
      </h2>

      <div
        className="relative mt-6 flex items-center justify-center"
        style={{ width: RING_SIZE, height: RING_SIZE }}
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          className="absolute -rotate-90"
          role="img"
          aria-label={`Score ring: ${score.overall} of ${score.maxScore} points filled`}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={RING_STROKE}
          />
          <motion.circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={style.border}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            initial={
              reduce
                ? { strokeDashoffset: RING_CIRCUMFERENCE * (1 - fraction) }
                : { strokeDashoffset: RING_CIRCUMFERENCE }
            }
            animate={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - fraction) }}
            transition={{ duration: 1.3, ease: EASE }}
          />
        </svg>

        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-1">
            <CountUp value={score.overall} className="num text-6xl font-semibold leading-none text-foreground" />
            <span className="num text-xl text-subtle">/{score.maxScore}</span>
          </div>
          <motion.span
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.1, ease: EASE }}
            className="mt-3 rounded-full px-3 py-1 text-xs font-semibold tracking-wide"
            style={{ color: style.text, background: style.bg }}
          >
            {style.tagline}
          </motion.span>
        </div>
      </div>

      <p className="mt-6 max-w-2xl text-xs text-subtle">
        Ratings are descriptive bands based on the calculated score (90–100
        Exceptional, 75–89 Strong, 60–74 Moderate, 40–59 Weak, 0–39 High
        Risk). This score is a fundamental-analysis framework, not a
        prediction of future stock returns, and is not a recommendation to
        buy or sell.
      </p>
    </section>
  );
}
