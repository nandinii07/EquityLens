"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Reveal, Stagger, StaggerItem, EASE } from "@/components/motion/primitives";

const STEPS = [
  { n: "01", title: "Enter a company", body: "Search any supported public company by ticker." },
  { n: "02", title: "Analyze the fundamentals", body: "EquityLens evaluates financial performance across five dimensions." },
  { n: "03", title: "Get your score", body: "Every company receives a transparent 0–100 fundamental score." },
  { n: "04", title: "Understand the result", body: "Claude explains the numbers in plain English." },
];

export function HowItWorks() {
  const reduce = useReducedMotion();

  return (
    <section className="bg-mkt-bg px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-xl">
          <span className="text-xs uppercase tracking-[0.3em] text-mkt-accent-strong">How it works</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-mkt-ink sm:text-4xl">
            From ticker to insight, in one pass.
          </h2>
        </Reveal>

        <div className="relative mt-16">
          <motion.div
            initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.1, ease: EASE }}
            style={{ transformOrigin: "0% 50%" }}
            className="absolute left-0 right-0 top-5 hidden h-px bg-mkt-border-strong sm:block"
          />

          <Stagger className="grid grid-cols-1 gap-10 sm:grid-cols-4 sm:gap-6" stagger={0.12}>
            {STEPS.map((step) => (
              <StaggerItem key={step.n}>
                <div className="relative flex flex-col gap-3">
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-mkt-border-strong bg-mkt-surface">
                    <span className="num text-xs text-mkt-accent-strong">{step.n}</span>
                  </div>
                  <h3 className="text-base font-medium text-mkt-ink">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-mkt-ink-muted">{step.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
