import type { NormalizedDeal } from "./deal-normalizer";
import { formatMoney } from "./sales-analytics";
import { parseBitrixDate } from "./tashkent-time";
import type { KpiSnapshot } from "./kpi-engine";
import type { CompanyTrendBundle } from "./trend-engine";

export interface ForecastPeriod {
  label: string;
  revenue: number;
  revenueFormatted: string;
  deals: number;
  pipeline: number;
  pipelineFormatted: string;
  confidence: number;
  growthPercent: number;
  riskPercent: number;
  pipelineGrowthPercent: number;
  riskChangePercent: number;
}

export interface ForecastBundle {
  nextWeek: ForecastPeriod;
  nextMonth: ForecastPeriod;
  days90: ForecastPeriod;
  quarter: ForecastPeriod;
  year: ForecastPeriod;
  trend: "up" | "down" | "flat";
  narrative: string;
}

function monthlyBuckets(deals: NormalizedDeal[]): number[] {
  const buckets = new Map<string, number>();
  for (const d of deals) {
    const dt = parseBitrixDate(d.dateCreate);
    if (!dt) continue;
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    buckets.set(key, (buckets.get(key) || 0) + d.opportunity);
  }
  return [...buckets.values()].slice(-6);
}

function trendDirection(values: number[]): "up" | "down" | "flat" {
  if (values.length < 2) return "flat";
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last > prev * 1.05) return "up";
  if (last < prev * 0.95) return "down";
  return "flat";
}

function projectPeriod(
  label: string,
  basePipeline: number,
  growth: number,
  factor: number,
  riskNow: number
): ForecastPeriod {
  const growthFactor = 1 + (growth / 100) * Math.min(1, factor);
  const pipeline = Math.round(basePipeline * growthFactor);
  const revenue = Math.round(pipeline * (0.08 + Math.max(0, growth) / 500));
  const confidence = Math.min(92, Math.max(40, 58 + Math.abs(growth) * 0.4 - factor * 3));
  const riskChange = Math.round(-growth * 0.3 * factor);
  return {
    label,
    revenue,
    revenueFormatted: formatMoney(revenue),
    deals: Math.max(0, Math.round(factor * 4 + growth / 10)),
    pipeline,
    pipelineFormatted: formatMoney(pipeline),
    confidence: Math.round(confidence),
    growthPercent: Math.round(growth * Math.min(1, factor) * 10) / 10,
    riskPercent: Math.min(80, Math.max(5, riskNow + riskChange)),
    pipelineGrowthPercent: Math.round((growthFactor - 1) * 1000) / 10,
    riskChangePercent: riskChange,
  };
}

export function calculateForecast(
  deals: NormalizedDeal[],
  kpis: KpiSnapshot,
  trends?: CompanyTrendBundle
): ForecastBundle {
  const buckets = monthlyBuckets(deals);
  const trend = trendDirection(buckets);
  const pipelineTrend = trends?.kpiTrends.find((t) => t.label === "Pipeline");
  const growth =
    pipelineTrend?.deltaPercent ??
    kpis.growthPercent ??
    (trend === "up" ? 8 : trend === "down" ? -6 : 2);

  const openPipeline = deals.filter((d) => d.isOpen).reduce((s, d) => s + d.opportunity, 0);
  const base = openPipeline || kpis.pipeline * 0.15 || 1;
  const riskNow = kpis.riskScore;

  const nextWeek = projectPeriod("7 kun", base, growth, 0.25, riskNow);
  const nextMonth = projectPeriod("30 kun", base, growth, 1, riskNow);
  const days90 = projectPeriod("90 kun", base, growth, 3, riskNow);
  const quarter = projectPeriod("Quarter", base, growth, 3, riskNow);
  const year = projectPeriod("Yil", kpis.pipeline || base, growth, 12, riskNow);

  const narrative =
    trend === "up"
      ? `Shu sur'at davom etsa, 30 kunda pipeline ~${nextMonth.pipelineGrowthPercent}% o'sishi kutiladi.`
      : trend === "down"
        ? `Pasayish davom etsa, 30 kunda pipeline ~${Math.abs(nextMonth.pipelineGrowthPercent)}% qisqarishi mumkin.`
        : "Barqaror sur'at — 30 kunlik o'zgarishlar cheklangan bo'lishi kutiladi.";

  return { nextWeek, nextMonth, days90, quarter, year, trend, narrative };
}
