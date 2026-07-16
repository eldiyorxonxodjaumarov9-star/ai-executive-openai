import {
  AGENT_DISPLAY_NAMES,
  QUICK_ANSWER_INSTRUCTION,
  USER_OUTPUT_INSTRUCTION,
  normalizeAgent,
  type AgentId,
} from "./constants";
import { fetchCrmForQuick, formatCrmBlockQuick } from "./crm-router";
import { chatCompletion } from "./openai";
import { loadAgentPrompt } from "./prompts";
import { sanitizeUserOutput } from "./sanitize";
import { getEnv } from "./env";

export async function runQuickAnswer(agentName: string, question: string): Promise<{
  answer: string;
  crmSummary: Record<string, unknown>;
}> {
  const agent = normalizeAgent(agentName);
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const rolePrompt = loadAgentPrompt(agent);
  const display = AGENT_DISPLAY_NAMES[agent];

  const systemPrompt = `${rolePrompt}

Siz ${display} sifatida tezkor savol-javob rejimidasiz.

${QUICK_ANSWER_INSTRUCTION}

${USER_OUTPUT_INSTRUCTION}`;

  const { data: crmData } = await fetchCrmForQuick(q);
  const userPrompt = [
    "=== BITRIX24 (faqat savolga tegishli qism) ===",
    formatCrmBlockQuick(crmData),
    "",
    "=== SAVOL ===",
    q,
    "",
    "Yuqoridagi ma'lumotlarga tayangan holda qisqa javob bering (2–8 jumla).",
  ].join("\n");

  const { quickMaxTokens } = getEnv();
  const raw = await chatCompletion(systemPrompt, userPrompt, quickMaxTokens);
  return {
    answer: sanitizeUserOutput(raw),
    crmSummary: crmData.summary as unknown as Record<string, unknown>,
  };
}

export type { AgentId };
