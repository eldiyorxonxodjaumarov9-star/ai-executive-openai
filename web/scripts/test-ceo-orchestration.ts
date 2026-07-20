/**
 * CEO orchestration unit tests (offline + optional live OpenAI).
 * Usage: npm run test:ceo:orchestration
 */
import { resolveCeoOrchestrationAgents } from "../lib/server/router/route-query";
import { gatherCeoDirectorReports } from "../lib/server/ceo/orchestrator";
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

function assertAgentsEqual(actual: RoutableAgentId[], expected: RoutableAgentId[], label: string) {
  const a = [...actual].sort().join(",");
  const e = [...expected].sort().join(",");
  assert(a === e, `${label}: [${actual.join(", ")}]`);
}

function assertAgentsInclude(actual: RoutableAgentId[], must: RoutableAgentId[], label: string) {
  assert(must.every((id) => actual.includes(id)), `${label}: includes ${must.join(", ")}`);
}

async function main() {
  // --- resolveCeoOrchestrationAgents ---

  // Company-wide → 6 agents
  const companyWide = resolveCeoOrchestrationAgents("Kompaniya holati qanday?");
  assert(companyWide.length === 6, "1. company-wide → 6 agents");
  assertAgentsEqual(companyWide, ALL_DIRECTOR_AGENTS, "2. company-wide = ALL_DIRECTOR_AGENTS");
  assert(!companyWide.includes("ceo"), "3. company-wide ceo yo'q");

  // Procurement only
  const procOnly = resolveCeoOrchestrationAgents("Ta'minot va yetkazib berish holati");
  assert(procOnly.includes("procurement"), "4. procurement only includes procurement");
  assert(procOnly.length === 1, "4b. procurement only single agent");

  // IT only
  const itOnly = resolveCeoOrchestrationAgents("IT tizim va CRM monitoring holati");
  assert(itOnly.includes("business_analytics"), "5. IT only → business_analytics");
  assert(!itOnly.includes("sales"), "5b. IT only sales yo'q");

  // Sales + finance
  const salesFinance = resolveCeoOrchestrationAgents("Savdo va moliya holati");
  assertAgentsInclude(salesFinance, ["sales", "finance"], "6. sales+finance");
  assert(salesFinance.length === 2, "6b. sales+finance 2 agents");

  // Procurement + finance
  const procFinance = resolveCeoOrchestrationAgents("Ta'minot va moliya holati");
  assertAgentsInclude(procFinance, ["procurement", "finance"], "7. procurement+finance");
  assert(procFinance.length === 2, "7b. procurement+finance 2 agents");

  // HR + sales
  const hrSales = resolveCeoOrchestrationAgents("Xodimlar va savdo holati");
  assertAgentsInclude(hrSales, ["hr", "sales"], "8. hr+sales");
  assert(hrSales.length === 2, "8b. hr+sales 2 agents");

  // No signal → empty
  assert(resolveCeoOrchestrationAgents("Salom").length === 0, "9. no signal → empty");
  assert(resolveCeoOrchestrationAgents("").length === 0, "10. empty question → empty");

  // Duplicate prevention
  const dupInput: RoutableAgentId[] = ["sales", "sales", "finance", "finance"];
  const bundleDup = await gatherCeoDirectorReports("Test savol", dupInput);
  assert(
    bundleDup.orchestrationAgents.length === 2,
    "11. duplicate prevention: 2 unique agents"
  );
  assert(
    new Set(bundleDup.orchestrationAgents).size === bundleDup.orchestrationAgents.length,
    "11b. duplicate prevention: no duplicates in list"
  );

  const resolvedDup = resolveCeoOrchestrationAgents("Savdo va savdo pipeline holati");
  assert(
    new Set(resolvedDup).size === resolvedDup.length,
    "12. resolve duplicate prevention"
  );

  // --- gatherCeoDirectorReports empty ---

  const emptyOrch = await gatherCeoDirectorReports("Salom");
  assert(emptyOrch.reports.length === 0, "13. gather empty when no agents resolved");
  assert(emptyOrch.promptBlock === "", "14. gather empty promptBlock");
  assert(emptyOrch.agentsConsulted.length === 0, "15. gather empty agentsConsulted");
  assert(emptyOrch.orchestrationAgents.length === 0, "16. gather empty orchestrationAgents");

  // Executive report triggers full orchestration list
  const execOrch = resolveCeoOrchestrationAgents("Executive report — barcha bo'lim holati");
  assert(execOrch.length === 6, "17. executive report → 6 agents");

  // CEO-only strategy question (no secondary) → empty orchestration
  assert(resolveCeoOrchestrationAgents("Strategik reja").length === 0, "18. ceo-only no secondary → empty");

  // Customer success isolated
  const csOnly = resolveCeoOrchestrationAgents("Mijozlar retention holati");
  assert(csOnly.includes("customer_success"), "19. cs only");
  assert(csOnly.length === 1, "19b. cs only single");

  // Finance isolated
  const finOnly = resolveCeoOrchestrationAgents("Moliyaviy tushum holati");
  assert(finOnly.includes("finance"), "20. finance only");

  // BA + CRM combo
  const baCrm = resolveCeoOrchestrationAgents("KPI dashboard va CRM monitoring");
  assert(baCrm.includes("business_analytics"), "21. ba kpi dashboard");

  // Firma baholash variant
  const firma = resolveCeoOrchestrationAgents("Firmamizni umumiy baholang");
  assert(firma.length === 6, "22. firma umumiy baholash → 6");

  console.log(`\n${passed} passed, ${failed} failed`);

  // --- Optional live section ---
  if (process.env.OPENAI_API_KEY) {
    console.log("\n[Live OpenAI] OPENAI_API_KEY mavjud — live orchestration smoke...");
    const live = await gatherCeoDirectorReports("Qisqa test: savdo holati", ["sales"]);
    assert(live.reports.length === 1, "live. 1 report");
    assert(live.orchestrationAgents.includes("sales"), "live. sales consulted");
    console.log(`Live mode: ${live.reports[0]?.mode || "unknown"}`);
  } else {
    console.log("\n[Live OpenAI] SKIPPED — OPENAI_API_KEY yo'q.");
  }

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
