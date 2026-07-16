import { cacheKey, getCached, setCached } from "../bitrix-cache";
import {
  fetchActivities,
  fetchAllDealsCompleteWithMeta,
  fetchCompanies,
  fetchContacts,
  fetchDealStages,
  fetchLeads,
  fetchTasks,
  fetchUsersByIds,
  type CrmRecord,
  type DealStageInfo,
  type BitrixUserInfo,
} from "../bitrix";
import type { BitrixEntityType } from "../agent-crm-config";

export interface EntityFetchResult<T> {
  data: T;
  cached: boolean;
  limitation?: string;
}

export async function fetchEntity(
  entity: BitrixEntityType,
  bypass: boolean
): Promise<EntityFetchResult<unknown>> {
  const key = cacheKey(entity);
  if (!bypass) {
    const hit = getCached<unknown>(key);
    if (hit) return { data: hit.data, cached: true };
  }

  try {
    switch (entity) {
      case "deals": {
        const pack = await fetchAllDealsCompleteWithMeta();
        setCached(key, pack);
        return { data: pack, cached: false };
      }
      case "stages": {
        const stages = await fetchDealStages();
        setCached(key, stages);
        return { data: stages, cached: false };
      }
      case "leads": {
        const leads = await fetchLeads();
        setCached(key, leads);
        return { data: leads, cached: false };
      }
      case "contacts": {
        const contacts = await fetchContacts();
        setCached(key, contacts);
        return { data: contacts, cached: false };
      }
      case "companies": {
        const companies = await fetchCompanies();
        setCached(key, companies);
        return { data: companies, cached: false };
      }
      case "tasks": {
        const tasks = await fetchTasks();
        setCached(key, tasks);
        return { data: tasks, cached: false };
      }
      case "activities": {
        const activities = await fetchActivities();
        setCached(key, activities);
        return { data: activities, cached: false };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch xato";
    return { data: null, cached: false, limitation: `${entity}: ${msg}` };
  }
  return { data: null, cached: false, limitation: `${entity}: noma'lum` };
}

export async function fetchUsersForDeals(
  deals: CrmRecord[]
): Promise<Map<string, BitrixUserInfo>> {
  const ids = [...new Set(deals.map((d) => String(d.ASSIGNED_BY_ID || "")).filter(Boolean))];
  if (!ids.length) return new Map();
  return fetchUsersByIds(ids);
}

export type { CrmRecord, DealStageInfo, BitrixUserInfo };
