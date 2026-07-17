import type { KpiSnapshot } from "./kpi-engine";
import type { RiskItem } from "./risk-engine";
import type { ForecastBundle } from "./forecast-engine";
import type { Recommendation } from "./recommendation-engine";
import type { CrmAnalyticsContext } from "./crm-analytics";
import {
  formatEmployeeMarkdown,
  type EmployeeAnalyticsBundle,
} from "./employee-analytics";

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
}

export function buildExecutiveReport(input: ExecutiveReportInput): string {
  const { kpis, analytics, risks, forecasts, recommendations, employeeAnalytics } = input;
  const lines: string[] = [
    `# ${input.title}`,
    "",
    `**Davr:** ${input.periodLabel} · **Yangilangan:** ${input.fetchedAt}`,
    "",
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
    "",
  ].filter((l) => l !== undefined);

  if (employeeAnalytics && employeeAnalytics.employees.length > 0) {
    lines.push(formatEmployeeMarkdown(employeeAnalytics), "");
  } else {
    lines.push(
      "## Menejer reytingi",
      ""
    );
    if (kpis.managerRanking.length) {
      lines.push("| Menejer | Yutuq | Summa |", "|---|---|---|");
      for (const m of kpis.managerRanking.slice(0, 8)) {
        lines.push(`| ${m.name} | ${m.wonCount} | ${m.totalAmountFormatted} |`);
      }
    } else {
      lines.push("_Menejer ma'lumotlari yetarli emas._");
    }
    lines.push("");
  }

  lines.push("## Risklar");
  if (risks.length) {
    for (const r of risks.slice(0, 6)) {
      lines.push(`- **[${r.score}]** ${r.title}: ${r.detail}${r.manager ? ` (${r.manager})` : ""}`);
    }
  } else {
    lines.push("_Yuqori risk signallari topilmadi._");
  }

  lines.push("", "## Prognoz");
  lines.push(
    `- Kelasi hafta: ${forecasts.nextWeek.revenueFormatted} (ishonch: ${forecasts.nextWeek.confidence}%)`,
    `- Kelasi oy: ${forecasts.nextMonth.revenueFormatted} (ishonch: ${forecasts.nextMonth.confidence}%)`,
    `- Quarter: ${forecasts.quarter.revenueFormatted}`,
    `- Trend: **${forecasts.trend === "up" ? "↑ O'sish" : forecasts.trend === "down" ? "↓ Pasayish" : "→ Barqaror"}**`
  );

  lines.push("", "## Tavsiyalar");
  const recTexts = [
    ...(employeeAnalytics?.executiveRecommendations || []),
    ...recommendations.map((r) => r.text),
  ];
  const unique = [...new Set(recTexts)].slice(0, 10);
  for (const text of unique) {
    lines.push(`- ${text}`);
  }

  lines.push("", "## Action Items");
  unique.slice(0, 5).forEach((text, i) => {
    lines.push(`${i + 1}. ${text}`);
  });

  if (input.limitations.length) {
    lines.push("", "## Cheklovlar", ...input.limitations.map((l) => `- ${l}`));
  }

  return lines.join("\n");
}
