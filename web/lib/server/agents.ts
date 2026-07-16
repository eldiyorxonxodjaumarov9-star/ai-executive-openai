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
import { AGENT_PROFESSIONAL_INSTRUCTIONS } from "./agent-crm-config";
import { appendFreshnessToAnswer } from "./agent-context";
import { fetchCrmForQuick, formatCrmBlockQuick, hasCrmData } from "./crm-router";
import { analyzeRouteIntent, type IntentType } from "./intent-router";
import { loadKnowledgeForIntent } from "./knowledge-router";
import { chatCompletion } from "./openai";
import { loadAgentPrompt } from "./prompts";
import { sanitizeUserOutput } from "./sanitize";
import { getEnv } from "./env";
import type { SalesFetchStatus } from "./sales-analytics";

export interface QuickAnswerOptions {
  bypassCache?: boolean;
  conversationId?: string;
}

export interface QuickAnswerResult {
  answer: string;
  intent: IntentType;
  domainIntent: string;
  crmSummary: Record<string, unknown>;
  brainFiles: string[];
  knowledgeFiles: string[];
  crmEntities: string[];
  crmFetchStatus?: SalesFetchStatus;
  dataFreshness?: { fetchedAt: string; cached: boolean };
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
  const pro = AGENT_PROFESSIONAL_INSTRUCTIONS[agent];

  return `${rolePrompt}

${pro}

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
    if (brainText) parts.push("=== AGENT MA'LUMOTI ===", brainText, "");
    parts.push("=== SAVOL ===", question, "", "Tabiiy va qisqa javob bering.");
    return parts.join("\n");
  }

  if (intent === "knowledge_question" || intent === "hybrid_question") {
    if (brainText) parts.push("=== BRAIN (agent bilimi) ===", brainText, "");
    if (knowledgeText) parts.push("=== BILIM BAZASI ===", knowledgeText, "");
  }

  if (intent === "crm_question" || intent === "hybrid_question") {
    parts.push("=== BITRIX24 (jonli ma'lumot — SOURCE OF TRUTH) ===", crmBlock, "");
  }

  parts.push("=== SAVOL ===", question, "");

  if (intent === "crm_question") {
    parts.push(
      "Faqat yuqoridagi Bitrix24 analytics ma'lumotlariga tayangan holda javob bering.",
      "Oldingi suhbatdagi raqamlarni ishlatmang."
    );
  } else if (intent === "hybrid_question") {
    parts.push("Bilim bazasi va Bitrix24 analytics ni birlashtirib javob bering.");
  } else {
    parts.push("Bilim bazasiga tayangan holda javob bering.");
  }

  return parts.join("\n");
}

export async function runQuickAnswer(
  agentName: string,
  question: string,
  options: QuickAnswerOptions = {}
): Promise<QuickAnswerResult> {
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
  let crmFetchStatus: SalesFetchStatus | undefined;
  let fetchedAt: string | undefined;
  let cached = false;

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
  } else if (route.type === "crm_question" || route.type === "hybrid_question") {
    if (route.type === "hybrid_question") {
      const brain = loadBrainForIntent(agent, route.domainIntent, "full");
      brainFiles = brain.files;
      brainText = brain.text;
      const knowledge = loadKnowledgeForIntent(agent, route.domainIntent);
      knowledgeFiles = knowledge.files;
      knowledgeText = knowledge.text;
    }

    const crmResult = await fetchCrmForQuick(q, agent, { bypassCache: options.bypassCache });
    crmEntities = crmResult.entities;
    crmSummary = crmResult.data.summary as unknown as Record<string, unknown>;
    crmFetchStatus = crmResult.fetchStatus;
    crmBlock = formatCrmBlockQuick(crmResult.data, route.type === "hybrid_question" ? "hybrid" : "crm_only");
    fetchedAt = crmResult.fetchedAt;
    cached = crmResult.cached ?? false;

    if (crmFetchStatus === "webhook_error" || crmFetchStatus === "permission_denied") {
      const msg =
        crmFetchStatus === "permission_denied"
          ? "Bitrix24 dan ma'lumot o'qish uchun ruxsat yetarli emas."
          : "Bitrix24 bilan hozir bog'lanib bo'lmadi.";
      return {
        answer: sanitizeUserOutput(msg),
        intent: route.type,
        domainIntent: route.domainIntent,
        crmSummary,
        brainFiles,
        knowledgeFiles,
        crmEntities,
        crmFetchStatus,
      };
    }

    if (!hasCrmData(crmResult.data) && crmFetchStatus === "empty_crm") {
      return {
        answer: sanitizeUserOutput("Bitrix24 da hozircha bitimlar mavjud emas."),
        intent: route.type,
        domainIntent: route.domainIntent,
        crmSummary,
        brainFiles,
        knowledgeFiles,
        crmEntities,
        crmFetchStatus,
      };
    }
  }

  if ((route.type === "crm_question" || route.type === "hybrid_question") && !crmBlock.trim()) {
    return {
      answer: sanitizeUserOutput("Bitrix24 dan ma'lumot olishda muammo yuz berdi."),
      intent: route.type,
      domainIntent: route.domainIntent,
      crmSummary,
      brainFiles,
      knowledgeFiles,
      crmEntities,
      crmFetchStatus,
    };
  }

  const userPrompt = buildUserPrompt(route.type, q, brainText, knowledgeText, crmBlock);
  const { quickMaxTokens } = getEnv();
  const raw = await chatCompletion(systemPrompt, userPrompt, quickMaxTokens);

  let answer = sanitizeUserOutput(raw);
  if ((route.type === "crm_question" || route.type === "hybrid_question") && fetchedAt) {
    answer = appendFreshnessToAnswer(answer, fetchedAt);
  }

  return {
    answer,
    intent: route.type,
    domainIntent: route.domainIntent,
    crmSummary,
    brainFiles,
    knowledgeFiles,
    crmEntities,
    crmFetchStatus,
    dataFreshness: fetchedAt ? { fetchedAt, cached } : undefined,
  };
}

export type { AgentId };
