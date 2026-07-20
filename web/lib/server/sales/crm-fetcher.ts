import {
  fetchAllDealsCompleteWithMeta,
  fetchAllLeadsComplete,
  fetchAllTasksComplete,
  fetchDealStages,
  fetchUsersByIds,
  type BitrixUserInfo,
  type CrmRecord,
  type DealStageInfo,
} from "../bitrix";
import type { SalesCrmTool, SalesToolPlan } from "./tool-planner";

export interface SalesCrmBundle {
  deals: CrmRecord[];
  leads: CrmRecord[];
  tasks: CrmRecord[];
  employees: BitrixUserInfo[];
  stages: Map<string, DealStageInfo>;
  fetchedAt: string;
  timezone: "Asia/Tashkent";
  counts: Record<string, number>;
  empty: boolean;
  limitations: string[];
  focus: SalesToolPlan["focus"];
}

function formatSom(n: number): string {
  return `${Math.round(n).toLocaleString("uz-UZ").replace(/,/g, " ")} so'm`;
}

function inTashkentDay(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d) === fmt.format(now);
}

function inTashkentMonth(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
  });
  return fmt.format(d) === fmt.format(now);
}

function daysAgo(iso: string, days: number, now = new Date()): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const ms = days * 24 * 60 * 60 * 1000;
  return now.getTime() - d.getTime() <= ms;
}

function isClosedWon(d: CrmRecord): boolean {
  return String(d.CLOSED) === "Y" || String(d.STAGE_SEMANTIC_ID) === "S";
}

function isClosedLost(d: CrmRecord): boolean {
  return String(d.STAGE_SEMANTIC_ID) === "F";
}

function isActive(d: CrmRecord): boolean {
  return !isClosedWon(d) && !isClosedLost(d);
}

function opportunity(d: CrmRecord): number {
  return Number(d.OPPORTUNITY || 0);
}

function stageName(bundle: SalesCrmBundle, d: CrmRecord): string {
  return bundle.stages.get(String(d.STAGE_ID || ""))?.name || "noma'lum bosqich";
}

function summarizeForPrompt(bundle: SalesCrmBundle): string {
  const lines: string[] = [
    `Vaqt zonasi: Asia/Tashkent`,
    `Yuklangan vaqt (UTC ISO): ${bundle.fetchedAt}`,
    `Bitimlar (to'liq): ${bundle.counts.deals}`,
    `Leadlar (to'liq): ${bundle.counts.leads}`,
    `Vazifalar (to'liq): ${bundle.counts.tasks}`,
    `Menejerlar: ${bundle.counts.employees}`,
  ];

  if (bundle.limitations.length) {
    lines.push(`Cheklovlar: ${bundle.limitations.join("; ")}`);
  }

  const won = bundle.deals.filter(isClosedWon);
  const lost = bundle.deals.filter(isClosedLost);
  const active = bundle.deals.filter(isActive);
  const zeroAmount = bundle.deals.filter((d) => opportunity(d) <= 0);
  const todayWon = won.filter((d) => inTashkentDay(String(d.CLOSEDATE || d.DATE_MODIFY || "")));
  const weekWon = won.filter((d) => daysAgo(String(d.CLOSEDATE || d.DATE_MODIFY || ""), 7));
  const monthWon = won.filter((d) => inTashkentMonth(String(d.CLOSEDATE || d.DATE_MODIFY || "")));
  const todayLeads = bundle.leads.filter((l) => inTashkentDay(String(l.DATE_CREATE || l.DATE_MODIFY || "")));
  const weekLeads = bundle.leads.filter((l) => daysAgo(String(l.DATE_CREATE || l.DATE_MODIFY || ""), 7));

  const stalled = active.filter((d) => {
    const mod = String(d.DATE_MODIFY || d.DATE_CREATE || "");
    const t = new Date(mod).getTime();
    if (Number.isNaN(t)) return false;
    return Date.now() - t > 14 * 24 * 60 * 60 * 1000;
  });

  const conversion =
    bundle.leads.length > 0 ? Math.round((won.length / bundle.leads.length) * 1000) / 10 : 0;

  const now = Date.now();
  const overdueTasks = bundle.tasks.filter((t) => {
    const deadline = String(t.DEADLINE || "");
    if (!deadline) return false;
    const ts = new Date(deadline).getTime();
    if (Number.isNaN(ts)) return false;
    return ts < now && Number(t.STATUS || 0) !== 5;
  });

  const followupLike = bundle.tasks.filter((t) => {
    const title = `${t.TITLE || ""} ${t.DESCRIPTION || ""}`.toLowerCase();
    return /follow|qo'ng'iroq|aloqa|mijoz|lead/.test(title);
  });

  lines.push("", "=== Savdo CRM faktlar ===");
  lines.push(`Bugungi yopilgan bitimlar: ${todayWon.length}, summa: ${formatSom(todayWon.reduce((s, d) => s + opportunity(d), 0))}`);
  lines.push(`Oxirgi 7 kun yopilgan: ${weekWon.length}, summa: ${formatSom(weekWon.reduce((s, d) => s + opportunity(d), 0))}`);
  lines.push(`Joriy oy yopilgan: ${monthWon.length}, summa: ${formatSom(monthWon.reduce((s, d) => s + opportunity(d), 0))}`);
  lines.push(`Faol bitimlar: ${active.length}`);
  lines.push(`Yutqazilgan bitimlar: ${lost.length}`);
  lines.push(`Bugungi leadlar: ${todayLeads.length}; 7 kunlik leadlar: ${weekLeads.length}; jami leadlar: ${bundle.leads.length}`);
  lines.push(`Taxminiy konversiya (yopilgan/leadlar): ${conversion}%`);
  lines.push(`Uzoq turib qolgan (>14 kun): ${stalled.length}`);
  lines.push(`Summasi 0 bitimlar: ${zeroAmount.length}`);
  lines.push(`Kechikkan vazifalar: ${overdueTasks.length}`);
  lines.push(`Follow-up tipidagi vazifalar: ${followupLike.length}`);

  // Stage breakdown (active)
  const byStage = new Map<string, number>();
  for (const d of active) {
    const name = stageName(bundle, d);
    byStage.set(name, (byStage.get(name) || 0) + 1);
  }
  if (byStage.size) {
    lines.push("", "Bosqichlar bo'yicha faol bitimlar:");
    for (const [name, count] of [...byStage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      lines.push(`- ${name}: ${count}`);
    }
  }

  // Sources from leads
  const bySource = new Map<string, number>();
  for (const l of bundle.leads) {
    const src = String(l.SOURCE_ID || "noma'lum");
    bySource.set(src, (bySource.get(src) || 0) + 1);
  }
  if (bySource.size) {
    lines.push("", "Lead manbalari (kod emas — ichki ID ni matnda yozmang, faqat son):");
    for (const [, count] of [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      lines.push(`- manba guruhi: ${count} ta lead`);
    }
  }

  const large = [...bundle.deals]
    .filter((d) => opportunity(d) > 0)
    .sort((a, b) => opportunity(b) - opportunity(a))
    .slice(0, 8);
  if (large.length) {
    lines.push("", "Eng katta bitimlar:");
    for (const d of large) {
      lines.push(`- ${String(d.TITLE || "Bitim")}: ${formatSom(opportunity(d))} · ${stageName(bundle, d)}`);
    }
  }

  if (stalled.length) {
    lines.push("", "Uzoq turib qolgan bitimlar (namuna):");
    for (const d of stalled.slice(0, 8)) {
      lines.push(`- ${String(d.TITLE || "Bitim")} · ${stageName(bundle, d)}`);
    }
  }

  const byManager = new Map<string, { won: number; sum: number; active: number }>();
  for (const d of monthWon) {
    const id = String(d.ASSIGNED_BY_ID || "");
    if (!id) continue;
    const cur = byManager.get(id) || { won: 0, sum: 0, active: 0 };
    cur.won += 1;
    cur.sum += opportunity(d);
    byManager.set(id, cur);
  }
  for (const d of active) {
    const id = String(d.ASSIGNED_BY_ID || "");
    if (!id) continue;
    const cur = byManager.get(id) || { won: 0, sum: 0, active: 0 };
    cur.active += 1;
    byManager.set(id, cur);
  }
  if (byManager.size) {
    const nameOf = (id: string) => bundle.employees.find((e) => e.id === id)?.name || `Menejer ${id}`;
    lines.push("", "Menejerlar kesimida joriy oy:");
    const rows = [...byManager.entries()]
      .map(([id, v]) => ({ name: nameOf(id), ...v }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 10);
    for (const r of rows) {
      lines.push(`- ${r.name}: yopilgan ${r.won}, summa ${formatSom(r.sum)}, faol ${r.active}`);
    }
  }

  if (overdueTasks.length || followupLike.length) {
    lines.push("", "Kechikkan / follow-up vazifalar (namuna):");
    for (const t of [...overdueTasks, ...followupLike].slice(0, 8)) {
      const owner =
        bundle.employees.find((e) => e.id === String(t.RESPONSIBLE_ID || ""))?.name || "noma'lum";
      lines.push(`- ${String(t.TITLE || "Vazifa")} · mas'ul: ${owner}`);
    }
  }

  return lines.join("\n");
}

export async function fetchSalesCrmData(
  tools: SalesCrmTool[],
  focus: SalesToolPlan["focus"] = []
): Promise<SalesCrmBundle> {
  const limitations: string[] = [];
  const bundle: SalesCrmBundle = {
    deals: [],
    leads: [],
    tasks: [],
    employees: [],
    stages: new Map(),
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Tashkent",
    counts: { deals: 0, leads: 0, tasks: 0, employees: 0 },
    empty: true,
    limitations,
    focus,
  };

  const jobs: Array<Promise<void>> = [];

  if (tools.includes("deals")) {
    jobs.push(
      (async () => {
        try {
          const pack = await fetchAllDealsCompleteWithMeta();
          bundle.deals = pack.deals;
          bundle.stages = await fetchDealStages();
        } catch (e) {
          limitations.push(`bitimlar: ${e instanceof Error ? e.message : "xato"}`);
        }
      })()
    );
  }

  if (tools.includes("leads")) {
    jobs.push(
      (async () => {
        try {
          bundle.leads = await fetchAllLeadsComplete();
        } catch (e) {
          limitations.push(`leadlar: ${e instanceof Error ? e.message : "xato"}`);
        }
      })()
    );
  }

  if (tools.includes("tasks")) {
    jobs.push(
      (async () => {
        try {
          bundle.tasks = await fetchAllTasksComplete();
        } catch (e) {
          limitations.push(`vazifalar: ${e instanceof Error ? e.message : "xato"}`);
        }
      })()
    );
  }

  await Promise.all(jobs);

  if (tools.includes("employees") || tools.includes("deals") || tools.includes("tasks")) {
    const ids = new Set<string>();
    for (const d of bundle.deals) {
      if (d.ASSIGNED_BY_ID != null) ids.add(String(d.ASSIGNED_BY_ID));
    }
    for (const l of bundle.leads) {
      if (l.ASSIGNED_BY_ID != null) ids.add(String(l.ASSIGNED_BY_ID));
    }
    for (const t of bundle.tasks) {
      if (t.RESPONSIBLE_ID != null) ids.add(String(t.RESPONSIBLE_ID));
    }
    try {
      const map = await fetchUsersByIds([...ids]);
      bundle.employees = [...map.values()];
    } catch (e) {
      limitations.push(`menejerlar: ${e instanceof Error ? e.message : "xato"}`);
    }
  }

  bundle.counts = {
    deals: bundle.deals.length,
    leads: bundle.leads.length,
    tasks: bundle.tasks.length,
    employees: bundle.employees.length,
  };
  bundle.empty = bundle.counts.deals + bundle.counts.leads + bundle.counts.tasks === 0;
  return bundle;
}

export function salesCrmPromptBlock(bundle: SalesCrmBundle): string {
  return summarizeForPrompt(bundle);
}
