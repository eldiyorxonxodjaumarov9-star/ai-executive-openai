import type { AgentId } from "./constants";
import { entitiesForAgent } from "./agent-crm-config";
import { analyzeCrmQuery } from "./crm-query-router";
import { analyzeRouteIntent, type IntentType } from "./intent-router";
import type { ExecutionPlan, PlanIntent, ToolName } from "./tools/types";

const EXECUTIVE_KEYWORDS = /\b(hisobot|direktor|rahbar|executive|xulosa|kpi|risk|forecast|prognoz)\b/i;
const COLLAB_KEYWORDS = /\b(savdo.*moliya|moliya.*savdo|barcha|umumiy|kompaniya|butun)\b/i;

function intentToPlan(intent: IntentType): PlanIntent {
  if (intent === "crm_question") return "crm";
  if (intent === "hybrid_question") return "hybrid";
  if (intent === "knowledge_question") return "knowledge";
  return "casual";
}

function entityToLoadStep(entity: string): ToolName | null {
  const map: Record<string, ToolName> = {
    deals: "loadDeals",
    leads: "loadLeads",
    contacts: "loadContacts",
    companies: "loadCompanies",
    stages: "loadStages",
    activities: "loadActivities",
    tasks: "loadTasks",
  };
  return map[entity] ?? null;
}

function buildLoadSteps(agent: AgentId, question: string): ToolName[] {
  const entities = entitiesForAgent(agent);
  const steps: ToolName[] = [];
  for (const e of entities) {
    const step = entityToLoadStep(e);
    if (step && !steps.includes(step)) steps.push(step);
  }
  if (steps.includes("loadDeals") && !steps.includes("loadUsers")) steps.push("loadUsers");
  if (steps.includes("loadDeals") && !steps.includes("loadStages")) steps.push("loadStages");
  return steps;
}

function buildAnalysisSteps(question: string, agent: AgentId): ToolName[] {
  const steps: ToolName[] = [
    "normalizeDeals",
    "calculateKpis",
    "generateAnalytics",
    "calculateRisks",
    "calculateForecast",
    "generateRecommendations",
    "buildContext",
  ];

  if (agent === "ceo" || COLLAB_KEYWORDS.test(question)) {
    steps.splice(steps.length - 1, 0, "collaborateAgents");
  }

  if (EXECUTIVE_KEYWORDS.test(question)) {
    if (!steps.includes("calculateRisks")) steps.push("calculateRisks");
    if (!steps.includes("calculateForecast")) steps.push("calculateForecast");
  }

  return steps;
}

export function createExecutionPlan(agent: AgentId, question: string): ExecutionPlan {
  const route = analyzeRouteIntent(question);
  const routing = analyzeCrmQuery(question);
  const intent = intentToPlan(route.type);

  const reasoning: string[] = [
    `Intent: ${route.type} (${route.domainIntent})`,
    `Metric: ${routing.metric}`,
    `Date range: ${routing.dateRange.label}`,
  ];

  if (intent === "casual" || intent === "knowledge") {
    return {
      intent,
      steps: [],
      metric: routing.metric,
      entities: [],
      filters: { domain: route.domainIntent },
      reasoning,
      priority: "low",
    };
  }

  const loadSteps = buildLoadSteps(agent, question);
  const analysisSteps = buildAnalysisSteps(question, agent);
  const steps = [...loadSteps, ...analysisSteps];

  reasoning.push(`Load entities: ${entitiesForAgent(agent).join(", ")}`);
  reasoning.push(`Analysis pipeline: ${analysisSteps.join(" → ")}`);

  const priority: ExecutionPlan["priority"] =
    EXECUTIVE_KEYWORDS.test(question) || routing.metric === "executive_report" ? "high" : "normal";

  return {
    intent,
    steps,
    metric: routing.metric,
    entities: entitiesForAgent(agent),
    filters: {
      dateRange: routing.dateRange.label,
      dateExplicit: routing.dateRange.explicit,
      dealStatusFilter: routing.dealStatusFilter,
      employee: routing.employee,
      domain: route.domainIntent,
    },
    reasoning,
    priority,
  };
}

export { analyzeCrmQuery, analyzeRouteIntent };
