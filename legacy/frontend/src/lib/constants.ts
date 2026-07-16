export const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "https://ai-executive-platform.onrender.com";

export const SECRET_KEY = "aiep_connector_secret";

export const AGENTS = [
  { id: "ceo", label: "Bosh direktor agenti" },
  { id: "finance", label: "Moliya agenti" },
  { id: "sales", label: "Sotuv agenti" },
  { id: "hr", label: "Kadrlar agenti" },
  { id: "marketing", label: "Marketing agenti" },
  { id: "customer_success", label: "Mijozlar muvaffaqiyati agenti" },
] as const;

export type AgentId = (typeof AGENTS)[number]["id"];

export type ChatMode = "quick_answer" | "full_report";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
  agent: AgentId;
  timestamp: number;
}

export interface HistoryEntry extends ChatMessage {
  question: string;
  answer: string;
}
