import type { NormalizedDeal } from "./deal-normalizer";
import type { CrmQueryRouting } from "./crm-query-router";
import { formatMoney } from "./sales-analytics";
import { parseBitrixDate } from "./tashkent-time";

export interface KpiSnapshot {
  pipeline: number;
  pipelineFormatted: string;
  revenue: number;
  revenueFormatted: string;
  won: number;
  lost: number;
  open: number;
  averageDeal: number;
  averageDealFormatted: string;
  conversionRate: number;
  managerRanking: { name: string; wonCount: number; totalAmount: number; totalAmountFormatted: string }[];
  dealVelocityDays: number;
  stageDistribution: { stage: string; count: number; percent: number }[];
  forecastNextMonth: number;
  forecastNextMonthFormatted: string;
  riskScore: number;
  growthPercent: number;
}

function managerRanking(deals: NormalizedDeal[]): KpiSnapshot["managerRanking"] {
  const map = new Map<string, { won: number; amount: number }>();
  for (const d of deals) {
    const cur = map.get(d.assignedByName) || { won: 0, amount: 0 };
    cur.amount += d.opportunity;
    if (d.isWon) cur.won += 1;
    map.set(d.assignedByName, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      wonCount: v.won,
      totalAmount: v.amount,
      totalAmountFormatted: formatMoney(v.amount),
    }))
    .sort((a, b) => b.wonCount - a.wonCount || b.totalAmount - a.totalAmount)
    .slice(0, 10);
}

function stageDistribution(deals: NormalizedDeal[]): KpiSnapshot["stageDistribution"] {
  const map = new Map<string, number>();
  for (const d of deals) map.set(d.stageName, (map.get(d.stageName) || 0) + 1);
  const total = deals.length || 1;
  return [...map.entries()]
    .map(([stage, count]) => ({ stage, count, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

function averageVelocityDays(deals: NormalizedDeal[]): number {
  const won = deals.filter((d) => d.isWon);
  if (!won.length) return 0;
  let totalDays = 0;
  let count = 0;
  for (const d of won) {
    const created = parseBitrixDate(d.dateCreate);
    const closed = parseBitrixDate(d.closeDate);
    if (created && closed) {
      totalDays += (closed.getTime() - created.getTime()) / (86400000);
      count += 1;
    }
  }
  return count ? Math.round(totalDays / count) : 0;
}

function growthPercent(deals: NormalizedDeal[]): number {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  let current = 0;
  let previous = 0;
  for (const d of deals) {
    const dt = parseBitrixDate(d.dateCreate);
    if (!dt) continue;
    const amount = d.opportunity;
    if (dt.getFullYear() === thisYear && dt.getMonth() === thisMonth) current += amount;
    else if (dt.getFullYear() === thisYear && dt.getMonth() === thisMonth - 1) previous += amount;
  }
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function calculateKpis(deals: NormalizedDeal[], _routing: CrmQueryRouting): KpiSnapshot {
  const open = deals.filter((d) => d.isOpen);
  const won = deals.filter((d) => d.isWon);
  const lost = deals.filter((d) => d.isLost);
  const pipeline = deals.reduce((s, d) => s + d.opportunity, 0);
  const revenue = won.reduce((s, d) => s + d.opportunity, 0);
  const avg = deals.length ? pipeline / deals.length : 0;
  const closed = won.length + lost.length;
  const conversion = closed ? Math.round((won.length / closed) * 100) : 0;
  const openPipeline = open.reduce((s, d) => s + d.opportunity, 0);

  return {
    pipeline,
    pipelineFormatted: formatMoney(pipeline),
    revenue,
    revenueFormatted: formatMoney(revenue),
    won: won.length,
    lost: lost.length,
    open: open.length,
    averageDeal: avg,
    averageDealFormatted: formatMoney(avg),
    conversionRate: conversion,
    managerRanking: managerRanking(deals),
    dealVelocityDays: averageVelocityDays(deals),
    stageDistribution: stageDistribution(deals),
    forecastNextMonth: openPipeline * (conversion / 100 || 0.1),
    forecastNextMonthFormatted: formatMoney(openPipeline * (conversion / 100 || 0.1)),
    riskScore: Math.min(100, lost.length * 5 + open.filter((d) => {
      const dt = parseBitrixDate(d.dateCreate);
      return dt && Date.now() - dt.getTime() > 30 * 86400000;
    }).length * 3),
    growthPercent: growthPercent(deals),
  };
}
