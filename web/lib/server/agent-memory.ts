import type { AgentId } from "./constants";

export interface MemoryPreference {
  prefersTables?: boolean;
  currency?: string;
  responseStyle?: "brief" | "detailed";
  topics: string[];
}

export interface ConversationMemory {
  conversationId: string;
  agent: AgentId;
  preferences: MemoryPreference;
  lastFetchAt?: string;
  lastQuestion?: string;
  crmQuestionCount: number;
}

const store = new Map<string, ConversationMemory>();

const STALE_MS = 60_000;

export function getOrCreateMemory(conversationId: string, agent: AgentId): ConversationMemory {
  const key = `${agent}:${conversationId}`;
  let mem = store.get(key);
  if (!mem) {
    mem = {
      conversationId,
      agent,
      preferences: { topics: [] },
      crmQuestionCount: 0,
    };
    store.set(key, mem);
  }
  return mem;
}

export function updateMemoryFromQuestion(mem: ConversationMemory, question: string): void {
  mem.lastQuestion = question;
  const t = question.toLowerCase();

  if (/\b(jadval|table|matrix)\b/.test(t)) mem.preferences.prefersTables = true;
  if (/\b(uzs|so'm|sum)\b/.test(t)) mem.preferences.currency = "UZS";
  if (/\b(qisqa|brief)\b/.test(t)) mem.preferences.responseStyle = "brief";
  if (/\b(batafsil|detailed|chuqur)\b/.test(t)) mem.preferences.responseStyle = "detailed";

  const topicMatch = t.match(/\b(savdo|moliya|xodim|marketing|mijoz|risk|hisobot)\b/);
  if (topicMatch && !mem.preferences.topics.includes(topicMatch[1])) {
    mem.preferences.topics.push(topicMatch[1]);
    if (mem.preferences.topics.length > 8) mem.preferences.topics.shift();
  }
}

export function recordFetch(mem: ConversationMemory, fetchedAt: string): void {
  mem.lastFetchAt = fetchedAt;
  mem.crmQuestionCount += 1;
}

export function shouldAutoRefresh(mem: ConversationMemory): boolean {
  if (!mem.lastFetchAt) return false;
  return Date.now() - new Date(mem.lastFetchAt).getTime() > STALE_MS;
}

export function memoryInstructionBlock(mem: ConversationMemory): string {
  const parts: string[] = [];
  if (mem.preferences.prefersTables) parts.push("Foydalanuvchi jadval formatini afzal ko'radi.");
  if (mem.preferences.currency === "UZS") parts.push("Moliyaviy raqamlarni UZS (so'm) da ko'rsating.");
  if (mem.preferences.responseStyle === "brief") parts.push("Qisqa va aniq javob bering.");
  if (mem.preferences.responseStyle === "detailed") parts.push("Batafsil tahlil bering.");
  if (mem.preferences.topics.length) {
    parts.push(`Suhbat mavzulari: ${mem.preferences.topics.join(", ")}.`);
  }
  return parts.length ? `\n=== SUHBAT XOTIRASI ===\n${parts.join("\n")}` : "";
}

export function clearConversationMemory(conversationId: string, agent: AgentId): void {
  store.delete(`${agent}:${conversationId}`);
}

/** Test helper */
export function _resetMemoryStore(): void {
  store.clear();
}
