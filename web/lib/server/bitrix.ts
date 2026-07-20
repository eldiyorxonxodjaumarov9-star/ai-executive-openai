import { getEnv } from "./env";

export class BitrixError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = "BitrixError";
  }
}

export type CrmRecord = Record<string, unknown>;

export interface DealStageInfo {
  name: string;
  semantics: string | null;
  isSuccess: boolean;
  isFail: boolean;
}

export interface BitrixListResponse {
  result: unknown;
  next?: number;
  total?: number;
  error?: string;
  error_description?: string;
}

export const DEAL_SELECT_FIELDS = [
  "ID",
  "TITLE",
  "OPPORTUNITY",
  "CURRENCY_ID",
  "STAGE_ID",
  "STAGE_SEMANTIC_ID",
  "DATE_CREATE",
  "DATE_MODIFY",
  "CLOSEDATE",
  "CLOSED",
  "ASSIGNED_BY_ID",
  "CATEGORY_ID",
  "CONTACT_ID",
  "COMPANY_ID",
] as const;

const stageCache: { map: Map<string, DealStageInfo>; expiresAt: number } = {
  map: new Map(),
  expiresAt: 0,
};

const STAGE_CACHE_TTL_MS = 5 * 60 * 1000;

function safeLog(level: "error" | "warn" | "info", message: string, detail?: Record<string, unknown>) {
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  if (level === "error") console.error(`[Bitrix24] ${message}${payload}`);
  else if (level === "warn") console.warn(`[Bitrix24] ${message}${payload}`);
  else console.info(`[Bitrix24] ${message}${payload}`);
}

function normalizeRecord(record: CrmRecord): CrmRecord {
  const normalized: CrmRecord = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    if (Array.isArray(value) && value[0] && typeof value[0] === "object" && "VALUE" in (value[0] as object)) {
      normalized[key] = (value as { VALUE?: string }[]).map((v) => v.VALUE).filter(Boolean);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

function classifyBitrixError(error: string, description?: string): BitrixError {
  const msg = (description || error).toLowerCase();
  if (msg.includes("insufficient scope") || msg.includes("access denied") || msg.includes("permission")) {
    return new BitrixError("Bitrix24 ruxsati yetarli emas.", 403, "permission_denied");
  }
  if (msg.includes("invalid") && msg.includes("token")) {
    return new BitrixError("Bitrix24 webhook noto'g'ri.", 401, "webhook_error");
  }
  return new BitrixError(description || error, undefined, "webhook_error");
}

export async function bitrixCallRaw(method: string, params: CrmRecord = {}): Promise<BitrixListResponse> {
  const { bitrixWebhookUrl } = getEnv();
  if (!bitrixWebhookUrl) {
    safeLog("error", "Webhook URL sozlanmagan");
    throw new BitrixError("BITRIX24_WEBHOOK_URL sozlanmagan.", undefined, "webhook_error");
  }

  const url = `${bitrixWebhookUrl}/${method}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(55000),
    });
  } catch (e) {
    safeLog("error", "Ulanish xatosi", { method, error: e instanceof Error ? e.message : "network" });
    throw new BitrixError("CRM ulanish xatosi — Bitrix24 dan javob kelmadi.", undefined, "webhook_error");
  }

  if (response.status >= 400) {
    safeLog("error", "HTTP xato", { method, status: response.status });
    throw new BitrixError(`Bitrix24 HTTP ${response.status}`, response.status, "webhook_error");
  }

  let data: BitrixListResponse;
  try {
    data = (await response.json()) as BitrixListResponse;
  } catch {
    safeLog("error", "JSON parse xato", { method });
    throw new BitrixError("Bitrix24 javobi o'qilmadi.", undefined, "webhook_error");
  }

  if (data.error) {
    safeLog("error", "API xato", { method, error: data.error, description: data.error_description });
    throw classifyBitrixError(data.error, data.error_description);
  }

  return data;
}

async function bitrixCall(method: string, params: CrmRecord = {}): Promise<unknown> {
  const data = await bitrixCallRaw(method, params);
  return data.result;
}

export async function listAllPaginated(
  method: string,
  params: { select: string[]; order?: Record<string, string>; filter?: CrmRecord },
  options: { maxRecords?: number } = {}
): Promise<{ items: CrmRecord[]; paginationPages: number }> {
  const maxRecords = options.maxRecords ?? 10000;
  const collected: CrmRecord[] = [];
  let start: number | undefined = 0;
  let page = 0;

  while (collected.length < maxRecords) {
    page += 1;
    const callParams: CrmRecord = { ...params, start };
    const data = await bitrixCallRaw(method, callParams);

    const items = Array.isArray(data.result) ? data.result : [];
    if (!items.length) break;

    collected.push(...items.map(normalizeRecord));

    if (data.next === undefined || data.next === null) break;
    start = data.next;

    if (page > 500) {
      safeLog("warn", "Pagination limitga yetdi", { method, collected: collected.length });
      break;
    }
  }

  return { items: collected.slice(0, maxRecords), paginationPages: page };
}

async function listAll(
  method: string,
  select: string[],
  limit: number,
  order?: Record<string, string>
): Promise<CrmRecord[]> {
  const { items } = await listAllPaginated(method, { select, order }, { maxRecords: limit });
  return items;
}

export interface DealsFetchMeta {
  deals: CrmRecord[];
  paginationPages: number;
}

export async function fetchAllDealsCompleteWithMeta(): Promise<DealsFetchMeta> {
  safeLog("info", "Barcha bitimlar yuklanmoqda (to'liq pagination)");
  const { items, paginationPages } = await listAllPaginated(
    "crm.deal.list",
    {
      select: [...DEAL_SELECT_FIELDS],
      order: { DATE_MODIFY: "DESC" },
    },
    { maxRecords: 10000 }
  );
  safeLog("info", "Bitimlar yuklandi", { count: items.length, paginationPages });
  return { deals: items, paginationPages };
}

export async function fetchAllDealsComplete(): Promise<CrmRecord[]> {
  const { deals } = await fetchAllDealsCompleteWithMeta();
  return deals;
}

export async function fetchDealStages(): Promise<Map<string, DealStageInfo>> {
  if (stageCache.map.size && Date.now() < stageCache.expiresAt) {
    return stageCache.map;
  }

  const stages = new Map<string, DealStageInfo>();
  const entityIds = new Set<string>(["DEAL_STAGE"]);

  try {
    const categories = (await bitrixCall("crm.dealcategory.list", {})) as CrmRecord[] | undefined;
    if (Array.isArray(categories)) {
      for (const cat of categories) {
        if (cat.ID != null) entityIds.add(`DEAL_STAGE_${cat.ID}`);
      }
    }
  } catch (e) {
    safeLog("warn", "Deal category yuklanmadi", {
      error: e instanceof Error ? e.message : "unknown",
    });
  }

  for (const entityId of entityIds) {
    try {
      const data = await bitrixCallRaw("crm.status.list", { filter: { ENTITY_ID: entityId } });
      const statuses = Array.isArray(data.result) ? data.result : [];
      for (const raw of statuses) {
        const s = raw as CrmRecord;
        const id = String(s.STATUS_ID || "");
        if (!id) continue;
        const semantics = typeof s.SEMANTICS === "string" ? s.SEMANTICS : null;
        stages.set(id, {
          name: String(s.NAME || id),
          semantics,
          isSuccess: semantics === "S",
          isFail: semantics === "F",
        });
      }
    } catch (e) {
      safeLog("warn", "Stage list yuklanmadi", { entityId, error: e instanceof Error ? e.message : "unknown" });
    }
  }

  stageCache.map = stages;
  stageCache.expiresAt = Date.now() + STAGE_CACHE_TTL_MS;
  safeLog("info", "Bosqichlar yuklandi", { count: stages.size });
  return stages;
}

export interface BitrixUserInfo {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
}

function mapUser(raw: CrmRecord): BitrixUserInfo {
  const firstName = String(raw.NAME ?? "");
  const lastName = String(raw.LAST_NAME ?? "");
  return {
    id: String(raw.ID ?? ""),
    name: `${firstName} ${lastName}`.trim() || String(raw.NAME ?? ""),
    firstName,
    lastName,
  };
}

export async function fetchUsersByIds(ids: string[]): Promise<Map<string, BitrixUserInfo>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, BitrixUserInfo>();

  await Promise.all(
    unique.slice(0, 100).map(async (id) => {
      try {
        const result = (await bitrixCall("user.get", { ID: id })) as CrmRecord | CrmRecord[] | undefined;
        const user = Array.isArray(result) ? result[0] : result;
        if (user && user.ID != null) {
          const info = mapUser(user);
          map.set(info.id, info);
        }
      } catch (e) {
        safeLog("warn", "user.get xato", { id, error: e instanceof Error ? e.message : "unknown" });
      }
    })
  );

  return map;
}

export async function searchUsersByName(name: string): Promise<CrmRecord[]> {
  if (!name.trim()) return [];
  try {
    const result = (await bitrixCall("user.search", {
      FILTER: { NAME: name.trim() },
      SELECT: ["ID", "NAME", "LAST_NAME"],
    })) as CrmRecord[] | undefined;
    if (Array.isArray(result) && result.length) return result;

    const lastNameResult = (await bitrixCall("user.search", {
      FILTER: { LAST_NAME: name.trim() },
      SELECT: ["ID", "NAME", "LAST_NAME"],
    })) as CrmRecord[] | undefined;
    return Array.isArray(lastNameResult) ? lastNameResult : [];
  } catch (e) {
    safeLog("warn", "user.search xato", { name, error: e instanceof Error ? e.message : "unknown" });
    return [];
  }
}

export async function fetchLeads(): Promise<CrmRecord[]> {
  const { bitrixLeadsLimit } = getEnv();
  return listAll(
    "crm.lead.list",
    ["ID", "TITLE", "NAME", "LAST_NAME", "OPPORTUNITY", "DATE_CREATE", "DATE_MODIFY", "ASSIGNED_BY_ID", "SOURCE_ID", "STATUS_ID"],
    bitrixLeadsLimit,
    { DATE_MODIFY: "DESC" }
  );
}

export async function fetchDeals(): Promise<CrmRecord[]> {
  const { bitrixDealsLimit } = getEnv();
  return listAll("crm.deal.list", [...DEAL_SELECT_FIELDS], bitrixDealsLimit, { DATE_MODIFY: "DESC" });
}

export async function fetchContacts(): Promise<CrmRecord[]> {
  const { bitrixContactsLimit } = getEnv();
  return listAll(
    "crm.contact.list",
    ["ID", "NAME", "LAST_NAME", "PHONE", "EMAIL", "DATE_CREATE", "DATE_MODIFY", "COMPANY_ID", "SOURCE_ID"],
    bitrixContactsLimit,
    { DATE_MODIFY: "DESC" }
  );
}

export async function fetchCompanies(): Promise<CrmRecord[]> {
  const { bitrixContactsLimit } = getEnv();
  try {
    return await listAll(
      "crm.company.list",
      ["ID", "TITLE", "DATE_CREATE", "DATE_MODIFY", "ASSIGNED_BY_ID"],
      bitrixContactsLimit,
      { DATE_MODIFY: "DESC" }
    );
  } catch (e) {
    safeLog("warn", "crm.company.list mavjud emas yoki ruxsat yo'q", {
      error: e instanceof Error ? e.message : "unknown",
    });
    return [];
  }
}

export async function fetchActivities(): Promise<CrmRecord[]> {
  try {
    const raw = await bitrixCallRaw("crm.activity.list", {
      order: { CREATED: "DESC" },
      select: ["ID", "SUBJECT", "DESCRIPTION", "CREATED", "COMPLETED", "OWNER_TYPE_ID", "OWNER_ID", "TYPE_ID"],
    });
    const items = Array.isArray(raw.result) ? raw.result : [];
    return items.slice(0, 50).map(normalizeRecord);
  } catch (e) {
    safeLog("warn", "crm.activity.list mavjud emas yoki ruxsat yo'q", {
      error: e instanceof Error ? e.message : "unknown",
    });
    return [];
  }
}

/** Full pagination for CRM activities (Customer Success tool path). */
export async function fetchAllActivitiesComplete(): Promise<CrmRecord[]> {
  try {
    const { items } = await listAllPaginated(
      "crm.activity.list",
      {
        select: [
          "ID",
          "SUBJECT",
          "DESCRIPTION",
          "CREATED",
          "LAST_UPDATED",
          "COMPLETED",
          "OWNER_TYPE_ID",
          "OWNER_ID",
          "TYPE_ID",
          "PROVIDER_ID",
        ],
        order: { CREATED: "DESC" },
      },
      { maxRecords: 10000 }
    );
    return items;
  } catch (e) {
    safeLog("warn", "crm.activity.list to'liq pagination muvaffaqiyatsiz", {
      error: e instanceof Error ? e.message : "unknown",
    });
    return [];
  }
}

export async function fetchTasks(): Promise<CrmRecord[]> {
  const { bitrixTasksLimit } = getEnv();
  try {
    const raw = (await bitrixCall("tasks.task.list", {
      order: { CHANGED_DATE: "DESC" },
      select: ["ID", "TITLE", "DESCRIPTION", "STATUS", "DEADLINE", "CREATED_DATE", "CHANGED_DATE", "RESPONSIBLE_ID"],
    })) as { tasks?: CrmRecord[] } | CrmRecord[] | undefined;

    let records: CrmRecord[] = [];
    if (raw && typeof raw === "object" && !Array.isArray(raw) && "tasks" in raw) {
      records = (raw.tasks as CrmRecord[]) || [];
    } else if (Array.isArray(raw)) {
      records = raw;
    }
    return records.slice(0, bitrixTasksLimit).map(normalizeRecord);
  } catch {
    return [];
  }
}

/** Full pagination for tasks (CEO tool path). */
export async function fetchAllTasksComplete(): Promise<CrmRecord[]> {
  const collected: CrmRecord[] = [];
  let start: number | undefined = 0;
  let page = 0;
  try {
    while (page < 500 && collected.length < 10000) {
      page += 1;
      const data = await bitrixCallRaw("tasks.task.list", {
        order: { CHANGED_DATE: "DESC" },
        select: ["ID", "TITLE", "DESCRIPTION", "STATUS", "DEADLINE", "CREATED_DATE", "CHANGED_DATE", "RESPONSIBLE_ID"],
        start,
      });
      const raw = data.result as { tasks?: CrmRecord[] } | CrmRecord[] | undefined;
      let batch: CrmRecord[] = [];
      if (raw && typeof raw === "object" && !Array.isArray(raw) && "tasks" in raw) {
        batch = (raw.tasks as CrmRecord[]) || [];
      } else if (Array.isArray(raw)) {
        batch = raw;
      }
      if (!batch.length) break;
      collected.push(...batch.map(normalizeRecord));
      if (data.next === undefined || data.next === null) break;
      start = data.next;
    }
  } catch {
    return collected;
  }
  return collected;
}

export async function fetchAllLeadsComplete(): Promise<CrmRecord[]> {
  const { items } = await listAllPaginated(
    "crm.lead.list",
    {
      select: [
        "ID",
        "TITLE",
        "NAME",
        "LAST_NAME",
        "OPPORTUNITY",
        "DATE_CREATE",
        "DATE_MODIFY",
        "ASSIGNED_BY_ID",
        "SOURCE_ID",
        "STATUS_ID",
      ],
      order: { DATE_MODIFY: "DESC" },
    },
    { maxRecords: 10000 }
  );
  return items;
}

export async function fetchAllContactsComplete(): Promise<CrmRecord[]> {
  const { items } = await listAllPaginated(
    "crm.contact.list",
    {
      select: [
        "ID",
        "NAME",
        "LAST_NAME",
        "PHONE",
        "EMAIL",
        "DATE_CREATE",
        "DATE_MODIFY",
        "COMPANY_ID",
        "SOURCE_ID",
      ],
      order: { DATE_MODIFY: "DESC" },
    },
    { maxRecords: 10000 }
  );
  return items;
}

export async function fetchAllCompaniesComplete(): Promise<CrmRecord[]> {
  try {
    const { items } = await listAllPaginated(
      "crm.company.list",
      {
        select: ["ID", "TITLE", "DATE_CREATE", "DATE_MODIFY", "ASSIGNED_BY_ID"],
        order: { DATE_MODIFY: "DESC" },
      },
      { maxRecords: 10000 }
    );
    return items;
  } catch {
    return [];
  }
}

export async function fetchAllCrm(): Promise<CrmPayload> {
  const [leads, deals, contacts, tasks] = await Promise.all([
    fetchLeads(),
    fetchDeals(),
    fetchContacts(),
    fetchTasks(),
  ]);

  return {
    fetched_at: new Date().toISOString(),
    summary: {
      leads_count: leads.length,
      deals_count: deals.length,
      contacts_count: contacts.length,
      tasks_count: tasks.length,
      total_opportunity: deals.reduce((s, d) => s + Number(d.OPPORTUNITY || 0), 0),
    },
    leads,
    deals,
    contacts,
    tasks,
  };
}

export async function testBitrixConnection(): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const data = await bitrixCall("profile");
    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof BitrixError ? e.message : "Bitrix24 connection failed",
    };
  }
}

export async function checkBitrixHealth(): Promise<{
  connected: boolean;
  deals_readable: boolean;
  sample_count: number;
  error: string | null;
}> {
  try {
    await bitrixCall("profile");
    const data = await bitrixCallRaw("crm.deal.list", { select: ["ID", "TITLE"], start: 0 });
    const items = Array.isArray(data.result) ? data.result : [];
    return {
      connected: true,
      deals_readable: true,
      sample_count: items.length,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof BitrixError ? e.message : "Bitrix24 ulanishi muvaffaqiyatsiz";
    safeLog("error", "Health check xato", { error: msg });
    return {
      connected: false,
      deals_readable: false,
      sample_count: 0,
      error: msg,
    };
  }
}

export interface CrmPayload {
  fetched_at: string;
  summary: {
    leads_count: number;
    deals_count: number;
    contacts_count: number;
    tasks_count: number;
    total_opportunity: number;
  };
  leads: CrmRecord[];
  deals: CrmRecord[];
  contacts: CrmRecord[];
  tasks: CrmRecord[];
  mode?: string;
  salesAnalytics?: import("./sales-analytics").SalesAnalytics;
  crmAnalytics?: import("./crm-analytics").CrmAnalyticsContext;
  salesBlock?: string;
  fetchStatus?: import("./sales-analytics").SalesFetchStatus;
  fetchLogReason?: string;
}
