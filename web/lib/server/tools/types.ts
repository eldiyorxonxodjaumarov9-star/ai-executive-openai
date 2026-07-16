import type { AgentId } from "../constants";
import type { BitrixLoadedData } from "../bitrix-data-loader";
import type { CrmQueryRouting } from "../crm-query-router";
import type { NormalizedDeal } from "../deal-normalizer";
import type { KpiSnapshot } from "../kpi-engine";
import type { RiskItem } from "../risk-engine";
import type { ForecastBundle } from "../forecast-engine";
import type { Recommendation } from "../recommendation-engine";
import type { AgentAnalyticsBundle } from "../agent-analytics";
import type { ConversationMemory } from "../agent-memory";

export type ToolName =
  | "loadDeals"
  | "loadLeads"
  | "loadContacts"
  | "loadCompanies"
  | "loadUsers"
  | "loadStages"
  | "loadActivities"
  | "loadTasks"
  | "normalizeDeals"
  | "calculateKpis"
  | "calculateRisks"
  | "calculateForecast"
  | "generateRecommendations"
  | "generateAnalytics"
  | "buildContext"
  | "collaborateAgents";

export type PlanIntent = "crm" | "knowledge" | "casual" | "hybrid";

export interface ExecutionPlan {
  intent: PlanIntent;
  steps: ToolName[];
  metric: string;
  entities: string[];
  filters: Record<string, unknown>;
  reasoning: string[];
  priority: "low" | "normal" | "high";
}

export interface ToolExecutionContext {
  agent: AgentId;
  question: string;
  bypassCache: boolean;
  routing: CrmQueryRouting;
  loaded: BitrixLoadedData;
  normalizedDeals: NormalizedDeal[];
  kpis: KpiSnapshot | null;
  risks: RiskItem[];
  forecasts: ForecastBundle | null;
  recommendations: Recommendation[];
  analytics: AgentAnalyticsBundle | null;
  collaboratorInsights: Record<string, unknown>;
  memory: ConversationMemory;
}

export interface ToolExecutionResult {
  name: ToolName;
  success: boolean;
  durationMs: number;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface BitrixTool {
  readonly name: ToolName;
  execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult>;
}

export interface OrchestratorResult {
  context: ToolExecutionContext;
  plan: ExecutionPlan;
  stepResults: ToolExecutionResult[];
  totalDurationMs: number;
}

/** OpenAI Tool Calling ready descriptor */
export interface ToolDescriptor {
  name: ToolName;
  description: string;
  parameters: Record<string, unknown>;
}
