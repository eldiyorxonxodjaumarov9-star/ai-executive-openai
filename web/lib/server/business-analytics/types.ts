export type BusinessAnalyticsIntent =
  | "casual_chat"
  | "knowledge_only"
  | "crm_only"
  | "knowledge_plus_crm";

export interface BusinessAnalyticsIntentResult {
  intent: BusinessAnalyticsIntent;
  matchedKeywords: string[];
  needsKnowledge: boolean;
  needsCrm: boolean;
}

export interface RewrittenQuery {
  original: string;
  rewritten: string;
  wasRewritten: boolean;
}
