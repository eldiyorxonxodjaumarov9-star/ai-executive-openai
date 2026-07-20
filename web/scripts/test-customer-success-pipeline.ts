/**
 * Customer Success document-grounded pipeline unit tests (offline).
 * Usage: npx tsx scripts/test-customer-success-pipeline.ts
 */
import { analyzeCustomerSuccessIntent } from "../lib/server/customer-success/intent";
import { rewriteCustomerSuccessQuery } from "../lib/server/customer-success/query-rewriter";
import { planCustomerSuccessCrmTools } from "../lib/server/customer-success/tool-planner";
import { retrieveCustomerSuccessChunks } from "../lib/server/customer-success/retriever";
import { loadCustomerSuccessKnowledgeIndex } from "../lib/server/customer-success/knowledge-loader";
import { buildCustomerSuccessContext } from "../lib/server/customer-success/context-builder";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1;
    console.log(`✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`✗ ${msg}`);
  }
}

async function main() {
  assert(analyzeCustomerSuccessIntent("Salom").intent === "casual_chat", "Salom → casual");
  assert(
    analyzeCustomerSuccessIntent("Mijozlar agenti nima qiladi?").intent === "casual_chat",
    "agent haqida → casual"
  );

  const retention = analyzeCustomerSuccessIntent("Mijozlarni ushlab qolish qanday?");
  assert(retention.needsKnowledge && !retention.needsCrm, "ushlab qolish → knowledge-only");

  assert(analyzeCustomerSuccessIntent("Riskdagi mijozlar bormi?").needsCrm, "risk → CRM");
  assert(analyzeCustomerSuccessIntent("Oxirgi activity qachon bo'lgan?").needsCrm, "activity → CRM");
  assert(
    analyzeCustomerSuccessIntent("Qaysi mijozlar bilan uzoq vaqt aloqa qilinmagan?").needsCrm,
    "aloqasiz → CRM"
  );

  const hybrid = analyzeCustomerSuccessIntent("Customer Success qoidalariga ko'ra holatni bahola.");
  assert(hybrid.needsKnowledge && hybrid.needsCrm, "qoida + holat → hybrid");
  assert(hybrid.intent === "knowledge_plus_crm", "hybrid intent");

  const kn = analyzeCustomerSuccessIntent("Onboarding va SLA qoidalari qanday?");
  assert(kn.intent === "knowledge_only" || kn.needsKnowledge, "knowledge-only savol");

  const rw1 = rewriteCustomerSuccessQuery("Mijozlar holati qanday?");
  assert(rw1.wasRewritten && /faol|risk|activity/i.test(rw1.rewritten), "holat rewrite");

  const rw2 = rewriteCustomerSuccessQuery("Mijozlarni yo'qotyapmizmi?");
  assert(rw2.wasRewritten && /churn|faol bo'lmagan/i.test(rw2.rewritten), "churn rewrite");

  const rw3 = rewriteCustomerSuccessQuery("Mijozlar bilan ishlash qanday?");
  assert(rw3.wasRewritten && /standart/i.test(rw3.rewritten), "ishlash rewrite");

  assert(planCustomerSuccessCrmTools(rw1.rewritten).tools.includes("contacts"), "tools: contacts");
  assert(planCustomerSuccessCrmTools(rw1.rewritten).tools.includes("activities"), "tools: activities");
  assert(
    planCustomerSuccessCrmTools("Uzoq vaqt aloqa qilinmagan mijozlar").tools.includes("contacts"),
    "tools: contacts (aloqa)"
  );

  const index = await loadCustomerSuccessKnowledgeIndex(true);
  assert(index.documents.length >= 5, `5 ta hujjat (${index.documents.length})`);
  assert(index.chunks.length > 5, `bo'laklar (${index.chunks.length})`);

  const hits = await retrieveCustomerSuccessChunks("mijozlarni ushlab qolish va retention KPI", {
    topK: 5,
  });
  assert(hits.hits.length > 0, "retrieval ishlaydi");
  assert(hits.diagnostics.usedChunksJson, "chunks.json ishlatildi");
  assert(hits.hits.length <= 5, "to'liq dump emas");

  const emptyCrm = buildCustomerSuccessContext({
    intent: "crm_only",
    originalQuestion: "Riskdagi mijozlar?",
    rewritten: {
      original: "Riskdagi mijozlar?",
      rewritten: "Riskdagi mijozlar?",
      wasRewritten: false,
    },
    crmMissing: true,
  });
  assert(
    emptyCrm.userPrompt.includes("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi"),
    "Bitrix24 bo'sh holat"
  );

  const crmOnly = analyzeCustomerSuccessIntent("Oxirgi activity qachon bo'lgan?");
  assert(crmOnly.intent === "crm_only" || crmOnly.needsCrm, "crm-only savol");

  const hybridEmpty = buildCustomerSuccessContext({
    intent: "knowledge_plus_crm",
    originalQuestion: "Qoidalarga ko'ra bahola",
    rewritten: {
      original: "Qoidalarga ko'ra bahola",
      rewritten: "Qoidalarga ko'ra bahola",
      wasRewritten: false,
    },
    knowledge: hits,
    crmMissing: true,
  });
  assert(
    hybridEmpty.userPrompt.includes("jonli ma'lumot topilmadi") ||
      hybridEmpty.systemPrompt.includes("jonli ma'lumot topilmadi") ||
      hybridEmpty.systemPrompt.includes("Customer Success qo'llanmasi"),
    "knowledge + CRM yo'q"
  );

  assert(Boolean(index.chunks[0]?.meta.fileName && index.chunks[0]?.meta.topic), "metadata");

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log(`Indexed docs: ${index.documents.length}, chunks: ${index.chunks.length}`);
  console.log(`Retrieval files: ${hits.matchedFiles.join(", ")}`);
  console.log(`Average score: ${hits.averageSimilarity}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
