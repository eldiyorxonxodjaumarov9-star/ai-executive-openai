/** Intent routing smoke tests — run: npx tsx scripts/test-intent-routing.ts */
import { analyzeRouteIntent } from "../lib/server/intent-router";

const cases: { q: string; expected: string }[] = [
  { q: "Salom", expected: "casual_chat" },
  { q: "Siz nimalar qila olasiz?", expected: "casual_chat" },
  { q: "Bugun nechta savdo bo'ldi?", expected: "crm_question" },
  { q: "Dilnura bugun nima qildi?", expected: "crm_question" },
  {
    q: "Savdo qoidalariga ko'ra Dilnuraning bugungi ishlari qanday baholanadi?",
    expected: "hybrid_question",
  },
  { q: "Savdo bo'limi qoidalari qanday?", expected: "knowledge_question" },
];

let passed = 0;
for (const { q, expected } of cases) {
  const result = analyzeRouteIntent(q);
  const ok = result.type === expected;
  console.log(`${ok ? "✓" : "✗"} "${q}" → ${result.type} (expected ${expected})`);
  if (ok) passed++;
}

console.log(`\n${passed}/${cases.length} passed`);
process.exit(passed === cases.length ? 0 : 1);
