import type { HistoryEntry } from "./constants";

const HISTORY_KEY = "aiep_web_history";

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 100)));
}

export function addHistory(entry: HistoryEntry): HistoryEntry[] {
  const list = [entry, ...loadHistory()].slice(0, 100);
  saveHistory(list);
  return list;
}

export function deleteHistory(id: string): HistoryEntry[] {
  const list = loadHistory().filter((e) => e.id !== id);
  saveHistory(list);
  return list;
}

export function newId(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
