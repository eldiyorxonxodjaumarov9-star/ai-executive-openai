/**
 * Production release smoke — health + 7 agent E2E against live API.
 * Usage:
 *   npx tsx scripts/test-production-release.ts --base=https://ai-executive-openai.vercel.app
 *   npx tsx scripts/test-production-release.ts   # local Bitrix probe via root .env
 */
import fs from "fs";
import path from "path";

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Placeholder'larni overwrite qilmaslik
    if (key === "BITRIX24_WEBHOOK_URL" && /your-domain|your-token/i.test(val)) continue;
    if (key === "OPENAI_API_KEY" && /your-openai|sk-your/i.test(val)) continue;
    process.env[key] = val;
  }
}

// Root .env birinchi (real webhook), keyin .env.local faqat placeholder bo'lmasa
loadEnvFile(path.join(process.cwd(), "..", ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));
if (process.env.AI_PROVIDER !== "openai") process.env.AI_PROVIDER = "openai";

const baseArg = process.argv.find((a) => a.startsWith("--base="));
const API_BASE = baseArg ? baseArg.slice("--base=".length).replace(/\/$/, "") : "";

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

const AGENT_CASES: { agent: string; question: string }[] = [
  { agent: "ceo", question: "Kompaniya umumiy holatini bahola" },
  { agent: "sales", question: "Bugun qancha savdo bo'ldi" },
  { agent: "finance", question: "Joriy oy tushumi qancha" },
  { agent: "hr", question: "Kimda kechikkan vazifalar bor" },
  { agent: "customer-success", question: "Qaysi mijozlar bilan uzoq vaqt aloqa qilinmagan" },
  { agent: "procurement", question: "Ta'minotdagi asosiy risklar" },
  { agent: "business-analytics", question: "Qaysi biznes jarayonlarda bottleneck mavjud" },
];

async function probeLocalBitrix(): Promise<void> {
  const { checkBitrixHealth } = await import("../lib/server/bitrix");
  const health = await checkBitrixHealth();
  assert(health.connected, `Bitrix connected (${health.error || "ok"})`);
  if (health.entities) {
    for (const [k, v] of Object.entries(health.entities)) {
      assert(v.ok, `Bitrix entity ${k}${v.permission ? ` [${v.permission}]` : ""} count=${v.count ?? 0}`);
    }
  }
}

async function probeRemote(base: string): Promise<void> {
  const healthRes = await fetch(`${base}/api/health`);
  const health = (await healthRes.json()) as {
    ok?: boolean;
    openai_configured?: boolean;
    agents?: string[];
  };
  assert(healthRes.ok && health.ok === true, "GET /api/health ok");
  assert(Boolean(health.openai_configured), "OpenAI configured on production");
  assert(
    Array.isArray(health.agents) &&
      health.agents.includes("procurement") &&
      health.agents.includes("business_analytics"),
    "VALID_AGENTS includes procurement + business_analytics"
  );

  const bitrixRes = await fetch(`${base}/api/health/bitrix`);
  const bitrix = (await bitrixRes.json()) as {
    connected?: boolean;
    error?: string | null;
    entities?: Record<string, { ok: boolean; count?: number }>;
  };
  assert(bitrixRes.ok && bitrix.connected === true, `GET /api/health/bitrix connected`);
  if (bitrix.entities) {
    for (const [k, v] of Object.entries(bitrix.entities)) {
      assert(v.ok, `Production Bitrix ${k} ok count=${v.count ?? 0}`);
    }
  }

  for (const c of AGENT_CASES) {
    const started = Date.now();
    const res = await fetch(`${base}/api/chat/agent/${c.agent}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: c.question }),
    });
    const data = (await res.json()) as {
      success?: boolean;
      answer?: string;
      mode?: string;
      crm_summary?: Record<string, unknown>;
      routing?: { knowledge_files?: string[]; crm_entities?: string[] };
      detail?: { code?: string; message?: string };
    };
    const ms = Date.now() - started;
    const ok = res.ok && data.success === true && Boolean(data.answer?.trim());
    assert(ok, `[${c.agent}] ${ms}ms mode=${data.mode || "?"} answer=${data.answer?.slice(0, 60) || data.detail?.message}`);
    if (ok) {
      const kn = (data.routing?.knowledge_files?.length || 0) > 0;
      const crm = (data.routing?.crm_entities?.length || 0) > 0 || Boolean(data.crm_summary);
      console.log(`   knowledge=${kn} crm=${crm} openai=yes`);
    }
  }
}

async function main() {
  console.log(`Production release smoke`);
  console.log(`API_BASE: ${API_BASE || "(local Bitrix only)"}`);

  if (API_BASE) {
    await probeRemote(API_BASE);
  } else {
    await probeLocalBitrix();
    console.log("\nNOTE: Agent E2E uchun --base=https://... bering (OpenAI productionda).");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
