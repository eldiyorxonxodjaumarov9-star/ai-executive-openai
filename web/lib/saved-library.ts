const LIBRARY_KEY = "aiep_saved_library";

export interface SavedReport {
  id: string;
  agentId: string;
  agentLabel: string;
  title: string;
  content: string;
  userQuestion?: string;
  savedAt: string;
}

export function saveToLibrary(item: Omit<SavedReport, "id" | "savedAt">): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    const list: SavedReport[] = raw ? JSON.parse(raw) : [];
    const entry: SavedReport = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      savedAt: new Date().toISOString(),
    };
    list.unshift(entry);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(list.slice(0, 100)));
    return true;
  } catch {
    return false;
  }
}

export function isSavedInLibrary(content: string, agentId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    const list: SavedReport[] = raw ? JSON.parse(raw) : [];
    return list.some((r) => r.content === content && r.agentId === agentId);
  } catch {
    return false;
  }
}
