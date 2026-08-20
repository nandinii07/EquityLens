import type { CompanyProfile } from "@/types/financial";
import type { CompanyAnalysisSource } from "@/lib/company-analysis";
import { formatDate, formatPrice } from "@/lib/format";
import { RefreshDataButton } from "@/components/RefreshDataButton";

interface CompanyHeaderProps {
  profile: CompanyProfile;
  source: CompanyAnalysisSource;
  /** Most recent fiscal year label with reported data, e.g. "FY2025" — the actual period the numbers below cover. */
  latestFiscalYear: string | null;
  /** Epoch ms this record was actually fetched — from lib/company-analysis.ts, the single source of truth for freshness. */
  fetchedAt: number;
}

export function CompanyHeader({ profile, source, latestFiscalYear, fetchedAt }: CompanyHeaderProps) {
  const fetchedAtIso = new Date(fetchedAt).toISOString();

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {profile.name}
          </h1>
          <span className="num rounded border border-border px-1.5 py-0.5 text-sm text-muted">
            {profile.ticker}
          </span>
          <DataSourceBadge source={source} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {profile.sector} · {profile.industry} · {profile.exchange}
        </p>
      </div>
      <div className="flex flex-col items-start gap-3 sm:items-end">
        <div className="text-left sm:text-right">
          <div className="num text-2xl font-medium text-foreground">
            {formatPrice(profile.latestPrice)}
          </div>
          <p className="text-xs text-subtle">Price as of {formatDate(profile.priceAsOf)}</p>
          <p className="text-xs text-subtle">
            {source === "demo" ? "Source: demo data set" : "Source: SEC EDGAR"} · Latest fiscal period:{" "}
            {latestFiscalYear ?? "N/A"} · <FreshnessLabel source={source} fetchedAtIso={fetchedAtIso} />
          </p>
        </div>
        {source !== "demo" && <RefreshDataButton ticker={profile.ticker} />}
      </div>
    </div>
  );
}

function FreshnessLabel({ source, fetchedAtIso }: { source: CompanyAnalysisSource; fetchedAtIso: string }) {
  if (source === "demo") return <>Illustrative as of {formatDate(fetchedAtIso)}</>;
  if (source === "recent") return <>Snapshot fetched {formatDate(fetchedAtIso)}</>;
  return <>Fetched {formatDate(fetchedAtIso)}</>;
}

/**
 * The single, unambiguous signal for which state the user is in — see
 * app/company/[ticker]/page.tsx: `source` always comes directly from
 * lib/company-analysis.ts and is never inferred or guessed here.
 * "Recent" deliberately uses a neutral accent color, not a warning
 * color — serving a recent SEC snapshot (whether from the runtime cache
 * or, for the five core demo companies, the bundled verified snapshot)
 * is the normal, expected path, not a problem to flag.
 */
function DataSourceBadge({ source }: { source: CompanyAnalysisSource }) {
  if (source === "live") {
    return <Badge color="var(--positive)" bg="var(--positive)" label="Live SEC data" title="Filed financial data retrieved from SEC EDGAR." />;
  }
  if (source === "recent") {
    return (
      <Badge color="var(--brand)" bg="var(--brand)" label="Recent SEC snapshot" title="Using a previously retrieved SEC financial snapshot." />
    );
  }
  return <Badge color="var(--warning)" bg="var(--warning)" label="Demo data" title="Sample data for exploring the product." />;
}

function Badge({ color, bg, label, title }: { color: string; bg: string; label: string; title: string }) {
  return (
    <span
      title={title}
      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{ color, borderColor: `color-mix(in srgb, ${bg} 30%, transparent)`, background: `color-mix(in srgb, ${bg} 10%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}
