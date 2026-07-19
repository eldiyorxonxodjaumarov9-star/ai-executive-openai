import {
  fetchAllCompaniesComplete,
  fetchAllContactsComplete,
  fetchAllDealsCompleteWithMeta,
  fetchAllLeadsComplete,
  fetchAllTasksComplete,
  fetchDealStages,
  fetchUsersByIds,
  type BitrixUserInfo,
  type CrmRecord,
  type DealStageInfo,
} from "../bitrix";
import type { CeoCrmTool } from "./tool-planner";

export interface CeoCrmBundle {
  deals: CrmRecord[];
  leads: CrmRecord[];
  tasks: CrmRecord[];
  contacts: CrmRecord[];
  companies: CrmRecord[];
  employees: BitrixUserInfo[];
  stages: Map<string, DealStageInfo>;
  fetchedAt: string;
  timezone: "Asia/Tashkent";
  counts: Record<string, number>;
  empty: boolean;
  limitations: string[];
}

function summarizeForPrompt(bundle: CeoCrmBundle): string {
  const lines: string[] = [
    `Vaqt zonasi: Asia/Tashkent`,
    `Yuklangan vaqt (UTC ISO): ${bundle.fetchedAt}`,
    `Bitimlar: ${bundle.counts.deals}`,
    `Mijoz so'rovlari: ${bundle.counts.leads}`,
    `Vazifalar: ${bundle.counts.tasks}`,
    `Kontaktlar: ${bundle.counts.contacts}`,
    `Kompaniyalar: ${bundle.counts.companies}`,
    `Xodimlar (mas'ullar): ${bundle.counts.employees}`,
  ];

  if (bundle.limitations.length) {
    lines.push(`Cheklovlar: ${bundle.limitations.join("; ")}`);
  }

  const closed = bundle.deals.filter(
    (d) => String(d.CLOSED) === "Y" || String(d.STAGE_SEMANTIC_ID) === "S"
  );
  const open = bundle.deals.filter(
    (d) =>
      String(d.CLOSED) !== "Y" &&
      String(d.STAGE_SEMANTIC_ID) !== "S" &&
      String(d.STAGE_SEMANTIC_ID) !== "F"
  );
  const oppSum = bundle.deals.reduce((s, d) => s + Number(d.OPPORTUNITY || 0), 0);

  lines.push("", "=== Qisqa CRM faktlar ===");
  lines.push(`Ochiq bitimlar: ${open.length}`);
  lines.push(`Yopilgan (muvaffaqiyatli) bitimlar: ${closed.length}`);
  lines.push(`Bitimlar jami imkoniyat summasi: ${Math.round(oppSum)} so'm`);

  const sampleDeals = open.slice(0, 8).map((d) => {
    const stage = bundle.stages.get(String(d.STAGE_ID || ""));
    return `- ${String(d.TITLE || "Bitim")}: ${Number(d.OPPORTUNITY || 0)} so'm, bosqich: ${stage?.name || "noma'lum"}`;
  });
  if (sampleDeals.length) {
    lines.push("", "Namuna ochiq bitimlar:");
    lines.push(...sampleDeals);
  }

  const sampleLeads = bundle.leads.slice(0, 6).map((l) => {
    const title = String(l.TITLE || `${l.NAME || ""} ${l.LAST_NAME || ""}`.trim() || "So'rov");
    return `- ${title}`;
  });
  if (sampleLeads.length) {
    lines.push("", "Namuna mijoz so'rovlari:");
    lines.push(...sampleLeads);
  }

  const sampleTasks = bundle.tasks.slice(0, 6).map((t) => `- ${String(t.TITLE || "Vazifa")}`);
  if (sampleTasks.length) {
    lines.push("", "Namuna vazifalar:");
    lines.push(...sampleTasks);
  }

  if (bundle.employees.length) {
    lines.push("", "Mas'ul xodimlar:");
    for (const u of bundle.employees.slice(0, 12)) {
      lines.push(`- ${u.name}`);
    }
  }

  return lines.join("\n");
}

export async function fetchCeoCrmData(tools: CeoCrmTool[]): Promise<CeoCrmBundle> {
  const limitations: string[] = [];
  const bundle: CeoCrmBundle = {
    deals: [],
    leads: [],
    tasks: [],
    contacts: [],
    companies: [],
    employees: [],
    stages: new Map(),
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Tashkent",
    counts: { deals: 0, leads: 0, tasks: 0, contacts: 0, companies: 0, employees: 0 },
    empty: true,
    limitations,
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
          limitations.push(`mijoz so'rovlari: ${e instanceof Error ? e.message : "xato"}`);
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

  await Promise.all(jobs);

  if (tools.includes("employees") || tools.includes("deals") || tools.includes("tasks")) {
    const ids = new Set<string>();
    for (const d of bundle.deals) {
      if (d.ASSIGNED_BY_ID != null) ids.add(String(d.ASSIGNED_BY_ID));
    }
    for (const t of bundle.tasks) {
      if (t.RESPONSIBLE_ID != null) ids.add(String(t.RESPONSIBLE_ID));
    }
    for (const l of bundle.leads) {
      if (l.ASSIGNED_BY_ID != null) ids.add(String(l.ASSIGNED_BY_ID));
    }
    try {
      const map = await fetchUsersByIds([...ids]);
      bundle.employees = [...map.values()];
    } catch (e) {
      limitations.push(`xodimlar: ${e instanceof Error ? e.message : "xato"}`);
    }
  }

  bundle.counts = {
    deals: bundle.deals.length,
    leads: bundle.leads.length,
    tasks: bundle.tasks.length,
    contacts: bundle.contacts.length,
    companies: bundle.companies.length,
    employees: bundle.employees.length,
  };
  bundle.empty =
    bundle.counts.deals +
      bundle.counts.leads +
      bundle.counts.tasks +
      bundle.counts.contacts +
      bundle.counts.companies ===
    0;

  return bundle;
}

export function ceoCrmPromptBlock(bundle: CeoCrmBundle): string {
  return summarizeForPrompt(bundle);
}
