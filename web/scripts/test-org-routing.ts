/**
 * Org routing unit tests — classifyAgent / routeQuery.
 * Usage: npm run test:router
 */
import { classifyAgent, routeQuery, resolveCeoOrchestrationAgents } from "../lib/server/router/route-query";
import { ALL_DIRECTOR_AGENTS } from "../lib/server/router/types";
import type { RoutableAgentId } from "../lib/server/router/types";

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

function assertPrimary(q: string, expected: RoutableAgentId, label: string) {
  const r = classifyAgent(q);
  assert(r.primaryAgent === expected, `${label}: primary=${expected} (${r.primaryAgent})`);
}

function assertIncludesSecondary(q: string, agent: RoutableAgentId, label: string) {
  const r = classifyAgent(q);
  assert(r.secondaryAgents.includes(agent), `${label}: secondary includes ${agent}`);
}

function main() {
  // --- Sales ---
  assertPrimary("Bugun qancha savdo bo'ldi?", "sales", "1. sales savdo");
  assertPrimary("Lead konversiyasi qanday?", "sales", "2. sales lead");
  assertPrimary("Savdo pipeline holati", "sales", "3. sales pipeline");
  assertPrimary("Menejerlar bitimlari", "sales", "4. sales menejer bitim");

  // --- Procurement ---
  assertPrimary("Ta'minot holati qanday?", "procurement", "5. procurement ta'minot");
  assertPrimary("Yetkazib beruvchilar ro'yxati", "procurement", "6. procurement yetkazib");
  assertPrimary("Xarid jarayoni holati", "procurement", "7. procurement xarid");
  assertPrimary("Ombor va logistika", "procurement", "8. procurement ombor");

  // --- Finance ---
  assertPrimary("Moliyaviy holat qanday?", "finance", "9. finance moliya");
  assertPrimary("Bugungi tushum qancha?", "finance", "10. finance tushum");
  assertPrimary("Debitor qarzdorlik", "finance", "11. finance debitor");
  assertPrimary("Invoice to'lov holati", "finance", "12. finance invoice");

  // --- Customer Success ---
  assertPrimary("Mijozlar retention holati", "customer_success", "13. cs mijoz");
  assertPrimary("Broker servis holati", "customer_success", "14. cs broker");
  assertPrimary("Account manager tajribasi", "customer_success", "15. cs account");
  assertPrimary("BP-04 brokerlik va mijoz tajribasi", "customer_success", "16. cs BP-04 broker");

  // --- HR ---
  assertPrimary("Kimda kechikkan vazifalar bor?", "hr", "17. hr vazifa");
  assertPrimary("Xodimlar onboarding tartibi", "hr", "18. hr onboarding");
  assertPrimary("Ish yuklamasi kimda ko'p?", "hr", "19. hr yuklama");
  assertPrimary("Performance motivatsiya", "hr", "20. hr performance");

  // --- Business Analytics ---
  assertPrimary("KPI dashboard holati", "business_analytics", "21. ba kpi");
  assertPrimary("CRM monitoring va bottleneck", "business_analytics", "22. ba monitoring");
  assertPrimary("Bitrix process monitoring", "business_analytics", "23. ba bitrix monitor");
  assertPrimary("Avtomatlashtirish analitikasi BP-08", "business_analytics", "24. ba avtomatlashtirish");

  // --- CEO ---
  assertPrimary("Kompaniya holati qanday?", "ceo", "25. ceo kompaniya holati");
  const companyWide = classifyAgent("Firma umumiy holati");
  assert(companyWide.primaryAgent === "ceo", "26. ceo firma holati primary");
  assert(companyWide.secondaryAgents.length === 6, "26. ceo firma holati 6 secondary");
  assert(
    ALL_DIRECTOR_AGENTS.every((a) => companyWide.secondaryAgents.includes(a)),
    "26. ceo firma holati barcha direktorlar"
  );

  // --- Multi-agent combos ---
  const procFinCombo = classifyAgent("Ta'minot va moliya holati");
  assert(procFinCombo.primaryAgent === "procurement", "27. procurement+finance primary procurement");
  assert(procFinCombo.secondaryAgents.includes("finance"), "27b. procurement+finance secondary finance");

  const salesFinance = classifyAgent("Savdo va moliya holati");
  assert(
    salesFinance.primaryAgent === "sales" || salesFinance.primaryAgent === "finance",
    "28. sales+finance primary"
  );
  assert(
    salesFinance.secondaryAgents.includes("sales") ||
      salesFinance.secondaryAgents.includes("finance") ||
      salesFinance.primaryAgent === "sales" ||
      salesFinance.primaryAgent === "finance",
    "28. sales+finance combo"
  );

  const hrSalesCombo = classifyAgent("Xodimlar va savdo holati");
  assert(
    hrSalesCombo.primaryAgent === "sales" || hrSalesCombo.primaryAgent === "hr",
    "29. hr+sales primary sales or hr"
  );
  assert(
    hrSalesCombo.secondaryAgents.includes("hr") || hrSalesCombo.primaryAgent === "hr",
    "29b. hr+sales includes hr"
  );
  assert(
    hrSalesCombo.secondaryAgents.includes("sales") || hrSalesCombo.primaryAgent === "sales",
    "29c. hr+sales includes sales"
  );

  const procFin = classifyAgent("Xarid va to'lov holati");
  assert(
    procFin.primaryAgent === "procurement" || procFin.primaryAgent === "finance",
    "30. procurement+finance xarid to'lov"
  );

  // --- Edge cases ---
  const empty = classifyAgent("");
  assert(empty.primaryAgent === "ceo", "31. bo'sh savol → ceo");
  assert(empty.secondaryAgents.length === 0, "31. bo'sh savol secondary yo'q");
  assert(empty.confidence === 0, "31. bo'sh savol confidence 0");

  const vague = classifyAgent("Salom");
  assert(vague.primaryAgent === "ceo", "32. no signal → ceo default");
  assert(vague.confidence <= 0.5, "32. no signal past confidence");

  assert(routeQuery("Savdo holati").primaryAgent === classifyAgent("Savdo holati").primaryAgent, "33. routeQuery ≡ classifyAgent");

  // --- resolveCeoOrchestrationAgents ---
  const orchAll = resolveCeoOrchestrationAgents("Kompaniya holati qanday?");
  assert(orchAll.length === 6, "34. orchestration company-wide → 6");
  assert(!orchAll.includes("ceo"), "34. orchestration ceo yo'q");

  const orchProc = resolveCeoOrchestrationAgents("Ta'minot holati");
  assert(orchProc.includes("procurement"), "35. orchestration procurement only");
  assert(orchProc.length >= 1, "35. orchestration procurement non-empty");

  const orchIt = resolveCeoOrchestrationAgents("IT tizim monitoring holati");
  assert(orchIt.includes("business_analytics"), "36. orchestration IT → BA");

  const orchSalesFin = resolveCeoOrchestrationAgents("Savdo va moliya holati");
  assert(orchSalesFin.includes("sales") || orchSalesFin.includes("finance"), "37. orchestration sales+finance");
  assert(orchSalesFin.length >= 2, "37. orchestration sales+finance 2+ agents");

  const orchProcFin = resolveCeoOrchestrationAgents("Ta'minot va moliya holati");
  assert(orchProcFin.includes("procurement") && orchProcFin.includes("finance"), "38. orchestration procurement+finance");

  const orchHrSales = resolveCeoOrchestrationAgents("Xodimlar va savdo holati");
  assert(orchHrSales.includes("hr") && orchHrSales.includes("sales"), "39. orchestration hr+sales");

  const orchEmpty = resolveCeoOrchestrationAgents("Salom");
  assert(orchEmpty.length === 0, "40. orchestration no signal → empty");

  const r = classifyAgent("Savdo va ta'minot va moliya");
  assert(r.confidence > 0.5, "41. multi-domain confidence > 0.5");
  assert(r.secondaryAgents.length >= 1, "41. multi-domain secondary mavjud");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
