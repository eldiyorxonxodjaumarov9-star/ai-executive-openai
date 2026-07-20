/**
 * Selects only Bitrix24 entity groups for Procurement (BP-02, BP-05).
 * Modules: companies, contacts, deals, tasks, activities, suppliers (proxy via companies).
 */

export type ProcurementCrmTool =
  | "companies"
  | "contacts"
  | "deals"
  | "tasks"
  | "activities"
  | "suppliers";

export interface ProcurementToolPlan {
  tools: ProcurementCrmTool[];
  reason: string;
  focus: Array<
    | "supplier_companies"
    | "supplier_contacts"
    | "procurement_deals"
    | "delivery_tasks"
    | "overdue_tasks"
    | "open_tasks"
    | "supplier_activities"
    | "contract_pipeline"
    | "delivery_status"
  >;
}

export function planProcurementCrmTools(rewrittenQuery: string): ProcurementToolPlan {
  const text = rewrittenQuery.toLowerCase();
  const tools = new Set<ProcurementCrmTool>(["companies", "deals"]);
  const focus = new Set<ProcurementToolPlan["focus"][number]>();

  if (/yetkazib|supplier|beruvchi|ta'minotchi/.test(text)) {
    tools.add("suppliers");
    focus.add("supplier_companies");
    focus.add("supplier_contacts");
  }

  if (/kontakt|aloqa|mas'ul/.test(text)) {
    tools.add("contacts");
    focus.add("supplier_contacts");
  }

  if (/vazifa|task|kechik|deadline|yetkazib berish/.test(text)) {
    tools.add("tasks");
    focus.add("delivery_tasks");
    if (/kechik|overdue|deadline/.test(text)) focus.add("overdue_tasks");
    if (/ochiq|open|faol/.test(text)) focus.add("open_tasks");
  }

  if (/activity|aktivit|qo'ng'iroq|email|timeline|oxirgi/.test(text)) {
    tools.add("activities");
    focus.add("supplier_activities");
  }

  if (/bitim|shartnoma|xarid|pipeline|offer|taklif/.test(text)) {
    tools.add("deals");
    focus.add("procurement_deals");
    focus.add("contract_pipeline");
  }

  if (/yetkaz|logistika|ombor|delivery/.test(text)) {
    focus.add("delivery_status");
    tools.add("tasks");
    tools.add("activities");
  }

  if (focus.size === 0) {
    tools.add("contacts");
    tools.add("tasks");
    tools.add("activities");
    tools.add("suppliers");
    focus.add("supplier_companies");
    focus.add("procurement_deals");
    focus.add("delivery_tasks");
    focus.add("overdue_tasks");
    focus.add("supplier_activities");
  }

  if (/tahlil|holat|umumiy|bahola|hisobot|risk/.test(text)) {
    tools.add("contacts");
    tools.add("tasks");
    tools.add("activities");
    tools.add("suppliers");
    focus.add("procurement_deals");
    focus.add("overdue_tasks");
    focus.add("delivery_status");
  }

  return {
    tools: [...tools],
    focus: [...focus],
    reason: `Procurement CRM (BP-02/BP-05): ${[...tools].join(", ")} · focus: ${[...focus].join(", ")}`,
  };
}
