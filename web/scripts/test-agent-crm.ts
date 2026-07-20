/** Agent CRM tests — run: npx tsx scripts/test-agent-crm.ts [baseUrl] */
import type { AgentId } from "../lib/constants";

const BASE = process.argv[2] || "http://localhost:3000";

const AGENT_TESTS: Record<AgentId, string[]> = {
  ceo: [
    "Kompaniyaning hozirgi sotuv holatini tahlil qil.",
    "Direktor uchun barcha vaqt hisoboti.",
    "Asosiy risklar qaysilar?",
  ],
  finance: [
    "Umumiy bitimlar summasi qancha?",
    "Shu oygi kutilayotgan tushum qancha?",
    "Eng katta moliyaviy risk nima?",
  ],
  sales: [
    "Qaysi menejer eng yaxshi natija ko'rsatgan?",
    "Voronka holatini tahlil qil.",
    "Qaysi bitimlar tiqilib qolgan?",
  ],
  hr: [
    "Qaysi xodimda eng ko'p ochiq bitim bor?",
    "Xodimlar yuklamasini tahlil qil.",
    "Kimga qo'shimcha yordam kerak?",
  ],
  marketing: [
    "Eng samarali lead manbasi qaysi?",
    "Marketing konversiyasini tahlil qil.",
    "Qaysi source ma'lumotlari yetishmayapti?",
  ],
  customer_success: [
    "Eng faol mijozlar kim?",
    "Takroriy mijozlar nechta?",
    "Mijozlarni saqlab qolish bo'yicha tavsiya ber.",
  ],
  procurement: [
    "Qaysi yetkazib beruvchi kechikyapti?",
    "Ta'minotdagi asosiy risklar nima?",
    "Yetkazib beruvchilarni qanday baholaymiz?",
  ],
  business_analytics: [
    "Qaysi jarayonda bottleneck bor?",
    "KPI monitoring bo'yicha muammolar nima?",
    "Dashboard uchun asosiy ko'rsatkichlarni ber.",
  ],
};

interface DebugResponse {
  ok: boolean;
  agent?: { id: string; name: string };
  dataFreshness?: { fetchedAt: string; cached: boolean };
  entitiesFetched?: Record<string, unknown>;
  analytics?: Record<string, unknown>;
  limitations?: string[];
  error?: string | null;
}

async function testAgentCrm(agent: AgentId, question: string): Promise<boolean> {
  const url = `${BASE}/api/debug/agent-crm?agent=${agent}&q=${encodeURIComponent(question)}&refresh=1`;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as DebugResponse;
    const ok = res.ok && data.ok === true && Boolean(data.dataFreshness?.fetchedAt);
    console.log(`${ok ? "✓" : "✗"} [${agent}] ${question}`);
    if (data.entitiesFetched) {
      console.log(`   entities: ${JSON.stringify(data.entitiesFetched)}`);
    }
    if (data.limitations?.length) {
      console.log(`   limitations: ${data.limitations.join("; ")}`);
    }
    if (!ok) {
      console.log(`   error: ${data.error || res.status}`);
    }
    return ok;
  } catch (e) {
    console.log(`✗ [${agent}] ${question}`);
    console.log(`   network: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

async function main() {
  console.log(`Testing agent CRM at ${BASE}\n`);
  let passed = 0;
  let total = 0;

  for (const [agent, questions] of Object.entries(AGENT_TESTS) as [AgentId, string[]][]) {
    for (const q of questions) {
      total++;
      if (await testAgentCrm(agent, q)) passed++;
    }
  }

  console.log(`\n${passed}/${total} passed`);
  process.exit(passed === total ? 0 : 1);
}

void main();
