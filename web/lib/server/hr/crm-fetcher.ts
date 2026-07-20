import {
  fetchAllActiveUsers,
  fetchAllActivitiesComplete,
  fetchAllDealsCompleteWithMeta,
  fetchAllDepartments,
  fetchAllTasksComplete,
  fetchUsersByIds,
  type BitrixUserInfo,
  type CrmRecord,
  type DealStageInfo,
} from "../bitrix";
import type { HrCrmTool, HrToolPlan } from "./tool-planner";

export interface HrCrmBundle {
  users: BitrixUserInfo[];
  departments: CrmRecord[];
  tasks: CrmRecord[];
  activities: CrmRecord[];
  deals: CrmRecord[];
  stages: Map<string, DealStageInfo>;
  fetchedAt: string;
  timezone: "Asia/Tashkent";
  counts: Record<string, number>;
  empty: boolean;
  limitations: string[];
  focus: HrToolPlan["focus"];
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

function isTaskCompleted(t: CrmRecord): boolean {
  return Number(t.STATUS || 0) === 5;
}

function isTaskOpen(t: CrmRecord): boolean {
  const status = Number(t.STATUS || 0);
  return status !== 5;
}

function isOverdue(t: CrmRecord, now = Date.now()): boolean {
  const deadline = String(t.DEADLINE || "");
  if (!deadline) return false;
  const ts = new Date(deadline).getTime();
  return !Number.isNaN(ts) && ts < now && !isTaskCompleted(t);
}

function userName(users: BitrixUserInfo[], id: string): string {
  return users.find((u) => u.id === id)?.name || "noma'lum xodim";
}

function summarizeForPrompt(bundle: HrCrmBundle): string {
  const lines: string[] = [
    `Vaqt zonasi: Asia/Tashkent`,
    `Yuklangan vaqt (UTC ISO): ${bundle.fetchedAt}`,
    `Faol xodimlar: ${bundle.counts.users}`,
    `Bo'limlar: ${bundle.counts.departments}`,
    `Vazifalar: ${bundle.counts.tasks}`,
    `Activities: ${bundle.counts.activities}`,
  ];

  if (bundle.limitations.length) {
    lines.push(`Cheklovlar: ${bundle.limitations.join("; ")}`);
  }

  lines.push(
    "",
    "Eslatma: Bitrix24 da davomat (attendance) moduli bu integratsiyada mavjud emas — davomat haqida ma'lumot bermang."
  );

  const now = Date.now();
  const openTasks = bundle.tasks.filter(isTaskOpen);
  const completedTasks = bundle.tasks.filter(isTaskCompleted);
  const overdueTasks = bundle.tasks.filter((t) => isOverdue(t, now));
  const completedToday = completedTasks.filter((t) =>
    inTashkentDay(String(t.CHANGED_DATE || t.CREATED_DATE || ""))
  );

  const workload = new Map<string, { open: number; overdue: number; completedToday: number }>();
  for (const t of bundle.tasks) {
    const rid = String(t.RESPONSIBLE_ID || "");
    if (!rid) continue;
    const row = workload.get(rid) || { open: 0, overdue: 0, completedToday: 0 };
    if (isTaskOpen(t)) row.open += 1;
    if (isOverdue(t, now)) row.overdue += 1;
    if (isTaskCompleted(t) && inTashkentDay(String(t.CHANGED_DATE || t.CREATED_DATE || ""))) {
      row.completedToday += 1;
    }
    workload.set(rid, row);
  }

  const workloadRows = [...workload.entries()]
    .map(([id, w]) => ({
      id,
      name: userName(bundle.users, id),
      ...w,
      total: w.open + w.overdue,
    }))
    .sort((a, b) => b.total - a.total);

  lines.push("", "=== HR CRM faktlar ===");
  lines.push(`Ochiq vazifalar: ${openTasks.length}`);
  lines.push(`Bajarilgan vazifalar: ${completedTasks.length}`);
  lines.push(`Kechikkan vazifalar: ${overdueTasks.length}`);
  lines.push(`Bugun bajarilgan (Tashkent): ${completedToday.length}`);

  if (overdueTasks.length) {
    lines.push("", "Kechikkan vazifalar (namuna):");
    for (const t of overdueTasks.slice(0, 10)) {
      const owner = userName(bundle.users, String(t.RESPONSIBLE_ID || ""));
      lines.push(`- ${String(t.TITLE || "Vazifa")} · mas'ul: ${owner} · deadline: ${String(t.DEADLINE || "noma'lum")}`);
    }
  }

  if (workloadRows.length) {
    lines.push("", "Ish yuklamasi (mas'ul bo'yicha, namuna):");
    for (const row of workloadRows.slice(0, 10)) {
      lines.push(
        `- ${row.name}: ochiq ${row.open}, kechikkan ${row.overdue}, bugun bajarilgan ${row.completedToday}`
      );
    }
  }

  if (completedToday.length) {
    lines.push("", "Bugun bajarilgan vazifalar (namuna):");
    for (const t of completedToday.slice(0, 8)) {
      const owner = userName(bundle.users, String(t.RESPONSIBLE_ID || ""));
      lines.push(`- ${String(t.TITLE || "Vazifa")} · ${owner}`);
    }
  }

  if (bundle.departments.length) {
    lines.push("", `Bo'limlar jami: ${bundle.departments.length}`);
    for (const d of bundle.departments.slice(0, 8)) {
      lines.push(`- ${String(d.NAME || "Bo'lim")}`);
    }
  }

  if (bundle.activities.length) {
    const recent = [...bundle.activities]
      .sort((a, b) => {
        const ta = new Date(String(a.CREATED || a.LAST_UPDATED || "")).getTime() || 0;
        const tb = new Date(String(b.CREATED || b.LAST_UPDATED || "")).getTime() || 0;
        return tb - ta;
      })
      .slice(0, 8);
    lines.push("", "Oxirgi CRM activities (namuna):");
    for (const a of recent) {
      lines.push(`- ${String(a.SUBJECT || "Activity")} · ${String(a.CREATED || a.LAST_UPDATED || "")}`);
    }
  }

  if (bundle.deals.length && bundle.focus.includes("employee_deals")) {
    const won = bundle.deals.filter(
      (d) => String(d.CLOSED) === "Y" || String(d.STAGE_SEMANTIC_ID) === "S"
    );
    lines.push("", `Xodim bitim natijalari (yopilgan bitimlar): ${won.length}`);
    const byAssignee = new Map<string, number>();
    for (const d of won) {
      const aid = String(d.ASSIGNED_BY_ID || "");
      if (!aid) continue;
      byAssignee.set(aid, (byAssignee.get(aid) || 0) + 1);
    }
    for (const [id, n] of [...byAssignee.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      lines.push(`- ${userName(bundle.users, id)}: ${n} ta yopilgan bitim`);
    }
  }

  return lines.join("\n");
}

export async function fetchHrCrmData(
  tools: HrCrmTool[],
  focus: HrToolPlan["focus"] = []
): Promise<HrCrmBundle> {
  const limitations: string[] = [];
  const bundle: HrCrmBundle = {
    users: [],
    departments: [],
    tasks: [],
    activities: [],
    deals: [],
    stages: new Map(),
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Tashkent",
    counts: { users: 0, departments: 0, tasks: 0, activities: 0, deals: 0 },
    empty: true,
    limitations,
    focus,
  };

  const needsTasks =
    tools.includes("tasks") ||
    tools.includes("open_tasks") ||
    tools.includes("overdue_tasks") ||
    tools.includes("completed_tasks") ||
    tools.includes("workload");

  const jobs: Array<Promise<void>> = [];

  if (tools.includes("users") || needsTasks) {
    jobs.push(
      (async () => {
        try {
          bundle.users = await fetchAllActiveUsers();
        } catch (e) {
          limitations.push(`xodimlar: ${e instanceof Error ? e.message : "xato"}`);
        }
      })()
    );
  }

  if (tools.includes("departments")) {
    jobs.push(
      (async () => {
        try {
          bundle.departments = await fetchAllDepartments();
        } catch (e) {
          limitations.push(`bo'limlar: ${e instanceof Error ? e.message : "xato"}`);
        }
      })()
    );
  }

  if (needsTasks) {
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

  if (tools.includes("activities")) {
    jobs.push(
      (async () => {
        try {
          bundle.activities = await fetchAllActivitiesComplete();
        } catch (e) {
          limitations.push(`activities: ${e instanceof Error ? e.message : "xato"}`);
        }
      })()
    );
  }

  if (tools.includes("deals")) {
    jobs.push(
      (async () => {
        try {
          const pack = await fetchAllDealsCompleteWithMeta();
          bundle.deals = pack.deals;
        } catch (e) {
          limitations.push(`bitimlar: ${e instanceof Error ? e.message : "xato"}`);
        }
      })()
    );
  }

  await Promise.all(jobs);

  if (bundle.tasks.length && !bundle.users.length) {
    const ids = new Set<string>();
    for (const t of bundle.tasks) {
      const rid = String(t.RESPONSIBLE_ID || "");
      if (rid) ids.add(rid);
    }
    try {
      const extra = await fetchUsersByIds([...ids]);
      bundle.users = [...extra.values()];
    } catch (e) {
      limitations.push(`xodim nomlari: ${e instanceof Error ? e.message : "xato"}`);
    }
  }

  bundle.counts = {
    users: bundle.users.length,
    departments: bundle.departments.length,
    tasks: bundle.tasks.length,
    activities: bundle.activities.length,
    deals: bundle.deals.length,
  };

  bundle.empty =
    bundle.users.length + bundle.tasks.length + bundle.activities.length + bundle.deals.length === 0;

  limitations.push("attendance: Bitrix24 REST orqali davomat ma'lumoti ulanmagan");

  return bundle;
}

export function hrCrmPromptBlock(bundle: HrCrmBundle): string {
  return summarizeForPrompt(bundle);
}
