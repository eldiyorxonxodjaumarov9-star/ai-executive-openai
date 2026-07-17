import type { NormalizedDeal } from "./deal-normalizer";
import type { CrmRecord } from "./bitrix";
import { formatMoney } from "./sales-analytics";
import { parseBitrixDate } from "./tashkent-time";

export type TrendDirection = "up" | "down" | "flat";

export interface SnapshotMetrics {
  deals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  pipeline: number;
  pipelineFormatted: string;
  revenue: number;
  revenueFormatted: string;
  conversionRate: number;
  activities: number;
  riskScore: number;
}

export interface MetricTrend {
  label: string;
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
  direction: TrendDirection;
  formattedCurrent: string;
  formattedDelta: string;
  arrow: string;
}

export interface PeriodSnapshot {
  label: string;
  daysAgo: number;
  asOf: string;
  metrics: SnapshotMetrics;
}

export interface EmployeeTrendProfile {
  assignedById: string;
  name: string;
  current: SnapshotMetrics;
  days7: SnapshotMetrics;
  days30: SnapshotMetrics;
  trends: {
    deals: MetricTrend;
    pipeline: MetricTrend;
    conversion: MetricTrend;
    activities: MetricTrend;
    risk: MetricTrend;
  };
  summary: string;
}

export interface CompanyTrendBundle {
  current: SnapshotMetrics;
  days7: SnapshotMetrics;
  days30: SnapshotMetrics;
  days90: SnapshotMetrics;
  kpiTrends: MetricTrend[];
  employeeTrends: EmployeeTrendProfile[];
}

const DAY_MS = 86400000;

function pointInPast(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * DAY_MS);
}

function direction(delta: number, flatThreshold = 0.5): TrendDirection {
  if (Math.abs(delta) < flatThreshold) return "flat";
  return delta > 0 ? "up" : "down";
}

function arrow(dir: TrendDirection, invert = false): string {
  const d = invert ? (dir === "up" ? "down" : dir === "down" ? "up" : "flat") : dir;
  if (d === "up") return "▲";
  if (d === "down") return "▼";
  return "→";
}

function pctDelta(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function makeTrend(
  label: string,
  current: number,
  previous: number,
  format: "number" | "money" | "percent" = "number",
  invertRisk = false
): MetricTrend {
  const delta = current - previous;
  const deltaPercent = pctDelta(current, previous);
  const dir = direction(deltaPercent);
  const fmt = (n: number) => {
    if (format === "money") return formatMoney(n);
    if (format === "percent") return `${Math.round(n)}%`;
    return String(Math.round(n * 10) / 10);
  };
  const sign = delta >= 0 ? "+" : "";
  return {
    label,
    current,
    previous,
    delta,
    deltaPercent,
    direction: dir,
    formattedCurrent: fmt(current),
    formattedDelta:
      format === "money"
        ? `${sign}${formatMoney(Math.abs(delta))}`
        : format === "percent"
          ? `${sign}${deltaPercent}%`
          : `${sign}${Math.round(delta * 10) / 10}`,
    arrow: arrow(dir, invertRisk),
  };
}

function dealOpenAt(deal: NormalizedDeal, asOf: Date): boolean {
  const created = parseBitrixDate(deal.dateCreate);
  if (!created || created > asOf) return false;
  if (deal.isOpen) return true;
  const closed = parseBitrixDate(deal.closeDate);
  if (!closed) return deal.isOpen;
  return closed > asOf;
}

function dealExistedAt(deal: NormalizedDeal, asOf: Date): boolean {
  const created = parseBitrixDate(deal.dateCreate);
  return Boolean(created && created <= asOf);
}

function dealWonBy(deal: NormalizedDeal, asOf: Date): boolean {
  if (!deal.isWon) return false;
  const closed = parseBitrixDate(deal.closeDate) || parseBitrixDate(deal.dateCreate);
  return Boolean(closed && closed <= asOf);
}

function dealLostBy(deal: NormalizedDeal, asOf: Date): boolean {
  if (!deal.isLost) return false;
  const closed = parseBitrixDate(deal.closeDate) || parseBitrixDate(deal.dateCreate);
  return Boolean(closed && closed <= asOf);
}

function activityCountAt(
  activities: CrmRecord[],
  asOf: Date,
  windowDays: number,
  assignedById?: string,
  dealIds?: Set<string>
): number {
  const from = new Date(asOf.getTime() - windowDays * DAY_MS);
  let count = 0;
  for (const a of activities) {
    const raw = String(a.LAST_UPDATED || a.CREATED || a.START_TIME || "");
    const dt = parseBitrixDate(raw);
    if (!dt || dt > asOf || dt < from) continue;
    if (assignedById) {
      const resp = String(a.RESPONSIBLE_ID || "");
      const owner = String(a.OWNER_ID || a.ASSOCIATED_ENTITY_ID || "");
      if (resp !== assignedById && !(dealIds && dealIds.has(owner))) continue;
    }
    count += 1;
  }
  return count;
}

function riskFromMetrics(open: number, staleApprox: number, conversion: number): number {
  return Math.min(
    100,
    Math.round(staleApprox * 8 + (open >= 10 ? 25 : open >= 5 ? 10 : 0) + (conversion < 10 ? 20 : 0))
  );
}

export function snapshotAt(
  deals: NormalizedDeal[],
  activities: CrmRecord[],
  daysAgo: number,
  assignedById?: string
): SnapshotMetrics {
  const asOf = pointInPast(daysAgo);
  const scoped = assignedById
    ? deals.filter((d) => (d.assignedById || "unknown") === assignedById)
    : deals;
  const dealIds = new Set(scoped.map((d) => d.id));

  const existed = scoped.filter((d) => dealExistedAt(d, asOf));
  const open = scoped.filter((d) => dealOpenAt(d, asOf));
  const won = scoped.filter((d) => dealWonBy(d, asOf));
  const lost = scoped.filter((d) => dealLostBy(d, asOf));
  const pipeline = open.reduce((s, d) => s + d.opportunity, 0);
  const revenue = won.reduce((s, d) => s + d.opportunity, 0);
  const closed = won.length + lost.length;
  const conversion = closed ? Math.round((won.length / closed) * 100) : 0;
  const staleApprox = open.filter((d) => {
    const created = parseBitrixDate(d.dateCreate);
    return created && asOf.getTime() - created.getTime() > 30 * DAY_MS;
  }).length;
  const activitiesCount = activityCountAt(activities, asOf, 7, assignedById, dealIds);

  return {
    deals: existed.length,
    openDeals: open.length,
    wonDeals: won.length,
    lostDeals: lost.length,
    pipeline,
    pipelineFormatted: formatMoney(pipeline),
    revenue,
    revenueFormatted: formatMoney(revenue),
    conversionRate: conversion,
    activities: activitiesCount,
    riskScore: riskFromMetrics(open.length, staleApprox, conversion),
  };
}

function employeeSummary(trends: EmployeeTrendProfile["trends"]): string {
  const ups = [trends.deals, trends.pipeline, trends.conversion, trends.activities].filter(
    (t) => t.direction === "up"
  ).length;
  const downs = [trends.deals, trends.pipeline, trends.conversion, trends.activities].filter(
    (t) => t.direction === "down"
  ).length;
  if (trends.risk.direction === "down" && ups >= 2) return "Yaxshilanmoqda.";
  if (downs >= 2 || trends.risk.direction === "up") return "Pasayish kuzatilmoqda.";
  if (ups >= 1) return "Barqaror o'sish.";
  return "Barqaror.";
}

export function buildCompanyTrends(
  deals: NormalizedDeal[],
  activities: CrmRecord[] = []
): CompanyTrendBundle {
  const current = snapshotAt(deals, activities, 0);
  const days7 = snapshotAt(deals, activities, 7);
  const days30 = snapshotAt(deals, activities, 30);
  const days90 = snapshotAt(deals, activities, 90);

  const kpiTrends: MetricTrend[] = [
    makeTrend("Pipeline", current.pipeline, days30.pipeline, "money"),
    makeTrend("Deals", current.deals, days30.deals, "number"),
    makeTrend("Revenue", current.revenue, days30.revenue, "money"),
    makeTrend("Conversion", current.conversionRate, days30.conversionRate, "percent"),
    makeTrend("Open deals", current.openDeals, days30.openDeals, "number"),
    makeTrend("Risk", current.riskScore, days30.riskScore, "number", true),
    makeTrend("Activities (7k)", current.activities, days7.activities, "number"),
  ];

  const ids = [...new Set(deals.map((d) => d.assignedById || "unknown"))];
  const employeeTrends: EmployeeTrendProfile[] = ids.map((id) => {
    const name =
      deals.find((d) => (d.assignedById || "unknown") === id)?.assignedByName || "Noma'lum xodim";
    const cur = snapshotAt(deals, activities, 0, id);
    const d7 = snapshotAt(deals, activities, 7, id);
    const d30 = snapshotAt(deals, activities, 30, id);
    const trends = {
      deals: makeTrend("Deals", cur.deals, d7.deals),
      pipeline: makeTrend("Pipeline", cur.pipeline, d7.pipeline, "money"),
      conversion: makeTrend("Conversion", cur.conversionRate, d30.conversionRate, "percent"),
      activities: makeTrend("Activities", cur.activities, d7.activities),
      risk: makeTrend("Risk", cur.riskScore, d7.riskScore, "number", true),
    };
    return {
      assignedById: id,
      name,
      current: cur,
      days7: d7,
      days30: d30,
      trends,
      summary: employeeSummary(trends),
    };
  });

  return { current, days7, days30, days90, kpiTrends, employeeTrends };
}

export function formatMetricTrendLine(t: MetricTrend): string {
  return `${t.label}: **${t.formattedCurrent}** ${t.arrow} ${t.formattedDelta} (${t.deltaPercent >= 0 ? "+" : ""}${t.deltaPercent}%)`;
}
