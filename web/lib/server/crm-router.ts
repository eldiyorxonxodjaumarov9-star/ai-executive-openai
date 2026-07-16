import { fetchContacts, fetchDeals, fetchLeads, fetchTasks, type CrmPayload } from "./bitrix";

type CrmRecord = Record<string, unknown>;

const QUICK_MAX = 12;

const ENTITY_KEYWORDS: Record<string, string[]> = {
  deals: ["sotuv", "bitim", "summa", "qancha sotuv", "bugun sotuv", "savdo", "konversiya", "voronka", "sotildi", "savdo bo'ldi", "yopildi"],
  tasks: ["vazifa", "kim nima qildi", "xodim", "ishchi", "bajarildi", "deadline", "nima qildi", "nima ish", "topshiriq", "faoliyat"],
  leads: ["lid", "so'rov", "so‘rov", "yangi mijoz", "mijoz so'rovi", "mijoz so‘rovi"],
  contacts: ["kontakt", "aloqa", "tashkilot", "kompaniya"],
};

const GREETING_RE = /^(salom|assalomu?|hayrli|hello|hi|rahmat|xayr)[\s!.,?]*$/i;

function normalize(text: string): string {
  return text.toLowerCase().replace(/ʻ|’|`/g, "'");
}

function isToday(dateStr: unknown): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function extractPersonName(question: string): string | null {
  const words = question.split(/\s+/);
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z\u0400-\u04FF']/g, "");
    if (clean.length >= 3 && /^[A-Z\u0410-\u042F]/.test(clean)) return clean;
  }
  return null;
}

export function detectQuickCrmEntities(question: string | null): string[] {
  if (!question?.trim()) return [];
  if (GREETING_RE.test(question.trim())) return [];

  const text = normalize(question);
  const selected: string[] = [];

  for (const [entity, keywords] of Object.entries(ENTITY_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) selected.push(entity);
  }

  if (text.includes("mijoz") && !selected.includes("leads")) selected.push("leads");
  if (text.includes("bugun") && !selected.length) selected.push("leads", "deals", "tasks");

  return [...new Set(selected)];
}

function filterByToday(items: CrmRecord[], dateFields: string[]): CrmRecord[] {
  return items.filter((item) => dateFields.some((f) => isToday(item[f])));
}

function filterByName(items: CrmRecord[], name: string): CrmRecord[] {
  const lower = name.toLowerCase();
  return items.filter((item) => {
    const hay = [item.TITLE, item.DESCRIPTION, item.NAME, item.LAST_NAME]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(lower);
  });
}

function summaryFrom(data: Partial<CrmPayload>): CrmPayload["summary"] {
  const leads = data.leads || [];
  const deals = data.deals || [];
  const contacts = data.contacts || [];
  const tasks = data.tasks || [];
  return {
    leads_count: leads.length,
    deals_count: deals.length,
    contacts_count: contacts.length,
    tasks_count: tasks.length,
    total_opportunity: deals.reduce((s, d) => s + Number(d.OPPORTUNITY || 0), 0),
  };
}

function emptyPayload(): CrmPayload {
  return {
    fetched_at: new Date().toISOString(),
    leads: [],
    deals: [],
    contacts: [],
    tasks: [],
    summary: { leads_count: 0, deals_count: 0, contacts_count: 0, tasks_count: 0, total_opportunity: 0 },
    mode: "quick",
  };
}

export function hasCrmData(data: CrmPayload): boolean {
  return data.leads.length + data.deals.length + data.contacts.length + data.tasks.length > 0;
}

export async function fetchCrmForQuick(question: string): Promise<{ entities: string[]; data: CrmPayload }> {
  const entities = detectQuickCrmEntities(question);
  const text = normalize(question);
  const wantsToday = text.includes("bugun");
  const personName = extractPersonName(question);

  if (!entities.length) {
    return { entities: [], data: emptyPayload() };
  }

  const payload = emptyPayload();
  const fetchers: Record<string, () => Promise<CrmRecord[]>> = {
    leads: fetchLeads,
    deals: fetchDeals,
    contacts: fetchContacts,
    tasks: fetchTasks,
  };

  await Promise.all(
    entities.map(async (name) => {
      if (!fetchers[name]) return;
      let items = await fetchers[name]();

      if (name === "leads" && wantsToday) {
        items = filterByToday(items, ["DATE_CREATE", "DATE_MODIFY"]);
      }
      if (name === "deals" && wantsToday) {
        items = filterByToday(items, ["DATE_CREATE", "DATE_MODIFY", "CLOSEDATE"]);
      }
      if (name === "tasks") {
        if (personName) items = filterByName(items, personName);
        if (wantsToday) items = filterByToday(items, ["CREATED_DATE", "CHANGED_DATE", "DEADLINE"]);
      }

      items = items.slice(0, QUICK_MAX);
      if (name === "leads") payload.leads = items;
      else if (name === "deals") payload.deals = items;
      else if (name === "contacts") payload.contacts = items;
      else if (name === "tasks") payload.tasks = items;
    })
  );

  payload.summary = summaryFrom(payload);
  return { entities, data: payload };
}

function formatCrmBlockQuick(data: CrmPayload, mode: "crm_only" | "hybrid" = "crm_only"): string {
  const hasData = hasCrmData(data);

  if (!hasData) {
    if (mode === "hybrid") {
      return "Bitrix24: bu savol uchun tegishli yozuv topilmadi. Bilim bazasi qismini ishlating va fallback qoidasiga amal qiling.";
    }
    return "Bitrix24: bu savol uchun tegishli yozuv topilmadi. Fallback qoidasiga amal qiling — texnik xato xabari bermang.";
  }

  const lines: string[] = [];
  if (data.fetched_at) lines.push(`Ma'lumot olingan vaqt: ${data.fetched_at}`, "");
  lines.push("UMUMIY STATISTIKA:", JSON.stringify(data.summary, null, 2));

  for (const [key, label] of [
    ["leads", "MIJOZ SO'ROVLARI"],
    ["deals", "BITIMLAR"],
    ["contacts", "ALOQALAR"],
    ["tasks", "VAZIFALAR"],
  ] as const) {
    const items = data[key];
    if (!items?.length) continue;
    lines.push(`\n${label} (${items.length} ta):`, JSON.stringify(items, null, 2));
  }
  return lines.join("\n");
}

export { formatCrmBlockQuick };
