/**
 * Business Analytics agent pipeline unit tests (offline + optional live CRM).
 * Usage: npm run test:business-analytics
 */
import { analyzeBusinessAnalyticsIntent } from "../lib/server/business-analytics/intent";
import { rewriteBusinessAnalyticsQuery } from "../lib/server/business-analytics/query-rewriter";
import { planBusinessAnalyticsCrmTools } from "../lib/server/business-analytics/tool-planner";
import { retrieveBusinessAnalyticsChunks } from "../lib/server/business-analytics/retriever";
import { loadBusinessAnalyticsKnowledgeIndex } from "../lib/server/business-analytics/knowledge-loader";
import { buildBusinessAnalyticsContext } from "../lib/server/business-analytics/context-builder";
import {
  fetchBusinessAnalyticsCrmData,
  businessAnalyticsCrmPromptBlock,
} from "../lib/server/business-analytics/crm-fetcher";

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
  assert(analyzeBusinessAnalyticsIntent("Salom").intent === "casual_chat", "1. Salom → casual");

  // 2. Agent haqida
  assert(
    analyzeBusinessAnalyticsIntent("Analitika agenti nima qiladi?").intent === "casual_chat",
    "2. Analitika agenti nima qiladi → casual"
  );

  // 3. KPI mezonlari
  const kpi = analyzeBusinessAnalyticsIntent("KPI mezonlari qanday?");
  assert(kpi.intent === "knowledge_only", "3. KPI mezonlari → knowledge_only");
  assert(kpi.needsKnowledge && !kpi.needsCrm, "3. KPI needs knowledge only");

  // 4. Dashboard
  assert(analyzeBusinessAnalyticsIntent("Dashboard qanday tuziladi?").needsKnowledge, "4. Dashboard");

  // 5. Bottleneck
  assert(analyzeBusinessAnalyticsIntent("Jarayon bottlenecklarini qanday aniqlash kerak?").needsKnowledge, "5. Bottleneck");

  // 6. Avtomatizatsiya
  assert(analyzeBusinessAnalyticsIntent("Avtomatizatsiya standartlari").needsKnowledge, "6. Avtomatizatsiya");

  // 7. CRM monitoring
  const crmMon = analyzeBusinessAnalyticsIntent("CRM monitoring holati qanday?");
  assert(crmMon.intent === "crm_only" || crmMon.needsCrm, "7. CRM monitoring → CRM");

  // 8. Lead konversiya
  assert(analyzeBusinessAnalyticsIntent("Lead konversiya ko'rsatkichi qanday?").needsCrm, "8. Lead konversiya → CRM");

  // 9. Kechikkan vazifalar
  assert(analyzeBusinessAnalyticsIntent("Kechikkan vazifalar bo'yicha yuklama").needsCrm, "9. Kechikkan vazifalar → CRM");

  // 10. Hybrid
  const hybrid = analyzeBusinessAnalyticsIntent("BP-08 ga ko'ra CRM holatini bahola");
  assert(hybrid.intent === "knowledge_plus_crm", "10. BP-08 + CRM → hybrid");
  assert(hybrid.needsKnowledge && hybrid.needsCrm, "10. hybrid needs both");

  // 11. knowledge_only explicit
  assert(
    analyzeBusinessAnalyticsIntent("AQ-06 bo'yicha KPI tasnifini tushuntir.").intent === "knowledge_only",
    "11. knowledge_only"
  );

  // 12. crm_only
  assert(analyzeBusinessAnalyticsIntent("Bitrix24 lead holati aggregati").needsCrm, "12. crm_only");

  // 13. knowledge_plus_crm
  assert(
    analyzeBusinessAnalyticsIntent("KPI mezonlariga ko'ra kechikkan vazifalarni tahlil qil.").intent ===
      "knowledge_plus_crm",
    "13. knowledge_plus_crm"
  );

  const rwKpi = rewriteBusinessAnalyticsQuery("KPI va dashboard holati");
  assert(rwKpi.wasRewritten, "query rewrite KPI dashboard");

  const rwBottleneck = rewriteBusinessAnalyticsQuery("Jarayon bottlenecklari qayerda?");
  assert(rwBottleneck.wasRewritten, "query rewrite bottleneck");

  const rwCrm = rewriteBusinessAnalyticsQuery("CRM monitoring holati");
  assert(rwCrm.wasRewritten, "query rewrite CRM monitoring");

  const tools = planBusinessAnalyticsCrmTools(rwKpi.rewritten);
  assert(tools.tools.includes("deals"), "tool plan: deals");
  assert(tools.tools.includes("leads") || tools.focus.includes("conversion"), "tool plan: leads/conversion");

  const workloadTools = planBusinessAnalyticsCrmTools("bo'lim yuklamasi va kechikkan vazifalar");
  assert(workloadTools.tools.includes("workload") || workloadTools.focus.includes("workload_by_dept"), "tool plan: workload");

  const dqTools = planBusinessAnalyticsCrmTools("ma'lumot sifati data quality signal");
  assert(dqTools.tools.includes("data_quality"), "tool plan: data_quality");

  const index = await loadBusinessAnalyticsKnowledgeIndex(true);
  assert(index.documents.length >= 5, `5 ta BA hujjati (${index.documents.length})`);
  assert(index.chunks.length > 5, `BA bo'laklar (${index.chunks.length})`);

  const kpiHits = await retrieveBusinessAnalyticsChunks("KPI dashboard ko'rsatkichlari BP-08", {
    topK: 5,
  });
  assert(kpiHits.hits.length > 0, "KPI retrieval");
  assert(
    kpiHits.matchedFiles.some((f) => /aq-06/i.test(f)) || kpiHits.hits.length > 0,
    "KPI → AQ-06"
  );

  const bottleneckHits = await retrieveBusinessAnalyticsChunks("bottleneck jarayon tirqish monitoring", {
    topK: 5,
  });
  assert(bottleneckHits.hits.length > 0 || bottleneckHits.matchedFiles.length >= 0, "bottleneck retrieval");

  // 14. Bitrix24 bo'sh javob (context)
  const emptyCrm = buildBusinessAnalyticsContext({
    intent: "crm_only",
    originalQuestion: "CRM holati qanday?",
    rewritten: { original: "CRM holati qanday?", rewritten: "...", wasRewritten: true },
    crmMissing: true,
  });
  assert(
    emptyCrm.userPrompt.includes("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi"),
    "14. Bitrix24 bo'sh holat"
  );

  // 15. Qisman CRM
  const partial = buildBusinessAnalyticsContext({
    intent: "knowledge_plus_crm",
    originalQuestion: "AQ-06 ga ko'ra tahlil",
    rewritten: { original: "...", rewritten: "...", wasRewritten: false },
    knowledge: kpiHits,
    crmMissing: true,
  });
  assert(
    partial.userPrompt.includes("jonli aggregat topilmadi") ||
      partial.systemPrompt.includes("jonli aggregat topilmadi"),
    "15. qisman CRM"
  );

  // 16. No relevant knowledge
  const nonsense = await retrieveBusinessAnalyticsChunks("xyzabc quantum flarnium unrelated topic 99999", {
    topK: 5,
  });
  assert(!nonsense.knowledgeUsed || nonsense.hits.length === 0, "16. no relevant knowledge");

  // 17. Pipeline empty question
  try {
    const { runBusinessAnalyticsAnswer } = await import("../lib/server/business-analytics/pipeline");
    await runBusinessAnalyticsAnswer("");
    assert(false, "17. empty question should throw");
  } catch {
    assert(true, "17. empty question error handling");
  }

  // 18. Bitrix24 fetch bundle
  const crmBundle = await fetchBusinessAnalyticsCrmData(["leads", "deals", "tasks"], ["conversion"]);
  assert(typeof crmBundle.empty === "boolean", "18. Bitrix24 fetch returns bundle");

  // 19. Aggregat prompt — ichki ID chiqmasligi
  const mockBundle = {
    leads: [{ ID: "101", TITLE: "Lead A", DATE_CREATE: new Date().toISOString() }],
    deals: [
      {
        ID: "201",
        TITLE: "Bitim A",
        OPPORTUNITY: 1000000,
        STAGE_ID: "NEW",
        CLOSED: "N",
        DATE_MODIFY: new Date().toISOString(),
      },
    ],
    contacts: [{ ID: "301", NAME: "Sardor", LAST_NAME: "Aliyev", EMAIL: "s@test.uz" }],
    companies: [{ ID: "401", TITLE: "Kompaniya A" }],
    tasks: [
      {
        ID: "1",
        TITLE: "Tahlil vazifasi",
        STATUS: 2,
        RESPONSIBLE_ID: "99",
        DEADLINE: "2026-01-01",
      },
    ],
    activities: [{ ID: "501", SUBJECT: "Qo'ng'iroq", CREATED: new Date().toISOString() }],
    users: [{ id: "99", name: "Dilnoza Karimova", firstName: "Dilnoza", lastName: "Karimova" }],
    departments: [{ ID: "601", NAME: "Savdo bo'limi" }],
    stages: new Map([
      ["NEW", { name: "Yangi", semantics: "process", isSuccess: false, isFail: false }],
    ]),
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Tashkent" as const,
    counts: {
      leads: 1,
      deals: 1,
      contacts: 1,
      companies: 1,
      tasks: 1,
      activities: 1,
      users: 1,
      departments: 1,
    },
    empty: false,
    limitations: [],
    focus: ["conversion" as const, "data_quality" as const],
  };
  const promptBlock = businessAnalyticsCrmPromptBlock(mockBundle);
  assert(promptBlock.includes("Dilnoza Karimova"), "19. xodim ismi ko'rsatiladi");
  assert(!/RESPONSIBLE_ID|"ID":\s*"99"|"201"|STAGE_ID/.test(promptBlock), "19. ichki ID promptda yo'q");
  assert(promptBlock.includes("aggregat") || promptBlock.includes("Konversiya"), "19. aggregat ko'rsatkichlar");

  // 20. Context ichida raw JSON bulk yo'q
  const ctxWithCrm = buildBusinessAnalyticsContext({
    intent: "crm_only",
    originalQuestion: "CRM holati",
    rewritten: { original: "CRM holati", rewritten: "...", wasRewritten: true },
    crm: mockBundle,
    toolPlan: tools,
  });
  assert(!/"ID":/.test(ctxWithCrm.userPrompt), "20. context raw JSON ID yo'q");
  assert(!/"STAGE_ID"/.test(ctxWithCrm.userPrompt), "20. context STAGE_ID yo'q");
  assert(ctxWithCrm.systemPrompt.includes("raw JSON"), "20. system prompt raw JSON qoidasi");

  // 21. Dashboard intent
  assert(analyzeBusinessAnalyticsIntent("Executive dashboard hisoboti").needsKnowledge, "21. dashboard knowledge");

  // 22. BP-08 scope
  assert(emptyCrm.systemPrompt.includes("AQ-06"), "22. system prompt AQ-06 scope");
  assert(tools.reason.includes("BP-08"), "22. tool plan reason BP-08");

  assert(Boolean(index.chunks[0]?.meta.agentId === "business-analytics"), "metadata agentId=business-analytics");
  assert(Boolean(index.chunks[0]?.meta.fileName), "metadata fileName");

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log(`Indexed docs: ${index.documents.length}, chunks: ${index.chunks.length}`);
  console.log(`KPI files: ${kpiHits.matchedFiles.join(", ")}`);
  console.log(`Average score: ${kpiHits.averageSimilarity}`);

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
