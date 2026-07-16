import type { AgentId } from "./constants";
import type { CrmQueryRouting } from "./crm-query-router";
import type { BitrixLoadedData } from "./bitrix-data-loader";
import { getTool } from "./tools/registry";
import type {
  ExecutionPlan,
  OrchestratorResult,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolName,
} from "./tools/types";

export interface ExecutePlanOptions {
  agent: AgentId;
  question: string;
  bypassCache: boolean;
  routing: CrmQueryRouting;
  loaded: BitrixLoadedData;
  normalizedDeals: ToolExecutionContext["normalizedDeals"];
  kpis: ToolExecutionContext["kpis"];
  risks: ToolExecutionContext["risks"];
  forecasts: ToolExecutionContext["forecasts"];
  recommendations: ToolExecutionContext["recommendations"];
  analytics: ToolExecutionContext["analytics"];
  collaboratorInsights: Record<string, unknown>;
  memory: ToolExecutionContext["memory"];
}

/** Load steps run in parallel; analysis steps run sequentially */
const PARALLEL_LOAD: Set<ToolName> = new Set([
  "loadDeals",
  "loadLeads",
  "loadContacts",
  "loadCompanies",
  "loadStages",
  "loadActivities",
  "loadTasks",
]);

export async function executePlan(
  plan: ExecutionPlan,
  opts: ExecutePlanOptions
): Promise<OrchestratorResult> {
  const start = Date.now();
  const ctx: ToolExecutionContext = {
    agent: opts.agent,
    question: opts.question,
    bypassCache: opts.bypassCache,
    routing: opts.routing,
    loaded: opts.loaded,
    normalizedDeals: opts.normalizedDeals,
    kpis: opts.kpis,
    risks: opts.risks,
    forecasts: opts.forecasts,
    recommendations: opts.recommendations,
    analytics: opts.analytics,
    collaboratorInsights: opts.collaboratorInsights,
    memory: opts.memory,
  };

  const stepResults: ToolExecutionResult[] = [];
  const loadSteps = plan.steps.filter((s) => PARALLEL_LOAD.has(s));
  const otherSteps = plan.steps.filter((s) => !PARALLEL_LOAD.has(s));

  if (loadSteps.length) {
    const parallelResults = await Promise.all(
      loadSteps.map(async (stepName) => {
        const tool = getTool(stepName);
        if (!tool) return { name: stepName, success: false, durationMs: 0, error: "tool not found" };
        return tool.execute(ctx);
      })
    );
    stepResults.push(...parallelResults);
  }

  if (ctx.loaded.deals.length && !loadSteps.includes("loadUsers")) {
    const userTool = getTool("loadUsers");
    if (userTool) stepResults.push(await userTool.execute(ctx));
  }

  for (const stepName of otherSteps) {
    const tool = getTool(stepName);
    if (!tool) {
      stepResults.push({ name: stepName, success: false, durationMs: 0, error: "tool not found" });
      continue;
    }
    stepResults.push(await tool.execute(ctx));
  }

  return {
    context: ctx,
    plan,
    stepResults,
    totalDurationMs: Date.now() - start,
  };
}
