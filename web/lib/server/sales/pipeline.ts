import { chatCompletion, chatCompletionStream } from "../openai";
import { sanitizeUserOutput } from "../sanitize";
import { appendFreshnessToAnswer } from "../agent-context";
import { getEnv } from "../env";
import type { IntentType } from "../intent-router";
import { analyzeSalesIntent, type SalesIntent } from "./intent";
import { rewriteSalesQuery } from "./query-rewriter";
import { retrieveSalesChunks } from "./retriever";
import { planSalesCrmTools } from "./tool-planner";
import { fetchSalesCrmData } from "./crm-fetcher";
import { buildSalesContext } from "./context-builder";

export interface SalesAnswerOptions {
  bypassCache?: boolean;
  conversationId?: string;
}

export interface SalesAnswerResult {
  answer: string;
  intent: IntentType;
  salesIntent: SalesIntent;
  domainIntent: string;
  crmSummary: Record<string, unknown>;
  brainFiles: string[];
  knowledgeFiles: string[];
  crmEntities: string[];
  dataFreshness?: { fetchedAt: string; cached: boolean };
  mode: "sales_v1";
  executionMs: number;
  rewrittenInternally: boolean;
}

function mapSalesIntentToLegacy(intent: SalesIntent): IntentType {
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

export async function runSalesAnswer(
  question: string,
  _options: SalesAnswerOptions = {}
): Promise<SalesAnswerResult> {
  const started = Date.now();
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const intentInfo = analyzeSalesIntent(q);
  const rewritten = rewriteSalesQuery(q);
  const analysisQuery = rewritten.rewritten;

  let knowledge;
  if (intentInfo.needsKnowledge) {
    knowledge = await retrieveSalesChunks(analysisQuery, { topK: 6 });
  } else {
    console.log(`\n[Knowledge]`);
    console.log(`Agent: sales`);
    console.log(`Used chunks.json: YO'Q`);
    console.log(`Sabab: intent knowledge chaqirmadi (${intentInfo.intent})`);
    console.log(`Chunks:\n0`);
    console.log(`Promptga kiritildi:\nYO'Q\n`);
  }

  let crm;
  let crmMissing = false;
  let toolPlan;
  if (intentInfo.needsCrm) {
    toolPlan = planSalesCrmTools(analysisQuery);
    try {
      crm = await fetchSalesCrmData(toolPlan.tools, toolPlan.focus);
      crmMissing = crm.empty;
    } catch {
      crmMissing = true;
    }
  }

  if (intentInfo.intent === "crm_only" && crmMissing) {
    return {
      answer: sanitizeUserOutput("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi."),
      intent: mapSalesIntentToLegacy(intentInfo.intent),
      salesIntent: intentInfo.intent,
      domainIntent: "sales_crm",
      crmSummary: { empty: true },
      brainFiles: [],
      knowledgeFiles: [],
      crmEntities: toolPlan?.tools || [],
      mode: "sales_v1",
      executionMs: Date.now() - started,
      rewrittenInternally: rewritten.wasRewritten,
    };
  }

  const built = buildSalesContext({
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
    intent: mapSalesIntentToLegacy(intentInfo.intent),
    salesIntent: intentInfo.intent,
    domainIntent: "sales_document_crm",
    crmSummary: {
      salesIntent: intentInfo.intent,
      tools: toolPlan?.tools || [],
      focus: toolPlan?.focus || [],
      counts: crm?.counts,
      knowledgeChunks: knowledge?.usedChunkIds.length || 0,
      rewritten: rewritten.wasRewritten,
      knowledgeInPrompt: built.knowledgeInPrompt,
    },
    brainFiles: [],
    knowledgeFiles: built.knowledgeFiles,
    crmEntities: built.crmEntities,
    dataFreshness: crm ? { fetchedAt: crm.fetchedAt, cached: false } : undefined,
    mode: "sales_v1",
    executionMs: Date.now() - started,
    rewrittenInternally: rewritten.wasRewritten,
  };
}

export async function* runSalesAnswerStream(
  question: string,
  options: SalesAnswerOptions = {}
): AsyncGenerator<
  | { type: "status"; message: string; phase: "bitrix" | "reasoning" | "generating" }
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; mode: "sales_v1" },
  void,
  unknown
> {
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const intentInfo = analyzeSalesIntent(q);
  const rewritten = rewriteSalesQuery(q);
  const analysisQuery = rewritten.rewritten;

  yield { type: "status", message: "Savdo savoli tahlil qilinmoqda...", phase: "reasoning" };

  let knowledge;
  if (intentInfo.needsKnowledge) {
    knowledge = await retrieveSalesChunks(analysisQuery, { topK: 6 });
  }

  let crm;
  let crmMissing = false;
  let toolPlan;
  if (intentInfo.needsCrm) {
    yield { type: "status", message: "Bitrix24 savdo ma'lumotlari yuklanmoqda...", phase: "bitrix" };
    toolPlan = planSalesCrmTools(analysisQuery);
    try {
      crm = await fetchSalesCrmData(toolPlan.tools, toolPlan.focus);
      crmMissing = crm.empty;
    } catch {
      crmMissing = true;
    }
  }

  if (intentInfo.intent === "crm_only" && crmMissing) {
    const answer = sanitizeUserOutput("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi.");
    yield { type: "delta", text: answer };
    yield { type: "done", answer, mode: "sales_v1" };
    return;
  }

  const built = buildSalesContext({
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
  yield { type: "status", message: "Savdo javobi generatsiya qilinmoqda...", phase: "generating" };

  let raw = "";
  for await (const chunk of chatCompletionStream(built.systemPrompt, built.userPrompt, quickMaxTokens)) {
    raw += chunk;
    yield { type: "delta", text: chunk };
  }

  let answer = sanitizeUserOutput(raw);
  if (intentInfo.needsCrm && crm && !crmMissing) {
    answer = appendFreshnessToAnswer(answer, crm.fetchedAt);
  }
  yield { type: "done", answer, mode: "sales_v1" };
}
