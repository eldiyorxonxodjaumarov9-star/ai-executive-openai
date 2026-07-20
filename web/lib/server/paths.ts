import path from "path";

/** CEO document knowledge lives under web/data/knowledge/ceo */
export function getCeoKnowledgeDir(): string {
  return path.join(process.cwd(), "data", "knowledge", "ceo");
}

/** Finance document knowledge lives under web/data/knowledge/finance */
export function getFinanceKnowledgeDir(): string {
  return path.join(process.cwd(), "data", "knowledge", "finance");
}

/** Sales document knowledge lives under web/data/knowledge/sales */
export function getSalesKnowledgeDir(): string {
  return path.join(process.cwd(), "data", "knowledge", "sales");
}

/** IT / Business Analytics knowledge lives under web/data/knowledge/business-analytics */
export function getBusinessAnalyticsKnowledgeDir(): string {
  return path.join(process.cwd(), "data", "knowledge", "business-analytics");
}

/** Customer Success knowledge lives under web/data/knowledge/customer-success */
export function getCustomerSuccessKnowledgeDir(): string {
  return path.join(process.cwd(), "data", "knowledge", "customer-success");
}

export const BRAINS_DIR = path.join(process.cwd(), "content", "brains");
export const KNOWLEDGE_DIR = path.join(process.cwd(), "content", "knowledge");
