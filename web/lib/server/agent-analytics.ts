import type { AgentId } from "./constants";
import type { CrmQueryRouting } from "./crm-query-router";
import { buildCrmAnalytics, type CrmAnalyticsContext } from "./crm-analytics";
import { normalizeDeals, type NormalizedDeal } from "./deal-normalizer";
import { dealAmount, formatMoney } from "./sales-analytics";
import { getThisMonthRange } from "./date-range-parser";
import { parseBitrixDate, isDateInRange } from "./tashkent-time";
import type { BitrixLoadedData } from "./bitrix-data-loader";
import type { CrmRecord } from "./bitrix";
import { buildEmployeeAnalytics, type EmployeeAnalyticsBundle } from "./employee-analytics";
import {
  buildExecutiveIntelligence,
  type ExecutiveIntelligence,
} from "./executive-intelligence";

export interface AgentAnalyticsBundle {
  base: CrmAnalyticsContext;
  agentSpecific: Record<string, unknown>;
  employeeAnalytics: EmployeeAnalyticsBundle;
  intelligence: ExecutiveIntelligence;
}

function leadSourceBreakdown(leads: CrmRecord[]): { source: string; count: number }[] {
  const map = new Map<string, number>();
  for (const l of leads) {
    const src = String(l.SOURCE_ID || "Noma'lum manba");
    map.set(src, (map.get(src) || 0) + 1);
  }
  return [...map.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
}

function stuckDeals(deals: NormalizedDeal[]): NormalizedDeal[] {
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return deals.filter((d) => {
    if (!d.isOpen) return false;
    const mod = parseBitrixDate(d.dateCreate);
    return mod && mod.getTime() < monthAgo;
  });
}

function monthlyTrend(deals: NormalizedDeal[]): { month: string; count: number; amount: number }[] {
  const map = new Map<string, { count: number; amount: number }>();
  for (const d of deals) {
    const dt = parseBitrixDate(d.dateCreate);
    if (!dt) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const cur = map.get(key) || { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += d.opportunity;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([month, v]) => ({ month, ...v, amountFormatted: formatMoney(v.amount) }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);
}

function employeeWorkload(deals: NormalizedDeal[]): {
  name: string;
  openDeals: number;
  totalDeals: number;
  wonDeals: number;
}[] {
  const map = new Map<string, { open: number; total: number; won: number }>();
  for (const d of deals) {
    const key = d.assignedByName;
    const cur = map.get(key) || { open: 0, total: 0, won: 0 };
    cur.total += 1;
    if (d.isOpen) cur.open += 1;
    if (d.isWon) cur.won += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, openDeals: v.open, totalDeals: v.total, wonDeals: v.won }))
    .sort((a, b) => b.openDeals - a.openDeals);
}

function customerInsights(contacts: CrmRecord[], deals: NormalizedDeal[]): Record<string, unknown> {
  const contactCount = contacts.length;
  const companiesWithDeals = new Set(deals.map((d) => d.title)).size;
  return {
    totalContacts: contactCount,
    activeCustomerDeals: deals.filter((d) => d.isOpen).length,
    repeatIndicator: companiesWithDeals,
    note: "Takroriy mijoz aniqlash CONTACT_ID/company bog'lanishi kengaytirilishi mumkin",
  };
}

export function buildAgentAnalytics(
  agent: AgentId,
  loaded: BitrixLoadedData,
  routing: CrmQueryRouting,
  question: string
): AgentAnalyticsBundle {
  const normalized = normalizeDeals(loaded.deals, loaded.stages, loaded.users);
  const base = buildCrmAnalytics(normalized, routing);
  const employeeAnalytics = buildEmployeeAnalytics(normalized, loaded.activities);

  // Intelligence uses already-loaded deals/activities — no extra Bitrix calls
  const kpisLite = {
    pipeline: base.summary.totalPipelineAmount,
    pipelineFormatted: base.summary.totalPipelineAmountFormatted,
    revenue: base.summary.wonAmount,
    revenueFormatted: base.summary.wonAmountFormatted,
    won: base.summary.wonDeals,
    lost: base.summary.lostDeals,
    open: base.summary.openDeals,
    averageDeal: base.summary.averageDealAmount,
    averageDealFormatted: base.summary.averageDealAmountFormatted,
    conversionRate: base.summary.totalDeals
      ? Math.round(
          (base.summary.wonDeals / Math.max(1, base.summary.wonDeals + base.summary.lostDeals)) * 100
        )
      : 0,
    managerRanking: base.managerPerformance.slice(0, 10).map((m) => ({
      name: m.name,
      wonCount: m.wonCount,
      totalAmount: m.totalAmount,
      totalAmountFormatted: m.totalAmountFormatted,
    })),
    dealVelocityDays: 0,
    stageDistribution: base.stageBreakdown.slice(0, 8).map((s) => ({
      stage: s.stage,
      count: s.count,
      percent: base.summary.totalDeals
        ? Math.round((s.count / base.summary.totalDeals) * 100)
        : 0,
    })),
    forecastNextMonth: 0,
    forecastNextMonthFormatted: "0",
    riskScore: Math.min(100, base.summary.lostDeals * 5 + employeeAnalytics.atRisk.length * 8),
    growthPercent: 0,
  };

  const intelligence = buildExecutiveIntelligence(
    normalized,
    kpisLite,
    [],
    employeeAnalytics,
    loaded.activities,
    loaded.leads.length
  );
  // Align growth with trend engine
  kpisLite.growthPercent =
    intelligence.trends.kpiTrends.find((t) => t.label === "Pipeline")?.deltaPercent || 0;

  const agentSpecific: Record<string, unknown> = {};

  switch (agent) {
    case "ceo":
      agentSpecific.executiveSummary = {
        totalPipeline: base.summary.totalPipelineAmountFormatted,
        openDeals: base.summary.openDeals,
        wonDeals: base.summary.wonDeals,
        lostDeals: base.summary.lostDeals,
        topManagers: base.managerPerformance.slice(0, 5),
        stageBreakdown: base.stageBreakdown.slice(0, 8),
        executiveHealthScore: intelligence.executiveScore.overall,
        insights: intelligence.insights,
        earlyWarnings: intelligence.earlyWarnings,
        riskDeals: stuckDeals(normalized).slice(0, 5).map((d) => ({
          title: d.title,
          amount: formatMoney(d.opportunity),
          manager: d.assignedByName,
        })),
        recommendations: [
          ...intelligence.recommendedActions.slice(0, 5).map((a) => a.text),
          ...employeeAnalytics.executiveRecommendations.slice(0, 3),
        ].filter(Boolean),
      };
      agentSpecific.employeeAnalytics = {
        totalEmployees: employeeAnalytics.totalEmployees,
        employees: employeeAnalytics.employees,
        ranking: employeeAnalytics.ranking.slice(0, 10),
        mostBusy: employeeAnalytics.mostBusy,
        leastBusy: employeeAnalytics.leastBusy,
        atRisk: employeeAnalytics.atRisk.slice(0, 8),
        executiveRecommendations: employeeAnalytics.executiveRecommendations,
      };
      break;

    case "finance":
      agentSpecific.financial = {
        totalDealAmount: base.summary.totalPipelineAmountFormatted,
        wonAmount: base.summary.wonAmountFormatted,
        averageDealSize: base.summary.averageDealAmountFormatted,
        expectedRevenue: formatMoney(
          normalized.filter((d) => d.isOpen).reduce((s, d) => s + d.opportunity, 0)
        ),
        monthlyTrend: monthlyTrend(normalized),
        currencyNote: "Asosiy valyuta: so'm (UZS)",
        risks: base.summary.lostAmount > 0 ? [`Yutqazilgan bitimlar summasi: ${formatMoney(base.summary.lostAmount)}`] : [],
      };
      break;

    case "sales":
      agentSpecific.sales = {
        funnel: base.stageBreakdown,
        managerRanking: base.managerPerformance,
        employeeAnalytics: {
          employees: employeeAnalytics.employees,
          ranking: employeeAnalytics.ranking.slice(0, 10),
          mostBusy: employeeAnalytics.mostBusy,
          atRisk: employeeAnalytics.atRisk.slice(0, 8),
        },
        wonRate: base.summary.totalDeals
          ? `${Math.round((base.summary.wonDeals / base.summary.totalDeals) * 100)}%`
          : "0%",
        lostRate: base.summary.totalDeals
          ? `${Math.round((base.summary.lostDeals / base.summary.totalDeals) * 100)}%`
          : "0%",
        stuckDeals: stuckDeals(normalized).slice(0, 8).map((d) => ({
          title: d.title,
          manager: d.assignedByName,
          amount: formatMoney(d.opportunity),
        })),
        topDeals: base.topDeals,
        dailyWeeklyNote: routing.dateRange.label,
      };
      break;

    case "hr":
      agentSpecific.hr = {
        employeeWorkload: employeeWorkload(normalized),
        employeeAnalytics: {
          employees: employeeAnalytics.employees,
          mostBusy: employeeAnalytics.mostBusy,
          leastBusy: employeeAnalytics.leastBusy,
          atRisk: employeeAnalytics.atRisk,
          recommendations: employeeAnalytics.executiveRecommendations,
        },
        overloaded: employeeAnalytics.mostBusy.filter((e) => e.openDeals >= 5).slice(0, 5),
        lowPerformance: employeeAnalytics.employees
          .filter((e) => e.totalDeals >= 3 && e.wonDeals === 0)
          .slice(0, 5),
        tasksCount: loaded.tasks.length,
        fairNote: "Bitim soni yagona KPI emas — to'liq xodim baholash uchun qo'shimcha ma'lumot kerak",
      };
      break;

    case "marketing":
      agentSpecific.marketing = {
        leadSources: leadSourceBreakdown(loaded.leads),
        totalLeads: loaded.leads.length,
        leadsToDealsNote: `Lidlar: ${loaded.leads.length}, Bitimlar: ${loaded.deals.length}`,
        missingSourceWarning:
          loaded.leads.some((l) => !l.SOURCE_ID) ? "Ba'zi lidlarda SOURCE_ID maydoni to'ldirilmagan" : null,
        recommendations: [
          leadSourceBreakdown(loaded.leads)[0]
            ? `Eng ko'p lid manbasi: ${leadSourceBreakdown(loaded.leads)[0].source}`
            : null,
        ].filter(Boolean),
      };
      break;

    case "customer_success":
      agentSpecific.customers = {
        ...customerInsights(loaded.contacts, normalized),
        companies: loaded.companies.length,
        activities: loaded.activities.length,
        retentionInsights: [
          base.summary.openDeals > 0 ? `${base.summary.openDeals} ta ochiq mijoz bitimi kuzatuvda` : null,
          loaded.contacts.length > 0 ? `${loaded.contacts.length} ta kontakt bazada` : null,
        ].filter(Boolean),
      };
      break;
  }

  if (/\bshu oy/i.test(question)) {
    const month = getThisMonthRange();
    agentSpecific.periodHighlight = {
      label: month.label,
      createdInPeriod: normalized.filter((d) => {
        const dt = parseBitrixDate(d.dateCreate);
        return dt && isDateInRange(dt, month.from, month.to);
      }).length,
    };
  }

  // Har bir agent uchun xodim + intelligence majburiy
  agentSpecific.employeeAnalytics = {
    totalEmployees: employeeAnalytics.totalEmployees,
    employees: employeeAnalytics.employees,
    ranking: employeeAnalytics.ranking.slice(0, 10),
    mostBusy: employeeAnalytics.mostBusy,
    leastBusy: employeeAnalytics.leastBusy,
    atRisk: employeeAnalytics.atRisk.slice(0, 8),
    executiveRecommendations: employeeAnalytics.executiveRecommendations,
  };
  agentSpecific.executiveIntelligence = {
    healthScore: intelligence.executiveScore.overall,
    departments: intelligence.executiveScore.departments,
    insights: intelligence.insights,
    earlyWarnings: intelligence.earlyWarnings,
    employeeScores: intelligence.employeeScores,
    topImprovers: intelligence.topImprovers,
    topDeclining: intelligence.topDeclining,
    kpiTrends: intelligence.trends.kpiTrends,
    forecasts: {
      days7: intelligence.forecasts.nextWeek,
      days30: intelligence.forecasts.nextMonth,
      days90: intelligence.forecasts.days90,
      narrative: intelligence.forecasts.narrative,
    },
    recommendedActions: intelligence.recommendedActions,
    narrative: intelligence.executiveNarrative,
  };

  return { base, agentSpecific, employeeAnalytics, intelligence };
}
