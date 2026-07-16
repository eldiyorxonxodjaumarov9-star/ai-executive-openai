import { loadBrainForIntent } from "./brain-router";
import {
  AGENT_DISPLAY_NAMES,
  CASUAL_ANSWER_INSTRUCTION,
  CRM_ANSWER_INSTRUCTION,
  HYBRID_ANSWER_INSTRUCTION,
  KNOWLEDGE_ANSWER_INSTRUCTION,
  USER_OUTPUT_INSTRUCTION,
  normalizeAgent,
  type AgentId,
} from "./constants";
import { fetchCrmForQuick, formatCrmBlockQuick } from "./crm-router";
import { analyzeRouteIntent, type IntentType } from "./intent-router";
import { loadKnowledgeForIntent } from "./knowledge-router";
import { chatCompletion } from "./openai";
import { loadAgentPrompt } from "./prompts";
import { sanitizeUserOutput } from "./sanitize";
import { getEnv } from "./env";

export interface QuickAnswerResult {
  answer: string;
  intent: IntentType;
  domainIntent: string;
  crmSummary: Record<string, unknown>;
  brainFiles: string[];
  knowledgeFiles: string[];
  crmEntities: string[];
}

function instructionForIntent(intent: IntentType): string {
  switch (intent) {
    case "casual_chat":
      return CASUAL_ANSWER_INSTRUCTION;
    case "knowledge_question":
      return KNOWLEDGE_ANSWER_INSTRUCTION;
    case "crm_question":
      return CRM_ANSWER_INSTRUCTION;
    case "hybrid_question":
      return HYBRID_ANSWER_INSTRUCTION;
  }
}

function buildSystemPrompt(agent: AgentId, intent: IntentType): string {
  const rolePrompt = loadAgentPrompt(agent);
  const display = AGENT_DISPLAY_NAMES[agent];
  return `${rolePrompt}

Siz ${display} sifatida tezkor savol-javob rejimidasiz.

${instructionForIntent(intent)}

${USER_OUTPUT_INSTRUCTION}`;
}

function buildUserPrompt(
  intent: IntentType,
  question: string,
  brainText: string,
  knowledgeText: string,
  crmBlock: string
): string {
  const parts: string[] = [];

  if (intent === "casual_chat") {
    if (brainText) {
      parts.push("=== AGENT MA'LUMOTI ===", brainText, "");
    }
    parts.push("=== SAVOL ===", question, "", "Tabiiy va qisqa javob bering.");
    return parts.join("\n");
  }

  if (intent === "knowledge_question" || intent === "hybrid_question") {
    if (brainText) parts.push("=== BRAIN (agent bilimi) ===", brainText, "");
    if (knowledgeText) parts.push("=== BILIM BAZASI ===", knowledgeText, "");
  }

  if (intent === "crm_question" || intent === "hybrid_question") {
    parts.push("=== BITRIX24 (jonli ma'lumot) ===", crmBlock, "");
  }

  parts.push("=== SAVOL ===", question, "");

  if (intent === "crm_question") {
    parts.push("Faqat Bitrix24 ma'lumotlariga tayangan holda javob bering.");
  } else if (intent === "hybrid_question") {
    parts.push("Bilim bazasi va Bitrix24 ma'lumotlarini birlashtirib javob bering.");
  } else {
    parts.push("Bilim bazasiga tayangan holda javob bering.");
  }

  return parts.join("\n");
}

export async function runQuickAnswer(agentName: string, question: string): Promise<QuickAnswerResult> {
  const agent = normalizeAgent(agentName);
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const route = analyzeRouteIntent(q);
  const systemPrompt = buildSystemPrompt(agent, route.type);

  let brainFiles: string[] = [];
  let brainText = "";
  let knowledgeFiles: string[] = [];
  let knowledgeText = "";
  let crmEntities: string[] = [];
  let crmSummary: Record<string, unknown> = {};
  let crmBlock = "";

  if (route.type === "casual_chat") {
    const brain = loadBrainForIntent(agent, route.domainIntent, "casual");
    brainFiles = brain.files;
    brainText = brain.text;
  } else if (route.type === "knowledge_question") {
    const brain = loadBrainForIntent(agent, route.domainIntent, "full");
    brainFiles = brain.files;
    brainText = brain.text;
    const knowledge = loadKnowledgeForIntent(agent, route.domainIntent);
    knowledgeFiles = knowledge.files;
    knowledgeText = knowledge.text;
  } else if (route.type === "crm_question") {
    const { entities, data } = await fetchCrmForQuick(q);
    crmEntities = entities;
    crmSummary = data.summary as unknown as Record<string, unknown>;
    crmBlock = formatCrmBlockQuick(data, "crm_only");
  } else {
    const brain = loadBrainForIntent(agent, route.domainIntent, "full");
    brainFiles = brain.files;
    brainText = brain.text;
    const knowledge = loadKnowledgeForIntent(agent, route.domainIntent);
    knowledgeFiles = knowledge.files;
    knowledgeText = knowledge.text;
    const { entities, data } = await fetchCrmForQuick(q);
    crmEntities = entities;
    crmSummary = data.summary as unknown as Record<string, unknown>;
    crmBlock = formatCrmBlockQuick(data, "hybrid");
  }

  const userPrompt = buildUserPrompt(route.type, q, brainText, knowledgeText, crmBlock);
  const { quickMaxTokens } = getEnv();
  const raw = await chatCompletion(systemPrompt, userPrompt, quickMaxTokens);

  return {
    answer: sanitizeUserOutput(raw),
    intent: route.type,
    domainIntent: route.domainIntent,
    crmSummary,
    brainFiles,
    knowledgeFiles,
    crmEntities,
  };
}

export type { AgentId };
