"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { AIAnalysis as AIAnalysisT } from "@/types/scoring";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/primitives";

const DISCLAIMER =
  "AI-assisted analysis is for research and educational purposes only and is not financial advice.";

/**
 * Progressively reveals a real, already-generated analysis: overall
 * assessment first, then strengths/risks/watch items together as one
 * staggered group, then the score explanation, then the disclaimer —
 * four steps, not one animation per bullet, per "avoid animating every
 * single element independently."
 */
export function AIAnalysis({ analysis }: { analysis: AIAnalysisT }) {
  return (
    <AIAnalysisShell>
      <Reveal y={12} duration={0.5}>
        <h3 className="text-sm font-medium text-foreground">Overall Assessment</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">{analysis.summary}</p>
      </Reveal>

      <Stagger className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3" stagger={0.1}>
        <StaggerItem>
          <AnalysisList heading="Key Strengths" items={analysis.strengths} marker="✓" markerColor="var(--positive)" />
        </StaggerItem>
        <StaggerItem>
          <AnalysisList heading="Key Risks" items={analysis.risks} marker="⚠" markerColor="var(--negative)" />
        </StaggerItem>
        <StaggerItem>
          <AnalysisList heading="What to Watch" items={analysis.watchItems} marker="→" markerColor="var(--muted)" />
        </StaggerItem>
      </Stagger>

      <Reveal y={12} duration={0.5} delay={0.1} className="mt-5 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-foreground">Why this score?</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">{analysis.scoreExplanation}</p>
      </Reveal>

      <Reveal duration={0.5} delay={0.15} className="mt-6 border-t border-border pt-4">
        <p className="text-xs italic text-subtle">{DISCLAIMER}</p>
      </Reveal>
    </AIAnalysisShell>
  );
}

/** Shown while Claude is still generating the analysis for this company. */
export function AIAnalysisSkeleton() {
  const reduce = useReducedMotion();
  return (
    <AIAnalysisShell>
      <div className="flex items-center gap-2.5 text-sm text-muted">
        <span>Generating AI analysis</span>
        <span className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1 w-1 rounded-full bg-subtle"
              animate={reduce ? { opacity: 0.6 } : { opacity: [0.25, 1, 0.25] }}
              transition={reduce ? undefined : { duration: 1.1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
            />
          ))}
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-2" aria-hidden="true">
        <div className="h-3 w-full animate-pulse rounded bg-border" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-border" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-border" />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex flex-col gap-2">
            <div className="h-3 w-20 animate-pulse rounded bg-border" />
            <div className="h-2.5 w-full animate-pulse rounded bg-border" />
            <div className="h-2.5 w-full animate-pulse rounded bg-border" />
            <div className="h-2.5 w-3/4 animate-pulse rounded bg-border" />
          </div>
        ))}
      </div>
    </AIAnalysisShell>
  );
}

/** Shown when the Claude API call failed or its response was malformed — the rest of the dashboard is unaffected. */
export function AIAnalysisUnavailable() {
  return (
    <AIAnalysisShell>
      <p className="text-sm text-muted">AI analysis is temporarily unavailable.</p>
      <p className="mt-1 text-xs text-subtle">
        The investment score and financial metrics above are unaffected — they come from the deterministic scoring
        engine, not from this section.
      </p>
    </AIAnalysisShell>
  );
}

function AIAnalysisShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="py-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">AI-Assisted Analysis</h2>
        <span className="text-xs text-subtle">Generated from the financial metrics shown above.</span>
      </div>
      <div className="mt-4 border border-border bg-surface p-5">{children}</div>
    </section>
  );
}

function AnalysisList({
  heading,
  items,
  marker,
  markerColor,
}: {
  heading: string;
  items: string[];
  marker: string;
  markerColor: string;
}) {
  return (
    <div>
      <h4 className="text-xs font-medium text-muted">{heading}</h4>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm text-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden="true" style={{ color: markerColor }}>
              {marker}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
