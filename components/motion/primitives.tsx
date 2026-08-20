"use client";

import { animate, motion, useInView } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Shared animation primitives used across the marketing site (and,
 * sparingly, the analyzer) so entrance/scroll motion is defined once
 * instead of re-implemented per section. Every primitive here checks
 * `useReducedMotion()` and renders content in its final, settled state
 * with no animation when the user has that preference set — the content
 * itself is never hidden or delayed, only the motion is skipped.
 *
 * Timing/easing is centralized here for a consistent feel: a single
 * "premium" ease-out curve, and durations tuned to be quick enough not to
 * feel sluggish on repeated scrolling.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

interface MotionBlockProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Initial vertical offset in px before settling to 0. */
  y?: number;
  duration?: number;
}

/** Fades and rises into place once, immediately on mount (hero-style entrance). */
export function FadeIn({ children, className, delay = 0, y = 16, duration = 0.7 }: MotionBlockProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Fades and rises into place the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0, y = 24, duration = 0.7 }: MotionBlockProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Scales and fades into place the first time it scrolls into view. */
export function ScaleIn({ children, className, delay = 0, duration = 0.6 }: MotionBlockProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.94 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Container that staggers its `StaggerItem` children in as it scrolls into view. */
export function Stagger({
  children,
  className,
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, y = 16 }: { children: ReactNode; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={{
        hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : y },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animates a number counting up to `value` once it scrolls into view.
 * Never invents the value — it's passed in from real, already-computed
 * data (see components/marketing/ScoreShowcase.tsx) and only the count-up
 * presentation is animated.
 */
export function CountUp({
  value,
  duration = 1.4,
  className,
  formatter,
}: {
  value: number;
  duration?: number;
  className?: string;
  formatter?: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState(0);

  // `reduce` starts `false` on every render (server and the client's
  // hydration-matching first render — see hooks/use-reduced-motion.ts)
  // and only resolves to its real value in a later render. A `useState`
  // initializer only ever runs once, so seeding `display` from `reduce`
  // there (the previous approach) left it permanently stuck at 0 for
  // reduced-motion users once `reduce` corrected to `true` after the
  // initializer had already fired. Snapping `display` to `value` here,
  // synchronously during render rather than in an effect, is the
  // documented React pattern for reacting to a value that changed since
  // the last render without an extra painted frame at the stale (0) value.
  if (reduce && display !== value) {
    setDisplay(value);
  }

  useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, reduce, value, duration]);

  return (
    <span ref={ref} className={className}>
      {formatter ? formatter(display) : display}
    </span>
  );
}
