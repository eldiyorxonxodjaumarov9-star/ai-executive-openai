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
import { runCeoAnswer, runCeoAnswerStream } from "./ceo/pipeline";
import { runFinanceAnswer, runFinanceAnswerStream } from "./finance/pipeline";
import { runSalesAnswer, runSalesAnswerStream } from "./sales/pipeline";
import {
  runCustomerSuccessAnswer,
  runCustomerSuccessAnswerStream,
} from "./customer-success/pipeline";
import { runExecutivePipeline } from "./executive-pipeline";
import { analyzeRouteIntent, type IntentType } from "./intent-router";
import { loadKnowledgeForIntent } from "./knowledge-router";
import { chatCompletion, chatCompletionStream } from "./openai";
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
  mode?:
    | "quick_answer"
    | "executive_v2"
    | "ceo_v1"
    | "finance_v1"
    | "sales_v1"
    | "customer_success_v1";
  executionMs?: number;
}

function hasExecutiveData(exec: Awaited<ReturnType<typeof runExecutivePipeline>>): boolean {
  const loaded = exec.orchestration.context.loaded;
  return loaded.deals.length + loaded.leads.length + loaded.contacts.length + loaded.tasks.length > 0;
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

  // CEO agent: independent document-grounded + Bitrix24 pipeline
  if (agent === "ceo") {
    const ceo = await runCeoAnswer(q, options);
    return {
      answer: ceo.answer,
      intent: ceo.intent,
      domainIntent: ceo.domainIntent,
      crmSummary: ceo.crmSummary,
      brainFiles: ceo.brainFiles,
      knowledgeFiles: ceo.knowledgeFiles,
      crmEntities: ceo.crmEntities,
      dataFreshness: ceo.dataFreshness,
      mode: ceo.mode,
      executionMs: ceo.executionMs,
    };
  }

  // Finance agent: independent document-grounded + Bitrix24 pipeline
  if (agent === "finance") {
    const finance = await runFinanceAnswer(q, options);
    return {
      answer: finance.answer,
      intent: finance.intent,
      domainIntent: finance.domainIntent,
      crmSummary: finance.crmSummary,
      brainFiles: finance.brainFiles,
      knowledgeFiles: finance.knowledgeFiles,
      crmEntities: finance.crmEntities,
      dataFreshness: finance.dataFreshness,
      mode: finance.mode,
      executionMs: finance.executionMs,
    };
  }

  // Sales agent: independent document-grounded + Bitrix24 pipeline
  if (agent === "sales") {
    const sales = await runSalesAnswer(q, options);
    return {
      answer: sales.answer,
      intent: sales.intent,
      domainIntent: sales.domainIntent,
      crmSummary: sales.crmSummary,
      brainFiles: sales.brainFiles,
      knowledgeFiles: sales.knowledgeFiles,
      crmEntities: sales.crmEntities,
      dataFreshness: sales.dataFreshness,
      mode: sales.mode,
      executionMs: sales.executionMs,
    };
  }

  // Customer Success agent: independent document-grounded + Bitrix24 pipeline
  if (agent === "customer_success") {
    const cs = await runCustomerSuccessAnswer(q, options);
    return {
      answer: cs.answer,
      intent: cs.intent,
      domainIntent: cs.domainIntent,
      crmSummary: cs.crmSummary,
      brainFiles: cs.brainFiles,
      knowledgeFiles: cs.knowledgeFiles,
      crmEntities: cs.crmEntities,
      dataFreshness: cs.dataFreshness,
      mode: cs.mode,
      executionMs: cs.executionMs,
    };
  }

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

    const exec = await runExecutivePipeline(agent, q, {
      bypassCache: options.bypassCache,
      conversationId: options.conversationId,
    });

    crmEntities = exec.orchestration.plan.entities;
    crmFetchStatus = exec.fetchStatus;
    fetchedAt = exec.fetchedAt;
    cached = exec.cached;
    crmSummary = {
      entities: exec.orchestration.context.loaded.entitiesFetched,
      kpis: exec.orchestration.context.kpis,
      risks: exec.orchestration.context.risks.length,
      recommendations: exec.orchestration.context.recommendations.length,
      executionMs: exec.orchestration.totalDurationMs,
    };
    crmBlock = exec.contextBlock + exec.memoryBlock;
    if (exec.executiveReport) {
      crmBlock += `\n\n=== EXECUTIVE REPORT (markdown) ===\n${exec.executiveReport}`;
    }

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

    if (!hasExecutiveData(exec) && crmFetchStatus === "empty_crm") {
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
    mode: route.type === "crm_question" || route.type === "hybrid_question" ? "executive_v2" : "quick_answer",
    executionMs:
      route.type === "crm_question" || route.type === "hybrid_question"
        ? (crmSummary.executionMs as number | undefined)
        : undefined,
  };
}

export type { AgentId };

export type StreamEvent =
  | { type: "status"; message: string; phase: "bitrix" | "reasoning" | "generating" }
  | { type: "delta"; text: string }
  | {
      type: "done";
      answer: string;
      mode:
        | "quick_answer"
        | "executive_v2"
        | "ceo_v1"
        | "finance_v1"
        | "sales_v1"
        | "customer_success_v1";
    };

export async function* runQuickAnswerStream(
  agentName: string,
  question: string,
  options: QuickAnswerOptions = {}
): AsyncGenerator<StreamEvent, void, unknown> {
  const agent = normalizeAgent(agentName);
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  if (agent === "ceo") {
    for await (const event of runCeoAnswerStream(q, options)) {
      yield event;
    }
    return;
  }

  if (agent === "finance") {
    for await (const event of runFinanceAnswerStream(q, options)) {
      yield event;
    }
    return;
  }

  if (agent === "sales") {
    for await (const event of runSalesAnswerStream(q, options)) {
      yield event;
    }
    return;
  }

  if (agent === "customer_success") {
    for await (const event of runCustomerSuccessAnswerStream(q, options)) {
      yield event;
    }
    return;
  }

  const route = analyzeRouteIntent(q);
  const systemPrompt = buildSystemPrompt(agent, route.type);

  let brainText = "";
  let knowledgeText = "";
  let crmBlock = "";
  let fetchedAt: string | undefined;

  if (route.type === "casual_chat") {
    brainText = loadBrainForIntent(agent, route.domainIntent, "casual").text;
  } else if (route.type === "knowledge_question") {
    brainText = loadBrainForIntent(agent, route.domainIntent, "full").text;
    knowledgeText = loadKnowledgeForIntent(agent, route.domainIntent).text;
  } else if (route.type === "crm_question" || route.type === "hybrid_question") {
    if (route.type === "hybrid_question") {
      brainText = loadBrainForIntent(agent, route.domainIntent, "full").text;
      knowledgeText = loadKnowledgeForIntent(agent, route.domainIntent).text;
    }
    yield { type: "status", message: "Bitrix24 ma'lumotlari yangilanmoqda...", phase: "bitrix" };
    const exec = await runExecutivePipeline(agent, q, {
      bypassCache: options.bypassCache,
      conversationId: options.conversationId,
    });
    fetchedAt = exec.fetchedAt;
    crmBlock = exec.contextBlock + exec.memoryBlock;
    if (exec.executiveReport) crmBlock += `\n\n=== EXECUTIVE REPORT ===\n${exec.executiveReport}`;
    yield { type: "status", message: "Tahlil va reasoning bajarilmoqda...", phase: "reasoning" };
  }

  const userPrompt = buildUserPrompt(route.type, q, brainText, knowledgeText, crmBlock);
  const { quickMaxTokens } = getEnv();
  yield { type: "status", message: "Javob generatsiya qilinmoqda...", phase: "generating" };

  let raw = "";
  for await (const chunk of chatCompletionStream(systemPrompt, userPrompt, quickMaxTokens)) {
    raw += chunk;
    yield { type: "delta", text: chunk };
  }

  let answer = sanitizeUserOutput(raw);
  if ((route.type === "crm_question" || route.type === "hybrid_question") && fetchedAt) {
    answer = appendFreshnessToAnswer(answer, fetchedAt);
  }

  yield {
    type: "done",
    answer,
    mode: route.type === "crm_question" || route.type === "hybrid_question" ? "executive_v2" : "quick_answer",
  };
}
