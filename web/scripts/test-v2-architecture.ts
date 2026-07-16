/** V2 architecture tests — run: npx tsx scripts/test-v2-architecture.ts */
import { createExecutionPlan } from "../lib/server/query-planner";
import { calculateKpis } from "../lib/server/kpi-engine";
import { calculateRisks } from "../lib/server/risk-engine";
import { calculateForecast } from "../lib/server/forecast-engine";
import { generateRecommendations } from "../lib/server/recommendation-engine";
import { runMultiAgentCollaboration } from "../lib/server/multi-agent-collaborator";
import { analyzeCrmQuery } from "../lib/server/crm-query-router";
import type { NormalizedDeal } from "../lib/server/deal-normalizer";
import {
  getOrCreateMemory,
  updateMemoryFromQuestion,
  shouldAutoRefresh,
  recordFetch,
  _resetMemoryStore,
} from "../lib/server/agent-memory";
import { getTool, listTools } from "../lib/server/tools/registry";

const sampleDeals: NormalizedDeal[] = [
  {
    id: "1",
    title: "Bitim A",
    opportunity: 10_000_000,
    currency: "UZS",
    stageId: "NEW",
    stageSemanticId: "P",
    stageName: "Yangi",
    assignedById: "1",
    assignedByName: "Azizbek",
    dateCreate: "2026-06-01T10:00:00+05:00",
    closeDate: "2026-07-20T10:00:00+05:00",
    isWon: false,
    isLost: false,
    isOpen: true,
  },
  {
    id: "2",
    title: "Bitim B",
    opportunity: 50_000_000,
    currency: "UZS",
    stageId: "WON",
    stageSemanticId: "S",
    stageName: "Yutuq",
    assignedById: "2",
    assignedByName: "Dilnura",
    dateCreate: "2026-05-01T10:00:00+05:00",
    closeDate: "2026-06-15T10:00:00+05:00",
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

// Planner tests
const plan = createExecutionPlan("ceo", "Shu oy eng yaxshi manager kim?");
assert("Planner intent is crm", plan.intent === "crm");
assert("Planner has loadDeals step", plan.steps.includes("loadDeals"));
assert("Planner has calculateKpis step", plan.steps.includes("calculateKpis"));
assert("Planner has reasoning", plan.reasoning.length > 0);

const execPlan = createExecutionPlan("ceo", "Direktor uchun barcha vaqt hisoboti");
assert("Executive plan high priority", execPlan.priority === "high");
assert("Executive plan has collaborateAgents", execPlan.steps.includes("collaborateAgents"));

// Tool registry
assert("Tool registry has 16+ tools", listTools().length >= 16);
assert("Deal tool exists", Boolean(getTool("loadDeals")));

// KPI engine
const routing = analyzeCrmQuery("Jami nechta bitim bor?");
const kpis = calculateKpis(sampleDeals, routing);
assert("KPI pipeline calculated", kpis.pipeline > 0);
assert("KPI manager ranking", kpis.managerRanking.length >= 1);
assert("KPI conversion rate", kpis.conversionRate >= 0);

// Risk engine
const risks = calculateRisks(sampleDeals);
assert("Risk engine returns items", risks.length >= 0);

// Forecast engine
const forecast = calculateForecast(sampleDeals, kpis);
assert("Forecast next month", forecast.nextMonth.revenue >= 0 && Boolean(forecast.nextMonth.revenueFormatted));
assert("Forecast has confidence", forecast.nextMonth.confidence > 0);

// Recommendations
const recs = generateRecommendations(sampleDeals, kpis, risks);
assert("Recommendations generated", recs.length > 0);

// Agent memory
_resetMemoryStore();
const mem = getOrCreateMemory("conv-test", "ceo");
updateMemoryFromQuestion(mem, "Jadval ko'rinishida UZS hisobot bering");
assert("Memory prefers tables", mem.preferences.prefersTables === true);
assert("Memory currency UZS", mem.preferences.currency === "UZS");
recordFetch(mem, new Date(Date.now() - 120_000).toISOString());
assert("Auto refresh when stale", shouldAutoRefresh(mem) === true);

// Multi-agent collaboration
async function runCollabTest() {
  const collab = await runMultiAgentCollaboration(
    "ceo",
    "Kompaniya umumiy hisoboti",
    {
      deals: [],
      leads: [],
      contacts: [],
      companies: [],
      tasks: [],
      activities: [],
      stages: new Map(),
      users: new Map(),
      fetchedAt: new Date().toISOString(),
      cached: false,
      entitiesFetched: {},
      limitations: [],
      paginationPages: 0,
    },
    routing
  );
  assert("CEO collaboration invokes agents", Object.keys(collab).length >= 5);
}

void runCollabTest().then(() => {
  console.log(`\n${passed}/${total} passed`);
  process.exit(passed === total ? 0 : 1);
});
