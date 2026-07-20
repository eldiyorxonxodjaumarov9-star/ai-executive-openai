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
import type { ProcurementCrmTool, ProcurementToolPlan } from "./tool-planner";

export interface ProcurementCrmBundle {
  companies: CrmRecord[];
  contacts: CrmRecord[];
  deals: CrmRecord[];
  tasks: CrmRecord[];
  activities: CrmRecord[];
  employees: BitrixUserInfo[];
  stages: Map<string, DealStageInfo>;
  fetchedAt: string;
  timezone: "Asia/Tashkent";
  counts: Record<string, number>;
  empty: boolean;
  limitations: string[];
  focus: ProcurementToolPlan["focus"];
  suppliersRequested: boolean;
}

function formatSom(n: number): string {
  return `${Math.round(n).toLocaleString("uz-UZ").replace(/,/g, " ")} so'm`;
}

function companyName(c: CrmRecord): string {
  return String(c.TITLE || c.NAME || `Kompaniya ${c.ID || ""}`);
}

function contactName(c: CrmRecord): string {
  const name = `${c.NAME || ""} ${c.LAST_NAME || ""}`.trim();
  return name || `Kontakt ${c.ID || ""}`;
}

function employeeName(employees: BitrixUserInfo[], id: string): string {
  return employees.find((e) => e.id === id)?.name || "noma'lum xodim";
}

function isTaskCompleted(t: CrmRecord): boolean {
  return Number(t.STATUS || 0) === 5;
}

function isOverdue(t: CrmRecord, now = Date.now()): boolean {
  const deadline = String(t.DEADLINE || "");
  if (!deadline) return false;
  const ts = new Date(deadline).getTime();
  return !Number.isNaN(ts) && ts < now && !isTaskCompleted(t);
}

function isActiveDeal(d: CrmRecord): boolean {
  const semantic = String(d.STAGE_SEMANTIC_ID || "");
  return String(d.CLOSED) !== "Y" && semantic !== "S" && semantic !== "F";
}

function opportunity(d: CrmRecord): number {
  return Number(d.OPPORTUNITY || 0);
}

function looksLikeSupplierCompany(c: CrmRecord): boolean {
  const blob = `${c.TITLE || ""} ${c.COMMENTS || ""} ${c.INDUSTRY || ""}`.toLowerCase();
  return /yetkazib|supplier|ta'minot|taminot|xarid|logistika|ombor|vendor/.test(blob);
}

function summarizeForPrompt(bundle: ProcurementCrmBundle): string {
  const lines: string[] = [
    `Vaqt zonasi: Asia/Tashkent`,
    `Yuklangan vaqt (UTC ISO): ${bundle.fetchedAt}`,
    `Kompaniyalar: ${bundle.counts.companies}`,
    `Kontaktlar: ${bundle.counts.contacts}`,
    `Bitimlar: ${bundle.counts.deals}`,
    `Vazifalar: ${bundle.counts.tasks}`,
    `Activities: ${bundle.counts.activities}`,
  ];

  if (bundle.limitations.length) {
    lines.push(`Cheklovlar: ${bundle.limitations.join("; ")}`);
  }

  const now = Date.now();
  const openTasks = bundle.tasks.filter((t) => !isTaskCompleted(t));
  const overdueTasks = bundle.tasks.filter((t) => isOverdue(t, now));
  const activeDeals = bundle.deals.filter(isActiveDeal);
  const closedDeals = bundle.deals.filter(
    (d) => String(d.CLOSED) === "Y" || String(d.STAGE_SEMANTIC_ID) === "S"
  );

  const supplierLikeCompanies = bundle.companies.filter(looksLikeSupplierCompany);

  const recentActivities = [...bundle.activities]
    .sort((a, b) => {
      const ta = new Date(String(a.CREATED || a.LAST_UPDATED || "")).getTime() || 0;
      const tb = new Date(String(b.CREATED || b.LAST_UPDATED || "")).getTime() || 0;
      return tb - ta;
    })
    .slice(0, 10);

  lines.push("", "=== Ta'minot CRM faktlar ===");
  lines.push(`Faol bitimlar: ${activeDeals.length}`);
  lines.push(`Yopilgan bitimlar: ${closedDeals.length}`);
  lines.push(`Ochiq vazifalar: ${openTasks.length}`);
  lines.push(`Kechikkan vazifalar: ${overdueTasks.length}`);

  if (bundle.suppliersRequested) {
    lines.push(
      "",
      `Yetkazib beruvchi kompaniyalar (kompaniya nomi/izoh bo'yicha taxminiy filtr): ${supplierLikeCompanies.length}`
    );
    if (supplierLikeCompanies.length) {
      for (const c of supplierLikeCompanies.slice(0, 8)) {
        lines.push(`- ${companyName(c)}`);
      }
    } else if (bundle.companies.length) {
      lines.push("Alohida supplier entity yo'q — kompaniyalar ro'yxatidan aniq yetkazib beruvchi ajratib bo'lmadi.");
      for (const c of bundle.companies.slice(0, 6)) {
        lines.push(`- ${companyName(c)} (umumiy kompaniya)`);
      }
    }
  }

  if (overdueTasks.length) {
    lines.push("", "Kechikkan yetkazib berish vazifalari (namuna):");
    for (const t of overdueTasks.slice(0, 8)) {
      const owner = employeeName(bundle.employees, String(t.RESPONSIBLE_ID || ""));
      lines.push(
        `- ${String(t.TITLE || "Vazifa")} · mas'ul: ${owner} · deadline: ${String(t.DEADLINE || "noma'lum")}`
      );
    }
  }

  if (activeDeals.length) {
    lines.push("", "Faol xarid/ta'minot bitimlari (namuna):");
    for (const d of activeDeals.slice(0, 8)) {
      const amount = opportunity(d) > 0 ? formatSom(opportunity(d)) : "summa ko'rsatilmagan";
      lines.push(`- ${String(d.TITLE || "Bitim")}: ${amount}`);
    }
  }

  if (recentActivities.length) {
    lines.push("", "Oxirgi ta'minot activities (namuna):");
    for (const a of recentActivities) {
      lines.push(`- ${String(a.SUBJECT || "Activity")} · ${String(a.CREATED || a.LAST_UPDATED || "")}`);
    }
  }

  if (bundle.contacts.length && bundle.focus.includes("supplier_contacts")) {
    lines.push("", "Bog'liq kontaktlar (namuna):");
    for (const c of bundle.contacts.slice(0, 6)) {
      lines.push(`- ${contactName(c)}`);
    }
  }

  return lines.join("\n");
}

export async function fetchProcurementCrmData(
  tools: ProcurementCrmTool[],
  focus: ProcurementToolPlan["focus"] = []
): Promise<ProcurementCrmBundle> {
  const limitations: string[] = [];
  const suppliersRequested = tools.includes("suppliers");

  const bundle: ProcurementCrmBundle = {
    companies: [],
    contacts: [],
    deals: [],
    tasks: [],
    activities: [],
    employees: [],
    stages: new Map(),
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Tashkent",
    counts: { companies: 0, contacts: 0, deals: 0, tasks: 0, activities: 0, employees: 0 },
    empty: true,
    limitations,
    focus,
    suppliersRequested,
  };

  if (suppliersRequested) {
    limitations.push(
      "suppliers: Bitrix24 da alohida supplier entity ulanmagan — yetkazib beruvchilar kompaniyalar ro'yxati orqali taxminiy ko'rsatiladi"
    );
  }

  const needsCompanies = tools.includes("companies") || suppliersRequested;
  const needsTasks = tools.includes("tasks");

  const jobs: Array<Promise<void>> = [];

  if (needsCompanies) {
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

  await Promise.all(jobs);

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

  if (ids.size) {
    try {
      const map = await fetchUsersByIds([...ids]);
      bundle.employees = [...map.values()];
    } catch (e) {
      limitations.push(`xodim nomlari: ${e instanceof Error ? e.message : "xato"}`);
    }
  }

  bundle.counts = {
    companies: bundle.companies.length,
    contacts: bundle.contacts.length,
    deals: bundle.deals.length,
    tasks: bundle.tasks.length,
    activities: bundle.activities.length,
    employees: bundle.employees.length,
  };

  bundle.empty =
    bundle.counts.companies +
      bundle.counts.contacts +
      bundle.counts.deals +
      bundle.counts.tasks +
      bundle.counts.activities ===
    0;

  return bundle;
}

export function procurementCrmPromptBlock(bundle: ProcurementCrmBundle): string {
  return summarizeForPrompt(bundle);
}
