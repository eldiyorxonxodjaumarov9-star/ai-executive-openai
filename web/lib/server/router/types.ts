export type RoutableAgentId =
  | "ceo"
  | "sales"
  | "procurement"
  | "finance"
  | "customer_success"
  | "hr"
  | "business_analytics";

export interface RouteResult {
  primaryAgent: RoutableAgentId;
  secondaryAgents: RoutableAgentId[];
  confidence: number;
  reason: string;
}

export const ALL_DIRECTOR_AGENTS: RoutableAgentId[] = [
  "sales",
  "procurement",
  "finance",
  "customer_success",
  "hr",
  "business_analytics",
];
