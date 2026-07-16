export const AGENTS = [
  { id: "ceo", label: "Rahbar agenti", short: "R", color: "#C96442" },
  { id: "finance", label: "Moliya agenti", short: "M", color: "#059669" },
  { id: "sales", label: "Sotuv agenti", short: "S", color: "#3B82F6" },
  { id: "hr", label: "Xodimlar agenti", short: "X", color: "#8B5CF6" },
  { id: "marketing", label: "Targ'ibot agenti", short: "T", color: "#EC4899" },
  { id: "customer_success", label: "Mijozlar agenti", short: "J", color: "#0EA5E9" },
] as const;

export type AgentId = (typeof AGENTS)[number]["id"];

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export const SUGGESTIONS = [
  "Bugun nechta yangi mijoz so'rovi keldi?",
  "Bugun qancha sotuv bo'ldi?",
  "Dilnura bugun nima ish qildi?",
  "Salom",
] as const;

export const USER_NAME_KEY = "aiep_user_name";
