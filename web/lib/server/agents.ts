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
import { fetchCrmForQuick, formatCrmBlockQuick, hasCrmData } from "./crm-router";
import { analyzeRouteIntent, type IntentType } from "./intent-router";
import { loadKnowledgeForIntent } from "./knowledge-router";
import { chatCompletion } from "./openai";
import { loadAgentPrompt } from "./prompts";
import { sanitizeUserOutput } from "./sanitize";
import { getEnv } from "./env";
import type { SalesFetchStatus } from "./sales-analytics";

export interface QuickAnswerResult {
  answer: string;
  intent: IntentType;
  domainIntent: string;
  crmSummary: Record<string, unknown>;
  brainFiles: string[];
  knowledgeFiles: string[];
  crmEntities: string[];
  crmFetchStatus?: SalesFetchStatus;
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

function buildServerSideCrmAnswer(
  question: string,
  fetchStatus: SalesFetchStatus,
  logReason?: string
): string | null {
  if (fetchStatus === "webhook_error") {
    return "Bitrix24 bilan hozir bog'lanib bo'lmadi. Keyinroq qayta urinib ko'ring.";
  }
  if (fetchStatus === "permission_denied") {
    return "Bitrix24 dan sotuv ma'lumotlarini o'qish uchun ruxsat yetarli emas. Administrator bilan bog'laning.";
  }
  return null;
}

function buildServerSideSalesAnswer(question: string, crmBlock: string, fetchStatus?: SalesFetchStatus): string | null {
  if (fetchStatus === "webhook_error" || fetchStatus === "permission_denied") {
    return buildServerSideCrmAnswer(question, fetchStatus);
  }

  const q = question.toLowerCase();
  const wonMatch = crmBlock.match(/Summasi: ([^\n]+)/);
  const countMatch = crmBlock.match(/Soni: (\d+) ta/);
  const createdMatch = crmBlock.match(/Bugun yaratilgan bitimlar: (\d+) ta/);
  const modifiedMatch = crmBlock.match(/Bugun o'zgartirilgan faol bitimlar: (\d+) ta/);

  if (!wonMatch && fetchStatus === "empty_crm") {
    return "Bitrix24 da hozircha bitimlar mavjud emas.";
  }

  if (/\bnechta.*yaratil/i.test(q) && createdMatch) {
    return `Bugun ${createdMatch[1]} ta yangi bitim yaratilgan.`;
  }

  if (/\bnechta.*yopil/i.test(q) && countMatch) {
    return `Bugun ${countMatch[1]} ta bitim muvaffaqiyatli yopilgan.`;
  }

  if (fetchStatus === "no_filter_match" && countMatch && wonMatch) {
    const count = countMatch[1];
    const sum = wonMatch[1];
    if (count === "0") {
      return `Bugun muvaffaqiyatli yopilgan bitimlar topilmadi (0 ta). Bugun yaratilgan bitimlar: ${createdMatch?.[1] || "0"} ta.`;
    }
    return `Bugun ${count} ta bitim muvaffaqiyatli yopilgan, jami summa ${sum}.`;
  }

  return null;
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
  let crmFetchStatus: SalesFetchStatus | undefined;

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
    const { entities, data, fetchStatus, fetchLogReason } = await fetchCrmForQuick(q);
    crmEntities = entities;
    crmSummary = data.summary as unknown as Record<string, unknown>;
    crmFetchStatus = fetchStatus;
    crmBlock = formatCrmBlockQuick(data, "crm_only");

    const serverAnswer = buildServerSideCrmAnswer(q, fetchStatus || "ok", fetchLogReason)
      ?? buildServerSideSalesAnswer(q, crmBlock, fetchStatus);
    if (serverAnswer && (fetchStatus === "webhook_error" || fetchStatus === "permission_denied")) {
      return {
        answer: sanitizeUserOutput(serverAnswer),
        intent: route.type,
        domainIntent: route.domainIntent,
        crmSummary,
        brainFiles,
        knowledgeFiles,
        crmEntities,
        crmFetchStatus,
      };
    }

    if (!hasCrmData(data) && fetchStatus !== "no_filter_match") {
      return {
        answer: sanitizeUserOutput(
          buildServerSideCrmAnswer(q, fetchStatus || "empty_crm", fetchLogReason)
            || "Bitrix24 da bu savol bo'yicha ma'lumot topilmadi."
        ),
        intent: route.type,
        domainIntent: route.domainIntent,
        crmSummary,
        brainFiles,
        knowledgeFiles,
        crmEntities,
        crmFetchStatus,
      };
    }
  } else {
    const brain = loadBrainForIntent(agent, route.domainIntent, "full");
    brainFiles = brain.files;
    brainText = brain.text;
    const knowledge = loadKnowledgeForIntent(agent, route.domainIntent);
    knowledgeFiles = knowledge.files;
    knowledgeText = knowledge.text;
    const { entities, data, fetchStatus } = await fetchCrmForQuick(q);
    crmEntities = entities;
    crmSummary = data.summary as unknown as Record<string, unknown>;
    crmFetchStatus = fetchStatus;
    crmBlock = formatCrmBlockQuick(data, "hybrid");
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

  return {
    answer: sanitizeUserOutput(raw),
    intent: route.type,
    domainIntent: route.domainIntent,
    crmSummary,
    brainFiles,
    knowledgeFiles,
    crmEntities,
    crmFetchStatus,
  };
}

export type { AgentId };
