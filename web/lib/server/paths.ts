import path from "path";

/** Repo root (parent of web/) — brains and knowledge live outside the Next app dir. */
export function getRepoRoot(): string {
  return path.join(process.cwd(), "..");
}

export const BRAINS_DIR = path.join(getRepoRoot(), "legacy", "brains");
export const KNOWLEDGE_DIR = path.join(getRepoRoot(), "knowledge");
