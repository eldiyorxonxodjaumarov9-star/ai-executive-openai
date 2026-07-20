/**
 * Cross-domain procurement retrieval tests.
 * Usage: npx tsx scripts/test-cross-domain-procurement.ts
 */
import { shouldAttachProcurement } from "../lib/server/knowledge-base/cross-domain";
import { retrieveCeoChunks } from "../lib/server/ceo/retriever";
import { retrieveFinanceChunks } from "../lib/server/finance/retriever";
import { retrieveBusinessAnalyticsChunks } from "../lib/server/business-analytics/retriever";
import { retrieveSalesChunks } from "../lib/server/sales/retriever";
import { retrieveCustomerSuccessChunks } from "../lib/server/customer-success/retriever";
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

  assert(
    shouldAttachProcurement("ceo", "Ta'minotdagi asosiy risklarni bahola").attach,
    "CEO + ta'minot risk → attach"
  );
  assert(
    shouldAttachProcurement("finance", "Yetkazib beruvchilarga to'lov holatini tahlil qil").attach,
    "Finance + yetkazib to'lov → attach"
  );
  assert(
    shouldAttachProcurement(
      "business-analytics",
      "Ta'minot jarayonidagi kechikishlarni aniqlash mezonlari qanday?"
    ).attach,
    "BA + kechikish → attach"
  );
  assert(
    !shouldAttachProcurement("sales", "Savdo holati qanday?").attach,
    "Sales odatiy → procurement YO'Q"
  );
  assert(
    !shouldAttachProcurement("customer-success", "Mijozlar holati qanday?").attach,
    "CS odatiy → procurement YO'Q"
  );

  const ceo = await retrieveCeoChunks("Ta'minotdagi asosiy risklarni bahola", { topK: 6 });
  assert(ceo.domainsUsed.includes("procurement"), "CEO domains include procurement");
  assert(ceo.hits.length >= 1 && ceo.hits.length <= 6, `CEO chunks 1–6 (${ceo.hits.length})`);
  assert(ceo.promptIncluded, "CEO promptga kiritildi");

  const finance = await retrieveFinanceChunks("Yetkazib beruvchilarga to'lov holatini tahlil qil", {
    topK: 6,
  });
  assert(finance.domainsUsed.includes("procurement"), "Finance domains include procurement");
  assert(finance.hits.length >= 1 && finance.hits.length <= 6, `Finance chunks (${finance.hits.length})`);

  const ba = await retrieveBusinessAnalyticsChunks(
    "Ta'minot jarayonidagi kechikishlarni aniqlash mezonlari qanday?",
    { topK: 6 }
  );
  assert(ba.domainsUsed.includes("procurement"), "BA domains include procurement");
  assert(ba.hits.length >= 1 && ba.hits.length <= 6, `BA chunks (${ba.hits.length})`);

  const sales = await retrieveSalesChunks("Savdo holati qanday?", { topK: 6 });
  assert(!sales.domainsUsed.includes("procurement"), "Sales domains WITHOUT procurement");
  assert(!sales.procurementAttached, "Sales procurementAttached=false");

  const cs = await retrieveCustomerSuccessChunks("Mijozlar holati qanday?", { topK: 6 });
  assert(!cs.domainsUsed.includes("procurement"), "CS domains WITHOUT procurement");
  assert(!cs.procurementAttached, "CS procurementAttached=false");

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log(`Procurement docs: ${index.documents.length}, chunks: ${index.chunks.length}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
