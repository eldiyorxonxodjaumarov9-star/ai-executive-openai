import { dealTool } from "./deal-tool";
import { leadTool } from "./lead-tool";
import { contactTool } from "./contact-tool";
import { companyTool } from "./company-tool";
import { stageTool } from "./stage-tool";
import { activityTool } from "./activity-tool";
import { taskTool } from "./task-tool";
import { userTool } from "./user-tool";
import {
  normalizeDealsTool,
  calculateKpisTool,
  calculateRisksTool,
  calculateForecastTool,
  generateRecommendationsTool,
  generateAnalyticsTool,
  buildContextTool,
  collaborateAgentsTool,
} from "./analysis-tools";
import type { BitrixTool, ToolDescriptor, ToolName } from "./types";

const ALL_TOOLS: BitrixTool[] = [
  dealTool,
  leadTool,
  contactTool,
  companyTool,
  stageTool,
  activityTool,
  taskTool,
  userTool,
  normalizeDealsTool,
  calculateKpisTool,
  calculateRisksTool,
  calculateForecastTool,
  generateRecommendationsTool,
  generateAnalyticsTool,
  collaborateAgentsTool,
  buildContextTool,
];

const toolMap = new Map<ToolName, BitrixTool>(
  ALL_TOOLS.map((t) => [t.name, t])
);

export function getTool(name: ToolName): BitrixTool | undefined {
  return toolMap.get(name);
}

export function listTools(): BitrixTool[] {
  return ALL_TOOLS;
}

/** OpenAI Tool Calling ready — add tools here when enabling native tool calls */
export const TOOL_DESCRIPTORS: ToolDescriptor[] = ALL_TOOLS.map((t) => ({
  name: t.name,
  description: `Execute ${t.name} for Bitrix24 executive analytics pipeline`,
  parameters: { type: "object", properties: {} },
}));

export { buildContextTool };
