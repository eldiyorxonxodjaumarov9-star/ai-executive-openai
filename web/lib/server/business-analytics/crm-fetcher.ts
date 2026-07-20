import {
  fetchAllActiveUsers,
  fetchAllActivitiesComplete,
  fetchAllCompaniesComplete,
  fetchAllContactsComplete,
  fetchAllDealsCompleteWithMeta,
  fetchAllDepartments,
  fetchAllLeadsComplete,
  fetchAllTasksComplete,
  fetchDealStages,
  fetchUsersByIds,
  type BitrixUserInfo,
  type CrmRecord,
  type DealStageInfo,
} from "../bitrix";
import type { BusinessAnalyticsCrmTool, BusinessAnalyticsToolPlan } from "./tool-planner";

export interface BusinessAnalyticsCrmBundle {
  leads: CrmRecord[];
  deals: CrmRecord[];
  contacts: CrmRecord[];
  companies: CrmRecord[];
  tasks: CrmRecord[];
  activities: CrmRecord[];
  users: BitrixUserInfo[];
  departments: CrmRecord[];
  stages: Map<string, DealStageInfo>;
  fetchedAt: string;
  timezone: "Asia/Tashkent";
  counts: Record<string, number>;
  empty: boolean;
  limitations: string[];
  focus: BusinessAnalyticsToolPlan["focus"];
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

function daysSince(iso: string, now = Date.now()): number | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / (24 * 60 * 60 * 1000));
}

function isTaskCompleted(t: CrmRecord): boolean {
  return Number(t.STATUS || 0) === 5;
}

function isTaskOpen(t: CrmRecord): boolean {
  return !isTaskCompleted(t);
}

function isOverdueTask(t: CrmRecord, now = Date.now()): boolean {
  const deadline = String(t.DEADLINE || "");
  if (!deadline) return false;
  const ts = new Date(deadline).getTime();
  return !Number.isNaN(ts) && ts < now && !isTaskCompleted(t);
}

function isClosedWon(d: CrmRecord): boolean {
  return String(d.CLOSED) === "Y" || String(d.STAGE_SEMANTIC_ID) === "S";
}

function isClosedLost(d: CrmRecord): boolean {
  return String(d.STAGE_SEMANTIC_ID) === "F";
}

function isActiveDeal(d: CrmRecord): boolean {
  return !isClosedWon(d) && !isClosedLost(d);
}

function opportunity(d: CrmRecord): number {
  return Number(d.OPPORTUNITY || 0);
}

function userName(users: BitrixUserInfo[], id: string): string {
  return users.find((u) => u.id === id)?.name || "noma'lum xodim";
}

function stageName(bundle: BusinessAnalyticsCrmBundle, d: CrmRecord): string {
  return bundle.stages.get(String(d.STAGE_ID || ""))?.name || "noma'lum bosqich";
}

function summarizeForPrompt(bundle: BusinessAnalyticsCrmBundle): string {
  const lines: string[] = [
    `Vaqt zonasi: Asia/Tashkent`,
    `Yuklangan vaqt (UTC ISO): ${bundle.fetchedAt}`,
    `Leadlar: ${bundle.counts.leads}`,
    `Bitimlar: ${bundle.counts.deals}`,
    `Kontaktlar: ${bundle.counts.contacts}`,
    `Kompaniyalar: ${bundle.counts.companies}`,
    `Vazifalar: ${bundle.counts.tasks}`,
    `Activities: ${bundle.counts.activities}`,
    `Faol xodimlar: ${bundle.counts.users}`,
    `Bo'limlar: ${bundle.counts.departments}`,
  ];

  if (bundle.limitations.length) {
    lines.push(`Cheklovlar: ${bundle.limitations.join("; ")}`);
  }

  const now = Date.now();
  const openTasks = bundle.tasks.filter(isTaskOpen);
  const overdueTasks = bundle.tasks.filter((t) => isOverdueTask(t, now));
  const won = bundle.deals.filter(isClosedWon);
  const lost = bundle.deals.filter(isClosedLost);
  const activeDeals = bundle.deals.filter(isActiveDeal);
  const todayLeads = bundle.leads.filter((l) => inTashkentDay(String(l.DATE_CREATE || l.DATE_MODIFY || "")));
  const todayWon = won.filter((d) => inTashkentDay(String(d.CLOSEDATE || d.DATE_MODIFY || "")));
  const conversion =
    bundle.leads.length > 0 ? Math.round((won.length / bundle.leads.length) * 1000) / 10 : 0;

  const stalled = activeDeals.filter((d) => {
    const dDays = daysSince(String(d.DATE_MODIFY || d.DATE_CREATE || ""), now);
    return dDays != null && dDays > 14;
  });

  const zeroAmountDeals = bundle.deals.filter((d) => opportunity(d) <= 0);
  const contactsNoEmail = bundle.contacts.filter((c) => !String(c.EMAIL || c.EMAIL_WORK || "").trim());
  const contactsNoPhone = bundle.contacts.filter((c) => !String(c.PHONE || c.PHONE_MOBILE || "").trim());
  const companiesNoContact = bundle.companies.filter((c) => {
    const mod = daysSince(String(c.DATE_MODIFY || c.DATE_CREATE || ""), now);
    return mod != null && mod > 90;
  });

  lines.push("", "=== Biznes analitika CRM aggregati ===");
  lines.push(`Bugungi yangi leadlar: ${todayLeads.length}`);
  lines.push(`Bugungi yopilgan bitimlar: ${todayWon.length}, summa: ${formatSom(todayWon.reduce((s, d) => s + opportunity(d), 0))}`);
  lines.push(`Faol bitimlar: ${activeDeals.length}; yutqazilgan: ${lost.length}; yopilgan jami: ${won.length}`);
  lines.push(`Taxminiy lead→yopilgan konversiya: ${conversion}%`);
  lines.push(`Uzoq turib qolgan faol bitimlar (>14 kun): ${stalled.length}`);
  lines.push(`Ochiq vazifalar: ${openTasks.length}; kechikkan: ${overdueTasks.length}`);

  if (overdueTasks.length) {
    lines.push("", "Kechikkan vazifalar (namuna):");
    for (const t of overdueTasks.slice(0, 8)) {
      const owner = userName(bundle.users, String(t.RESPONSIBLE_ID || ""));
      lines.push(`- ${String(t.TITLE || "Vazifa")} · mas'ul: ${owner}`);
    }
  }

  const workloadByUser = new Map<string, { open: number; overdue: number }>();
  for (const t of bundle.tasks) {
    const rid = String(t.RESPONSIBLE_ID || "");
    if (!rid) continue;
    const row = workloadByUser.get(rid) || { open: 0, overdue: 0 };
    if (isTaskOpen(t)) row.open += 1;
    if (isOverdueTask(t, now)) row.overdue += 1;
    workloadByUser.set(rid, row);
  }

  if (workloadByUser.size) {
    lines.push("", "Xodimlar kesimida yuqori yuklama (namuna):");
    for (const [uid, w] of [...workloadByUser.entries()]
      .sort((a, b) => b[1].open + b[1].overdue - (a[1].open + a[1].overdue))
      .slice(0, 8)) {
      lines.push(`- ${userName(bundle.users, uid)}: ochiq ${w.open}, kechikkan ${w.overdue}`);
    }
  }

  const byStage = new Map<string, number>();
  for (const d of activeDeals) {
    const name = stageName(bundle, d);
    byStage.set(name, (byStage.get(name) || 0) + 1);
  }
  if (byStage.size) {
    lines.push("", "Faol bitimlar bosqichlari:");
    for (const [name, count] of [...byStage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      lines.push(`- ${name}: ${count}`);
    }
  }

  lines.push("", "=== Ma'lumot sifati signallari ===");
  lines.push(`Summasi 0 yoki kiritilmagan bitimlar: ${zeroAmountDeals.length}`);
  lines.push(`Email yo'q kontaktlar: ${contactsNoEmail.length}`);
  lines.push(`Telefon yo'q kontaktlar: ${contactsNoPhone.length}`);
  lines.push(`90+ kun yangilanmagan kompaniyalar: ${companiesNoContact.length}`);

  if (stalled.length) {
    lines.push("", "Turib qolgan bitimlar (namuna):");
    for (const d of stalled.slice(0, 6)) {
      lines.push(`- ${String(d.TITLE || "Bitim")} · ${stageName(bundle, d)}`);
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

  if (bundle.departments.length) {
    lines.push("", `Bo'limlar jami: ${bundle.departments.length}`);
    for (const d of bundle.departments.slice(0, 8)) {
      lines.push(`- ${String(d.NAME || "Bo'lim")}`);
    }
  }

  return lines.join("\n");
}

export async function fetchBusinessAnalyticsCrmData(
  tools: BusinessAnalyticsCrmTool[],
  focus: BusinessAnalyticsToolPlan["focus"] = []
): Promise<BusinessAnalyticsCrmBundle> {
  const limitations: string[] = [];
  const bundle: BusinessAnalyticsCrmBundle = {
    leads: [],
    deals: [],
    contacts: [],
    companies: [],
    tasks: [],
    activities: [],
    users: [],
    departments: [],
    stages: new Map(),
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Tashkent",
    counts: {
      leads: 0,
      deals: 0,
      contacts: 0,
      companies: 0,
      tasks: 0,
      activities: 0,
      users: 0,
      departments: 0,
    },
    empty: true,
    limitations,
    focus,
  };

  const needsTasks =
    tools.includes("tasks") ||
    tools.includes("open_tasks") ||
    tools.includes("overdue_tasks") ||
    tools.includes("workload");

  const jobs: Array<Promise<void>> = [];

  if (tools.includes("leads") || tools.includes("conversion")) {
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

  if (tools.includes("deals") || tools.includes("conversion") || tools.includes("data_quality")) {
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

  if (tools.includes("contacts") || tools.includes("data_quality")) {
    jobs.push(
      (async () => {
        try {
          bundle.contacts = await fetchAllContactsComplete();
        } catch (e) {
          limitations.push(`kontaktlar: ${e instanceof Error ? e.message : "xato"}`);
        }
      })()
    );
  }

  if (tools.includes("companies") || tools.includes("data_quality")) {
    jobs.push(
      (async () => {
        try {
          bundle.companies = await fetchAllCompaniesComplete();
        } catch (e) {
          limitations.push(`kompaniyalar: ${e instanceof Error ? e.message : "xato"}`);
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

  if (tools.includes("users") || tools.includes("workload") || needsTasks) {
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

  if (tools.includes("departments") || tools.includes("workload")) {
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

  await Promise.all(jobs);

  if ((bundle.tasks.length || bundle.deals.length || bundle.leads.length) && !bundle.users.length) {
    const ids = new Set<string>();
    for (const t of bundle.tasks) {
      const rid = String(t.RESPONSIBLE_ID || "");
      if (rid) ids.add(rid);
    }
    for (const d of bundle.deals) {
      const aid = String(d.ASSIGNED_BY_ID || "");
      if (aid) ids.add(aid);
    }
    for (const l of bundle.leads) {
      const aid = String(l.ASSIGNED_BY_ID || "");
      if (aid) ids.add(aid);
    }
    if (ids.size) {
      try {
        const extra = await fetchUsersByIds([...ids]);
        bundle.users = [...extra.values()];
      } catch (e) {
        limitations.push(`xodim nomlari: ${e instanceof Error ? e.message : "xato"}`);
      }
    }
  }

  bundle.counts = {
    leads: bundle.leads.length,
    deals: bundle.deals.length,
    contacts: bundle.contacts.length,
    companies: bundle.companies.length,
    tasks: bundle.tasks.length,
    activities: bundle.activities.length,
    users: bundle.users.length,
    departments: bundle.departments.length,
  };

  bundle.empty =
    bundle.leads.length +
      bundle.deals.length +
      bundle.contacts.length +
      bundle.companies.length +
      bundle.tasks.length +
      bundle.activities.length ===
    0;

  return bundle;
}

export function businessAnalyticsCrmPromptBlock(bundle: BusinessAnalyticsCrmBundle): string {
  return summarizeForPrompt(bundle);
}
