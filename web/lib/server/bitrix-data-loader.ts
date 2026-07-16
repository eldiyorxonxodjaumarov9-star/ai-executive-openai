import type { AgentId } from "./constants";
import { entitiesForAgent, type BitrixEntityType } from "./agent-crm-config";
import { cacheKey, getCached, setCached, shouldBypassCache } from "./bitrix-cache";
import {
  fetchAllDealsCompleteWithMeta,
  fetchContacts,
  fetchDealStages,
  fetchLeads,
  fetchTasks,
  fetchCompanies,
  fetchActivities,
  fetchUsersByIds,
  type CrmRecord,
  type DealStageInfo,
  type BitrixUserInfo,
} from "./bitrix";

export interface BitrixLoadedData {
  deals: CrmRecord[];
  leads: CrmRecord[];
  contacts: CrmRecord[];
  companies: CrmRecord[];
  tasks: CrmRecord[];
  activities: CrmRecord[];
  stages: Map<string, DealStageInfo>;
  users: Map<string, BitrixUserInfo>;
  fetchedAt: string;
  cached: boolean;
  entitiesFetched: Record<string, number>;
  limitations: string[];
  paginationPages: number;
}

async function loadEntity(
  entity: BitrixEntityType,
  bypass: boolean
): Promise<{ data: unknown; cached: boolean; limitation?: string }> {
  const key = cacheKey(entity);
  if (!bypass) {
    const hit = getCached<unknown>(key);
    if (hit) return { data: hit.data, cached: true };
  }

  try {
    let data: unknown;
    switch (entity) {
      case "deals": {
        const r = await fetchAllDealsCompleteWithMeta();
        data = r;
        setCached(key, r);
        return { data: r, cached: false };
      }
      case "stages": {
        data = await fetchDealStages();
        setCached(key, data);
        return { data, cached: false };
      }
      case "leads": {
        data = await fetchLeads();
        setCached(key, data);
        return { data, cached: false };
      }
      case "contacts": {
        data = await fetchContacts();
        setCached(key, data);
        return { data, cached: false };
      }
      case "companies": {
        data = await fetchCompanies();
        setCached(key, data);
        return { data, cached: false };
      }
      case "tasks": {
        data = await fetchTasks();
        setCached(key, data);
        return { data, cached: false };
      }
      case "activities": {
        data = await fetchActivities();
        setCached(key, data);
        return { data, cached: false };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch xato";
    return { data: null, cached: false, limitation: `${entity}: ${msg}` };
  }
  return { data: null, cached: false, limitation: `${entity}: noma'lum` };
}

export async function loadBitrixDataForAgent(
  agent: AgentId,
  options: { bypassCache?: boolean; question?: string; extraEntities?: BitrixEntityType[] } = {}
): Promise<BitrixLoadedData> {
  const bypass = shouldBypassCache(options.question || "", options.bypassCache);
  const needed = [...new Set([...entitiesForAgent(agent), ...(options.extraEntities || [])])];

  const limitations: string[] = [];
  const entitiesFetched: Record<string, number> = {};
  let anyCached = false;
  let paginationPages = 0;

  let deals: CrmRecord[] = [];
  let leads: CrmRecord[] = [];
  let contacts: CrmRecord[] = [];
  let companies: CrmRecord[] = [];
  let tasks: CrmRecord[] = [];
  let activities: CrmRecord[] = [];
  let stages = new Map<string, DealStageInfo>();

  await Promise.all(
    needed.map(async (entity) => {
      const result = await loadEntity(entity, bypass);
      if (result.cached) anyCached = true;
      if (result.limitation) {
        limitations.push(result.limitation);
        entitiesFetched[entity] = 0;
        return;
      }

      if (entity === "deals" && result.data && typeof result.data === "object" && "deals" in (result.data as object)) {
        const pack = result.data as { deals: CrmRecord[]; paginationPages: number };
        deals = pack.deals;
        paginationPages = pack.paginationPages;
        entitiesFetched.deals = deals.length;
      } else if (entity === "stages" && result.data instanceof Map) {
        stages = result.data;
        entitiesFetched.stages = stages.size;
      } else if (Array.isArray(result.data)) {
        const arr = result.data as CrmRecord[];
        entitiesFetched[entity] = arr.length;
        if (entity === "leads") leads = arr;
        else if (entity === "contacts") contacts = arr;
        else if (entity === "companies") companies = arr;
        else if (entity === "tasks") tasks = arr;
        else if (entity === "activities") activities = arr;
      }
    })
  );

  const assigneeIds = deals.map((d) => String(d.ASSIGNED_BY_ID || "")).filter(Boolean);
  const users = assigneeIds.length ? await fetchUsersByIds(assigneeIds) : new Map<string, BitrixUserInfo>();

  return {
    deals,
    leads,
    contacts,
    companies,
    tasks,
    activities,
    stages,
    users,
    fetchedAt: new Date().toISOString(),
    cached: anyCached && !bypass,
    entitiesFetched,
    limitations,
    paginationPages,
  };
}
