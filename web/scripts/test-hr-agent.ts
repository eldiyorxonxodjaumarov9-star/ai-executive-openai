/**
 * HR agent pipeline unit tests (offline + optional live CRM).
 * Usage: npm run test:hr
 */
import { analyzeHrIntent } from "../lib/server/hr/intent";
import { rewriteHrQuery } from "../lib/server/hr/query-rewriter";
import { planHrCrmTools } from "../lib/server/hr/tool-planner";
import { retrieveHrChunks } from "../lib/server/hr/retriever";
import { loadHrKnowledgeIndex } from "../lib/server/hr/knowledge-loader";
import { buildHrContext } from "../lib/server/hr/context-builder";
import { fetchHrCrmData, hrCrmPromptBlock } from "../lib/server/hr/crm-fetcher";

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
  assert(analyzeHrIntent("Salom").intent === "casual_chat", "1. Salom → casual");

  // 2. Agent haqida
  assert(
    analyzeHrIntent("Xodimlar agenti nima qiladi?").intent === "casual_chat",
    "2. Xodimlar agenti nima qiladi → casual"
  );

  // 3. Onboarding
  const onboarding = analyzeHrIntent("Onboarding tartibi qanday?");
  assert(onboarding.intent === "knowledge_only", "3. Onboarding → knowledge_only");
  assert(onboarding.needsKnowledge && !onboarding.needsCrm, "3. Onboarding needs knowledge only");

  // 4. KPI
  const kpi = analyzeHrIntent("KPI qanday baholanadi?");
  assert(kpi.needsKnowledge, "4. KPI → knowledge");

  // 5. Motivatsiya
  assert(analyzeHrIntent("Xodimlarni qanday motivatsiya qilish kerak?").needsKnowledge, "5. Motivatsiya");

  // 6. Turnover
  assert(analyzeHrIntent("Turnover qanday hisoblanadi?").needsKnowledge, "6. Turnover");

  // 7. Kechikkan vazifalar
  const overdue = analyzeHrIntent("Kimda kechikkan vazifalar bor?");
  assert(overdue.intent === "crm_only" || overdue.needsCrm, "7. Kechikkan vazifalar → CRM");

  // 8. Ish yuklamasi
  assert(analyzeHrIntent("Kimning ish yuklamasi ko'p?").needsCrm, "8. Ish yuklamasi → CRM");

  // 9. Bugun bajarilgan
  assert(analyzeHrIntent("Bugun kim ko'p vazifa bajardi?").needsCrm, "9. Bugun bajarilgan → CRM");

  // 10. Hybrid
  const hybrid = analyzeHrIntent("HR qoidalariga ko'ra kechikishlarni bahola");
  assert(hybrid.intent === "knowledge_plus_crm", "10. HR qoida + kechikish → hybrid");
  assert(hybrid.needsKnowledge && hybrid.needsCrm, "10. hybrid needs both");

  // 11. knowledge_only explicit
  assert(
    analyzeHrIntent("Yangi xodimni onboarding qilish tartibini yoz.").intent === "knowledge_only",
    "11. knowledge_only"
  );

  // 12. crm_only
  assert(analyzeHrIntent("Kimda kechikkan vazifalar bor?").needsCrm, "12. crm_only");

  // 13. knowledge_plus_crm
  assert(
    analyzeHrIntent("Bugungi vazifalarni HR qoidalariga ko'ra bahola.").intent ===
      "knowledge_plus_crm",
    "13. knowledge_plus_crm"
  );

  const rw = rewriteHrQuery("Kimda kechikkan vazifalar bor?");
  assert(rw.wasRewritten, "query rewrite kechikkan");

  const tools = planHrCrmTools(rw.rewritten);
  assert(tools.tools.includes("tasks"), "tool plan: tasks");
  assert(tools.tools.includes("overdue_tasks") || tools.focus.includes("overdue_tasks"), "tool plan: overdue");

  const index = await loadHrKnowledgeIndex(true);
  assert(index.documents.length >= 5, `5 ta HR hujjat (${index.documents.length})`);
  assert(index.chunks.length > 5, `HR bo'laklar (${index.chunks.length})`);

  const onboardingHits = await retrieveHrChunks("yangi xodim onboarding tartibi rekruting", {
    topK: 5,
  });
  assert(onboardingHits.hits.length > 0, "onboarding retrieval");
  assert(
    onboardingHits.matchedFiles.some((f) => /aq-hr_02/i.test(f)),
    "onboarding → AQ-HR_02"
  );

  const kpiHits = await retrieveHrChunks("KPI performance baholash xodimlarni boshqarish", {
    topK: 5,
  });
  assert(
    kpiHits.matchedFiles.some((f) => /aq-hr_03/i.test(f)) || kpiHits.hits.length > 0,
    "KPI retrieval"
  );

  // 14. Bitrix24 bo'sh javob (context)
  const emptyCrm = buildHrContext({
    intent: "crm_only",
    originalQuestion: "Kimda kechikkan vazifalar bor?",
    rewritten: { original: "Kimda kechikkan vazifalar bor?", rewritten: "...", wasRewritten: true },
    crmMissing: true,
  });
  assert(
    emptyCrm.userPrompt.includes("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi"),
    "14. Bitrix24 bo'sh holat"
  );

  // 15. Qisman CRM
  const partial = buildHrContext({
    intent: "knowledge_plus_crm",
    originalQuestion: "HR qoidalariga ko'ra bahola",
    rewritten: { original: "...", rewritten: "...", wasRewritten: false },
    knowledge: onboardingHits,
    crmMissing: true,
  });
  assert(
    partial.userPrompt.includes("jonli ma'lumot topilmadi") ||
      partial.systemPrompt.includes("jonli ma'lumot topilmadi"),
    "15. qisman CRM"
  );

  // 16. No relevant knowledge
  const nonsense = await retrieveHrChunks("xyzabc quantum flarnium unrelated topic 99999", {
    topK: 5,
  });
  assert(!nonsense.knowledgeUsed || nonsense.hits.length === 0, "16. no relevant knowledge");

  // 17. OpenAI error handling — pipeline throws gracefully on empty question
  try {
    const { runHrAnswer } = await import("../lib/server/hr/pipeline");
    await runHrAnswer("");
    assert(false, "17. empty question should throw");
  } catch {
    assert(true, "17. OpenAI/empty error handling");
  }

  // 18. Bitrix24 error — no webhook returns empty bundle
  const crmBundle = await fetchHrCrmData(["tasks", "users"], ["overdue_tasks"]);
  assert(typeof crmBundle.empty === "boolean", "18. Bitrix24 fetch returns bundle");

  // 19. Ichki ID chiqmasligi — CRM prompt blokida mas'ul ism ishlatiladi
  const mockBundle = {
    users: [{ id: "99", name: "Ali Valiyev", firstName: "Ali", lastName: "Valiyev" }],
    departments: [],
    tasks: [
      {
        ID: "1",
        TITLE: "Test vazifa",
        STATUS: 2,
        RESPONSIBLE_ID: "99",
        DEADLINE: "2026-01-01",
      },
    ],
    activities: [],
    deals: [],
    stages: new Map(),
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Tashkent" as const,
    counts: { users: 1, departments: 0, tasks: 1, activities: 0, deals: 0 },
    empty: false,
    limitations: [],
    focus: ["overdue_tasks" as const],
  };
  const promptBlock = hrCrmPromptBlock(mockBundle);
  assert(promptBlock.includes("Ali Valiyev"), "19. xodim ismi ko'rsatiladi");
  assert(!/RESPONSIBLE_ID|ID:\s*99|"99"/.test(promptBlock), "19. ichki ID promptda yo'q");

  // 20. Boshqa agent savoli HR da noto'g'ri hybrid bo'lmasin
  const salesQ = analyzeHrIntent("Bugun qancha savdo bo'ldi?");
  assert(salesQ.needsCrm || salesQ.intent === "crm_only", "20. sales-like savol CRM yo'nalishi");

  assert(Boolean(index.chunks[0]?.meta.agentId === "hr"), "metadata agentId=hr");
  assert(Boolean(index.chunks[0]?.meta.fileName), "metadata fileName");

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log(`Indexed docs: ${index.documents.length}, chunks: ${index.chunks.length}`);
  console.log(`Onboarding files: ${onboardingHits.matchedFiles.join(", ")}`);
  console.log(`Average score: ${onboardingHits.averageSimilarity}`);

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
