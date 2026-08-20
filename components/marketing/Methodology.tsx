import { Reveal, Stagger, StaggerItem } from "@/components/motion/primitives";
import { SpotlightCard } from "@/components/motion/interactive";

const CATEGORIES = [
  { name: "Revenue Growth", points: 20, desc: "Year-over-year growth and multi-year CAGR." },
  { name: "Profitability", points: 20, desc: "Net margin, operating margin, ROE, and income growth." },
  { name: "Valuation", points: 20, desc: "P/E, P/S, P/B, and EV/EBITDA — graduated, not pass/fail." },
  { name: "Debt", points: 20, desc: "Debt-to-equity, debt-to-assets, net debt, and interest coverage." },
  { name: "Cash Flow", points: 20, desc: "Operating and free cash flow, margin, growth, and quality." },
];

export function Methodology() {
  return (
    <section className="border-t border-mkt-border bg-mkt-bg px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-5xl">
        <Reveal className="max-w-2xl">
          <span className="text-xs uppercase tracking-[0.3em] text-mkt-accent-strong">Methodology</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-mkt-ink sm:text-4xl">
            No black box. Every point is explainable.
          </h2>
          <p className="mt-4 text-mkt-ink-muted">
            The score is never generated or adjusted by AI. A deterministic engine scores each category against fixed,
            documented thresholds — the same formulas for every company, every time. Claude only explains a score
            that&rsquo;s already final.
          </p>
        </Reveal>

        <Stagger className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-mkt-border bg-mkt-border sm:grid-cols-5" stagger={0.08}>
          {CATEGORIES.map((cat) => (
            <StaggerItem key={cat.name} className="h-full">
              <SpotlightCard className="h-full bg-mkt-surface">
                <div className="flex h-full flex-col gap-3 p-6">
                  <span className="num text-2xl font-semibold text-mkt-ink">{cat.points}</span>
                  <h3 className="text-sm font-medium text-mkt-ink">{cat.name}</h3>
                  <p className="text-xs leading-relaxed text-mkt-ink-subtle">{cat.desc}</p>
                </div>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
