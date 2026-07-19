/**
 * Selects only the Bitrix24 entity groups needed for the rewritten CEO query.
 */

export type CeoCrmTool =
  | "deals"
  | "leads"
  | "tasks"
  | "employees"
  | "contacts"
  | "companies";

export interface CeoToolPlan {
  tools: CeoCrmTool[];
  reason: string;
}

const TOOL_SIGNALS: Record<CeoCrmTool, string[]> = {
  deals: ["bitim", "sotuv", "savdo", "pipeline", "yopilgan", "kechikkan", "daromad", "summa", "opportunity"],
  leads: ["lid", "lead", "mijoz so'rov", "so'rov"],
  tasks: ["vazifa", "task", "deadline", "muddat"],
  employees: ["xodim", "mas'ul", "jamoa", "manager", "assigned"],
  contacts: ["kontakt", "contact", "telefon", "mijoz"],
  companies: ["kompaniya", "company", "tashkilot"],
};

export function planCeoCrmTools(rewrittenQuery: string): CeoToolPlan {
  const text = rewrittenQuery.toLowerCase();
  const selected = new Set<CeoCrmTool>();

  for (const [tool, signals] of Object.entries(TOOL_SIGNALS) as Array<[CeoCrmTool, string[]]>) {
    if (signals.some((s) => text.includes(s))) selected.add(tool);
  }

  // Executive defaults for broad performance questions
  if (selected.size === 0 || /tahlil|holat|xavf|umumiy|kompaniya/.test(text)) {
    selected.add("deals");
    selected.add("leads");
    selected.add("tasks");
  }

  if (/xodim|jamoa|mas'ul/.test(text)) selected.add("employees");
  if (/kontakt/.test(text)) selected.add("contacts");
  if (/kompaniya|tashkilot/.test(text)) selected.add("companies");

  // Employees often derived from deals/tasks assignees
  if ((selected.has("deals") || selected.has("tasks")) && /xodim|samarador/.test(text)) {
    selected.add("employees");
  }

  const tools = [...selected];
  return {
    tools,
    reason: `Tanlangan CRM bo'limlari: ${tools.join(", ")}`,
  };
}
