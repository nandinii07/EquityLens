"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";
import {
  applyFilters,
  applyPreset,
  EMPTY_FILTERS,
  SCREENER_PRESETS,
  sortRows,
  type ScreenerCompanyRow,
  type ScreenerFilters,
  type SortDirection,
  type SortField,
} from "@/lib/screener-filters";
import { formatBillions, formatDate, formatDecimal, formatPercent } from "@/lib/format";
import { getRatingStyle } from "@/lib/rating";

/**
 * All interactivity (search, presets, filters, sort) runs client-side over
 * the already-precomputed `rows` array passed in from app/screener/page.tsx
 * (which read it from the bundled data/screener-snapshot.json via
 * lib/screener-snapshot.ts) — a few hundred rows at most, so no server
 * roundtrip is needed for any of it. Clicking a row navigates straight to
 * the existing /company/[ticker] route; this component never renders its
 * own analysis, only the discovery/browse layer in front of it.
 */

interface ColumnDef {
  field: SortField;
  label: string;
  align?: "right";
}

const COLUMNS: ColumnDef[] = [
  { field: "score", label: "Score", align: "right" },
  { field: "revenueGrowth", label: "Revenue Growth", align: "right" },
  { field: "netMargin", label: "Net Margin", align: "right" },
  { field: "roe", label: "ROE", align: "right" },
  { field: "debtToEquity", label: "Debt/Equity", align: "right" },
  { field: "freeCashFlow", label: "Free Cash Flow", align: "right" },
];

export function ScreenerClient({ rows }: { rows: ScreenerCompanyRow[] }) {
  const [filters, setFilters] = useState<ScreenerFilters>(EMPTY_FILTERS);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const visible = useMemo(() => {
    const filtered = applyFilters(rows, filters);
    return sortRows(filtered, sortField, sortDirection);
  }, [rows, filters, sortField, sortDirection]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  function handlePreset(id: string) {
    if (activePreset === id) {
      setActivePreset(null);
      setFilters(EMPTY_FILTERS);
      return;
    }
    const preset = SCREENER_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setActivePreset(id);
    setFilters(applyPreset(preset));
  }

  function clearAll() {
    setActivePreset(null);
    setFilters(EMPTY_FILTERS);
  }

  const hasActiveFilters = activePreset !== null || JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div>
      {/* Search */}
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          type="text"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          placeholder="Search by company or ticker…"
          className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-brand focus:outline-none"
        />
      </div>

      {/* Presets */}
      <div className="mt-4 flex flex-wrap gap-2">
        {SCREENER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handlePreset(preset.id)}
            title={preset.description}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activePreset === preset.id
                ? "border-brand bg-brand/15 text-brand-strong"
                : "border-border text-muted hover:border-border-strong hover:text-foreground"
            }`}
          >
            {preset.label}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-medium text-subtle transition-colors hover:text-foreground"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Manual filters */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <NumberFilter
          label="Min Score"
          value={filters.minScore}
          onChange={(v) => setFilters((f) => ({ ...f, minScore: v }))}
        />
        <PercentFilter
          label="Min Rev Growth"
          value={filters.minRevenueGrowth}
          onChange={(v) => setFilters((f) => ({ ...f, minRevenueGrowth: v }))}
        />
        <PercentFilter
          label="Min Net Margin"
          value={filters.minNetMargin}
          onChange={(v) => setFilters((f) => ({ ...f, minNetMargin: v }))}
        />
        <PercentFilter label="Min ROE" value={filters.minRoe} onChange={(v) => setFilters((f) => ({ ...f, minRoe: v }))} />
        <NumberFilter
          label="Max D/E"
          value={filters.maxDebtToEquity}
          onChange={(v) => setFilters((f) => ({ ...f, maxDebtToEquity: v }))}
        />
        <PercentFilter
          label="Min FCF Growth"
          value={filters.minFcfGrowth}
          onChange={(v) => setFilters((f) => ({ ...f, minFcfGrowth: v }))}
        />
      </div>

      {/* Results count */}
      <p className="mt-6 text-xs text-subtle">
        {visible.length} of {rows.length} companies
      </p>

      {/* Table */}
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs font-medium uppercase tracking-wide text-subtle">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Ticker</th>
              {COLUMNS.map((col) => (
                <th key={col.field} className={col.align === "right" ? "px-4 py-3 text-right" : "px-4 py-3"}>
                  <button
                    type="button"
                    onClick={() => handleSort(col.field)}
                    className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-subtle transition-colors hover:text-foreground"
                  >
                    {col.label}
                    <SortIcon active={sortField === col.field} direction={sortDirection} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3">Data Date</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <ScreenerRow key={row.ticker} row={row} />
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-subtle">
            No companies match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenerRow({ row }: { row: ScreenerCompanyRow }) {
  const style = getRatingStyle(row.rating);
  return (
    <tr className="border-b border-border transition-colors last:border-b-0 hover:bg-surface">
      <td className="px-4 py-3">
        <Link href={`/company/${row.ticker}`} className="font-medium text-foreground hover:text-brand">
          {row.companyName}
        </Link>
        <div className="text-xs text-subtle">{row.sector}</div>
      </td>
      <td className="px-4 py-3">
        <Link href={`/company/${row.ticker}`} className="num text-muted hover:text-brand">
          {row.ticker}
        </Link>
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className="num inline-flex min-w-[3ch] justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ color: style.text, background: style.bg }}
        >
          {row.score}
        </span>
      </td>
      <td className="num px-4 py-3 text-right text-foreground">{formatPercent(row.revenueGrowth)}</td>
      <td className="num px-4 py-3 text-right text-foreground">{formatPercent(row.netMargin)}</td>
      <td className="num px-4 py-3 text-right text-foreground">{formatPercent(row.roe)}</td>
      <td className="num px-4 py-3 text-right text-foreground">{formatDecimal(row.debtToEquity)}</td>
      <td className="num px-4 py-3 text-right text-foreground">{formatBillions(row.freeCashFlow)}</td>
      <td className="px-4 py-3 text-xs text-subtle">{formatDate(row.dataDate)}</td>
    </tr>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ArrowUpDown size={12} className="text-subtle" />;
  return direction === "desc" ? <ArrowDown size={12} className="text-brand" /> : <ArrowUp size={12} className="text-brand" />;
}

function NumberFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-subtle">
      {label}
      <input
        type="number"
        step="0.1"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="num rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground focus:border-brand focus:outline-none"
      />
    </label>
  );
}

/** Same as NumberFilter, but the user types a whole-number percent (e.g. 15) and the stored filter value is the fraction (0.15) lib/screener-filters.ts expects — matching how every percent metric is stored throughout this app. */
function PercentFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-subtle">
      {label} (%)
      <input
        type="number"
        step="1"
        value={value === null ? "" : Math.round(value * 100)}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value) / 100)}
        className="num rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground focus:border-brand focus:outline-none"
      />
    </label>
  );
}
