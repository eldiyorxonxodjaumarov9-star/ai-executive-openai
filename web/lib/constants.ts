export const AGENTS = [
  { id: "ceo", label: "Rahbar agenti", short: "R", color: "#C96442", description: "Kompaniya umumiy holati, strategiya va yakuniy boshqaruv xulosasi." },
  { id: "sales", label: "Savdo agenti", short: "S", color: "#3B82F6", description: "Lead, savdo, bitim, tijoriy taklif va shartnomalar." },
  { id: "procurement", label: "Ta'minot agenti", short: "T", color: "#D97706", description: "Yetkazib beruvchilar, xarid, narx, ta'minot va yetkazib berish." },
  { id: "finance", label: "Moliya agenti", short: "M", color: "#059669", description: "Tushum, to'lov, debitor, kreditor va moliyaviy nazorat." },
  { id: "customer_success", label: "Mijozlar agenti", short: "J", color: "#0EA5E9", description: "Mijozlar, servis, brokerlik, retention va mijoz tajribasi." },
  { id: "hr", label: "Xodimlar agenti", short: "X", color: "#8B5CF6", description: "Xodimlar, vazifalar, KPI, onboarding va rivojlanish." },
  { id: "business_analytics", label: "IT va biznes analitika", short: "I", color: "#6366F1", description: "CRM monitoring, KPI, dashboard, biznes analitika va avtomatlashtirish." },
  { id: "marketing", label: "Targ'ibot agenti", short: "G", color: "#EC4899", description: "Targ'ibot va marketing analitikasi (tuzilmada yashirin)." },
] as const;

/** Demo UI: 7 ta asosiy agent (marketing yashirin). Tartib sxemaga mos. */
export const DEMO_AGENT_IDS = [
  "ceo",
  "sales",
  "procurement",
  "finance",
  "customer_success",
  "hr",
  "business_analytics",
] as const;

export const DEMO_AGENTS = AGENTS.filter((a) =>
  (DEMO_AGENT_IDS as readonly string[]).includes(a.id)
);

export type AgentId = (typeof AGENTS)[number]["id"];

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export const SUGGESTIONS = [
  "Kompaniya umumiy holati qanday?",
  "Bugun qancha savdo bo'ldi?",
  "Qaysi yetkazib beruvchi kechikyapti?",
  "Salom",
] as const;

export const USER_NAME_KEY = "aiep_user_name";
