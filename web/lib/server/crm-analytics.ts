import type { CrmQueryRouting } from "./crm-query-router";
import type { NormalizedDeal } from "./deal-normalizer";
import { formatMoney } from "./sales-analytics";
import { isDateInRange, parseBitrixDate, TASHKENT_TZ } from "./tashkent-time";

export interface CrmAnalyticsSummary {
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalPipelineAmount: number;
  totalPipelineAmountFormatted: string;
  wonAmount: number;
  wonAmountFormatted: string;
  lostAmount: number;
  openAmount: number;
  averageDealAmount: number;
  averageDealAmountFormatted: string;
}

export interface CrmPeriodStats {
  label: string;
  from: string;
  to: string;
  explicit: boolean;
  createdCount: number;
  wonCount: number;
  lostCount: number;
  openCount: number;
  createdAmount: number;
  wonAmount: number;
  createdAmountFormatted: string;
  wonAmountFormatted: string;
}

export interface CrmTopDeal {
  title: string;
  amount: number;
  amountFormatted: string;
  manager: string;
  status: string;
}

export interface CrmManagerPerformance {
  name: string;
  dealCount: number;
  wonCount: number;
  openCount: number;
  lostCount: number;
  totalAmount: number;
  totalAmountFormatted: string;
  wonAmount: number;
  wonAmountFormatted: string;
}

export interface CrmStageBreakdown {
  stage: string;
  count: number;
  amount: number;
  amountFormatted: string;
  wonCount: number;
  openCount: number;
  lostCount: number;
}

export interface CrmAnalyticsContext {
  timezone: string;
  routing: {
    metric: string;
    domain: string;
    aggregation: string;
    dealStatusFilter: string;
  };
  summary: CrmAnalyticsSummary;
  periodStats: CrmPeriodStats;
  topDeals: CrmTopDeal[];
  managerPerformance: CrmManagerPerformance[];
  stageBreakdown: CrmStageBreakdown[];
  relevantDeals: CrmTopDeal[];
  notes: string[];
  matchedDealsCount: number;
  totalDealsLoaded: number;
}

function filterDealsForQuery(deals: NormalizedDeal[], routing: CrmQueryRouting): NormalizedDeal[] {
  const { dateRange, dealStatusFilter, metric } = routing;
  const inPeriod = (dateStr: string) => {
    const d = parseBitrixDate(dateStr);
    return d ? isDateInRange(d, dateRange.from, dateRange.to) : false;
  };

  switch (dealStatusFilter) {
    case "won":
      return deals.filter((d) => d.isWon);
    case "won_in_period":
      return deals.filter((d) => d.isWon && inPeriod(d.closeDate));
    case "lost":
      return deals.filter((d) => d.isLost);
    case "open":
      return deals.filter((d) => d.isOpen);
    case "created_in_period":
      return deals.filter((d) => inPeriod(d.dateCreate));
    case "all":
    default:
      if (dateRange.explicit) {
        if (metric === "created_count") return deals.filter((d) => inPeriod(d.dateCreate));
        if (metric === "won_count" || metric === "won_amount" || metric === "today_sales") {
          return deals.filter((d) => d.isWon && inPeriod(d.closeDate));
        }
      }
      return deals;
  }
}

function buildSummary(deals: NormalizedDeal[]): CrmAnalyticsSummary {
  const open = deals.filter((d) => d.isOpen);
  const won = deals.filter((d) => d.isWon);
  const lost = deals.filter((d) => d.isLost);
  const totalPipeline = deals.reduce((s, d) => s + d.opportunity, 0);
  const wonAmount = won.reduce((s, d) => s + d.opportunity, 0);
  const lostAmount = lost.reduce((s, d) => s + d.opportunity, 0);
  const openAmount = open.reduce((s, d) => s + d.opportunity, 0);
  const avg = deals.length ? totalPipeline / deals.length : 0;

  return {
    totalDeals: deals.length,
    openDeals: open.length,
    wonDeals: won.length,
    lostDeals: lost.length,
    totalPipelineAmount: totalPipeline,
    totalPipelineAmountFormatted: formatMoney(totalPipeline),
    wonAmount,
    wonAmountFormatted: formatMoney(wonAmount),
    lostAmount,
    openAmount,
    averageDealAmount: avg,
    averageDealAmountFormatted: formatMoney(avg),
  };
}

function buildPeriodStats(allDeals: NormalizedDeal[], routing: CrmQueryRouting): CrmPeriodStats {
  const { dateRange } = routing;
  const inPeriod = (dateStr: string) => {
    const d = parseBitrixDate(dateStr);
    return d ? isDateInRange(d, dateRange.from, dateRange.to) : false;
  };

  const created = allDeals.filter((d) => inPeriod(d.dateCreate));
  const won = allDeals.filter((d) => d.isWon && inPeriod(d.closeDate));
  const lost = allDeals.filter((d) => d.isLost && inPeriod(d.closeDate));
  const open = allDeals.filter((d) => d.isOpen);

  const createdAmount = created.reduce((s, d) => s + d.opportunity, 0);
  const wonAmount = won.reduce((s, d) => s + d.opportunity, 0);

  return {
    label: dateRange.label,
    from: dateRange.fromIso,
    to: dateRange.toIso,
    explicit: dateRange.explicit,
    createdCount: created.length,
    wonCount: won.length,
    lostCount: lost.length,
    openCount: open.length,
    createdAmount,
    wonAmount,
    createdAmountFormatted: formatMoney(createdAmount),
    wonAmountFormatted: formatMoney(wonAmount),
  };
}

function buildManagerPerformance(deals: NormalizedDeal[]): CrmManagerPerformance[] {
  const map = new Map<string, CrmManagerPerformance>();

  for (const d of deals) {
    const key = d.assignedById || "unknown";
    const existing = map.get(key) || {
      name: d.assignedByName,
      dealCount: 0,
      wonCount: 0,
      openCount: 0,
      lostCount: 0,
      totalAmount: 0,
      totalAmountFormatted: "",
      wonAmount: 0,
      wonAmountFormatted: "",
    };
    existing.dealCount += 1;
    existing.totalAmount += d.opportunity;
    if (d.isWon) {
      existing.wonCount += 1;
      existing.wonAmount += d.opportunity;
    }
    if (d.isOpen) existing.openCount += 1;
    if (d.isLost) existing.lostCount += 1;
    map.set(key, existing);
  }

  return [...map.values()]
    .map((m) => ({
      ...m,
      totalAmountFormatted: formatMoney(m.totalAmount),
      wonAmountFormatted: formatMoney(m.wonAmount),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

function buildStageBreakdown(deals: NormalizedDeal[]): CrmStageBreakdown[] {
  const map = new Map<string, CrmStageBreakdown>();
  for (const d of deals) {
    const key = d.stageName;
    const existing = map.get(key) || {
      stage: key,
      count: 0,
      amount: 0,
      amountFormatted: "",
      wonCount: 0,
      openCount: 0,
      lostCount: 0,
    };
    existing.count += 1;
    existing.amount += d.opportunity;
    if (d.isWon) existing.wonCount += 1;
    else if (d.isLost) existing.lostCount += 1;
    else existing.openCount += 1;
    map.set(key, existing);
  }
  return [...map.values()]
    .map((s) => ({ ...s, amountFormatted: formatMoney(s.amount) }))
    .sort((a, b) => b.count - a.count);
}

function toTopDeal(d: NormalizedDeal): CrmTopDeal {
  return {
    title: d.title,
    amount: d.opportunity,
    amountFormatted: formatMoney(d.opportunity, d.currency),
    manager: d.assignedByName,
    status: d.isWon ? "yopilgan" : d.isLost ? "yutqazilgan" : "ochiq",
  };
}

export function buildCrmAnalytics(
  allNormalized: NormalizedDeal[],
  routing: CrmQueryRouting
): CrmAnalyticsContext {
  let matched = filterDealsForQuery(allNormalized, routing);

  if (routing.employee) {
    const lower = routing.employee.toLowerCase();
    matched = matched.filter((d) => d.assignedByName.toLowerCase().includes(lower));
  }

  const summary = buildSummary(allNormalized);
  const periodStats = buildPeriodStats(allNormalized, routing);
  const managers = buildManagerPerformance(matched.length ? matched : allNormalized);
  const stages = buildStageBreakdown(matched.length ? matched : allNormalized);
  const topDeals = [...(matched.length ? matched : allNormalized)]
    .sort((a, b) => b.opportunity - a.opportunity)
    .slice(0, 5)
    .map(toTopDeal);

  const notes: string[] = [];
  if (allNormalized.length === 0) {
    notes.push("Bitrix24 dan bitimlar topilmadi.");
  } else if (matched.length === 0 && routing.dateRange.explicit) {
    notes.push(
      `${routing.dateRange.label} davrida (${routing.dateRange.fromIso} — ${routing.dateRange.toIso}) mos bitim topilmadi. Umumiy bazada ${allNormalized.length} ta bitim mavjud.`
    );
  } else if (matched.length === 0) {
    notes.push(`Filtr bo'yicha mos bitim topilmadi. Umumiy bazada ${allNormalized.length} ta bitim mavjud.`);
  }

  let relevant = matched.slice(0, 10).map(toTopDeal);
  if (routing.metric === "top_deal" && matched.length) {
    relevant = [toTopDeal(matched.sort((a, b) => b.opportunity - a.opportunity)[0])];
  }

  return {
    timezone: TASHKENT_TZ,
    routing: {
      metric: routing.metric,
      domain: routing.domain,
      aggregation: routing.aggregation,
      dealStatusFilter: routing.dealStatusFilter,
    },
    summary,
    periodStats,
    topDeals,
    managerPerformance: managers.slice(0, 10),
    stageBreakdown: stages,
    relevantDeals: relevant,
    notes,
    matchedDealsCount: matched.length,
    totalDealsLoaded: allNormalized.length,
  };
}

export function formatCrmAnalyticsContext(analytics: CrmAnalyticsContext, question: string): string {
  const lines: string[] = [
    `Vaqt zonasi: ${analytics.timezone}`,
    `Savol turi: ${analytics.routing.metric} | Domain: ${analytics.routing.domain} | Aggregation: ${analytics.routing.aggregation}`,
    `Davr: ${analytics.periodStats.label} (${analytics.periodStats.from} — ${analytics.periodStats.to})${analytics.periodStats.explicit ? "" : " [sana ko'rsatilmagan — barcha vaqt]"}`,
    `Jami yuklangan bitimlar: ${analytics.totalDealsLoaded}`,
    `Filtr bo'yicha mos bitimlar: ${analytics.matchedDealsCount}`,
    "",
    "=== UMUMIY STATISTIKA (BARCHA BITIMLAR) ===",
    JSON.stringify(analytics.summary, null, 2),
    "",
    "=== TANLANGAN DAVR STATISTIKASI ===",
    JSON.stringify(analytics.periodStats, null, 2),
  ];

  if (analytics.managerPerformance.length) {
    lines.push("", "=== MENEJERLAR BO'YICHA ===", JSON.stringify(analytics.managerPerformance.slice(0, 5), null, 2));
  }
  if (analytics.stageBreakdown.length) {
    lines.push("", "=== BOSQICHLAR BO'YICHA ===", JSON.stringify(analytics.stageBreakdown.slice(0, 8), null, 2));
  }
  if (analytics.topDeals.length) {
    lines.push("", "=== TOP BITIMLAR ===", JSON.stringify(analytics.topDeals, null, 2));
  }
  if (analytics.relevantDeals.length) {
    lines.push("", "=== SAVOLGA MOS BITIMLAR ===", JSON.stringify(analytics.relevantDeals, null, 2));
  }
  if (analytics.notes.length) {
    lines.push("", "=== IZOHLAR ===", analytics.notes.join("\n"));
  }

  if (/\bjami\b.*\bnechta\b/i.test(question)) {
    lines.push("", "DIQQAT: Foydalanuvchi jami bitimlar sonini so'radi — summary.totalDeals javob.");
  }
  if (/\beng katta\b/i.test(question)) {
    lines.push("", "DIQQAT: Foydalanuvchi eng katta bitimni so'radi — topDeals[0] javob.");
  }
  if (/\bmenejer\b/i.test(question)) {
    lines.push("", "DIQQAT: Foydalanuvchi menejer statistikasini so'radi — managerPerformance javob.");
  }
  if (/\bhisobot\b/i.test(question)) {
    lines.push("", "DIQQAT: Foydalanuvchi umumiy hisobot so'radi — summary + periodStats + stageBreakdown ishlating.");
  }

  return lines.join("\n");
}

export function buildCrmAnalyticsPreview(analytics: CrmAnalyticsContext): Record<string, unknown> {
  return {
    summary: analytics.summary,
    periodStats: analytics.periodStats,
    topDealsCount: analytics.topDeals.length,
    managerCount: analytics.managerPerformance.length,
    stageCount: analytics.stageBreakdown.length,
    relevantDealsCount: analytics.relevantDeals.length,
    notes: analytics.notes,
  };
}
