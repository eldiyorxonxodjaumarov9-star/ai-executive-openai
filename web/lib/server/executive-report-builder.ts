import type { KpiSnapshot } from "./kpi-engine";
import type { RiskItem } from "./risk-engine";
import type { ForecastBundle } from "./forecast-engine";
import type { Recommendation } from "./recommendation-engine";
import type { CrmAnalyticsContext } from "./crm-analytics";
import {
  formatEmployeeMarkdown,
  type EmployeeAnalyticsBundle,
} from "./employee-analytics";
import {
  formatExecutiveIntelligenceMarkdown,
  type ExecutiveIntelligence,
} from "./executive-intelligence";

export interface ExecutiveReportInput {
  title: string;
  periodLabel: string;
  kpis: KpiSnapshot;
  analytics: CrmAnalyticsContext;
  risks: RiskItem[];
  forecasts: ForecastBundle;
  recommendations: Recommendation[];
  limitations: string[];
  fetchedAt: string;
  employeeAnalytics?: EmployeeAnalyticsBundle | null;
  intelligence?: ExecutiveIntelligence | null;
}

export function buildExecutiveReport(input: ExecutiveReportInput): string {
  const { kpis, analytics, risks, forecasts, recommendations, employeeAnalytics, intelligence } =
    input;

  const lines: string[] = [
    `# ${input.title}`,
    "",
    `**Davr:** ${input.periodLabel} · **Yangilangan:** ${input.fetchedAt}`,
    "",
  ];

  if (intelligence) {
    lines.push(formatExecutiveIntelligenceMarkdown(intelligence), "");
  } else {
    lines.push(
      "## Qisqacha xulosa",
      `- Jami bitimlar: **${analytics.summary.totalDeals}** (ochiq: ${kpis.open}, yutuq: ${kpis.won}, yo'qotish: ${kpis.lost})`,
      `- Pipeline: **${kpis.pipelineFormatted}**`,
      `- Revenue (won): **${kpis.revenueFormatted}**`,
      `- Konversiya: **${kpis.conversionRate}%** · O'sish: **${kpis.growthPercent}%**`,
      employeeAnalytics
        ? `- Xodimlar (ASSIGNED_BY_ID): **${employeeAnalytics.totalEmployees}**`
        : "",
      "",
      "## KPI",
      "| Ko'rsatkich | Qiymat |",
      "|---|---|",
      `| O'rtacha bitim | ${kpis.averageDealFormatted} |`,
      `| Deal velocity | ${kpis.dealVelocityDays} kun |`,
      `| Risk score | ${kpis.riskScore}/100 |`,
      ""
    );

    if (employeeAnalytics && employeeAnalytics.employees.length > 0) {
      lines.push(formatEmployeeMarkdown(employeeAnalytics), "");
    }

    lines.push("## Risklar");
    if (risks.length) {
      for (const r of risks.slice(0, 6)) {
        lines.push(
          `- **[${r.score}]** ${r.title}: ${r.detail}${r.manager ? ` (${r.manager})` : ""}`
        );
      }
    } else {
      lines.push("_Yuqori risk signallari topilmadi._");
    }

    lines.push("", "## Prognoz");
    lines.push(
      `- 7 kun: ${forecasts.nextWeek.revenueFormatted} (ishonch: ${forecasts.nextWeek.confidence}%)`,
      `- 30 kun: ${forecasts.nextMonth.revenueFormatted} (ishonch: ${forecasts.nextMonth.confidence}%)`,
      `- 90 kun: ${forecasts.days90?.revenueFormatted || forecasts.quarter.revenueFormatted}`,
      `- Trend: **${forecasts.trend === "up" ? "↑ O'sish" : forecasts.trend === "down" ? "↓ Pasayish" : "→ Barqaror"}**`
    );

    lines.push("", "## Tavsiyalar");
    const recTexts = [
      ...(employeeAnalytics?.executiveRecommendations || []),
      ...recommendations.map((r) => r.text),
    ];
    const unique = [...new Set(recTexts)].slice(0, 10);
    for (const text of unique) lines.push(`- ${text}`);
  }

  if (input.limitations.length) {
    lines.push("", "## Cheklovlar", ...input.limitations.map((l) => `- ${l}`));
  }

  return lines.filter((l) => l !== undefined && l !== "").join("\n");
}
