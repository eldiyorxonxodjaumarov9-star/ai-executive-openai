import { isCompanyWideCeoQuestion } from "../org/structure";
import { classifyAgent } from "./classify-agent";
import type { RouteResult, RoutableAgentId } from "./types";
import { ALL_DIRECTOR_AGENTS } from "./types";

export { classifyAgent };
export type { RouteResult, RoutableAgentId };

export function routeQuery(question: string): RouteResult {
  return classifyAgent(question);
}

/** CEO orchestration uchun chaqiriladigan agentlar ro'yxati. */
export function resolveCeoOrchestrationAgents(question: string): RoutableAgentId[] {
  if (isCompanyWideCeoQuestion(question)) {
    return [...ALL_DIRECTOR_AGENTS];
  }

  const route = routeQuery(question);
  if (route.primaryAgent === "ceo" && route.secondaryAgents.length === 0) {
    return [];
  }

  const agents =
    route.primaryAgent === "ceo"
      ? route.secondaryAgents
      : [route.primaryAgent, ...route.secondaryAgents];

  return [...new Set(agents.filter((a) => a !== "ceo"))];
}
