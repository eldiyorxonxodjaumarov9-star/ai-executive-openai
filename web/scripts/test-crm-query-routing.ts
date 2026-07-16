/** CRM query routing tests — run: npx tsx scripts/test-crm-query-routing.ts */
import { analyzeCrmQuery } from "../lib/server/crm-query-router";
import { analyzeRouteIntent } from "../lib/server/intent-router";

const cases = [
  "Jami nechta bitim bor?",
  "Umumiy bitimlar summasi qancha?",
  "Oxirgi 7 kunda nechta bitim yaratilgan?",
  "Shu oyda nechta savdo yopilgan?",
  "Eng katta bitim qaysi?",
  "Qaysi menejer eng ko'p savdo qilgan?",
  "Qaysi menejerda eng ko'p ochiq bitim bor?",
  "Muvaffaqiyatli yopilgan bitimlar summasi qancha?",
  "Yutqazilgan bitimlar nechta?",
  "Sotuv voronkasi holatini tahlil qil.",
  "Direktor uchun umumiy sotuv hisoboti tayyorla.",
  "Salom",
  "Savdo qoidalari qanday?",
];

let passed = 0;
for (const q of cases) {
  const intent = analyzeRouteIntent(q);
  const routing = analyzeCrmQuery(q);
  const isCrm = intent.type === "crm_question" || intent.type === "hybrid_question";
  const shouldBeCrm = !["Salom", "Savdo qoidalari qanday?"].includes(q);
  const ok = shouldBeCrm ? isCrm : !isCrm || intent.type === "knowledge_question";
  console.log(`${ok ? "✓" : "✗"} "${q}"`);
  console.log(`   intent=${intent.type} metric=${routing.metric} range=${routing.dateRange.label} explicit=${routing.dateRange.explicit}`);
  if (ok) passed++;
}

console.log(`\n${passed}/${cases.length} passed`);
process.exit(passed === cases.length ? 0 : 1);
