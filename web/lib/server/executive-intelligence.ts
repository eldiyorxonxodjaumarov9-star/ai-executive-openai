import type { NormalizedDeal } from "./deal-normalizer";
import type { CrmRecord } from "./bitrix";
import type { KpiSnapshot } from "./kpi-engine";
import type { RiskItem } from "./risk-engine";
import type { EmployeeAnalyticsBundle } from "./employee-analytics";
import { buildCompanyTrends, type CompanyTrendBundle, type EmployeeTrendProfile } from "./trend-engine";
import { scoreAllEmployees, type EmployeeScore } from "./employee-score";
import { calculateExecutiveScore, type ExecutiveScoreBundle } from "./executive-score";
import { calculateForecast, type ForecastBundle } from "./forecast-engine";
import { formatMoney } from "./sales-analytics";

export interface IntelligenceInsight {
  rank: number;
  text: string;
  severity: "positive" | "warning" | "neutral";
}

export interface EarlyWarning {
  text: string;
  severity: "high" | "medium" | "low";
}

export interface ImproverDecliner {
  name: string;
  metric: string;
  change: string;
  reason: string;
  recommendation?: string;
}

export interface ManagerComparison {
  name: string;
  score: number;
  vsAverage: string;
  strengths: string[];
  weaknesses: string[];
}

export interface RecommendedAction {
  priority: number;
  when: "Bugun" | "Shu hafta" | "Shu oy";
  text: string;
}

export interface ExecutiveIntelligence {
  trends: CompanyTrendBundle;
  employeeScores: EmployeeScore[];
  executiveScore: ExecutiveScoreBundle;
  forecasts: ForecastBundle;
  insights: IntelligenceInsight[];
  earlyWarnings: EarlyWarning[];
  topImprovers: ImproverDecliner[];
  topDeclining: ImproverDecliner[];
  managerComparison: ManagerComparison[];
  recommendedActions: RecommendedAction[];
  executiveNarrative: string;
}

function buildInsights(
  trends: CompanyTrendBundle,
  scores: EmployeeScore[],
  employees: EmployeeAnalyticsBundle,
  leadsCount: number
): IntelligenceInsight[] {
  const items: IntelligenceInsight[] = [];
  const pipeline = trends.kpiTrends.find((t) => t.label === "Pipeline");
  const conv = trends.kpiTrends.find((t) => t.label === "Conversion");
  const deals = trends.kpiTrends.find((t) => t.label === "Deals");

  const top = scores[0];
  if (top && top.score >= 70) {
    const t = trends.employeeTrends.find((e) => e.assignedById === top.assignedById);
    const pct = t?.trends.pipeline.deltaPercent ?? t?.trends.deals.deltaPercent ?? 0;
    items.push({
      rank: 1,
      text: `${top.name}ning natijasi ${pct >= 0 ? "+" : ""}${pct || top.scoreOutOf10}% bahoda yetakchi (${top.scoreOutOf10}/10).`,
      severity: "positive",
    });
  }

  const atRiskEmp = employees.atRisk[0];
  if (atRiskEmp) {
    items.push({
      rank: 2,
      text: `${atRiskEmp.name}da xavf ortmoqda (${atRiskEmp.riskLevel}, ${atRiskEmp.staleDeals30d} ta stale bitim).`,
      severity: "warning",
    });
  }

  if (leadsCount < 20) {
    items.push({
      rank: 3,
      text: `Marketing leadlari past darajada (${leadsCount} ta) — oqimni kuchaytirish kerak.`,
      severity: "warning",
    });
  } else if ((deals?.deltaPercent || 0) > 5) {
    items.push({
      rank: 3,
      text: `Yangi bitimlar o'smoqda (${deals!.deltaPercent > 0 ? "+" : ""}${deals!.deltaPercent}%).`,
      severity: "positive",
    });
  }

  if (pipeline && pipeline.direction === "up") {
    items.push({
      rank: 4,
      text: `Pipeline oshmoqda: ${pipeline.formattedCurrent} (${pipeline.arrow} ${pipeline.formattedDelta}).`,
      severity: "positive",
    });
  } else if (pipeline && pipeline.direction === "down") {
    items.push({
      rank: 4,
      text: `Pipeline kamaymoqda: ${pipeline.formattedCurrent} (${pipeline.arrow} ${pipeline.formattedDelta}).`,
      severity: "warning",
    });
  }

  if (conv && conv.direction === "down") {
    items.push({
      rank: 5,
      text: `Conversion pasaymoqda (${conv.formattedCurrent}, ${conv.arrow} ${conv.deltaPercent}%).`,
      severity: "warning",
    });
  } else {
    const declining = trends.employeeTrends.find((e) => e.trends.activities.direction === "down");
    if (declining) {
      items.push({
        rank: 5,
        text: `${declining.name}ning activity darajasi tushmoqda.`,
        severity: "warning",
      });
    } else {
      items.push({
        rank: 5,
        text: `Kompaniya holati ${pipeline?.direction === "up" ? "o'sish" : "barqaror"} bosqichida.`,
        severity: "neutral",
      });
    }
  }

  return items.slice(0, 5).map((x, i) => ({ ...x, rank: i + 1 }));
}

function buildEarlyWarnings(
  deals: NormalizedDeal[],
  trends: CompanyTrendBundle,
  risks: RiskItem[],
  leadsCount: number
): EarlyWarning[] {
  const warnings: EarlyWarning[] = [];
  const stale21 = deals.filter((d) => {
    if (!d.isOpen) return false;
    const created = d.dateCreate;
    const dt = Date.parse(created);
    return !Number.isNaN(dt) && Date.now() - dt > 21 * 86400000;
  }).length;
  if (stale21 > 0) {
    warnings.push({
      text: `${stale21} ta bitim 21 kundan beri harakatsiz.`,
      severity: stale21 >= 5 ? "high" : "medium",
    });
  }

  const pipeline = trends.kpiTrends.find((t) => t.label === "Pipeline");
  if (pipeline && pipeline.direction === "down" && Math.abs(pipeline.deltaPercent) >= 5) {
    warnings.push({
      text: `Pipeline ${Math.abs(pipeline.deltaPercent)}% kamaymoqda.`,
      severity: "high",
    });
  }

  if (leadsCount < 15) {
    warnings.push({ text: "Marketing leadlari kamaygan / past.", severity: "medium" });
  }

  for (const e of trends.employeeTrends) {
    if (e.trends.activities.direction === "down" && e.trends.activities.deltaPercent <= -15) {
      warnings.push({
        text: `${e.name}ning activity darajasi tushmoqda (${e.trends.activities.deltaPercent}%).`,
        severity: "medium",
      });
    }
  }

  if (risks.length >= 3) {
    warnings.push({
      text: `${risks.length} ta yuqori risk signali aniqlandi.`,
      severity: "high",
    });
  }

  return warnings.slice(0, 8);
}

function buildImproversDecliners(trends: EmployeeTrendProfile[]): {
  improvers: ImproverDecliner[];
  declining: ImproverDecliner[];
} {
  const scored = trends.map((t) => {
    const score =
      (t.trends.deals.deltaPercent || 0) +
      (t.trends.pipeline.deltaPercent || 0) +
      (t.trends.activities.deltaPercent || 0) -
      (t.trends.risk.direction === "up" ? 20 : 0);
    return { t, score };
  });

  const improvers = [...scored]
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ t }) => {
      const best = [t.trends.pipeline, t.trends.deals, t.trends.activities].sort(
        (a, b) => b.deltaPercent - a.deltaPercent
      )[0];
      return {
        name: t.name,
        metric: best.label,
        change: `${best.arrow} ${best.deltaPercent}%`,
        reason: t.summary,
      };
    });

  const declining = [...scored]
    .filter((x) => x.score < 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map(({ t }) => {
      const worst = [t.trends.pipeline, t.trends.deals, t.trends.activities, t.trends.risk].sort(
        (a, b) => a.deltaPercent - b.deltaPercent
      )[0];
      return {
        name: t.name,
        metric: worst.label,
        change: `${worst.arrow} ${worst.deltaPercent}%`,
        reason: t.summary,
        recommendation: `${t.name} bilan 1:1 uchrashuv va stale bitimlarni ko'rib chiqish.`,
      };
    });

  return { improvers, declining };
}

function buildManagerComparison(scores: EmployeeScore[]): ManagerComparison[] {
  if (!scores.length) return [];
  const avg = scores.reduce((s, e) => s + e.score, 0) / scores.length;
  return scores.slice(0, 8).map((e) => {
    const diff = Math.round(e.score - avg);
    return {
      name: e.name,
      score: e.scoreOutOf10,
      vsAverage: diff >= 0 ? `O'rtachadan +${diff}` : `O'rtachadan ${diff}`,
      strengths: e.reasons.filter((r) => !/past|yuqori|yo'q|pasay/i.test(r)).slice(0, 2),
      weaknesses: e.reasons.filter((r) => /past|yuqori|yo'q|pasay|stale|risk/i.test(r)).slice(0, 2),
    };
  });
}

function buildActions(
  warnings: EarlyWarning[],
  declining: ImproverDecliner[],
  improvers: ImproverDecliner[],
  employees: EmployeeAnalyticsBundle
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  let i = 1;
  for (const d of declining.slice(0, 2)) {
    actions.push({
      priority: i++,
      when: "Bugun",
      text: `${d.name} bilan uchrashuv — ${d.metric} pasayishi`,
    });
  }
  if (employees.atRisk[0]) {
    actions.push({
      priority: i++,
      when: "Bugun",
      text: `${employees.atRisk[0].staleDeals30d || 3} ta stale dealni ko'rib chiqish (${employees.atRisk[0].name})`,
    });
  }
  if (warnings.some((w) => /marketing|lead/i.test(w.text))) {
    actions.push({
      priority: i++,
      when: "Shu hafta",
      text: "Marketing budgetni qayta taqsimlash",
    });
  }
  if (improvers[0]) {
    actions.push({
      priority: i++,
      when: "Shu hafta",
      text: `${improvers[0].name}ga yirik mijozlarni topshirish`,
    });
  }
  const overloaded = employees.mostBusy[0];
  if (overloaded && overloaded.openDeals >= 8) {
    actions.push({
      priority: i++,
      when: "Shu hafta",
      text: `${overloaded.name} yuklamasini qayta taqsimlash`,
    });
  }
  actions.push({
    priority: i++,
    when: "Shu oy",
    text: "Sotuv voronkasi konversiyasini haftalik review qilish",
  });
  actions.push({
    priority: i++,
    when: "Shu oy",
    text: "Xodimlar reytingini KPI meetingda muhokama qilish",
  });
  return actions.slice(0, 10);
}

function buildNarrative(
  score: ExecutiveScoreBundle,
  trends: CompanyTrendBundle,
  warnings: EarlyWarning[],
  forecasts: ForecastBundle
): string {
  const pipeline = trends.kpiTrends.find((t) => t.label === "Pipeline");
  const parts = [
    `Kompaniya ${score.label.toLowerCase()} holatda (Executive Health Score: ${score.overall}/100).`,
    pipeline
      ? `Pipeline ${pipeline.direction === "up" ? "oshmoqda" : pipeline.direction === "down" ? "kamaymoqda" : "barqaror"}: ${pipeline.formattedCurrent}.`
      : "",
    warnings[0] ? warnings[0].text : "",
    forecasts.narrative,
    score.departments.sales >= 80
      ? "Kelasi hafta o'sishni mustahkamlash tavsiya qilinadi."
      : "Kelasi hafta sotuv bo'limini kuchaytirish tavsiya qilinadi.",
  ];
  return parts.filter(Boolean).join(" ");
}

export function buildExecutiveIntelligence(
  deals: NormalizedDeal[],
  kpis: KpiSnapshot,
  risks: RiskItem[],
  employees: EmployeeAnalyticsBundle,
  activities: CrmRecord[] = [],
  leadsCount = 0
): ExecutiveIntelligence {
  const trends = buildCompanyTrends(deals, activities);
  const employeeScores = scoreAllEmployees(employees.employees, trends.employeeTrends);
  const executiveScore = calculateExecutiveScore(
    kpis,
    trends,
    risks,
    employees,
    employeeScores,
    leadsCount
  );
  const forecasts = calculateForecast(deals, kpis, trends);
  const insights = buildInsights(trends, employeeScores, employees, leadsCount);
  const earlyWarnings = buildEarlyWarnings(deals, trends, risks, leadsCount);
  const { improvers, declining } = buildImproversDecliners(trends.employeeTrends);
  const managerComparison = buildManagerComparison(employeeScores);
  const recommendedActions = buildActions(earlyWarnings, declining, improvers, employees);
  const executiveNarrative = buildNarrative(executiveScore, trends, earlyWarnings, forecasts);

  return {
    trends,
    employeeScores,
    executiveScore,
    forecasts,
    insights,
    earlyWarnings,
    topImprovers: improvers,
    topDeclining: declining,
    managerComparison,
    recommendedActions,
    executiveNarrative,
  };
}

export function formatExecutiveIntelligenceMarkdown(intel: ExecutiveIntelligence): string {
  const lines: string[] = [
    "## Bugungi eng muhim 5 ta insight",
    "",
  ];
  for (const ins of intel.insights) {
    lines.push(`${ins.rank}. ${ins.text}`);
  }

  lines.push(
    "",
    "## Executive Health Score",
    "",
    `**${intel.executiveScore.overall} / 100** — ${intel.executiveScore.label}`,
    ""
  );
  for (const b of intel.executiveScore.bars) {
    lines.push(`${b.label}`, `${b.bar} ${b.score}%`, "");
  }

  lines.push("## KPI trendlar (30 kun)", "");
  for (const t of intel.trends.kpiTrends) {
    lines.push(`- ${t.label}: **${t.formattedCurrent}** ${t.arrow} ${t.formattedDelta}`);
  }

  lines.push("", "## Tarixiy taqqoslash", "");
  lines.push(
    `| Davr | Bitimlar | Pipeline | Revenue | Risk |`,
    `|---|---|---|---|---|`,
    `| Hozir | ${intel.trends.current.deals} | ${intel.trends.current.pipelineFormatted} | ${intel.trends.current.revenueFormatted} | ${intel.trends.current.riskScore} |`,
    `| 7 kun oldin | ${intel.trends.days7.deals} | ${intel.trends.days7.pipelineFormatted} | ${intel.trends.days7.revenueFormatted} | ${intel.trends.days7.riskScore} |`,
    `| 30 kun oldin | ${intel.trends.days30.deals} | ${intel.trends.days30.pipelineFormatted} | ${intel.trends.days30.revenueFormatted} | ${intel.trends.days30.riskScore} |`,
    `| 90 kun oldin | ${intel.trends.days90.deals} | ${intel.trends.days90.pipelineFormatted} | ${intel.trends.days90.revenueFormatted} | ${intel.trends.days90.riskScore} |`
  );

  lines.push("", "## Xodimlar trend + AI ball", "");
  for (const e of intel.trends.employeeTrends) {
    const sc = intel.employeeScores.find((s) => s.assignedById === e.assignedById);
    lines.push(
      `👤 **${e.name}**`,
      "",
      "**Joriy holat**",
      `- Bitimlar: ${e.current.deals}`,
      `- Pipeline: ${e.current.pipelineFormatted}`,
      `- Ochiq: ${e.current.openDeals}`,
      `- Risk: ${e.current.riskScore}/100`,
      "",
      "**7 kun oldin**",
      `- Bitimlar: ${e.days7.deals}`,
      `- Pipeline: ${e.days7.pipelineFormatted}`,
      "",
      "**30 kun oldin**",
      `- Bitimlar: ${e.days30.deals}`,
      `- Pipeline: ${e.days30.pipelineFormatted}`,
      "",
      "**Trend**",
      `- Deals ${e.trends.deals.arrow} ${e.trends.deals.formattedDelta}`,
      `- Pipeline ${e.trends.pipeline.arrow} ${e.trends.pipeline.formattedDelta}`,
      `- Conversion ${e.trends.conversion.arrow} ${e.trends.conversion.formattedDelta}`,
      `- Activities ${e.trends.activities.arrow} ${e.trends.activities.formattedDelta}`,
      `- Risk ${e.trends.risk.arrow} ${e.trends.risk.formattedDelta}`,
      "",
      `**AI bahosi:** ${sc?.scoreOutOf10 ?? "—"} / 10 (${sc?.grade || ""})`,
      `**Xulosa:** ${e.summary}`,
      sc ? `**Sabab:** ${sc.reasons.join("; ")}` : "",
      "",
      "---",
      ""
    );
  }

  lines.push("## 🚀 Eng tez o'sayotgan xodimlar", "", "TOP 5", "");
  if (intel.topImprovers.length) {
    lines.push("| Kim | Nima yaxshiladi | Foiz | Sabab |", "|---|---|---|---|");
    for (const x of intel.topImprovers) {
      lines.push(`| ${x.name} | ${x.metric} | ${x.change} | ${x.reason} |`);
    }
  } else {
    lines.push("_Hali aniq o'sish signali yo'q._");
  }

  lines.push("", "## 📉 Pasaygan xodimlar", "", "TOP 5", "");
  if (intel.topDeclining.length) {
    lines.push("| Kim | Nima pasaydi | Sababi | AI tavsiyasi |", "|---|---|---|---|");
    for (const x of intel.topDeclining) {
      lines.push(`| ${x.name} | ${x.metric} ${x.change} | ${x.reason} | ${x.recommendation || "—"} |`);
    }
  } else {
    lines.push("_Jiddiy pasayish topilmadi._");
  }

  lines.push("", "## Early Warning", "");
  for (const w of intel.earlyWarnings) {
    lines.push(`⚠️ ${w.text}`);
  }
  if (!intel.earlyWarnings.length) lines.push("_Jiddiy ogohlantirish yo'q._");

  lines.push("", "## Forecast", "");
  lines.push(
    `| Davr | Revenue | Pipeline o'sish | Risk | Confidence |`,
    `|---|---|---|---|---|`,
    `| 7 kun | ${intel.forecasts.nextWeek.revenueFormatted} | ${intel.forecasts.nextWeek.pipelineGrowthPercent}% | ${intel.forecasts.nextWeek.riskChangePercent}% | ${intel.forecasts.nextWeek.confidence}% |`,
    `| 30 kun | ${intel.forecasts.nextMonth.revenueFormatted} | ${intel.forecasts.nextMonth.pipelineGrowthPercent}% | ${intel.forecasts.nextMonth.riskChangePercent}% | ${intel.forecasts.nextMonth.confidence}% |`,
    `| 90 kun | ${intel.forecasts.days90.revenueFormatted} | ${intel.forecasts.days90.pipelineGrowthPercent}% | ${intel.forecasts.days90.riskChangePercent}% | ${intel.forecasts.days90.confidence}% |`,
    "",
    intel.forecasts.narrative
  );

  lines.push("", "## Manager Comparison", "");
  for (const m of intel.managerComparison) {
    lines.push(
      `- **${m.name}** — ${m.score}/10 (${m.vsAverage})`,
      m.strengths.length ? `  - Kuchli: ${m.strengths.join(", ")}` : "",
      m.weaknesses.length ? `  - Zaif: ${m.weaknesses.join(", ")}` : ""
    );
  }

  lines.push("", "## Recommended Actions (Top 10)", "");
  for (const a of intel.recommendedActions) {
    lines.push(`- **${a.when}:** ${a.text}`);
  }

  lines.push("", "## Direktor xulosasi", "", intel.executiveNarrative);

  return lines.filter((l) => l !== undefined).join("\n");
}

export { formatMoney };
