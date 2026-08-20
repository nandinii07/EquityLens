"use client";

import { useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { EASE } from "@/components/motion/primitives";

/**
 * Decorative animated backdrop for the hero — a dark grid with a few
 * "drawing" signal lines, soft pulsing nodes, and floating figures,
 * suggesting a living financial system without literally being one (no
 * real data is plotted here; the real charts live further down the page
 * and on the analyzer). Kept intentionally sparse (a handful of elements)
 * and restricted to opacity/transform animation for GPU-friendly 60fps,
 * and positions are hardcoded (not random) so server and client markup
 * match exactly on hydration.
 *
 * Sequencing: this is the LAST layer of the hero's entrance timeline (see
 * components/marketing/Hero.tsx) — the grid/glow base is near-instant,
 * but the lines/nodes/figures only begin once the interactive content
 * (headline, search) has already settled, so they read as a closing
 * flourish rather than competing for attention during the parts of the
 * hero the user actually reads and uses.
 *
 * The looping node pulses stop entirely once the hero scrolls out of
 * view (useInView below) — there is no reason to keep animating a
 * backdrop the user can no longer see.
 */

const VISUAL_DELAY = 1.7;

const LINES = [
  { d: "M -40 260 C 160 200, 320 300, 520 180 S 860 120, 1040 200", delay: 0 },
  { d: "M -40 420 C 200 380, 380 460, 600 380 S 900 300, 1120 360", delay: 0.15 },
  { d: "M -40 120 C 220 160, 360 60, 580 100 S 880 180, 1080 80", delay: 0.3 },
];

const NODES = [
  { x: "18%", y: "28%", delay: 0 },
  { x: "62%", y: "18%", delay: 0.4 },
  { x: "84%", y: "44%", delay: 0.8 },
  { x: "32%", y: "62%", delay: 1.2 },
  { x: "70%", y: "70%", delay: 0.6 },
  { x: "12%", y: "76%", delay: 1.6 },
];

const FIGURES = [
  { x: "22%", y: "22%", text: "+6.4%", delay: 0.5 },
  { x: "72%", y: "30%", text: "31.2x", delay: 0.75 },
  { x: "80%", y: "62%", text: "82/100", delay: 1.0 },
  { x: "14%", y: "58%", text: "$416B", delay: 1.25 },
];

export function HeroBackground() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { margin: "-10% 0px -10% 0px" });
  const runLoops = inView && !reduce;

  // Gentle scroll parallax: the grid drifts slower than the signal
  // lines/nodes, which drift slower than the page itself — a subtle
  // sense of depth, not a dramatic effect.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const gridY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 40]);
  const signalY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 90]);

  return (
    <div ref={sectionRef} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <motion.div
        style={{ y: gridY }}
        className="mkt-grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_30%,black,transparent)]"
      />

      <div className="absolute left-1/2 top-[-10%] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-mkt-accent/10 blur-[120px]" />

      <motion.div style={{ y: signalY }} className="absolute inset-0">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1080 520"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          {LINES.map((line, i) => (
            <motion.path
              key={i}
              d={line.d}
              stroke="url(#hero-line-gradient)"
              strokeWidth={1.5}
              strokeLinecap="round"
              initial={reduce ? { pathLength: 1, opacity: 0.5 } : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 1.6, delay: VISUAL_DELAY + line.delay, ease: EASE }}
            />
          ))}
          <defs>
            <linearGradient id="hero-line-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--mkt-accent)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--mkt-accent)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--mkt-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {NODES.map((node, i) => (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-mkt-accent-strong"
            style={{ left: node.x, top: node.y }}
            initial={{ opacity: 0 }}
            animate={
              runLoops
                ? { opacity: [0.2, 0.9, 0.2] }
                : { opacity: reduce ? 0.5 : 0 }
            }
            transition={
              runLoops
                ? { duration: 3.4, delay: VISUAL_DELAY + node.delay, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.8, delay: reduce ? 0 : VISUAL_DELAY + node.delay }
            }
          />
        ))}

        {FIGURES.map((fig, i) => (
          <motion.span
            key={i}
            className="num absolute text-xs text-mkt-ink-subtle"
            style={{ left: fig.x, top: fig.y }}
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 0.55, y: 0 }}
            transition={{ duration: 0.9, delay: VISUAL_DELAY + fig.delay, ease: EASE }}
          >
            {fig.text}
          </motion.span>
        ))}
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-mkt-bg" />
    </div>
  );
}
