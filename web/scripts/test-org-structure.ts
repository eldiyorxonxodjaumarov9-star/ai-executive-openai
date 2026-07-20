/**
 * Xaridlar.uz tashkiliy tuzilma / BP ownership tests.
 */
import {
  AGENT_ORG_PROFILES,
  BUSINESS_PROCESSES,
  CEO_ORCHESTRATION_AGENTS,
  getProcessesForAgent,
  isCompanyWideCeoQuestion,
} from "../lib/server/org/structure";
import { planSalesCrmTools } from "../lib/server/sales/tool-planner";
import { planFinanceCrmTools } from "../lib/server/finance/tool-planner";
import { planHrCrmTools } from "../lib/server/hr/tool-planner";
import { planCustomerSuccessCrmTools } from "../lib/server/customer-success/tool-planner";
import { planProcurementCrmTools } from "../lib/server/procurement/tool-planner";
import { planBusinessAnalyticsCrmTools } from "../lib/server/business-analytics/tool-planner";
import { shouldAttachProcurement } from "../lib/server/knowledge-base/cross-domain";
import { DEMO_AGENT_IDS } from "../lib/constants";
import { VALID_AGENTS } from "../lib/server/constants";

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

function main() {
  assert(BUSINESS_PROCESSES.length === 9, "9 ta BP");
  assert(getProcessesForAgent("sales").map((p) => p.id).join(",") === "BP-01,BP-03", "Sales BP");
  assert(getProcessesForAgent("procurement").map((p) => p.id).join(",") === "BP-02,BP-05", "Procurement BP");
  assert(getProcessesForAgent("finance").map((p) => p.id).join(",") === "BP-06", "Finance BP");
  assert(
    getProcessesForAgent("customer_success").map((p) => p.id).join(",") === "BP-04,BP-07",
    "CS BP"
  );
  assert(getProcessesForAgent("business_analytics").map((p) => p.id).join(",") === "BP-08", "BA BP");
  assert(getProcessesForAgent("ceo").map((p) => p.id).join(",") === "BP-09", "CEO BP");

  assert(CEO_ORCHESTRATION_AGENTS.length === 6, "CEO 6 agent");
  assert(CEO_ORCHESTRATION_AGENTS.includes("procurement"), "CEO → procurement");
  assert(CEO_ORCHESTRATION_AGENTS.includes("business_analytics"), "CEO → business_analytics");
  assert(!CEO_ORCHESTRATION_AGENTS.includes("marketing"), "CEO marketing emas");

  assert(isCompanyWideCeoQuestion("Kompaniya holati qanday?"), "company-wide detect");
  assert(!isCompanyWideCeoQuestion("Bugun qancha savdo bo'ldi?"), "sales-only emas");

  assert(AGENT_ORG_PROFILES.sales.knowledgeDomains.join() === "sales", "sales knowledge only");
  assert(AGENT_ORG_PROFILES.procurement.knowledgeDomains.join() === "procurement", "procurement knowledge only");
  assert(AGENT_ORG_PROFILES.finance.knowledgeDomains.join() === "finance", "finance knowledge only");
  assert(AGENT_ORG_PROFILES.hr.knowledgeDomains.join() === "hr", "hr knowledge only");
  assert(
    AGENT_ORG_PROFILES.customer_success.knowledgeDomains.join() === "customer-success",
    "cs knowledge only"
  );
  assert(
    AGENT_ORG_PROFILES.business_analytics.knowledgeDomains.join() === "business-analytics",
    "ba knowledge only"
  );

  assert(!planSalesCrmTools("holat").tools.includes("tasks"), "sales Bitrix: tasks yo'q");
  assert(planProcurementCrmTools("yetkazib beruvchi").tools.includes("companies"), "procurement companies");
  assert(planFinanceCrmTools("tushum").tools.join() === "deals", "finance Bitrix: deals only");
  assert(!planHrCrmTools("kechikkan").tools.includes("deals"), "hr Bitrix: deals yo'q");
  assert(planBusinessAnalyticsCrmTools("kpi dashboard").tools.includes("deals"), "ba deals agregatsiya");

  assert(!shouldAttachProcurement("sales", "ta'minot risk").attach, "sales procurement block");
  assert(!shouldAttachProcurement("ceo", "ta'minot risk").attach, "ceo shared procurement yo'q");
  assert(!shouldAttachProcurement("business-analytics", "ta'minot kechikish").attach, "ba shared procurement yo'q");
  assert(shouldAttachProcurement("procurement", "ta'minot risk").attach, "procurement own domain");

  assert(VALID_AGENTS.includes("procurement"), "VALID_AGENTS procurement");
  assert(VALID_AGENTS.includes("business_analytics"), "VALID_AGENTS business_analytics");

  assert((DEMO_AGENT_IDS as readonly string[]).includes("procurement"), "UI: procurement");
  assert((DEMO_AGENT_IDS as readonly string[]).includes("business_analytics"), "UI: ba");
  assert(!(DEMO_AGENT_IDS as readonly string[]).includes("marketing"), "UI: marketing yashirin");
  assert(DEMO_AGENT_IDS[0] === "ceo" && DEMO_AGENT_IDS.length === 7, "UI: 7 agent tartibi");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
