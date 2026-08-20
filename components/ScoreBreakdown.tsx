"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { CategoryScore } from "@/types/scoring";
import { Stagger, StaggerItem, EASE } from "@/components/motion/primitives";

export function ScoreBreakdown({ breakdown }: { breakdown: CategoryScore[] }) {
  const reduce = useReducedMotion();

  return (
    <section className="border-b border-border py-8">
      <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">
        Score Breakdown
      </h2>
      <Stagger className="mt-4 flex flex-col gap-5" stagger={0.1}>
        {breakdown.map((cat) => {
          const pctOfCategory = (cat.score / cat.maxScore) * 100;
          const pctOfTotal = (cat.score / 100) * 100;
          return (
            <StaggerItem key={cat.category}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium text-foreground">
                  {cat.category}
                </span>
                <span className="num text-sm text-muted">
                  {cat.score}/{cat.maxScore}
                  <span className="ml-2 text-subtle">
                    ({pctOfTotal.toFixed(0)}% of total)
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <motion.div
                  className="h-full rounded-full bg-brand"
                  initial={reduce ? { width: `${pctOfCategory}%` } : { width: 0 }}
                  whileInView={{ width: `${pctOfCategory}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, ease: EASE }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">{cat.rationale}</p>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
