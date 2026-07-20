/**
 * Sales document-grounded pipeline unit tests (offline).
 * Usage: npx tsx scripts/test-sales-pipeline.ts
 */
import { analyzeSalesIntent } from "../lib/server/sales/intent";
import { rewriteSalesQuery } from "../lib/server/sales/query-rewriter";
import { planSalesCrmTools } from "../lib/server/sales/tool-planner";
import { retrieveSalesChunks } from "../lib/server/sales/retriever";
import { loadSalesKnowledgeIndex } from "../lib/server/sales/knowledge-loader";
import { buildSalesContext } from "../lib/server/sales/context-builder";

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
  assert(analyzeSalesIntent("Salom").intent === "casual_chat", "Salom → casual");
  assert(analyzeSalesIntent("Sales agent nima qiladi?").intent === "casual_chat", "agent haqida → casual");

  const processQ = analyzeSalesIntent("Savdo jarayoni qanday bo'lishi kerak?");
  assert(processQ.needsKnowledge && !processQ.needsCrm, "jarayon → knowledge-only");

  assert(analyzeSalesIntent("Bugungi savdo qancha?").needsCrm, "Bugungi savdo → CRM");
  assert(analyzeSalesIntent("Bu oy qancha bitim yopildi?").needsCrm, "Bu oy bitim → CRM");
  assert(analyzeSalesIntent("Qaysi menejer yaxshi ishlayapti?").needsCrm, "menejer → CRM");
  assert(analyzeSalesIntent("Konversiya qancha?").needsCrm, "konversiya → CRM");
  assert(analyzeSalesIntent("Uzoq turib qolgan bitimlar bormi?").needsCrm, "turib qolgan → CRM");
  assert(analyzeSalesIntent("Follow-up qilinmagan mijozlar bormi?").needsCrm, "follow-up → CRM");

  const why = analyzeSalesIntent("Nega savdo tushgan?");
  assert(why.needsCrm, "Nega savdo tushgan → CRM");

  const hybrid = analyzeSalesIntent("Savdo qoidalariga ko'ra bugungi holatni bahola.");
  assert(hybrid.needsKnowledge && hybrid.needsCrm, "qoida + holat → hybrid");
  assert(hybrid.intent === "knowledge_plus_crm", "hybrid intent");

  const kn = analyzeSalesIntent("Lead bilan ishlash qoidalari qanday?");
  assert(kn.intent === "knowledge_only" || kn.needsKnowledge, "knowledge-only savol");

  const rw1 = rewriteSalesQuery("Savdo qanday?");
  assert(rw1.wasRewritten && /lead|bitim|konversiya/i.test(rw1.rewritten), "Savdo qanday rewrite");

  const rw2 = rewriteSalesQuery("Qaysi menejer yaxshi ishlayapti?");
  assert(rw2.wasRewritten && /menejer/i.test(rw2.rewritten), "menejer rewrite");

  const rw3 = rewriteSalesQuery("Nega savdo tushgan?");
  assert(rw3.wasRewritten, "nega savdo rewrite");

  assert(planSalesCrmTools(rw1.rewritten).tools.includes("deals"), "tools: deals");
  assert(planSalesCrmTools(rw2.rewritten).tools.includes("employees"), "tools: employees");
  assert(planSalesCrmTools("Follow-up qilinmagan mijozlar").tools.includes("deals"), "tools: deals");
  assert(!planSalesCrmTools("Follow-up qilinmagan mijozlar").tools.includes("tasks"), "tools: tasks yo'q (BP-01/03)");

  const index = await loadSalesKnowledgeIndex(true);
  assert(
    index.documents.length >= 5,
    `5 ta savdo hujjat (${index.documents.length})`
  );
  assert(index.chunks.length > 5, `bo'laklar (${index.chunks.length})`);

  const hits = await retrieveSalesChunks("savdo jarayoni va konversiya mezonlari", { topK: 5 });
  assert(hits.hits.length > 0, "retrieval ishlaydi");
  assert(hits.diagnostics.usedChunksJson, "chunks.json ishlatildi");
  assert(hits.hits.length <= 5, "to'liq dump emas");
  assert(Boolean(index.chunks[0]?.meta.fileName && index.chunks[0]?.meta.topic), "metadata");

  const hybridEmpty = buildSalesContext({
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
      hybridEmpty.systemPrompt.includes("jonli ma'lumot topilmadi"),
    "knowledge + CRM yo'q"
  );

  const emptyKnowledge = buildSalesContext({
    intent: "knowledge_only",
    originalQuestion: "Qoida?",
    rewritten: { original: "Qoida?", rewritten: "Qoida?", wasRewritten: false },
  });
  assert(
    emptyKnowledge.userPrompt.includes("ichki qo'llanma mavjud emas"),
    "bo'sh knowledge xabari"
  );

  console.log(`Retrieval files: ${hits.matchedFiles.join(", ")}`);
  console.log(`Average score: ${hits.averageSimilarity}`);

  const emptyCrm = buildSalesContext({
    intent: "crm_only",
    originalQuestion: "Bugungi savdo?",
    rewritten: { original: "Bugungi savdo?", rewritten: "Bugungi savdo?", wasRewritten: false },
    crmMissing: true,
  });
  assert(
    emptyCrm.userPrompt.includes("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi"),
    "Bitrix24 bo'sh holat"
  );

  const crmOnly = analyzeSalesIntent("Bugungi savdo qancha?");
  assert(crmOnly.intent === "crm_only" || crmOnly.needsCrm, "crm-only savol");

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log(`Indexed docs: ${index.documents.length}, chunks: ${index.chunks.length}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
