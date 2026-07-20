import { chatCompletion, chatCompletionStream } from "../openai";
import { sanitizeUserOutput } from "../sanitize";
import { appendFreshnessToAnswer } from "../agent-context";
import { getEnv } from "../env";
import type { IntentType } from "../intent-router";
import { analyzeHrIntent } from "./intent";
import type { HrIntent } from "./types";
import { rewriteHrQuery } from "./query-rewriter";
import { retrieveHrChunks } from "./retriever";
import { planHrCrmTools } from "./tool-planner";
import { fetchHrCrmData } from "./crm-fetcher";
import { buildHrContext } from "./context-builder";

export interface HrAnswerOptions {
  bypassCache?: boolean;
  conversationId?: string;
}

export interface HrAnswerResult {
  answer: string;
  intent: IntentType;
  hrIntent: HrIntent;
  domainIntent: string;
  crmSummary: Record<string, unknown>;
  brainFiles: string[];
  knowledgeFiles: string[];
  crmEntities: string[];
  dataFreshness?: { fetchedAt: string; cached: boolean };
  mode: "hr_v1";
  executionMs: number;
  rewrittenInternally: boolean;
}

function mapIntentToLegacy(intent: HrIntent): IntentType {
  switch (intent) {
    case "casual_chat":
      return "casual_chat";
    case "knowledge_only":
      return "knowledge_question";
    case "crm_only":
      return "crm_question";
    case "knowledge_plus_crm":
      return "hybrid_question";
  }
}

export async function runHrAnswer(
  question: string,
  _options: HrAnswerOptions = {}
): Promise<HrAnswerResult> {
  const started = Date.now();
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const intentInfo = analyzeHrIntent(q);
  const rewritten = rewriteHrQuery(q);
  const analysisQuery = rewritten.rewritten;

  let knowledge;
  if (intentInfo.needsKnowledge) {
    knowledge = await retrieveHrChunks(analysisQuery, { topK: 5 });
  } else {
    console.log(`\n[HR Knowledge]`);
    console.log(`Query:\n${q}`);
    console.log(`Matched files:\n- (intent knowledge chaqirmadi)`);
    console.log(`Candidate chunks:\n0`);
    console.log(`Selected chunks:\n0`);
    console.log(`Scores:\n0`);
    console.log(`Promptga kiritildi:\nYO'Q\n`);
  }

  let crm;
  let crmMissing = false;
  let toolPlan;
  if (intentInfo.needsCrm) {
    toolPlan = planHrCrmTools(analysisQuery);
    try {
      crm = await fetchHrCrmData(toolPlan.tools, toolPlan.focus);
      crmMissing = crm.empty;
    } catch {
      crmMissing = true;
    }
  }

  if (intentInfo.intent === "crm_only" && crmMissing) {
    return {
      answer: sanitizeUserOutput("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi."),
      intent: mapIntentToLegacy(intentInfo.intent),
      hrIntent: intentInfo.intent,
      domainIntent: "hr_crm",
      crmSummary: { empty: true },
      brainFiles: [],
      knowledgeFiles: [],
      crmEntities: toolPlan?.tools || [],
      mode: "hr_v1",
      executionMs: Date.now() - started,
      rewrittenInternally: rewritten.wasRewritten,
    };
  }

  const built = buildHrContext({
    intent: intentInfo.intent,
    originalQuestion: q,
    rewritten,
    knowledge,
    crm,
    toolPlan,
    crmMissing,
  });

  if (knowledge) {
    console.log(`Promptga kiritildi:\n${built.knowledgeInPrompt ? "HA" : "YO'Q"}`);
  }

  const { quickMaxTokens } = getEnv();
  const raw = await chatCompletion(built.systemPrompt, built.userPrompt, quickMaxTokens);
  let answer = sanitizeUserOutput(raw);

  if (intentInfo.needsCrm && crm && !crmMissing) {
    answer = appendFreshnessToAnswer(answer, crm.fetchedAt);
  }

  return {
    answer,
    intent: mapIntentToLegacy(intentInfo.intent),
    hrIntent: intentInfo.intent,
    domainIntent: "hr_document_crm",
    crmSummary: {
      hrIntent: intentInfo.intent,
      tools: toolPlan?.tools || [],
      focus: toolPlan?.focus || [],
      counts: crm?.counts,
      knowledgeChunks: knowledge?.usedChunkIds.length || 0,
      knowledgeUsed: knowledge?.knowledgeUsed ?? false,
      rewritten: rewritten.wasRewritten,
      knowledgeInPrompt: built.knowledgeInPrompt,
    },
    brainFiles: [],
    knowledgeFiles: built.knowledgeFiles,
    crmEntities: built.crmEntities,
    dataFreshness: crm ? { fetchedAt: crm.fetchedAt, cached: false } : undefined,
    mode: "hr_v1",
    executionMs: Date.now() - started,
    rewrittenInternally: rewritten.wasRewritten,
  };
}

export async function* runHrAnswerStream(
  question: string,
  options: HrAnswerOptions = {}
): AsyncGenerator<
  | { type: "status"; message: string; phase: "bitrix" | "reasoning" | "generating" }
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; mode: "hr_v1" },
  void,
  unknown
> {
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const intentInfo = analyzeHrIntent(q);
  const rewritten = rewriteHrQuery(q);
  const analysisQuery = rewritten.rewritten;

  yield { type: "status", message: "HR savoli tahlil qilinmoqda...", phase: "reasoning" };

  let knowledge;
  if (intentInfo.needsKnowledge) {
    knowledge = await retrieveHrChunks(analysisQuery, { topK: 5 });
  }

  let crm;
  let crmMissing = false;
  let toolPlan;
  if (intentInfo.needsCrm) {
    yield { type: "status", message: "Bitrix24 HR ma'lumotlari yuklanmoqda...", phase: "bitrix" };
    toolPlan = planHrCrmTools(analysisQuery);
    try {
      crm = await fetchHrCrmData(toolPlan.tools, toolPlan.focus);
      crmMissing = crm.empty;
    } catch {
      crmMissing = true;
    }
  }

  if (intentInfo.intent === "crm_only" && crmMissing) {
    const answer = sanitizeUserOutput("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi.");
    yield { type: "delta", text: answer };
    yield { type: "done", answer, mode: "hr_v1" };
    return;
  }

  const built = buildHrContext({
    intent: intentInfo.intent,
    originalQuestion: q,
    rewritten,
    knowledge,
    crm,
    toolPlan,
    crmMissing,
  });

  const { quickMaxTokens } = getEnv();
  yield { type: "status", message: "HR javobi generatsiya qilinmoqda...", phase: "generating" };

  let raw = "";
  for await (const chunk of chatCompletionStream(built.systemPrompt, built.userPrompt, quickMaxTokens)) {
    raw += chunk;
    yield { type: "delta", text: chunk };
  }

  let answer = sanitizeUserOutput(raw);
  if (intentInfo.needsCrm && crm && !crmMissing) {
    answer = appendFreshnessToAnswer(answer, crm.fetchedAt);
  }
  yield { type: "done", answer, mode: "hr_v1" };
}
