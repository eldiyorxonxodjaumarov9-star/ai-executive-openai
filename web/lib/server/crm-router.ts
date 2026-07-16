import {
  BitrixError,
  fetchAllDealsCompleteWithMeta,
  fetchContacts,
  fetchDealStages,
  fetchLeads,
  fetchTasks,
  fetchUsersByIds,
  type CrmPayload,
} from "./bitrix";
import {
  buildCrmAnalytics,
  buildCrmAnalyticsPreview,
  formatCrmAnalyticsContext,
  type CrmAnalyticsContext,
} from "./crm-analytics";
import { analyzeCrmQuery, isCrmDealQuery, type CrmQueryRouting } from "./crm-query-router";
import { normalizeDeals } from "./deal-normalizer";
import type { SalesFetchStatus } from "./sales-analytics";

type CrmRecord = Record<string, unknown>;

const QUICK_MAX = 12;

const DEAL_KEYWORDS = [
  "sotuv", "savdo", "bitim", "jami", "umumiy", "menejer", "eng katta", "eng ko'p", "eng kop",
  "hisobot", "voronka", "yutqazilgan", "yopildi", "yopilgan", "yaratildi", "ochiq", "summasi",
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

export function isSalesQuery(question: string): boolean {
  const text = normalize(question);
  return DEAL_KEYWORDS.some((k) => text.includes(k)) || isCrmDealQuery(question);
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
  if (isCrmDealQuery(question) && !selected.includes("deals")) selected.push("deals");

  return [...new Set(selected)];
}

function summaryFrom(deals: CrmRecord[]) {
  return {
    leads_count: 0,
    deals_count: deals.length,
    contacts_count: 0,
    tasks_count: 0,
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
  if (data.crmAnalytics) return data.crmAnalytics.totalDealsLoaded > 0;
  if (data.salesBlock) return true;
  if (data.salesAnalytics && data.salesAnalytics.totalDealsFetched > 0) return true;
  return data.leads.length + data.deals.length + data.contacts.length + data.tasks.length > 0;
}

export interface CrmFetchResult {
  entities: string[];
  data: CrmPayload;
  routing: CrmQueryRouting;
  analytics: CrmAnalyticsContext | null;
  fetchStatus: SalesFetchStatus;
  fetchLogReason?: string;
}

export async function fetchCrmAnalytics(question: string): Promise<CrmFetchResult> {
  const routing = analyzeCrmQuery(question);
  const payload = emptyPayload();
  payload.mode = "crm_analytics";

  try {
    const [{ deals, paginationPages }, stages] = await Promise.all([
      fetchAllDealsCompleteWithMeta(),
      fetchDealStages(),
    ]);

    const assigneeIds = deals.map((d) => String(d.ASSIGNED_BY_ID || "")).filter(Boolean);
    const users = await fetchUsersByIds(assigneeIds);
    const normalized = normalizeDeals(deals, stages, users);
    const analytics = buildCrmAnalytics(normalized, routing);
    const contextBlock = formatCrmAnalyticsContext(analytics, question);

    payload.deals = deals.slice(0, QUICK_MAX);
    payload.summary = summaryFrom(deals);
    payload.crmAnalytics = analytics;
    payload.salesBlock = contextBlock;
    payload.fetchStatus = deals.length === 0 ? "empty_crm" : "ok";
    payload.fetchLogReason = analytics.notes.join(" ") || undefined;

    console.info("[CRM] Analytics", {
      question: question.slice(0, 80),
      metric: routing.metric,
      dateRange: routing.dateRange.label,
      totalLoaded: analytics.totalDealsLoaded,
      matched: analytics.matchedDealsCount,
      pages: paginationPages,
    });

    return {
      entities: ["deals"],
      data: payload,
      routing,
      analytics,
      fetchStatus: payload.fetchStatus as SalesFetchStatus,
      fetchLogReason: payload.fetchLogReason,
    };
  } catch (e) {
    let status: SalesFetchStatus = "webhook_error";
    let logReason = "Bitrix24 webhook xatosi";

    if (e instanceof BitrixError) {
      status = e.code === "permission_denied" ? "permission_denied" : "webhook_error";
      logReason = e.message;
      console.error("[CRM] Analytics xato", { code: e.code, reason: logReason });
    } else {
      console.error("[CRM] Analytics kutilmagan xato", { error: e instanceof Error ? e.message : "unknown" });
    }

    payload.fetchStatus = status;
    payload.fetchLogReason = logReason;
    return { entities: ["deals"], data: payload, routing, analytics: null, fetchStatus: status, fetchLogReason: logReason };
  }
}

export async function fetchCrmForQuick(question: string): Promise<{
  entities: string[];
  data: CrmPayload;
  fetchStatus?: SalesFetchStatus;
  fetchLogReason?: string;
  routing?: CrmQueryRouting;
  analytics?: CrmAnalyticsContext | null;
}> {
  const entities = detectQuickCrmEntities(question);

  if (!entities.length) {
    return { entities: [], data: emptyPayload() };
  }

  if (entities.includes("deals") || isSalesQuery(question)) {
    const result = await fetchCrmAnalytics(question);
    return {
      entities: result.entities,
      data: result.data,
      fetchStatus: result.fetchStatus,
      fetchLogReason: result.fetchLogReason,
      routing: result.routing,
      analytics: result.analytics,
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
      const items = (await fetchers[name]()).slice(0, QUICK_MAX);
      if (name === "leads") payload.leads = items;
      else if (name === "contacts") payload.contacts = items;
      else if (name === "tasks") payload.tasks = items;
    })
  );

  payload.summary = {
    leads_count: payload.leads.length,
    deals_count: payload.deals.length,
    contacts_count: payload.contacts.length,
    tasks_count: payload.tasks.length,
    total_opportunity: 0,
  };

  return { entities, data: payload, fetchStatus: hasCrmData(payload) ? "ok" : "empty_crm" };
}

function formatCrmBlockQuick(data: CrmPayload, mode: "crm_only" | "hybrid" = "crm_only"): string {
  if (data.salesBlock) return data.salesBlock;

  const hasData = hasCrmData(data);
  if (!hasData) {
    const reason = data.fetchLogReason || "Bitrix24 dan ma'lumot olinmadi";
    console.warn("[CRM] Bo'sh context", { reason, mode, fetchStatus: data.fetchStatus });
    if (mode === "hybrid") return `Bitrix24: ${reason}. Bilim bazasi qismini ishlating.`;
    return `Bitrix24: ${reason}.`;
  }

  const lines: string[] = [];
  if (data.fetched_at) lines.push(`Ma'lumot olingan vaqt: ${data.fetched_at}`, "");
  lines.push("UMUMIY STATISTIKA:", JSON.stringify(data.summary, null, 2));
  return lines.join("\n");
}

export { formatCrmBlockQuick, buildCrmAnalyticsPreview };
