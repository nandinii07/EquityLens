import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  previousValue?: string;
  change?: { text: string; positive: boolean | null };
  explanation: string;
}

export function MetricCard({
  label,
  value,
  previousValue,
  change,
  explanation,
}: MetricCardProps) {
  return (
    <div className="border border-border bg-surface p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_0_0_1px_var(--border-strong),0_12px_28px_-18px_rgba(0,0,0,0.6)]">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="num mt-1.5 text-xl font-medium text-foreground">
        {value}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {previousValue && (
          <span className="num text-subtle">Prior: {previousValue}</span>
        )}
        {change && <ChangeTag text={change.text} positive={change.positive} />}
      </div>
      <p className="mt-2 text-xs leading-snug text-muted">{explanation}</p>
    </div>
  );
}

function ChangeTag({
  text,
  positive,
}: {
  text: string;
  positive: boolean | null;
}) {
  if (positive === null) {
    return <span className="num text-subtle">{text}</span>;
  }
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="num flex items-center gap-0.5"
      style={{ color: positive ? "var(--positive)" : "var(--negative)" }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {text}
    </span>
  );
}

export function MetricCardNA({ label }: { label: string }) {
  return (
    <div className="border border-border bg-surface p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="num mt-1.5 flex items-center gap-1 text-xl font-medium text-subtle">
        <Minus size={16} /> N/A
      </div>
      <p className="mt-2 text-xs leading-snug text-muted">
        Not available for this company.
      </p>
    </div>
  );
}
