export type HrIntent =
  | "casual_chat"
  | "knowledge_only"
  | "crm_only"
  | "knowledge_plus_crm";

export interface HrIntentResult {
  intent: HrIntent;
  matchedKeywords: string[];
  needsKnowledge: boolean;
  needsCrm: boolean;
}

export interface RewrittenQuery {
  original: string;
  rewritten: string;
  wasRewritten: boolean;
}
