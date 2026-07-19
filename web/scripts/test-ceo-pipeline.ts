/**
 * CEO document-grounded pipeline unit tests (offline).
 * Usage: npx tsx scripts/test-ceo-pipeline.ts
 */
import { analyzeCeoIntent } from "../lib/server/ceo/intent";
import { rewriteCeoQuery } from "../lib/server/ceo/query-rewriter";
import { planCeoCrmTools } from "../lib/server/ceo/tool-planner";
import { retrieveCeoChunks } from "../lib/server/ceo/retriever";
import { loadCeoKnowledgeIndex } from "../lib/server/ceo/knowledge-loader";
import { buildCeoContext } from "../lib/server/ceo/context-builder";

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
  // 1) casual
  const casual = analyzeCeoIntent("Salom");
  assert(casual.intent === "casual_chat", "oddiy salom → casual_chat");

  // 2) knowledge-only (architecture)
  const kn = analyzeCeoIntent("Sotuv arxitekturasi qanday ishlaydi?");
  assert(kn.intent === "knowledge_only" || kn.intent === "knowledge_plus_crm", "hujjatga oid savol → knowledge*");
  assert(kn.needsKnowledge, "hujjat savoli knowledge talab qiladi");

  // 3) crm-only
  const crm = analyzeCeoIntent("Bugungi bitimlar soni qancha?");
  assert(crm.intent === "crm_only" || crm.intent === "knowledge_plus_crm", "CRM savoli");
  assert(crm.needsCrm, "CRM savoli crm talab qiladi");

  // 4) hybrid
  const hybrid = analyzeCeoIntent("Sotuv qoidalariga qarab bitimlar holatini tahlil qil");
  assert(
    hybrid.intent === "knowledge_plus_crm" || (hybrid.needsKnowledge && hybrid.needsCrm),
    "hujjat + CRM savoli"
  );

  // 5) vague rewrite
  const rw = rewriteCeoQuery("Savdo qanday?");
  assert(rw.wasRewritten, "noaniq savol qayta yoziladi");
  assert(rw.rewritten.toLowerCase().includes("bitim") || rw.rewritten.toLowerCase().includes("sotuv"), "rewrite mazmuni");
  assert(rw.original === "Savdo qanday?", "original saqlanadi");

  // 6) tool planner selectivity
  const planDeals = planCeoCrmTools("Bugungi yopilgan bitimlar va kechikkan bitimlar");
  assert(planDeals.tools.includes("deals"), "bitimlar tool tanlanadi");
  const planTasks = planCeoCrmTools("Kechikkan vazifalarni ko'rsat");
  assert(planTasks.tools.includes("tasks"), "vazifalar tool tanlanadi");

  // 7) index + retrieval (not full dump)
  const index = await loadCeoKnowledgeIndex(true);
  assert(index.documents.length >= 9, `9 ta hujjat indekslangan (got ${index.documents.length})`);
  assert(index.chunks.length > 9, `bo'laklar yaratilgan (${index.chunks.length})`);

  const hits = await retrieveCeoChunks("sotuv arxitekturasi brokerlar bilan ishlash", { topK: 5 });
  assert(hits.hits.length > 0, "semantic retrieval mos bo'lak topadi");
  assert(hits.hits.length <= 5, "barcha hujjatlar to'liq yuklanmaydi");
  const filesUsed = new Set(hits.hits.map((h) => h.chunk.meta.fileName));
  assert(filesUsed.size < index.documents.length, "faqat mos fayllar/bo'laklar");

  // 8) CRM missing message in context
  const ctx = buildCeoContext({
    intent: "crm_only",
    originalQuestion: "Bugun bitimlar?",
    rewritten: { original: "Bugun bitimlar?", rewritten: "Bugun bitimlar?", wasRewritten: false },
    crmMissing: true,
  });
  assert(
    ctx.userPrompt.includes("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi"),
    "Bitrix24 topilmagan holat matni"
  );

  // metadata present
  const sample = index.chunks[0];
  assert(Boolean(sample.meta.fileName), "metadata: fayl nomi");
  assert(Boolean(sample.meta.sectionName), "metadata: bo'lim");
  assert(sample.meta.pageOrLine >= 1, "metadata: sahifa/qator");
  assert(Boolean(sample.meta.topic), "metadata: mavzu");
  assert(Boolean(sample.meta.documentType), "metadata: hujjat turi");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
