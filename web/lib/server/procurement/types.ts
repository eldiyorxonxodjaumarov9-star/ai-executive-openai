export type ProcurementIntent =
  | "casual_chat"
  | "knowledge_only"
  | "crm_only"
  | "knowledge_plus_crm";

export interface ProcurementIntentResult {
  intent: ProcurementIntent;
  matchedKeywords: string[];
  needsKnowledge: boolean;
  needsCrm: boolean;
}

export interface RewrittenQuery {
  original: string;
  rewritten: string;
  wasRewritten: boolean;
}
