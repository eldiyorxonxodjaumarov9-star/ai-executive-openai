import { fetchContacts, fetchDeals, fetchLeads, fetchTasks, type CrmPayload } from "./bitrix";

type CrmRecord = Record<string, unknown>;

const QUICK_MAX = 12;

const ENTITY_KEYWORDS: Record<string, string[]> = {
  deals: ["sotuv", "bitim", "narx", "qancha sotuv", "bugun sotuv", "savdo", "konversiya", "voronka"],
  tasks: ["vazifa", "kim nima qildi", "xodim", "ishchi", "bajarildi", "deadline", "nima qildi"],
  leads: ["lid", "so'rov", "so‘rov", "yangi mijoz", "lead"],
  contacts: ["mijoz", "kontakt", "aloqa", "contact"],
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/ʻ|’|`/g, "'");
}

export function detectQuickCrmEntities(question: string | null): string[] {
  if (!question?.trim()) return ["summary"];
  const text = normalize(question);
  const selected: string[] = [];

  for (const [entity, keywords] of Object.entries(ENTITY_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) selected.push(entity);
  }
  if (text.includes("mijoz") || text.includes("lid")) {
    if (!selected.includes("leads")) selected.push("leads");
    if (!selected.includes("contacts")) selected.push("contacts");
  }
  return selected.length ? [...new Set(selected)] : ["summary"];
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

export async function fetchCrmForQuick(question: string): Promise<{ entities: string[]; data: CrmPayload }> {
  const entities = detectQuickCrmEntities(question);
  const payload: CrmPayload = {
    fetched_at: new Date().toISOString(),
    leads: [],
    deals: [],
    contacts: [],
    tasks: [],
    summary: { leads_count: 0, deals_count: 0, contacts_count: 0, tasks_count: 0, total_opportunity: 0 },
    mode: "quick",
  };

  if (entities.length === 1 && entities[0] === "summary") {
    const [leads, deals, tasks] = await Promise.all([fetchLeads(), fetchDeals(), fetchTasks()]);
    payload.leads = leads.slice(0, 5);
    payload.deals = deals.slice(0, 5);
    payload.tasks = tasks.slice(0, 5);
    payload.summary = summaryFrom({ leads, deals, tasks });
    return { entities: ["summary"], data: payload };
  }

  const fetchers: Record<string, () => Promise<CrmRecord[]>> = {
    leads: fetchLeads,
    deals: fetchDeals,
    contacts: fetchContacts,
    tasks: fetchTasks,
  };

  await Promise.all(
    entities.map(async (name) => {
      if (!fetchers[name]) return;
      const items = (await fetchers[name]()).slice(0, QUICK_MAX);
      if (name === "leads") payload.leads = items;
      else if (name === "deals") payload.deals = items;
      else if (name === "contacts") payload.contacts = items;
      else if (name === "tasks") payload.tasks = items;
    })
  );
  payload.summary = summaryFrom(payload);
  return { entities, data: payload };
}

function formatCrmBlockQuick(data: CrmPayload): string {
  const lines: string[] = [];
  if (data.fetched_at) lines.push(`Ma'lumot olingan vaqt: ${data.fetched_at}`, "");
  lines.push("UMUMIY STATISTIKA:", JSON.stringify(data.summary, null, 2));

  for (const [key, label] of [
    ["leads", "LIDLAR"],
    ["deals", "BITIMLAR"],
    ["contacts", "KONTAKTLAR"],
    ["tasks", "VAZIFALAR"],
  ] as const) {
    const items = data[key];
    if (!items?.length) continue;
    lines.push(`\n${label} (${items.length} ta):`, JSON.stringify(items, null, 2));
  }
  return lines.join("\n");
}

function formatCrmBlockFull(data: CrmPayload): string {
  return formatCrmBlockQuick(data);
}

export { formatCrmBlockQuick, formatCrmBlockFull };
