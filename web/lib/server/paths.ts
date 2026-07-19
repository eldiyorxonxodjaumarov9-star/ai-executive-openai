import path from "path";

/** CEO document knowledge lives under web/data/knowledge/ceo */
export function getCeoKnowledgeDir(): string {
  return path.join(process.cwd(), "data", "knowledge", "ceo");
}

export const BRAINS_DIR = path.join(process.cwd(), "content", "brains");
export const KNOWLEDGE_DIR = path.join(process.cwd(), "content", "knowledge");
