const CACHE_TTL_MS = 45_000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheKey(entity: string, queryKey = "default"): string {
  return `bitrix:${entity}:${queryKey}`;
}

export function getCached<T>(key: string): { data: T; cached: true } | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return { data: entry.data, cached: true };
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateBitrixCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function shouldBypassCache(question: string, forceRefresh = false): boolean {
  if (forceRefresh) return true;
  const t = question.toLowerCase().replace(/ʻ|’|`/g, "'");
  return /\b(yangila|hozirgi|eng yangi|qayta tekshir|refresh|yangilash)\b/.test(t);
}
