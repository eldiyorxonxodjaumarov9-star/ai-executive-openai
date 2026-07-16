import type { NormalizedDeal } from "./deal-normalizer";
import { formatMoney } from "./sales-analytics";
import { parseBitrixDate } from "./tashkent-time";
import type { KpiSnapshot } from "./kpi-engine";

export interface ForecastPeriod {
  label: string;
  revenue: number;
  revenueFormatted: string;
  deals: number;
  confidence: number;
  growthPercent: number;
  riskPercent: number;
}

export interface ForecastBundle {
  nextWeek: ForecastPeriod;
  nextMonth: ForecastPeriod;
  quarter: ForecastPeriod;
  year: ForecastPeriod;
  trend: "up" | "down" | "flat";
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

function project(base: number, growth: number, factor: number): ForecastPeriod {
  const projected = base * factor * (1 + growth / 100);
  const confidence = Math.min(92, 55 + Math.abs(growth) + factor * 10);
  const risk = Math.min(80, Math.max(10, 50 - confidence / 2));
  return {
    label: "",
    revenue: Math.round(projected),
    revenueFormatted: formatMoney(projected),
    deals: Math.max(0, Math.round(factor * 3)),
    confidence: Math.round(confidence),
    growthPercent: growth,
    riskPercent: Math.round(risk),
  };
}

export function calculateForecast(deals: NormalizedDeal[], kpis: KpiSnapshot): ForecastBundle {
  const buckets = monthlyBuckets(deals);
  const trend = trendDirection(buckets);
  const growth = kpis.growthPercent;
  const openPipeline = deals.filter((d) => d.isOpen).reduce((s, d) => s + d.opportunity, 0);
  const base = openPipeline || kpis.pipeline * 0.15;

  return {
    nextWeek: { ...project(base, growth, 0.25), label: "Kelasi hafta" },
    nextMonth: { ...project(base, growth, 1), label: "Kelasi oy" },
    quarter: { ...project(base, growth, 3), label: "Quarter" },
    year: { ...project(kpis.pipeline, growth, 12), label: "Yil" },
    trend,
  };
}
