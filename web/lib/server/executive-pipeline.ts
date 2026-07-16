import type { AgentId } from "./constants";
import type { BitrixLoadedData } from "./bitrix-data-loader";
import { analyzeCrmQuery } from "./crm-query-router";
import { shouldBypassCache } from "./bitrix-cache";
import {
  getOrCreateMemory,
  updateMemoryFromQuestion,
  recordFetch,
  shouldAutoRefresh,
  memoryInstructionBlock,
} from "./agent-memory";
import { createExecutionPlan } from "./query-planner";
import { executePlan } from "./tool-orchestrator";
import { buildContextTool } from "./tools/registry";
import { buildExecutiveReport } from "./executive-report-builder";
import type { SalesFetchStatus } from "./sales-analytics";
import type { OrchestratorResult } from "./tools/types";

export interface ExecutivePipelineOptions {
  bypassCache?: boolean;
  conversationId?: string;
}

export interface ExecutivePipelineResult {
  contextBlock: string;
  executiveReport?: string;
  orchestration: OrchestratorResult;
  fetchStatus: SalesFetchStatus;
  fetchedAt: string;
  cached: boolean;
  memoryBlock: string;
}

function emptyLoaded(): BitrixLoadedData {
  return {
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
  };
}

function resolveFetchStatus(loaded: BitrixLoadedData): SalesFetchStatus {
  const hasDeals = loaded.deals.length > 0;
  const hasOther =
    loaded.leads.length + loaded.contacts.length + loaded.tasks.length > 0;
  if (!hasDeals && !hasOther) {
    const perm = loaded.limitations.some((l) => l.includes("403") || l.includes("permission"));
    if (perm) return "permission_denied";
    if (loaded.limitations.some((l) => l.includes("webhook") || l.includes("HTTP"))) return "webhook_error";
    return "empty_crm";
  }
  return "ok";
}

export async function runExecutivePipeline(
  agent: AgentId,
  question: string,
  options: ExecutivePipelineOptions = {}
): Promise<ExecutivePipelineResult> {
  const conversationId = options.conversationId || `exec-${Date.now()}`;
  const memory = getOrCreateMemory(conversationId, agent);
  updateMemoryFromQuestion(memory, question);

  let bypass = shouldBypassCache(question, options.bypassCache);
  if (shouldAutoRefresh(memory)) bypass = true;

  const plan = createExecutionPlan(agent, question);
  const routing = analyzeCrmQuery(question);

  const orchestration = await executePlan(plan, {
    agent,
    question,
    bypassCache: bypass,
    routing,
    loaded: emptyLoaded(),
    normalizedDeals: [],
    kpis: null,
    risks: [],
    forecasts: null,
    recommendations: [],
    analytics: null,
    collaboratorInsights: {},
    memory,
  });

  const { context } = orchestration;
  context.loaded.fetchedAt = new Date().toISOString();
  recordFetch(memory, context.loaded.fetchedAt);

  const contextBlock = buildContextTool.contextBlock || "";
  const fetchStatus = resolveFetchStatus(context.loaded);

  let executiveReport: string | undefined;
  if (/\b(hisobot|report|direktor|executive)\b/i.test(question) && context.kpis && context.analytics && context.forecasts) {
    executiveReport = buildExecutiveReport({
      title: "Executive Intelligence Report",
      periodLabel: String(plan.filters.dateRange || routing.dateRange.label),
      kpis: context.kpis,
      analytics: context.analytics.base,
      risks: context.risks,
      forecasts: context.forecasts!,
      recommendations: context.recommendations,
      limitations: context.loaded.limitations,
      fetchedAt: context.loaded.fetchedAt,
    });
  }

  return {
    contextBlock,
    executiveReport,
    orchestration,
    fetchStatus,
    fetchedAt: context.loaded.fetchedAt,
    cached: context.loaded.cached && !bypass,
    memoryBlock: memoryInstructionBlock(memory),
  };
}

export { createExecutionPlan, executePlan };
