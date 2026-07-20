import {
  fetchAllDealsCompleteWithMeta,
  fetchAllTasksComplete,
  fetchDealStages,
  fetchUsersByIds,
  type BitrixUserInfo,
  type CrmRecord,
  type DealStageInfo,
} from "../bitrix";
import type { FinanceCrmTool, FinanceToolPlan } from "./tool-planner";

export interface FinanceCrmBundle {
  deals: CrmRecord[];
  tasks: CrmRecord[];
  employees: BitrixUserInfo[];
  stages: Map<string, DealStageInfo>;
  fetchedAt: string;
  timezone: "Asia/Tashkent";
  counts: Record<string, number>;
  empty: boolean;
  limitations: string[];
  focus: FinanceToolPlan["focus"];
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

function isClosedWon(d: CrmRecord): boolean {
  return String(d.CLOSED) === "Y" || String(d.STAGE_SEMANTIC_ID) === "S";
}

function opportunity(d: CrmRecord): number {
  return Number(d.OPPORTUNITY || 0);
}

function summarizeForPrompt(bundle: FinanceCrmBundle): string {
  const lines: string[] = [
    `Vaqt zonasi: Asia/Tashkent`,
    `Yuklangan vaqt (UTC ISO): ${bundle.fetchedAt}`,
    `Bitimlar (to'liq): ${bundle.counts.deals}`,
    `Vazifalar (to'liq): ${bundle.counts.tasks}`,
    `Menejerlar: ${bundle.counts.employees}`,
  ];

  if (bundle.limitations.length) {
    lines.push(`Cheklovlar: ${bundle.limitations.join("; ")}`);
  }

  const closed = bundle.deals.filter(isClosedWon);
  const zeroAmount = bundle.deals.filter((d) => opportunity(d) <= 0);
  const todayClosed = closed.filter((d) => {
    const dt = String(d.CLOSEDATE || d.DATE_MODIFY || d.DATE_CREATE || "");
    return dt && inTashkentDay(dt);
  });
  const monthClosed = closed.filter((d) => {
    const dt = String(d.CLOSEDATE || d.DATE_MODIFY || d.DATE_CREATE || "");
    return dt && inTashkentMonth(dt);
  });

  const todaySum = todayClosed.reduce((s, d) => s + opportunity(d), 0);
  const monthSum = monthClosed.reduce((s, d) => s + opportunity(d), 0);
  const closedSum = closed.reduce((s, d) => s + opportunity(d), 0);

  const large = [...bundle.deals]
    .sort((a, b) => opportunity(b) - opportunity(a))
    .filter((d) => opportunity(d) > 0)
    .slice(0, 8);

  const now = Date.now();
  const overdueTasks = bundle.tasks.filter((t) => {
    const deadline = String(t.DEADLINE || "");
    if (!deadline) return false;
    const ts = new Date(deadline).getTime();
    if (Number.isNaN(ts)) return false;
    const status = Number(t.STATUS || 0);
    return ts < now && status !== 5;
  });

  const debtLike = bundle.tasks.filter((t) => {
    const title = `${t.TITLE || ""} ${t.DESCRIPTION || ""}`.toLowerCase();
    return /qarz|debitor|to'?lov|pul|invoice|hisob/.test(title);
  });

  lines.push("", "=== Moliyaviy CRM faktlar ===");
  lines.push(`Bugungi yopilgan bitimlar: ${todayClosed.length}, tushum: ${formatSom(todaySum)}`);
  lines.push(`Joriy oy yopilgan bitimlar: ${monthClosed.length}, tushum: ${formatSom(monthSum)}`);
  lines.push(`Jami yopilgan (muvaffaqiyatli) bitimlar: ${closed.length}, summa: ${formatSom(closedSum)}`);
  lines.push(`Summasi 0 / kiritilmagan bitimlar: ${zeroAmount.length}`);
  lines.push(`Kechikkan vazifalar: ${overdueTasks.length}`);
  lines.push(`Qarzdorlikka o'xshash vazifalar: ${debtLike.length}`);

  if (large.length) {
    lines.push("", "Eng katta bitimlar (nom + summa):");
    for (const d of large) {
      lines.push(`- ${String(d.TITLE || "Bitim")}: ${formatSom(opportunity(d))}`);
    }
  }

  if (zeroAmount.length) {
    lines.push("", "Summasi 0 bo'lgan bitimlar (namuna):");
    for (const d of zeroAmount.slice(0, 8)) {
      lines.push(`- ${String(d.TITLE || "Bitim")}`);
    }
  }

  // Manager sales from closed deals this month
  const byManager = new Map<string, { count: number; sum: number }>();
  for (const d of monthClosed) {
    const id = String(d.ASSIGNED_BY_ID || "");
    if (!id) continue;
    const cur = byManager.get(id) || { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += opportunity(d);
    byManager.set(id, cur);
  }
  if (byManager.size) {
    const nameOf = (id: string) => bundle.employees.find((e) => e.id === id)?.name || `Xodim ${id}`;
    lines.push("", "Menejerlar kesimida joriy oy yopilgan savdo:");
    const rows = [...byManager.entries()]
      .map(([id, v]) => ({ name: nameOf(id), ...v }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 10);
    for (const r of rows) {
      lines.push(`- ${r.name}: ${r.count} bitim, ${formatSom(r.sum)}`);
    }
  }

  if (debtLike.length || overdueTasks.length) {
    lines.push("", "Qarz / kechikkan vazifalar (namuna):");
    for (const t of [...debtLike, ...overdueTasks].slice(0, 8)) {
      const owner = bundle.employees.find((e) => e.id === String(t.RESPONSIBLE_ID || ""))?.name || "noma'lum";
      lines.push(`- ${String(t.TITLE || "Vazifa")} · mas'ul: ${owner}`);
    }
  }

  return lines.join("\n");
}

export async function fetchFinanceCrmData(
  tools: FinanceCrmTool[],
  focus: FinanceToolPlan["focus"] = []
): Promise<FinanceCrmBundle> {
  const limitations: string[] = [];
  const bundle: FinanceCrmBundle = {
    deals: [],
    tasks: [],
    employees: [],
    stages: new Map(),
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Tashkent",
    counts: { deals: 0, tasks: 0, employees: 0 },
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
    tasks: bundle.tasks.length,
    employees: bundle.employees.length,
  };
  bundle.empty = bundle.counts.deals + bundle.counts.tasks === 0;
  return bundle;
}

export function financeCrmPromptBlock(bundle: FinanceCrmBundle): string {
  return summarizeForPrompt(bundle);
}
