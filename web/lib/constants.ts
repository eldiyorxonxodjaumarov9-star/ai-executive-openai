export const AGENTS = [
  { id: "ceo", label: "Bosh direktor", short: "CEO", color: "#C96442" },
  { id: "sales", label: "Sotuv", short: "Sales", color: "#3B82F6" },
  { id: "finance", label: "Moliya", short: "Finance", color: "#059669" },
  { id: "hr", label: "Kadrlar", short: "HR", color: "#8B5CF6" },
  { id: "marketing", label: "Marketing", short: "Marketing", color: "#EC4899" },
  { id: "customer_success", label: "Mijozlar muvaffaqiyati", short: "CS", color: "#0EA5E9" },
] as const;

export type AgentId = (typeof AGENTS)[number]["id"];

export type ChatMode = "quick_answer" | "full_report";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
  timestamp: number;
}

export const SUGGESTIONS = [
  "Leadlar nechta?",
  "Bugun qancha sotuv bo'ldi?",
  "Bugun Dilnura nima qildi?",
  "To'liq hisobot",
] as const;

export const USER_NAME_KEY = "aiep_user_name";