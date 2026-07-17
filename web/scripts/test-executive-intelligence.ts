/** Executive Intelligence tests — npx tsx scripts/test-executive-intelligence.ts */
import { buildEmployeeAnalytics } from "../lib/server/employee-analytics";
import { buildExecutiveIntelligence, formatExecutiveIntelligenceMarkdown } from "../lib/server/executive-intelligence";
import { buildCompanyTrends } from "../lib/server/trend-engine";
import { calculateForecast } from "../lib/server/forecast-engine";
import { calculateKpis } from "../lib/server/kpi-engine";
import { analyzeCrmQuery } from "../lib/server/crm-query-router";
import { buildExecutiveReport } from "../lib/server/executive-report-builder";
import { buildCrmAnalytics } from "../lib/server/crm-analytics";
import { calculateRisks } from "../lib/server/risk-engine";
import { generateRecommendations } from "../lib/server/recommendation-engine";
import type { NormalizedDeal } from "../lib/server/deal-normalizer";

const deals: NormalizedDeal[] = [
  {
    id: "1",
    title: "Deal A",
    opportunity: 5_000_000_000,
    currency: "UZS",
    stageId: "NEW",
    stageSemanticId: "P",
    stageName: "Yangi",
    assignedById: "10",
    assignedByName: "Dilnura Abilkasimova",
    dateCreate: "2026-04-01T10:00:00+05:00",
    closeDate: "",
    isWon: false,
    isLost: false,
    isOpen: true,
  },
  {
    id: "2",
    title: "Deal B",
    opportunity: 2_000_000_000,
    currency: "UZS",
    stageId: "NEW",
    stageSemanticId: "P",
    stageName: "Yangi",
    assignedById: "10",
    assignedByName: "Dilnura Abilkasimova",
    dateCreate: "2026-07-10T10:00:00+05:00",
    closeDate: "",
    isWon: false,
    isLost: false,
    isOpen: true,
  },
  {
    id: "3",
    title: "Deal C",
    opportunity: 800_000_000,
    currency: "UZS",
    stageId: "NEW",
    stageSemanticId: "P",
    stageName: "Yangi",
    assignedById: "11",
    assignedByName: "Sardor Yo'ldashev",
    dateCreate: "2026-03-01T10:00:00+05:00",
    closeDate: "",
    isWon: false,
    isLost: false,
    isOpen: true,
  },
  {
    id: "4",
    title: "Won D",
    opportunity: 100_000_000,
    currency: "UZS",
    stageId: "WON",
    stageSemanticId: "S",
    stageName: "Yutuq",
    assignedById: "11",
    assignedByName: "Sardor Yo'ldashev",
    dateCreate: "2026-05-01T10:00:00+05:00",
    closeDate: "2026-06-01T10:00:00+05:00",
    isWon: true,
    isLost: false,
    isOpen: false,
  },
];

let passed = 0;
let total = 0;
function assert(name: string, ok: boolean) {
  total++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (ok) passed++;
}

const routing = analyzeCrmQuery("Executive intelligence hisobot");
const kpis = calculateKpis(deals, routing);
const employees = buildEmployeeAnalytics(deals);
const risks = calculateRisks(deals);
const trends = buildCompanyTrends(deals);
const intel = buildExecutiveIntelligence(deals, kpis, risks, employees, [], 12);

assert("Trends have current snapshot", trends.current.deals >= 3);
assert("Trends have 7d snapshot", trends.days7.deals >= 0);
assert("Trends have 30d snapshot", trends.days30.deals >= 0);
assert("Employee trends present", trends.employeeTrends.length >= 2);
assert("KPI trends non-empty", trends.kpiTrends.length >= 4);
assert("Executive score 0-100", intel.executiveScore.overall >= 0 && intel.executiveScore.overall <= 100);
assert("Department bars", intel.executiveScore.bars.length >= 6);
assert("Employee scores", intel.employeeScores.length >= 2);
assert("Insights top 5", intel.insights.length >= 1 && intel.insights.length <= 5);
assert("Forecast 7/30/90", Boolean(intel.forecasts.nextWeek && intel.forecasts.nextMonth && intel.forecasts.days90));
assert("Recommended actions", intel.recommendedActions.length >= 1);
assert("Narrative non-empty", intel.executiveNarrative.length > 40);

const md = formatExecutiveIntelligenceMarkdown(intel);
assert("Markdown has Health Score", md.includes("Executive Health Score"));
assert("Markdown has insights", md.includes("eng muhim 5 ta insight"));
assert("Markdown has forecast", md.includes("Forecast"));
assert("Markdown has early warning or history", md.includes("Tarixiy") || md.includes("Early Warning"));

const report = buildExecutiveReport({
  title: "Executive Intelligence Report",
  periodLabel: "barcha vaqt",
  kpis,
  analytics: buildCrmAnalytics(deals, routing),
  risks,
  forecasts: calculateForecast(deals, kpis, trends),
  recommendations: generateRecommendations(deals, kpis, risks),
  limitations: [],
  fetchedAt: new Date().toISOString(),
  employeeAnalytics: employees,
  intelligence: intel,
});

assert("Report includes Dilnura trend section", report.includes("Dilnura"));
assert("Report includes AI bahosi or score", report.includes("AI bahosi") || report.includes("/ 10"));
assert("Report includes director narrative", report.includes("Direktor xulosasi"));

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
