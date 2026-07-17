import type { KpiSnapshot } from "./kpi-engine";
import type { RiskItem } from "./risk-engine";
import type { CompanyTrendBundle } from "./trend-engine";
import type { EmployeeScore } from "./employee-score";
import type { EmployeeAnalyticsBundle } from "./employee-analytics";

export interface DepartmentScores {
  sales: number;
  finance: number;
  marketing: number;
  hr: number;
  customer: number;
  risk: number;
}

export interface ExecutiveScoreBundle {
  overall: number;
  departments: DepartmentScores;
  bars: { label: string; score: number; bar: string }[];
  label: string;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function progressBar(score: number, width = 10): string {
  const filled = Math.round((score / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

export function calculateExecutiveScore(
  kpis: KpiSnapshot,
  trends: CompanyTrendBundle,
  risks: RiskItem[],
  employees: EmployeeAnalyticsBundle,
  employeeScores: EmployeeScore[],
  leadsCount = 0
): ExecutiveScoreBundle {
  const pipelineTrend = trends.kpiTrends.find((t) => t.label === "Pipeline");
  const convTrend = trends.kpiTrends.find((t) => t.label === "Conversion");
  const dealTrend = trends.kpiTrends.find((t) => t.label === "Deals");
  const actTrend = trends.kpiTrends.find((t) => t.label === "Activities (7k)");

  let sales = 70;
  if (pipelineTrend?.direction === "up") sales += 10;
  if (dealTrend?.direction === "up") sales += 8;
  if (kpis.conversionRate >= 20) sales += 8;
  else if (kpis.conversionRate === 0 && kpis.open > 10) sales -= 8;
  if (convTrend?.direction === "down") sales -= 6;
  sales = clamp(sales);

  let finance = 68;
  if ((pipelineTrend?.deltaPercent || 0) > 0) finance += 10;
  if (kpis.growthPercent > 0) finance += 8;
  else if (kpis.growthPercent < 0) finance -= 10;
  if (kpis.averageDeal > 0) finance += 5;
  finance = clamp(finance);

  let marketing = 65;
  if (leadsCount >= 30) marketing += 12;
  else if (leadsCount >= 10) marketing += 6;
  else marketing -= 5;
  // Proxy: new deals in last 30d vs 90d via company trends
  if ((dealTrend?.deltaPercent || 0) > 5) marketing += 8;
  else if ((dealTrend?.deltaPercent || 0) < -5) marketing -= 8;
  marketing = clamp(marketing);

  let hr = 70;
  const avgEmp =
    employeeScores.length > 0
      ? employeeScores.reduce((s, e) => s + e.score, 0) / employeeScores.length
      : 60;
  hr = clamp(Math.round(avgEmp * 0.85 + (employees.atRisk.length === 0 ? 10 : -employees.atRisk.length * 3)));

  let customer = 72;
  if (kpis.open > 0) customer += 5;
  if (kpis.lost > kpis.won) customer -= 10;
  if ((actTrend?.direction || "flat") === "up") customer += 6;
  customer = clamp(customer);

  let risk = 80;
  risk -= Math.min(40, risks.length * 4);
  risk -= Math.min(20, employees.atRisk.length * 5);
  if (kpis.riskScore > 50) risk -= 15;
  if ((pipelineTrend?.direction || "flat") === "down") risk -= 8;
  risk = clamp(risk);

  const departments: DepartmentScores = { sales, finance, marketing, hr, customer, risk };
  const overall = clamp(
    Math.round(
      sales * 0.25 + finance * 0.2 + marketing * 0.15 + hr * 0.15 + customer * 0.1 + risk * 0.15
    )
  );

  const bars = [
    { label: "Sales", score: sales, bar: progressBar(sales) },
    { label: "Finance", score: finance, bar: progressBar(finance) },
    { label: "Marketing", score: marketing, bar: progressBar(marketing) },
    { label: "HR", score: hr, bar: progressBar(hr) },
    { label: "Customer", score: customer, bar: progressBar(customer) },
    { label: "Risk", score: risk, bar: progressBar(risk) },
    { label: "Umumiy", score: overall, bar: progressBar(overall) },
  ];

  const label =
    overall >= 85 ? "Kuchli" : overall >= 70 ? "Yaxshi" : overall >= 55 ? "O'rtacha" : "Zaif";

  return { overall, departments, bars, label };
}
