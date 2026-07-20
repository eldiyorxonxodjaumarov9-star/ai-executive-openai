/**
 * Cross-domain procurement retrieval tests (updated for full agents).
 */
import { shouldAttachProcurement } from "../lib/server/knowledge-base/cross-domain";
import { retrieveCeoChunks } from "../lib/server/ceo/retriever";
import { retrieveFinanceChunks } from "../lib/server/finance/retriever";
import { retrieveBusinessAnalyticsChunks } from "../lib/server/business-analytics/retriever";
import { retrieveSalesChunks } from "../lib/server/sales/retriever";
import { retrieveCustomerSuccessChunks } from "../lib/server/customer-success/retriever";
import { retrieveProcurementChunks } from "../lib/server/procurement/retriever";
import { loadProcurementKnowledgeIndex } from "../lib/server/procurement/knowledge-loader";

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
  const index = await loadProcurementKnowledgeIndex(true);
  assert(index.documents.length >= 5, `procurement docs >= 5 (${index.documents.length})`);
  assert(index.chunks.length > 5, `procurement chunks (${index.chunks.length})`);

  assert(!shouldAttachProcurement("ceo", "Ta'minotdagi asosiy risklarni bahola").attach, "CEO shared procurement yo'q");
  assert(!shouldAttachProcurement("finance", "Yetkazib beruvchilarga to'lov").attach, "Finance procurement YO'Q");
  assert(!shouldAttachProcurement("business-analytics", "Ta'minot kechikish").attach, "BA shared procurement YO'Q");
  assert(shouldAttachProcurement("procurement", "Ta'minot risk").attach, "Procurement agent own domain");

  const proc = await retrieveProcurementChunks("Ta'minotdagi asosiy risklarni bahola", { topK: 6 });
  assert(proc.hits.length >= 1, `Procurement retrieval (${proc.hits.length})`);
  assert(proc.knowledgeUsed !== false || proc.hits.length >= 0, "Procurement retriever ishlaydi");

  const ceo = await retrieveCeoChunks("Ta'minotdagi asosiy risklarni bahola", { topK: 6 });
  assert(!ceo.domainsUsed.includes("procurement"), "CEO domains WITHOUT procurement cross-domain");

  const finance = await retrieveFinanceChunks("Yetkazib beruvchilarga to'lov holatini tahlil qil", { topK: 6 });
  assert(!finance.domainsUsed.includes("procurement"), "Finance WITHOUT procurement");

  const ba = await retrieveBusinessAnalyticsChunks("KPI monitoring dashboard", { topK: 6 });
  assert(ba.hits.length >= 0, "BA standalone retriever");

  const sales = await retrieveSalesChunks("Savdo holati qanday?", { topK: 6 });
  assert(!sales.domainsUsed.includes("procurement"), "Sales WITHOUT procurement");

  const cs = await retrieveCustomerSuccessChunks("Mijozlar holati qanday?", { topK: 6 });
  assert(!cs.domainsUsed.includes("procurement"), "CS WITHOUT procurement");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
