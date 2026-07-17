/** Employee analytics tests — run: npx tsx scripts/test-employee-analytics.ts */
import { buildEmployeeAnalytics, formatEmployeeMarkdown } from "../lib/server/employee-analytics";
import type { NormalizedDeal } from "../lib/server/deal-normalizer";
import { buildExecutiveReport } from "../lib/server/executive-report-builder";
import { calculateKpis } from "../lib/server/kpi-engine";
import { analyzeCrmQuery } from "../lib/server/crm-query-router";
import { calculateForecast } from "../lib/server/forecast-engine";
import { generateRecommendations } from "../lib/server/recommendation-engine";
import { calculateRisks } from "../lib/server/risk-engine";
import { buildCrmAnalytics } from "../lib/server/crm-analytics";

const deals: NormalizedDeal[] = [
  {
    id: "1",
    title: "Katta bitim A",
    opportunity: 11_000_000_000,
    currency: "UZS",
    stageId: "NEW",
    stageSemanticId: "P",
    stageName: "Yangi",
    assignedById: "10",
    assignedByName: "Dilnura Abilkasimova",
    dateCreate: "2026-05-01T10:00:00+05:00",
    closeDate: "",
    isWon: false,
    isLost: false,
    isOpen: true,
  },
  {
    id: "2",
    title: "Bitim B",
    opportunity: 500_000_000,
    currency: "UZS",
    stageId: "NEW",
    stageSemanticId: "P",
    stageName: "Yangi",
    assignedById: "10",
    assignedByName: "Dilnura Abilkasimova",
    dateCreate: "2026-06-01T10:00:00+05:00",
    closeDate: "",
    isWon: false,
    isLost: false,
    isOpen: true,
  },
  {
    id: "3",
    title: "Bitim C",
    opportunity: 100_000_000,
    currency: "UZS",
    stageId: "WON",
    stageSemanticId: "S",
    stageName: "Yutuq",
    assignedById: "11",
    assignedByName: "Sardor Yo'ldashev",
    dateCreate: "2026-04-01T10:00:00+05:00",
    closeDate: "2026-06-01T10:00:00+05:00",
    isWon: true,
    isLost: false,
    isOpen: false,
  },
  {
    id: "4",
    title: "Stale deal",
    opportunity: 80_000_000,
    currency: "UZS",
    stageId: "NEW",
    stageSemanticId: "P",
    stageName: "Yangi",
    assignedById: "11",
    assignedByName: "Sardor Yo'ldashev",
    dateCreate: "2026-04-01T10:00:00+05:00",
    closeDate: "",
    isWon: false,
    isLost: false,
    isOpen: true,
  },
  {
    id: "5",
    title: "No owner deal",
    opportunity: 10_000_000,
    currency: "UZS",
    stageId: "NEW",
    stageSemanticId: "P",
    stageName: "Yangi",
    assignedById: "",
    assignedByName: "Noma'lum xodim",
    dateCreate: "2026-06-15T10:00:00+05:00",
    closeDate: "",
    isWon: false,
    isLost: false,
    isOpen: true,
  },
];

let passed = 0;
let total = 0;
function assert(name: string, ok: boolean) {
  total++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (ok) passed++;
}

const bundle = buildEmployeeAnalytics(deals);
assert("At least 3 employees", bundle.totalEmployees >= 3);
assert("Dilnura present", bundle.employees.some((e) => e.name.includes("Dilnura")));
assert("Sardor present", bundle.employees.some((e) => e.name.includes("Sardor")));
assert("Unknown employee present", bundle.employees.some((e) => e.name === "Noma'lum xodim"));
assert("Most busy TOP", bundle.mostBusy.length >= 1);
assert("Least busy TOP", bundle.leastBusy.length >= 1);
assert("Ranking has Dilnura or Sardor", bundle.ranking.length >= 2);
assert("Recommendations non-empty", bundle.executiveRecommendations.length > 0);

const md = formatEmployeeMarkdown(bundle);
assert("Markdown has Xodimlar bo'yicha tahlil", md.includes("Xodimlar bo'yicha tahlil"));
assert("Markdown has reyting", md.includes("Xodimlar reytingi"));
assert("Markdown has eng band", md.includes("Eng band xodimlar"));
assert("Markdown has risk", md.includes("Riskdagi xodimlar"));
assert("Markdown has rahbar tavsiyalar", md.includes("Rahbar uchun tavsiyalar"));

const routing = analyzeCrmQuery("Barcha xodimlarni batafsil tahlil qil");
const kpis = calculateKpis(deals, routing);
const analytics = buildCrmAnalytics(deals, routing);
const report = buildExecutiveReport({
  title: "Executive Intelligence Report",
  periodLabel: "barcha vaqt",
  kpis,
  analytics,
  risks: calculateRisks(deals),
  forecasts: calculateForecast(deals, kpis),
  recommendations: generateRecommendations(deals, kpis, calculateRisks(deals)),
  limitations: [],
  fetchedAt: new Date().toISOString(),
  employeeAnalytics: bundle,
});

assert("Executive report includes employee section", report.includes("Xodimlar bo'yicha tahlil"));
assert("Executive report includes Dilnura", report.includes("Dilnura"));
assert("Executive report includes ranking medals", report.includes("1-o'rin"));

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
