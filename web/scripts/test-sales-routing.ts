/** Sales routing smoke tests — run: npx tsx scripts/test-sales-routing.ts */
import { analyzeRouteIntent } from "../lib/server/intent-router";
import { detectQuickCrmEntities, isSalesQuery } from "../lib/server/crm-router";
import { parseSalesPeriod } from "../lib/server/sales-analytics";

const cases = [
  "Bugun qancha sotuv bo'ldi?",
  "Bugun nechta bitim yopildi?",
  "Bugun nechta yangi bitim yaratildi?",
  "Diyora qancha savdo qildi?",
  "Oxirgi 7 kunlik savdo qancha?",
];

let passed = 0;
for (const q of cases) {
  const intent = analyzeRouteIntent(q);
  const entities = detectQuickCrmEntities(q);
  const sales = isSalesQuery(q);
  const period = parseSalesPeriod(q);
  const ok = intent.type === "crm_question" && entities.includes("deals") && sales;
  console.log(`${ok ? "✓" : "✗"} "${q}"`);
  console.log(`   intent=${intent.type} entities=${entities.join(",")} sales=${sales} period=${period.label}`);
  if (ok) passed++;
}

console.log(`\n${passed}/${cases.length} passed`);
process.exit(passed === cases.length ? 0 : 1);
