import {
  BitrixError,
  fetchAllDealsComplete,
  fetchContacts,
  fetchDealStages,
  fetchLeads,
  fetchTasks,
  searchUsersByName,
  type CrmPayload,
} from "./bitrix";
import {
  computeSalesAnalytics,
  formatSalesBlock,
  parseSalesPeriod,
  type SalesAnalytics,
  type SalesFetchStatus,
} from "./sales-analytics";

type CrmRecord = Record<string, unknown>;

const QUICK_MAX = 12;

const DEAL_KEYWORDS = [
  "sotuv",
  "savdo",
  "bitim",
  "qancha sotildi",
  "qancha sotuv",
  "bugungi savdo",
  "bugun sotuv",
  "sotuv bo'ldi",
  "savdo bo'ldi",
  "sotildi",
  "yopildi",
  "yopilgan",
  "yaratildi",
  "voronka",
  "konversiya",
];

const ENTITY_KEYWORDS: Record<string, string[]> = {
  deals: DEAL_KEYWORDS,
  tasks: ["vazifa", "kim nima qildi", "xodim", "ishchi", "bajarildi", "deadline", "nima qildi", "nima ish", "topshiriq", "faoliyat"],
  leads: ["lid", "so'rov", "so‘rov", "yangi mijoz", "mijoz so'rovi", "mijoz so‘rovi"],
  contacts: ["kontakt", "aloqa", "tashkilot", "kompaniya"],
};

const GREETING_RE = /^(salom|assalomu?|hayrli|hello|hi|rahmat|xayr)[\s!.,?]*$/i;

function normalize(text: string): string {
  return text.toLowerCase().replace(/ʻ|’|`/g, "'");
}

function extractPersonName(question: string): string | null {
  const skip = new Set(["Bugun", "Kecha", "Oxirgi", "Nechta", "Qancha", "Kim", "Savdo", "Sotuv", "Bitim"]);
  const words = question.split(/\s+/);
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z\u0400-\u04FF']/g, "");
    if (clean.length >= 3 && /^[A-Z\u0410-\u042F]/.test(clean) && !skip.has(clean)) return clean;
  }
  return null;
}

export function isSalesQuery(question: string): boolean {
  const text = normalize(question);
  return DEAL_KEYWORDS.some((k) => text.includes(k));
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
  if (text.includes("bugun") && /\b(nechta|qancha|qildi|sotuv|savdo|bitim)\b/.test(text) && !selected.includes("deals")) {
    selected.push("deals");
  }

  return [...new Set(selected)];
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
  if (data.salesBlock) return true;
  if (data.salesAnalytics && data.salesAnalytics.fetchStatus === "ok") return true;
  if (data.salesAnalytics && data.salesAnalytics.totalDealsFetched > 0) return true;
  return data.leads.length + data.deals.length + data.contacts.length + data.tasks.length > 0;
}

async function fetchSalesData(question: string): Promise<{
  payload: CrmPayload;
  status: SalesFetchStatus;
  logReason?: string;
}> {
  const payload = emptyPayload();
  payload.mode = "sales";

  try {
    const [deals, stages] = await Promise.all([fetchAllDealsComplete(), fetchDealStages()]);
    const range = parseSalesPeriod(question);
    const personName = extractPersonName(question);

    let personUserIds: Set<string> | undefined;
    if (personName) {
      const users = await searchUsersByName(personName);
      if (users.length) {
        personUserIds = new Set(users.map((u) => String(u.ID)));
        payload.summary = summaryFrom({ deals });
      }
    }

    const analytics: SalesAnalytics = computeSalesAnalytics(deals, stages, range, personUserIds);
    if (personName) analytics.personFilter = personName;

    analytics.fetchStatus = deals.length === 0 ? "empty_crm" : analytics.fetchStatus;
    analytics.logReason =
      analytics.fetchStatus === "empty_crm"
        ? "Bitrix24 bo'sh natija qaytardi"
        : analytics.logReason;

    payload.deals = deals.slice(0, QUICK_MAX);
    payload.summary = summaryFrom({ deals });
    payload.salesAnalytics = analytics;
    payload.salesBlock = formatSalesBlock(analytics, question);
    payload.fetchStatus = analytics.fetchStatus;
    payload.fetchLogReason = analytics.logReason;

    console.info("[CRM] Sales analytics", {
      question: question.slice(0, 80),
      totalDeals: deals.length,
      wonCount: analytics.wonToday.count,
      wonTotal: analytics.wonToday.total,
      createdCount: analytics.createdToday.count,
      status: analytics.fetchStatus,
      reason: analytics.logReason,
    });

    return { payload, status: analytics.fetchStatus, logReason: analytics.logReason };
  } catch (e) {
    let status: SalesFetchStatus = "webhook_error";
    let logReason = "Bitrix24 webhook xatosi";

    if (e instanceof BitrixError) {
      if (e.code === "permission_denied") {
        status = "permission_denied";
        logReason = "Bitrix24 ruxsati yetarli emas";
      } else {
        logReason = e.message;
      }
      console.error("[CRM] Sales fetch xato", { code: e.code, status: e.statusCode, reason: logReason });
    } else {
      console.error("[CRM] Sales fetch kutilmagan xato", { error: e instanceof Error ? e.message : "unknown" });
    }

    payload.fetchStatus = status;
    payload.fetchLogReason = logReason;
    return { payload, status, logReason };
  }
}

export async function fetchCrmForQuick(question: string): Promise<{
  entities: string[];
  data: CrmPayload;
  fetchStatus?: SalesFetchStatus;
  fetchLogReason?: string;
}> {
  const entities = detectQuickCrmEntities(question);

  if (!entities.length) {
    return { entities: [], data: emptyPayload() };
  }

  if (entities.includes("deals") || isSalesQuery(question)) {
    const { payload, status, logReason } = await fetchSalesData(question);
    return {
      entities: [...new Set([...entities, "deals"])],
      data: payload,
      fetchStatus: status,
      fetchLogReason: logReason,
    };
  }

  const payload = emptyPayload();
  const fetchers: Record<string, () => Promise<CrmRecord[]>> = {
    leads: fetchLeads,
    contacts: fetchContacts,
    tasks: fetchTasks,
  };

  await Promise.all(
    entities.map(async (name) => {
      if (!fetchers[name]) return;
      let items = await fetchers[name]();
      items = items.slice(0, QUICK_MAX);
      if (name === "leads") payload.leads = items;
      else if (name === "contacts") payload.contacts = items;
      else if (name === "tasks") payload.tasks = items;
    })
  );

  payload.summary = summaryFrom(payload);
  return { entities, data: payload, fetchStatus: hasCrmData(payload) ? "ok" : "empty_crm" };
}

function formatCrmBlockQuick(data: CrmPayload, mode: "crm_only" | "hybrid" = "crm_only"): string {
  if (data.salesBlock) {
    return data.salesBlock;
  }

  const hasData = hasCrmData(data);

  if (!hasData) {
    const reason = data.fetchLogReason || "Bitrix24 dan ma'lumot olinmadi";
    console.warn("[CRM] Bo'sh context", { reason, mode, fetchStatus: data.fetchStatus });
    if (mode === "hybrid") {
      return `Bitrix24: ${reason}. Bilim bazasi qismini ishlating.`;
    }
    return `Bitrix24: ${reason}.`;
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
