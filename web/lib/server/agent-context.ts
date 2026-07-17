import type { AgentId } from "./constants";
import { AGENT_DISPLAY_NAMES } from "./constants";
import { AGENT_PROFESSIONAL_INSTRUCTIONS, getAgentRole } from "./agent-crm-config";
import type { CrmQueryRouting } from "./crm-query-router";
import type { BitrixLoadedData } from "./bitrix-data-loader";
import type { AgentAnalyticsBundle } from "./agent-analytics";
import { TASHKENT_TZ } from "./tashkent-time";

export interface AgentContextStructured {
  dataFreshness: {
    fetchedAt: string;
    timezone: string;
    source: string;
    cached: boolean;
  };
  agent: {
    id: AgentId;
    name: string;
    role: string;
  };
  query: {
    original: string;
    intent: string;
    metric: string;
    filters: Record<string, unknown>;
  };
  analytics: Record<string, unknown>;
  limitations: string[];
  relevantRecords: unknown[];
}

export function formatFreshnessLine(fetchedAt: string): string {
  const dt = new Date(fetchedAt);
  const formatted = new Intl.DateTimeFormat("uz-UZ", {
    timeZone: TASHKENT_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
  return `\n\n_Ma'lumotlar Bitrix24'dan ${formatted} da yangilandi._`;
}

export function buildAgentContextStructured(
  agent: AgentId,
  question: string,
  routing: CrmQueryRouting,
  loaded: BitrixLoadedData,
  bundle: AgentAnalyticsBundle
): AgentContextStructured {
  return {
    dataFreshness: {
      fetchedAt: loaded.fetchedAt,
      timezone: TASHKENT_TZ,
      source: "Bitrix24",
      cached: loaded.cached,
    },
    agent: {
      id: agent,
      name: AGENT_DISPLAY_NAMES[agent],
      role: getAgentRole(agent),
    },
    query: {
      original: question,
      intent: routing.intent,
      metric: routing.metric,
      filters: {
        dateRange: routing.dateRange.label,
        dateExplicit: routing.dateRange.explicit,
        dealStatusFilter: routing.dealStatusFilter,
        employee: routing.employee,
      },
    },
    analytics: {
      summary: bundle.base.summary,
      periodStats: bundle.base.periodStats,
      agentSpecific: bundle.agentSpecific,
      managerPerformance: bundle.base.managerPerformance,
      employeeAnalytics: {
        totalEmployees: bundle.employeeAnalytics.totalEmployees,
        employees: bundle.employeeAnalytics.employees,
        ranking: bundle.employeeAnalytics.ranking.slice(0, 10),
        mostBusy: bundle.employeeAnalytics.mostBusy,
        leastBusy: bundle.employeeAnalytics.leastBusy,
        atRisk: bundle.employeeAnalytics.atRisk.slice(0, 8),
        executiveRecommendations: bundle.employeeAnalytics.executiveRecommendations,
      },
      executiveIntelligence: {
        healthScore: bundle.intelligence.executiveScore.overall,
        insights: bundle.intelligence.insights,
        earlyWarnings: bundle.intelligence.earlyWarnings,
        employeeScores: bundle.intelligence.employeeScores,
        kpiTrends: bundle.intelligence.trends.kpiTrends,
        topImprovers: bundle.intelligence.topImprovers,
        topDeclining: bundle.intelligence.topDeclining,
        recommendedActions: bundle.intelligence.recommendedActions,
        narrative: bundle.intelligence.executiveNarrative,
        forecasts: {
          days7: bundle.intelligence.forecasts.nextWeek,
          days30: bundle.intelligence.forecasts.nextMonth,
          days90: bundle.intelligence.forecasts.days90,
        },
      },
      stageBreakdown: bundle.base.stageBreakdown.slice(0, 8),
      topDeals: bundle.base.topDeals,
      notes: bundle.base.notes,
    },
    limitations: loaded.limitations,
    relevantRecords: bundle.base.relevantDeals,
  };
}

export function buildAgentContextBlock(
  agent: AgentId,
  structured: AgentContextStructured
): string {
  const emp = structured.analytics.employeeAnalytics as
    | { employees?: unknown[]; totalEmployees?: number }
    | undefined;

  const lines = [
    AGENT_PROFESSIONAL_INSTRUCTIONS[agent],
    "",
    "=== MA'LUMOT YANGILIGI ===",
    JSON.stringify(structured.dataFreshness, null, 2),
    "",
    "=== AGENT ===",
    JSON.stringify(structured.agent, null, 2),
    "",
    "=== SAVOL VA FILTR ===",
    JSON.stringify(structured.query, null, 2),
    "",
    "=== ANALYTICS (SOURCE OF TRUTH — faqat shu raqamlardan foydalaning) ===",
    JSON.stringify(structured.analytics, null, 2),
  ];

  if (emp?.employees && Array.isArray(emp.employees) && emp.employees.length > 0) {
    lines.push(
      "",
      "=== XODIMLAR BO'YICHA TAHLIL (ASSIGNED_BY_ID → user.get) ===",
      `Jami xodimlar: ${emp.totalEmployees ?? emp.employees.length}`,
      "MUHIM: Javobda HAR BIR xodim uchun alohida raqamlar, pipeline, risk va tavsiya yozing. Faqat umumiy gap yozmang.",
      JSON.stringify(emp.employees, null, 2)
    );
  }

  if (structured.limitations.length) {
    lines.push("", "=== CHEKLOVLAR ===", structured.limitations.join("\n"));
  }

  lines.push(
    "",
    "MUHIM: Oldingi suhbat yoki assistant javobidagi raqamlarga ishonmang. Faqat yuqoridagi analytics haqiqiy.",
    "Agar davr bo'yicha 0 bo'lsa, umumiy summary ni ham tushuntiring — hech qachon faqat 'topilmadi' demang.",
    "Xodimlar so'ralganda: Xodimlar bo'yicha tahlil, Reyting, Eng band, Eng kam yuklangan, Riskdagi xodimlar, Rahbar tavsiyalari bo'limlarini majburiy yozing.",
    "Executive Intelligence: trendlar (7/30/90 kun), employee score, health score, insights, early warning, forecast va recommended actions ni raqamlar bilan yozing. Faqat joriy snapshot bilan cheklanmang."
  );

  return lines.join("\n");
}

export function appendFreshnessToAnswer(answer: string, fetchedAt: string): string {
  const line = formatFreshnessLine(fetchedAt);
  if (answer.includes("Bitrix24'dan") && answer.includes("yangilandi")) return answer;
  return answer.trim() + line;
}
