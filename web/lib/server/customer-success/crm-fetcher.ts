import {
  fetchAllActivitiesComplete,
  fetchAllCompaniesComplete,
  fetchAllContactsComplete,
  fetchAllDealsCompleteWithMeta,
  fetchAllTasksComplete,
  fetchDealStages,
  fetchUsersByIds,
  type BitrixUserInfo,
  type CrmRecord,
  type DealStageInfo,
} from "../bitrix";
import type { CustomerSuccessCrmTool, CustomerSuccessToolPlan } from "./tool-planner";

export interface CustomerSuccessCrmBundle {
  contacts: CrmRecord[];
  companies: CrmRecord[];
  deals: CrmRecord[];
  activities: CrmRecord[];
  tasks: CrmRecord[];
  employees: BitrixUserInfo[];
  stages: Map<string, DealStageInfo>;
  fetchedAt: string;
  timezone: "Asia/Tashkent";
  counts: Record<string, number>;
  empty: boolean;
  limitations: string[];
  focus: CustomerSuccessToolPlan["focus"];
}

function formatSom(n: number): string {
  return `${Math.round(n).toLocaleString("uz-UZ").replace(/,/g, " ")} so'm`;
}

function contactName(c: CrmRecord): string {
  const name = `${c.NAME || ""} ${c.LAST_NAME || ""}`.trim();
  return name || `Kontakt ${c.ID || ""}`;
}

function daysSince(iso: string, now = Date.now()): number | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / (24 * 60 * 60 * 1000));
}

function isClosedWon(d: CrmRecord): boolean {
  return String(d.CLOSED) === "Y" || String(d.STAGE_SEMANTIC_ID) === "S";
}

function isActiveDeal(d: CrmRecord): boolean {
  const semantic = String(d.STAGE_SEMANTIC_ID || "");
  return String(d.CLOSED) !== "Y" && semantic !== "S" && semantic !== "F";
}

function opportunity(d: CrmRecord): number {
  return Number(d.OPPORTUNITY || 0);
}

function summarizeForPrompt(bundle: CustomerSuccessCrmBundle): string {
  const lines: string[] = [
    `Vaqt zonasi: Asia/Tashkent`,
    `Yuklangan vaqt (UTC ISO): ${bundle.fetchedAt}`,
    `Kontaktlar: ${bundle.counts.contacts}`,
    `Kompaniyalar: ${bundle.counts.companies}`,
    `Bitimlar: ${bundle.counts.deals}`,
    `Activities: ${bundle.counts.activities}`,
    `Vazifalar: ${bundle.counts.tasks}`,
  ];

  if (bundle.limitations.length) {
    lines.push(`Cheklovlar: ${bundle.limitations.join("; ")}`);
  }

  const now = Date.now();
  const activeContacts = bundle.contacts.filter((c) => {
    const d = daysSince(String(c.DATE_MODIFY || c.DATE_CREATE || ""), now);
    return d != null && d <= 30;
  });
  const inactiveContacts = bundle.contacts.filter((c) => {
    const d = daysSince(String(c.DATE_MODIFY || c.DATE_CREATE || ""), now);
    return d != null && d > 60;
  });
  const longSilent = bundle.contacts.filter((c) => {
    const d = daysSince(String(c.DATE_MODIFY || c.DATE_CREATE || ""), now);
    return d != null && d > 90;
  });

  const won = bundle.deals.filter(isClosedWon);
  const activeDeals = bundle.deals.filter(isActiveDeal);
  const large = [...won]
    .filter((d) => opportunity(d) > 0)
    .sort((a, b) => opportunity(b) - opportunity(a))
    .slice(0, 8);

  const wonByContact = new Map<string, number>();
  for (const d of won) {
    const cid = String(d.CONTACT_ID || d.COMPANY_ID || "");
    if (!cid) continue;
    wonByContact.set(cid, (wonByContact.get(cid) || 0) + 1);
  }
  const repeatBuyers = [...wonByContact.entries()].filter(([, n]) => n >= 2).length;

  const overdueTasks = bundle.tasks.filter((t) => {
    const deadline = String(t.DEADLINE || "");
    if (!deadline) return false;
    const ts = new Date(deadline).getTime();
    return !Number.isNaN(ts) && ts < now && Number(t.STATUS || 0) !== 5;
  });

  const recentActivities = [...bundle.activities]
    .sort((a, b) => {
      const ta = new Date(String(a.CREATED || a.LAST_UPDATED || "")).getTime() || 0;
      const tb = new Date(String(b.CREATED || b.LAST_UPDATED || "")).getTime() || 0;
      return tb - ta;
    })
    .slice(0, 10);

  const callLike = bundle.activities.filter((a) => {
    const blob = `${a.TYPE_ID || ""} ${a.PROVIDER_ID || ""} ${a.SUBJECT || ""}`.toLowerCase();
    return /call|qo'ng'iroq|telefon/.test(blob);
  });
  const emailLike = bundle.activities.filter((a) => {
    const blob = `${a.TYPE_ID || ""} ${a.PROVIDER_ID || ""} ${a.SUBJECT || ""}`.toLowerCase();
    return /email|pochta|mail/.test(blob);
  });

  lines.push("", "=== Customer Success CRM faktlar ===");
  lines.push(`Faol kontaktlar (30 kun ichida yangilangan): ${activeContacts.length}`);
  lines.push(`Faol bo'lmagan (>60 kun): ${inactiveContacts.length}`);
  lines.push(`Uzoq aloqasiz (>90 kun): ${longSilent.length}`);
  lines.push(`Yopilgan (yutilgan) bitimlar: ${won.length}`);
  lines.push(`Faol bitimlar: ${activeDeals.length}`);
  lines.push(`Takroriy xarid signali (2+ yutilgan bitim bog'langan): ${repeatBuyers}`);
  lines.push(`Kechikkan vazifalar: ${overdueTasks.length}`);
  lines.push(`Qo'ng'iroq tipidagi activity: ${callLike.length}; email tipidagi: ${emailLike.length}`);

  if (recentActivities.length) {
    lines.push("", "Oxirgi activities (namuna):");
    for (const a of recentActivities) {
      const when = String(a.CREATED || a.LAST_UPDATED || "noma'lum");
      lines.push(`- ${String(a.SUBJECT || "Activity")} · ${when}`);
    }
  }

  if (longSilent.length) {
    lines.push("", "Uzoq aloqasiz kontaktlar (namuna):");
    for (const c of longSilent.slice(0, 8)) {
      const d = daysSince(String(c.DATE_MODIFY || c.DATE_CREATE || ""), now);
      lines.push(`- ${contactName(c)} · ~${d} kun yangilanmagan`);
    }
  }

  if (large.length) {
    lines.push("", "Yirik mijoz bitimlari (namuna):");
    for (const d of large) {
      lines.push(`- ${String(d.TITLE || "Bitim")}: ${formatSom(opportunity(d))}`);
    }
  }

  if (overdueTasks.length) {
    lines.push("", "Kechikkan vazifalar (namuna):");
    for (const t of overdueTasks.slice(0, 8)) {
      const owner =
        bundle.employees.find((e) => e.id === String(t.RESPONSIBLE_ID || ""))?.name || "noma'lum";
      lines.push(`- ${String(t.TITLE || "Vazifa")} · mas'ul: ${owner}`);
    }
  }

  if (bundle.companies.length) {
    const staleCompanies = bundle.companies.filter((c) => {
      const d = daysSince(String(c.DATE_MODIFY || c.DATE_CREATE || ""), now);
      return d != null && d > 90;
    });
    lines.push(`Kompaniyalar jami: ${bundle.companies.length}; uzoq yangilanmagan: ${staleCompanies.length}`);
  }

  return lines.join("\n");
}

export async function fetchCustomerSuccessCrmData(
  tools: CustomerSuccessCrmTool[],
  focus: CustomerSuccessToolPlan["focus"] = []
): Promise<CustomerSuccessCrmBundle> {
  const limitations: string[] = [];
  const bundle: CustomerSuccessCrmBundle = {
    contacts: [],
    companies: [],
    deals: [],
    activities: [],
    tasks: [],
    employees: [],
    stages: new Map(),
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Tashkent",
    counts: { contacts: 0, companies: 0, deals: 0, activities: 0, tasks: 0, employees: 0 },
    empty: true,
    limitations,
    focus,
  };

  const jobs: Array<Promise<void>> = [];

  if (tools.includes("contacts")) {
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

  if (tools.includes("companies")) {
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

  if (tools.includes("employees") || tools.includes("tasks") || tools.includes("deals")) {
    const ids = new Set<string>();
    for (const d of bundle.deals) {
      if (d.ASSIGNED_BY_ID != null) ids.add(String(d.ASSIGNED_BY_ID));
    }
    for (const t of bundle.tasks) {
      if (t.RESPONSIBLE_ID != null) ids.add(String(t.RESPONSIBLE_ID));
    }
    for (const c of bundle.companies) {
      if (c.ASSIGNED_BY_ID != null) ids.add(String(c.ASSIGNED_BY_ID));
    }
    try {
      const map = await fetchUsersByIds([...ids]);
      bundle.employees = [...map.values()];
    } catch (e) {
      limitations.push(`xodimlar: ${e instanceof Error ? e.message : "xato"}`);
    }
  }

  bundle.counts = {
    contacts: bundle.contacts.length,
    companies: bundle.companies.length,
    deals: bundle.deals.length,
    activities: bundle.activities.length,
    tasks: bundle.tasks.length,
    employees: bundle.employees.length,
  };
  bundle.empty =
    bundle.counts.contacts +
      bundle.counts.companies +
      bundle.counts.deals +
      bundle.counts.activities +
      bundle.counts.tasks ===
    0;
  return bundle;
}

export function customerSuccessCrmPromptBlock(bundle: CustomerSuccessCrmBundle): string {
  return summarizeForPrompt(bundle);
}
