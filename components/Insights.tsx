import { AlertTriangle, Eye, TrendingUp } from "lucide-react";
import type { Insight } from "@/types/scoring";

const ICONS = {
  strength: TrendingUp,
  risk: AlertTriangle,
  watch: Eye,
} as const;

const COLORS = {
  strength: "var(--positive)",
  risk: "var(--negative)",
  watch: "var(--warning)",
} as const;

export function Insights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <section className="border-b border-border py-8">
      <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">
        Key Insights
      </h2>
      <p className="mt-1 text-xs text-subtle">
        Generated directly from the calculated metrics above.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {insights.map((insight, i) => {
          const Icon = ICONS[insight.type];
          return (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <Icon
                size={15}
                strokeWidth={2}
                className="mt-0.5 shrink-0"
                style={{ color: COLORS[insight.type] }}
              />
              <span className="text-foreground">{insight.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
