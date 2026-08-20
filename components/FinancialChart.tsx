"use client";

import { useRef } from "react";
import { useInView } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { YearValue } from "@/types/financial";
import { formatBillions } from "@/lib/format";

interface FinancialChartProps {
  title: string;
  data: YearValue[];
  color: string;
}

// Every chart on the dashboard plots a dollar figure in billions, so the
// formatter is resolved here rather than passed in — a server component
// cannot pass a function prop down to a client component like this one.
const valueFormatter = formatBillions;

/** Plain-text equivalent of the chart, e.g. "FY2021: $365.8B, FY2022: $394.3B". */
function describeSeries(data: YearValue[]): string {
  return data
    .map((point) => `${point.year.replace("FY", "")}: ${point.value === null ? "N/A" : valueFormatter(point.value)}`)
    .join(", ");
}

export function FinancialChart({ title, data, color }: FinancialChartProps) {
  const hasData = data.some((d) => d.value !== null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Once: true — this is a one-time "draw in" on first appearance, never
  // re-triggered on repeated scrolling, per the "only animate the initial
  // reveal" requirement.
  const inView = useInView(containerRef, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();

  return (
    <div className="border border-border bg-surface p-4">
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      {hasData ? (
        <div ref={containerRef} className="mt-2 h-44">
          {/* Recharts renders an unlabeled SVG — this gives screen reader
              users the same trend a sighted user reads off the bars. */}
          <span className="sr-only">{`${title} by fiscal year: ${describeSeries(data)}.`}</span>
          <div aria-hidden="true" className="h-full w-full">
            {inView && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeDasharray="0"
                  />
                  <XAxis
                    dataKey="year"
                    tickFormatter={(year: string) => year.replace("FY", "")}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--subtle)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--background)" }}
                    formatter={(value) => [valueFormatter(Number(value)), title]}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill={color}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={36}
                    isAnimationActive={!reduce}
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex h-44 items-center justify-center text-sm text-subtle">
          No data available
        </div>
      )}
    </div>
  );
}
