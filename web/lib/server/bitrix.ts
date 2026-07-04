import { getEnv } from "./env";

export class BitrixError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "BitrixError";
  }
}

type CrmRecord = Record<string, unknown>;

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

async function bitrixCall(method: string, params: CrmRecord = {}): Promise<unknown> {
  const { bitrixWebhookUrl } = getEnv();
  if (!bitrixWebhookUrl) throw new BitrixError("BITRIX24_WEBHOOK_URL sozlanmagan.");

  const url = `${bitrixWebhookUrl}/${method}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new BitrixError("CRM ulanish xatosi — Bitrix24 dan javob kelmadi.");
  }

  if (response.status >= 400) {
    throw new BitrixError(`Bitrix24 HTTP ${response.status}`, response.status);
  }

  const data = (await response.json()) as { error?: string; error_description?: string; result?: unknown };
  if (data.error) {
    throw new BitrixError(data.error_description || data.error);
  }
  return data.result;
}

async function listAll(
  method: string,
  select: string[],
  limit: number,
  order?: Record<string, string>
): Promise<CrmRecord[]> {
  const collected: CrmRecord[] = [];
  let start = 0;
  const pageSize = Math.min(50, limit);

  while (collected.length < limit) {
    const batchSize = Math.min(pageSize, limit - collected.length);
    const params: CrmRecord = { select, start };
    if (order) params.order = order;

    const result = (await bitrixCall(method, params)) as CrmRecord[] | undefined;
    const items = Array.isArray(result) ? result : [];
    if (!items.length) break;

    collected.push(...items.map(normalizeRecord));
    start += items.length;
    if (items.length < batchSize) break;
  }

  return collected.slice(0, limit);
}

export async function fetchLeads(): Promise<CrmRecord[]> {
  const { bitrixLeadsLimit } = getEnv();
  return listAll(
    "crm.lead.list",
    ["ID", "TITLE", "NAME", "LAST_NAME", "OPPORTUNITY", "DATE_CREATE", "DATE_MODIFY", "ASSIGNED_BY_ID"],
    bitrixLeadsLimit,
    { DATE_MODIFY: "DESC" }
  );
}

export async function fetchDeals(): Promise<CrmRecord[]> {
  const { bitrixDealsLimit } = getEnv();
  return listAll(
    "crm.deal.list",
    ["ID", "TITLE", "STAGE_ID", "OPPORTUNITY", "DATE_CREATE", "DATE_MODIFY", "CLOSEDATE", "ASSIGNED_BY_ID"],
    bitrixDealsLimit,
    { DATE_MODIFY: "DESC" }
  );
}

export async function fetchContacts(): Promise<CrmRecord[]> {
  const { bitrixContactsLimit } = getEnv();
  return listAll(
    "crm.contact.list",
    ["ID", "NAME", "LAST_NAME", "PHONE", "EMAIL", "DATE_CREATE", "DATE_MODIFY"],
    bitrixContactsLimit,
    { DATE_MODIFY: "DESC" }
  );
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
}
