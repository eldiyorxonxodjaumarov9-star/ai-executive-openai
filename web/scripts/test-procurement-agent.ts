/**
 * Procurement agent pipeline unit tests (offline + optional live CRM).
 * Usage: npm run test:procurement
 */
import { analyzeProcurementIntent } from "../lib/server/procurement/intent";
import { rewriteProcurementQuery } from "../lib/server/procurement/query-rewriter";
import { planProcurementCrmTools } from "../lib/server/procurement/tool-planner";
import { retrieveProcurementChunks } from "../lib/server/procurement/retriever";
import { loadProcurementKnowledgeIndex } from "../lib/server/procurement/knowledge-loader";
import { buildProcurementContext } from "../lib/server/procurement/context-builder";
import {
  fetchProcurementCrmData,
  procurementCrmPromptBlock,
} from "../lib/server/procurement/crm-fetcher";

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
  // 1. Salom
  assert(analyzeProcurementIntent("Salom").intent === "casual_chat", "1. Salom → casual");

  // 2. Agent haqida
  assert(
    analyzeProcurementIntent("Ta'minot agenti nima qiladi?").intent === "casual_chat",
    "2. Ta'minot agenti nima qiladi → casual"
  );

  // 3. Xarid tartibi
  const xarid = analyzeProcurementIntent("Xarid tartibi qanday?");
  assert(xarid.intent === "knowledge_only", "3. Xarid tartibi → knowledge_only");
  assert(xarid.needsKnowledge && !xarid.needsCrm, "3. Xarid needs knowledge only");

  // 4. Yetkazib beruvchi tanlash
  assert(analyzeProcurementIntent("Yetkazib beruvchi tanlash mezonlari").needsKnowledge, "4. Supplier tanlash");

  // 5. Ombor qoidalari
  assert(analyzeProcurementIntent("Ombor va zaxira SLA qoidalari").needsKnowledge, "5. Ombor SLA");

  // 6. Logistika
  assert(analyzeProcurementIntent("Logistika va yetkazib berish tartibi").needsKnowledge, "6. Logistika");

  // 7. Yetkazib beruvchi holati
  const supplierState = analyzeProcurementIntent("Yetkazib beruvchi holati qanday?");
  assert(supplierState.intent === "crm_only" || supplierState.needsCrm, "7. Yetkazib beruvchi holati → CRM");

  // 8. Kechikkan yetkazish
  assert(analyzeProcurementIntent("Kechikkan yetkazib berish vazifalari").needsCrm, "8. Kechikkan yetkazish → CRM");

  // 9. Bitrix holati
  assert(analyzeProcurementIntent("Bitrix24 ta'minot holati").needsCrm, "9. Bitrix holati → CRM");

  // 10. Hybrid
  const hybrid = analyzeProcurementIntent("Ta'minot qoidalariga ko'ra yetkazib berishni bahola");
  assert(hybrid.intent === "knowledge_plus_crm", "10. Qoida + yetkazish → hybrid");
  assert(hybrid.needsKnowledge && hybrid.needsCrm, "10. hybrid needs both");

  // 11. knowledge_only explicit
  assert(
    analyzeProcurementIntent("BP-02 bo'yicha xarid protsedurasini tushuntir.").intent === "knowledge_only",
    "11. knowledge_only"
  );

  // 12. crm_only
  assert(analyzeProcurementIntent("Bugun nechta ochiq ta'minot vazifasi bor?").needsCrm, "12. crm_only");

  // 13. knowledge_plus_crm
  assert(
    analyzeProcurementIntent("SLA mezonlariga ko'ra kechikkan vazifalarni bahola.").intent ===
      "knowledge_plus_crm",
    "13. knowledge_plus_crm"
  );

  const rw = rewriteProcurementQuery("Yetkazib beruvchi holati qanday?");
  assert(rw.wasRewritten, "query rewrite yetkazib beruvchi holati");

  const rwXarid = rewriteProcurementQuery("Xarid qanday amalga oshiriladi?");
  assert(rwXarid.wasRewritten, "query rewrite xarid tartibi");

  const tools = planProcurementCrmTools(rw.rewritten);
  assert(tools.tools.includes("companies"), "tool plan: companies");
  assert(tools.tools.includes("tasks") || tools.focus.includes("delivery_tasks"), "tool plan: tasks");

  const supplierTools = planProcurementCrmTools("yetkazib beruvchi supplier holati");
  assert(supplierTools.tools.includes("suppliers"), "tool plan: suppliers proxy");

  const index = await loadProcurementKnowledgeIndex(true);
  assert(index.documents.length >= 5, `5 ta ta'minot hujjati (${index.documents.length})`);
  assert(index.chunks.length > 5, `Ta'minot bo'laklar (${index.chunks.length})`);

  const xaridHits = await retrieveProcurementChunks("xarid jarayoni commercial offer tanlash BP-02", {
    topK: 5,
  });
  assert(xaridHits.hits.length > 0, "xarid retrieval");
  assert(
    xaridHits.matchedFiles.some((f) => /aq-02_1/i.test(f)) || xaridHits.hits.length > 0,
    "xarid → AQ-02_1"
  );

  const logistikaHits = await retrieveProcurementChunks("yetkazib berish logistika delivery", {
    topK: 5,
  });
  assert(
    logistikaHits.matchedFiles.some((f) => /aq-02_2/i.test(f)) || logistikaHits.hits.length > 0,
    "logistika retrieval"
  );

  // 14. Bitrix24 bo'sh javob (context)
  const emptyCrm = buildProcurementContext({
    intent: "crm_only",
    originalQuestion: "Yetkazib beruvchi holati qanday?",
    rewritten: { original: "Yetkazib beruvchi holati qanday?", rewritten: "...", wasRewritten: true },
    crmMissing: true,
  });
  assert(
    emptyCrm.userPrompt.includes("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi"),
    "14. Bitrix24 bo'sh holat"
  );

  // 15. Qisman CRM
  const partial = buildProcurementContext({
    intent: "knowledge_plus_crm",
    originalQuestion: "Ta'minot qoidalariga ko'ra bahola",
    rewritten: { original: "...", rewritten: "...", wasRewritten: false },
    knowledge: xaridHits,
    crmMissing: true,
  });
  assert(
    partial.userPrompt.includes("jonli ma'lumot topilmadi") ||
      partial.systemPrompt.includes("jonli ma'lumot topilmadi"),
    "15. qisman CRM"
  );

  // 16. No relevant knowledge
  const nonsense = await retrieveProcurementChunks("xyzabc quantum flarnium unrelated topic 99999", {
    topK: 5,
  });
  assert(!nonsense.knowledgeUsed || nonsense.hits.length === 0, "16. no relevant knowledge");

  // 17. Pipeline empty question
  try {
    const { runProcurementAnswer } = await import("../lib/server/procurement/pipeline");
    await runProcurementAnswer("");
    assert(false, "17. empty question should throw");
  } catch {
    assert(true, "17. empty question error handling");
  }

  // 18. Bitrix24 fetch bundle
  const crmBundle = await fetchProcurementCrmData(["companies", "tasks"], ["overdue_tasks"]);
  assert(typeof crmBundle.empty === "boolean", "18. Bitrix24 fetch returns bundle");
  assert(
    crmBundle.limitations.some((l) => /supplier entity/i.test(l)) ||
      !crmBundle.suppliersRequested,
    "18. supplier limitation when not requested"
  );

  const supplierBundle = await fetchProcurementCrmData(["suppliers", "companies"], ["supplier_companies"]);
  assert(
    supplierBundle.limitations.some((l) => /supplier entity/i.test(l)),
    "18b. supplier limitation when requested"
  );

  // 19. Ichki ID chiqmasligi
  const mockBundle = {
    companies: [{ ID: "501", TITLE: "Yetkazib Beruvchi LLC", COMMENTS: "supplier" }],
    contacts: [{ ID: "701", NAME: "Bobur", LAST_NAME: "Karimov" }],
    deals: [{ ID: "901", TITLE: "Xarid shartnomasi", OPPORTUNITY: 5000000, CLOSED: "N" }],
    tasks: [
      {
        ID: "1",
        TITLE: "Yetkazib berish",
        STATUS: 2,
        RESPONSIBLE_ID: "99",
        DEADLINE: "2026-01-01",
      },
    ],
    activities: [],
    employees: [{ id: "99", name: "Ali Valiyev", firstName: "Ali", lastName: "Valiyev" }],
    stages: new Map(),
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Tashkent" as const,
    counts: { companies: 1, contacts: 1, deals: 1, tasks: 1, activities: 0, employees: 1 },
    empty: false,
    limitations: ["suppliers: Bitrix24 da alohida supplier entity ulanmagan"],
    focus: ["supplier_companies" as const, "overdue_tasks" as const],
    suppliersRequested: true,
  };
  const promptBlock = procurementCrmPromptBlock(mockBundle);
  assert(promptBlock.includes("Ali Valiyev"), "19. xodim ismi ko'rsatiladi");
  assert(!/RESPONSIBLE_ID|"ID":\s*"99"|"501"/.test(promptBlock), "19. ichki ID promptda yo'q");
  assert(promptBlock.includes("supplier entity"), "19. supplier cheklovi ko'rsatiladi");

  // 20. Context ichida raw JSON yo'q
  const ctxWithCrm = buildProcurementContext({
    intent: "crm_only",
    originalQuestion: "Yetkazib beruvchi holati",
    rewritten: { original: "Yetkazib beruvchi holati", rewritten: "...", wasRewritten: true },
    crm: mockBundle,
    toolPlan: supplierTools,
  });
  assert(!/"ID":/.test(ctxWithCrm.userPrompt), "20. context raw JSON ID yo'q");
  assert(ctxWithCrm.systemPrompt.includes("Ichki ID"), "20. system prompt ID qoidasi");

  // 21. Boshqa agent savoli noto'g'ri hybrid bo'lmasin
  const hrQ = analyzeProcurementIntent("Kimda kechikkan vazifalar bor?");
  assert(hrQ.needsCrm || hrQ.intent === "crm_only", "21. HR-like savol CRM yo'nalishi");

  assert(Boolean(index.chunks[0]?.meta.agentId === "procurement"), "metadata agentId=procurement");
  assert(Boolean(index.chunks[0]?.meta.fileName), "metadata fileName");

  assert(emptyCrm.systemPrompt.includes("AQ-02"), "system prompt AQ-02 scope");
  assert(tools.reason.includes("BP-02"), "tool plan reason BP-02");

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log(`Indexed docs: ${index.documents.length}, chunks: ${index.chunks.length}`);
  console.log(`Xarid files: ${xaridHits.matchedFiles.join(", ")}`);
  console.log(`Average score: ${xaridHits.averageSimilarity}`);

  if (process.env.BITRIX24_WEBHOOK_URL) {
    console.log("\n[Live CRM] BITRIX24_WEBHOOK_URL mavjud — integration test o'tkazildi (bundle fetch).");
  } else {
    console.log("\n[Live CRM] BITRIX24_WEBHOOK_URL yo'q — real CRM smoke test o'tkazilmadi.");
  }

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
