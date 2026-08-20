import type { FinancialData } from "@/types/financial";
import type { Insight } from "@/types/scoring";
import { formatPercent, formatRatio, formatDecimal } from "@/lib/format";

/**
 * Derives plain-language "Key Insights" bullets straight from the
 * calculated metrics — never hardcoded per company. One insight per
 * category, in category order, so the list always reflects whatever
 * financial data was actually available.
 *
 * The thresholds here are intentionally simple and will be aligned with
 * the deterministic scoring engine's thresholds once it lands (Stage 3).
 */
export function generateInsights(data: FinancialData): Insight[] {
  const insights: Insight[] = [];

  // Revenue growth
  const { yoyGrowth, history } = data.revenue;
  if (yoyGrowth !== null) {
    const consecutiveGrowthYears = countTrailingIncreases(history);
    if (yoyGrowth >= 0.15) {
      insights.push({
        type: "strength",
        text: `Revenue grew ${formatPercent(yoyGrowth)} year-over-year, a strong pace.`,
      });
    } else if (yoyGrowth >= 0.05) {
      insights.push({
        type: "strength",
        text:
          consecutiveGrowthYears >= 3
            ? `Revenue has grown consistently over the last ${consecutiveGrowthYears} years, up ${formatPercent(yoyGrowth)} in the latest year.`
            : `Revenue grew ${formatPercent(yoyGrowth)} year-over-year.`,
      });
    } else if (yoyGrowth >= 0) {
      insights.push({
        type: "watch",
        text: `Revenue growth has slowed to ${formatPercent(yoyGrowth)} year-over-year.`,
      });
    } else {
      insights.push({
        type: "risk",
        text: `Revenue declined ${formatPercent(Math.abs(yoyGrowth))} year-over-year.`,
      });
    }
  }

  // Profitability
  const { netMargin } = data.profitability;
  if (netMargin !== null) {
    if (netMargin >= 0.2) {
      insights.push({
        type: "strength",
        text: `Net margin remains strong at ${formatPercent(netMargin)}.`,
      });
    } else if (netMargin >= 0.1) {
      insights.push({
        type: "watch",
        text: `Net margin is moderate at ${formatPercent(netMargin)}.`,
      });
    } else {
      insights.push({
        type: "risk",
        text: `Net margin is thin at ${formatPercent(netMargin)}, leaving less cushion against cost pressure.`,
      });
    }
  }

  // Valuation
  const { pe } = data.valuation;
  if (pe !== null) {
    if (pe > 45) {
      insights.push({
        type: "risk",
        text: `Valuation appears relatively high at ${formatRatio(pe)} P/E, pricing in significant future growth.`,
      });
    } else if (pe > 25) {
      insights.push({
        type: "watch",
        text: `Valuation is elevated at ${formatRatio(pe)} P/E relative to the broader market.`,
      });
    } else {
      insights.push({
        type: "strength",
        text: `Valuation looks reasonable at ${formatRatio(pe)} P/E.`,
      });
    }
  }

  // Debt
  const { debtToEquity, netDebt } = data.debt;
  if (netDebt !== null && netDebt < 0) {
    insights.push({
      type: "strength",
      text: "The company holds more cash than debt (a net cash position).",
    });
  } else if (debtToEquity !== null) {
    if (debtToEquity < 0.3) {
      insights.push({
        type: "strength",
        text: `Leverage is low, with a debt-to-equity ratio of ${formatDecimal(debtToEquity)}.`,
      });
    } else if (debtToEquity <= 0.7) {
      insights.push({
        type: "watch",
        text: `Debt levels are moderate (debt-to-equity of ${formatDecimal(debtToEquity)}) and worth monitoring.`,
      });
    } else {
      insights.push({
        type: "risk",
        text: `Leverage is elevated, with a debt-to-equity ratio of ${formatDecimal(debtToEquity)}.`,
      });
    }
  }

  // Cash flow
  const { freeCashFlow, fcfGrowth } = data.cashFlow;
  if (freeCashFlow !== null) {
    if (freeCashFlow < 0) {
      insights.push({
        type: "risk",
        text: "Free cash flow is negative, driven by heavy capital investment.",
      });
    } else if (fcfGrowth !== null && fcfGrowth >= 0.15) {
      insights.push({
        type: "strength",
        text: `Free cash flow remains positive and is growing quickly, up ${formatPercent(fcfGrowth)}.`,
      });
    } else if (fcfGrowth !== null && fcfGrowth >= 0) {
      insights.push({
        type: "strength",
        text: `Free cash flow remains positive, up ${formatPercent(fcfGrowth)} year-over-year.`,
      });
    } else {
      insights.push({
        type: "watch",
        text: "Free cash flow is positive but declined year-over-year.",
      });
    }
  }

  return insights;
}

/** Counts how many trailing years (ending at the most recent) each grew over the prior one. */
function countTrailingIncreases(history: { value: number | null }[]): number {
  let count = 0;
  for (let i = history.length - 1; i > 0; i--) {
    const current = history[i].value;
    const prev = history[i - 1].value;
    if (current === null || prev === null || current <= prev) break;
    count++;
  }
  return count > 0 ? count + 1 : 0;
}
