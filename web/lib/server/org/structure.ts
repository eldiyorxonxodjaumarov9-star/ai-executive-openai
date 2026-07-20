/**
 * Xaridlar.uz tashkiliy tuzilmasi — 7 ta mustaqil agent + marketing (yashirin).
 */

export type OrgAgentId =
  | "ceo"
  | "sales"
  | "procurement"
  | "finance"
  | "hr"
  | "customer_success"
  | "business_analytics"
  | "marketing";

export type KnowledgeDomainId =
  | "ceo"
  | "sales"
  | "finance"
  | "hr"
  | "customer-success"
  | "procurement"
  | "business-analytics";

export type BusinessProcessId =
  | "BP-01"
  | "BP-02"
  | "BP-03"
  | "BP-04"
  | "BP-05"
  | "BP-06"
  | "BP-07"
  | "BP-08"
  | "BP-09";

export interface BusinessProcessDef {
  id: BusinessProcessId;
  name: string;
  ownerLabel: string;
  ownerAgent: OrgAgentId | null;
  ownerKnowledgeDomain: KnowledgeDomainId;
}

export interface AgentOrgProfile {
  agentId: OrgAgentId;
  direction: string;
  ownedProcesses: BusinessProcessId[];
  departments: string[];
  knowledgeDomains: KnowledgeDomainId[];
  bitrixModules: string[];
  scopeRule: string;
}

export const BUSINESS_PROCESSES: BusinessProcessDef[] = [
  {
    id: "BP-01",
    name: "Lead generation",
    ownerLabel: "Savdo direktori",
    ownerAgent: "sales",
    ownerKnowledgeDomain: "sales",
  },
  {
    id: "BP-02",
    name: "Commercial offer va supplier tanlash",
    ownerLabel: "Ta'minot direktori",
    ownerAgent: "procurement",
    ownerKnowledgeDomain: "procurement",
  },
  {
    id: "BP-03",
    name: "Bitim va shartnoma",
    ownerLabel: "Savdo direktori",
    ownerAgent: "sales",
    ownerKnowledgeDomain: "sales",
  },
  {
    id: "BP-04",
    name: "Elektron savdo va brokerlik",
    ownerLabel: "Customer Success",
    ownerAgent: "customer_success",
    ownerKnowledgeDomain: "customer-success",
  },
  {
    id: "BP-05",
    name: "Ta'minot va yetkazib berish",
    ownerLabel: "Ta'minot direktori",
    ownerAgent: "procurement",
    ownerKnowledgeDomain: "procurement",
  },
  {
    id: "BP-06",
    name: "Moliyaviy hisob-kitob",
    ownerLabel: "Moliya direktori",
    ownerAgent: "finance",
    ownerKnowledgeDomain: "finance",
  },
  {
    id: "BP-07",
    name: "Servis va mijoz bilan ishlash",
    ownerLabel: "Customer Success",
    ownerAgent: "customer_success",
    ownerKnowledgeDomain: "customer-success",
  },
  {
    id: "BP-08",
    name: "Biznes analitika",
    ownerLabel: "IT direktori",
    ownerAgent: "business_analytics",
    ownerKnowledgeDomain: "business-analytics",
  },
  {
    id: "BP-09",
    name: "Korporativ boshqaruv",
    ownerLabel: "CEO",
    ownerAgent: "ceo",
    ownerKnowledgeDomain: "ceo",
  },
];

export const AGENT_ORG_PROFILES: Record<OrgAgentId, AgentOrgProfile> = {
  ceo: {
    agentId: "ceo",
    direction: "Bosh direktor (CEO)",
    ownedProcesses: ["BP-09"],
    departments: ["Savdo", "Ta'minot", "Moliya", "Customer Success", "HR", "IT"],
    knowledgeDomains: ["ceo"],
    bitrixModules: [],
    scopeRule:
      "CEO faqat ceo/ knowledge va sub-agent orchestration orqali boshqa bo'lim tahlilini oladi. Boshqa agent knowledge papkasini to'g'ridan-to'g'ri o'qimaydi.",
  },
  sales: {
    agentId: "sales",
    direction: "Savdo direksiyasi",
    ownedProcesses: ["BP-01", "BP-03"],
    departments: ["Liderlar", "Sotuv", "Narxlar va taklif", "Shartnomalar"],
    knowledgeDomains: ["sales"],
    bitrixModules: ["leads", "deals", "employees"],
    scopeRule: "Faqat savdo hujjatlari va savdo Bitrix24 (leads, deals, managers, revenue).",
  },
  procurement: {
    agentId: "procurement",
    direction: "Ta'minot direksiyasi",
    ownedProcesses: ["BP-02", "BP-05"],
    departments: ["Yetkazib beruvchilar", "Xarid", "Narx", "Yetkazib berish", "Supplier rating"],
    knowledgeDomains: ["procurement"],
    bitrixModules: ["companies", "contacts", "deals", "tasks", "activities"],
    scopeRule:
      "Faqat ta'minot hujjatlari va Bitrix24 (kompaniyalar, kontaktlar, bitimlar, vazifalar, aktivliklar). Alohida supplier API yo'q bo'lsa — cheklovni ochiq ayt.",
  },
  finance: {
    agentId: "finance",
    direction: "Moliya direksiyasi",
    ownedProcesses: ["BP-06"],
    departments: ["Buxgalteriya", "Debitor", "G'aznachilik", "Kreditor"],
    knowledgeDomains: ["finance"],
    bitrixModules: ["deals"],
    scopeRule: "Faqat moliya qo'llanmalari va moliyaviy Bitrix24 (deals/revenue/payments/invoice maydonlari).",
  },
  hr: {
    agentId: "hr",
    direction: "HR va administrativ boshqaruv",
    ownedProcesses: [],
    departments: ["HR", "O'qitish", "Ma'muriy xo'jalik", "Huquq"],
    knowledgeDomains: ["hr"],
    bitrixModules: ["users", "departments", "tasks", "activities"],
    scopeRule: "Faqat HR hujjatlari va HR Bitrix24 (users, departments, tasks, activities).",
  },
  customer_success: {
    agentId: "customer_success",
    direction: "Customer Success",
    ownedProcesses: ["BP-04", "BP-07"],
    departments: ["Account Manager", "Service", "Broker nazorati", "Mijoz tajribasi"],
    knowledgeDomains: ["customer-success"],
    bitrixModules: ["contacts", "companies", "activities", "deals"],
    scopeRule: "Faqat Customer Success hujjatlari va mijoz Bitrix24 (contacts, companies, activities, deals).",
  },
  business_analytics: {
    agentId: "business_analytics",
    direction: "IT va biznes analitika",
    ownedProcesses: ["BP-08"],
    departments: ["CRM monitoring", "KPI", "Dashboard", "Avtomatlashtirish", "Process monitoring"],
    knowledgeDomains: ["business-analytics"],
    bitrixModules: ["leads", "deals", "contacts", "companies", "tasks", "activities", "users", "departments"],
    scopeRule:
      "Faqat IT/analitika hujjatlari. Bitrix24 dan agregatsiya va tahlil — raw JSON qaytarmasdan. Operatsion ownership egallamasin.",
  },
  marketing: {
    agentId: "marketing",
    direction: "Targ'ibot (tuzilmada asosiy emas)",
    ownedProcesses: [],
    departments: [],
    knowledgeDomains: [],
    bitrixModules: ["leads", "deals", "contacts"],
    scopeRule: "Tashkiliy tuzilmada asosiy direksiya emas — UI va orchestration dan yashirin.",
  },
};

/** CEO kompaniya holati uchun chaqiradigan 6 ta direktor agent. */
export const CEO_ORCHESTRATION_AGENTS: OrgAgentId[] = [
  "sales",
  "procurement",
  "finance",
  "customer_success",
  "hr",
  "business_analytics",
];

/** @deprecated use CEO_ORCHESTRATION_AGENTS */
export const CEO_DIRECTOR_AGENTS = CEO_ORCHESTRATION_AGENTS;

export function getAgentOrgProfile(agentId: string): AgentOrgProfile | null {
  const key = agentId.trim().toLowerCase().replace(/-/g, "_") as OrgAgentId;
  return AGENT_ORG_PROFILES[key] ?? null;
}

export function getProcessesForAgent(agentId: string): BusinessProcessDef[] {
  const profile = getAgentOrgProfile(agentId);
  if (!profile) return [];
  return BUSINESS_PROCESSES.filter((bp) => profile.ownedProcesses.includes(bp.id));
}

export function formatAgentScopeBlock(agentId: string): string {
  const profile = getAgentOrgProfile(agentId);
  if (!profile) return "";
  const bps = getProcessesForAgent(agentId)
    .map((bp) => `${bp.id} (${bp.name})`)
    .join("; ");
  return [
    `=== TASHKILIY DOIRA ===`,
    `Direksiya: ${profile.direction}`,
    bps ? `Process Owner: ${bps}` : "Process Owner: (BP egasi emas — funksional qo'llab-quvvatlash)",
    `Bo'limlar: ${profile.departments.join(", ") || "—"}`,
    `Knowledge: faqat ${profile.knowledgeDomains.join(", ") || "yo'q"}`,
    `Bitrix24: ${profile.bitrixModules.join(", ") || "to'g'ridan-to'g'ri CRM emas (orchestration)"}`,
    `Qoida: ${profile.scopeRule}`,
  ].join("\n");
}

export function isCompanyWideCeoQuestion(question: string): boolean {
  const t = question.toLowerCase().trim();
  return (
    /kompaniya\s*holati|firma\s*holati|umumiy\s*holat|umumiy\s*tahlil|executive\s*report|barcha\s*bo'?lim|strategik\s*holat|tashkilot\s*holati|firma\s*umumiy|kompaniyani\s*bahola|umumiy\s*bahola/.test(
      t
    ) || /^(firma|kompaniya).*(bahola|tahlil|holat)/.test(t)
  );
}
