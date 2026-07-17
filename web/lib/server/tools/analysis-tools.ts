import { buildAgentAnalytics } from "../agent-analytics";
import {
  buildAgentContextBlock,
  buildAgentContextStructured,
} from "../agent-context";
import { normalizeDeals } from "../deal-normalizer";
import { calculateKpis } from "../kpi-engine";
import { calculateRisks } from "../risk-engine";
import { calculateForecast } from "../forecast-engine";
import { generateRecommendations } from "../recommendation-engine";
import { runMultiAgentCollaboration } from "../multi-agent-collaborator";
import type { BitrixTool, ToolExecutionContext, ToolExecutionResult } from "./types";

export class NormalizeDealsTool implements BitrixTool {
  readonly name = "normalizeDeals" as const;
  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    ctx.normalizedDeals = normalizeDeals(ctx.loaded.deals, ctx.loaded.stages, ctx.loaded.users);
    return {
      name: this.name,
      success: true,
      durationMs: Date.now() - start,
      meta: { count: ctx.normalizedDeals.length },
    };
  }
}

export class CalculateKpisTool implements BitrixTool {
  readonly name = "calculateKpis" as const;
  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    ctx.kpis = calculateKpis(ctx.normalizedDeals, ctx.routing);
    return { name: this.name, success: true, durationMs: Date.now() - start };
  }
}

export class CalculateRisksTool implements BitrixTool {
  readonly name = "calculateRisks" as const;
  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    ctx.risks = calculateRisks(ctx.normalizedDeals, ctx.loaded.activities);
    return {
      name: this.name,
      success: true,
      durationMs: Date.now() - start,
      meta: { count: ctx.risks.length },
    };
  }
}

export class CalculateForecastTool implements BitrixTool {
  readonly name = "calculateForecast" as const;
  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    if (!ctx.kpis) ctx.kpis = calculateKpis(ctx.normalizedDeals, ctx.routing);
    const trends = ctx.analytics?.intelligence?.trends;
    ctx.forecasts = calculateForecast(ctx.normalizedDeals, ctx.kpis, trends);
    return { name: this.name, success: true, durationMs: Date.now() - start };
  }
}

export class GenerateRecommendationsTool implements BitrixTool {
  readonly name = "generateRecommendations" as const;
  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    if (!ctx.kpis) ctx.kpis = calculateKpis(ctx.normalizedDeals, ctx.routing);
    ctx.recommendations = generateRecommendations(ctx.normalizedDeals, ctx.kpis, ctx.risks);
    return {
      name: this.name,
      success: true,
      durationMs: Date.now() - start,
      meta: { count: ctx.recommendations.length },
    };
  }
}

export class GenerateAnalyticsTool implements BitrixTool {
  readonly name = "generateAnalytics" as const;
  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    ctx.analytics = buildAgentAnalytics(ctx.agent, ctx.loaded, ctx.routing, ctx.question);
    return { name: this.name, success: true, durationMs: Date.now() - start };
  }
}

export class BuildContextTool implements BitrixTool {
  readonly name = "buildContext" as const;
  contextBlock = "";

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    if (!ctx.analytics) {
      ctx.analytics = buildAgentAnalytics(ctx.agent, ctx.loaded, ctx.routing, ctx.question);
    }
    const structured = buildAgentContextStructured(
      ctx.agent,
      ctx.question,
      ctx.routing,
      ctx.loaded,
      ctx.analytics
    );
    structured.analytics = {
      ...structured.analytics,
      kpis: ctx.kpis,
      risks: ctx.risks.slice(0, 8),
      forecasts: ctx.forecasts,
      recommendations: ctx.recommendations,
      collaboratorInsights: ctx.collaboratorInsights,
    };
    this.contextBlock = buildAgentContextBlock(ctx.agent, structured);
    return { name: this.name, success: true, durationMs: Date.now() - start };
  }
}

export class CollaborateAgentsTool implements BitrixTool {
  readonly name = "collaborateAgents" as const;
  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    ctx.collaboratorInsights = await runMultiAgentCollaboration(
      ctx.agent,
      ctx.question,
      ctx.loaded,
      ctx.routing
    );
    return {
      name: this.name,
      success: true,
      durationMs: Date.now() - start,
      meta: { agents: Object.keys(ctx.collaboratorInsights) },
    };
  }
}

export const normalizeDealsTool = new NormalizeDealsTool();
export const calculateKpisTool = new CalculateKpisTool();
export const calculateRisksTool = new CalculateRisksTool();
export const calculateForecastTool = new CalculateForecastTool();
export const generateRecommendationsTool = new GenerateRecommendationsTool();
export const generateAnalyticsTool = new GenerateAnalyticsTool();
export const buildContextTool = new BuildContextTool();
export const collaborateAgentsTool = new CollaborateAgentsTool();
