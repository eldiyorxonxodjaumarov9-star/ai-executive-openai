/**
 * Finance document-grounded pipeline unit tests (offline).
 * Usage: npx tsx scripts/test-finance-pipeline.ts
 */
import { analyzeFinanceIntent } from "../lib/server/finance/intent";
import { rewriteFinanceQuery } from "../lib/server/finance/query-rewriter";
import { planFinanceCrmTools } from "../lib/server/finance/tool-planner";
import { retrieveFinanceChunks } from "../lib/server/finance/retriever";
import { loadFinanceKnowledgeIndex } from "../lib/server/finance/knowledge-loader";
import { buildFinanceContext } from "../lib/server/finance/context-builder";

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
  assert(analyzeFinanceIntent("Salom").intent === "casual_chat", "Salom → casual_chat");

  const about = analyzeFinanceIntent("Moliya agenti nima qiladi?");
  assert(about.intent === "casual_chat", "Moliya agenti nima qiladi? → casual");

  const today = analyzeFinanceIntent("Bugungi tushum qancha?");
  assert(today.needsCrm, "Bugungi tushum → CRM");
  assert(today.intent === "crm_only" || today.intent === "knowledge_plus_crm", "Bugungi tushum intent");

  const month = analyzeFinanceIntent("Bu oy qancha savdo bo'ldi?");
  assert(month.needsCrm, "Bu oy savdo → CRM");

  const debt = analyzeFinanceIntent("Qarzdorlik holati qanday?");
  assert(debt.needsCrm || debt.needsKnowledge, "Qarzdorlik holati");

  const zero = analyzeFinanceIntent("Summasi 0 bo'lgan bitimlar bormi?");
  assert(zero.needsCrm, "Summasi 0 bitimlar → CRM");

  const hybrid = analyzeFinanceIntent("Moliyaviy qoidalarga ko'ra bugungi holatni bahola.");
  assert(hybrid.needsKnowledge && hybrid.needsCrm, "qoida + holat → knowledge + CRM");
  assert(hybrid.intent === "knowledge_plus_crm", "hybrid intent");

  const knOnly = analyzeFinanceIntent("Moliyaviy nazorat qoidalari qanday?");
  assert(knOnly.intent === "knowledge_only" || knOnly.needsKnowledge, "knowledge-only savol");

  const rw1 = rewriteFinanceQuery("Pul holati qanday?");
  assert(rw1.wasRewritten, "Pul holati rewrite");
  assert(/tushum|bitim|xavf/i.test(rw1.rewritten), "Pul holati rewrite mazmuni");

  const rw2 = rewriteFinanceQuery("Qarzdorlik bormi?");
  assert(rw2.wasRewritten, "Qarzdorlik rewrite");
  assert(/vazifa|qarz/i.test(rw2.rewritten), "Qarzdorlik rewrite mazmuni");

  const plan = planFinanceCrmTools(rw1.rewritten);
  assert(plan.tools.includes("deals"), "tool plan: deals");

  const debtPlan = planFinanceCrmTools(rw2.rewritten);
  assert(debtPlan.tools.includes("tasks"), "tool plan: tasks for debt");

  const index = await loadFinanceKnowledgeIndex(true);
  assert(index.documents.length >= 5, `5 ta hujjat (${index.documents.length})`);
  assert(index.chunks.length > 5, `bo'laklar (${index.chunks.length})`);

  const hits = await retrieveFinanceChunks("debitorlik nazorati va pul oqimi", { topK: 5 });
  assert(hits.hits.length > 0, "retrieval mos bo'lak topadi");
  assert(hits.hits.length <= 5, "to'liq dump emas");

  const emptyCrm = buildFinanceContext({
    intent: "crm_only",
    originalQuestion: "Bugungi tushum?",
    rewritten: { original: "Bugungi tushum?", rewritten: "Bugungi tushum?", wasRewritten: false },
    crmMissing: true,
  });
  assert(
    emptyCrm.userPrompt.includes("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi"),
    "Bitrix24 bo'sh holat"
  );

  const hybridEmpty = buildFinanceContext({
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
    hybridEmpty.userPrompt.includes("jonli raqamlar topilmadi") ||
      hybridEmpty.systemPrompt.includes("jonli raqamlar topilmadi"),
    "knowledge bor, CRM yo'q holat"
  );

  const sample = index.chunks[0];
  assert(Boolean(sample.meta.fileName && sample.meta.sectionName && sample.meta.topic), "metadata");

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log(`Indexed chunks: ${index.chunks.length}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
