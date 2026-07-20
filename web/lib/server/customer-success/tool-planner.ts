/**
 * Selects only Bitrix24 entity groups needed for the rewritten CS query.
 */

export type CustomerSuccessCrmTool =
  | "contacts"
  | "companies"
  | "deals"
  | "activities"
  | "tasks"
  | "employees";

export interface CustomerSuccessToolPlan {
  tools: CustomerSuccessCrmTool[];
  reason: string;
  focus: Array<
    | "active_customers"
    | "inactive_customers"
    | "no_contact_long"
    | "large_customers"
    | "repeat_buyers"
    | "last_activities"
    | "calls_emails"
    | "overdue_tasks"
    | "risk_customers"
    | "customer_history"
    | "won_deals"
  >;
}

export function planCustomerSuccessCrmTools(rewrittenQuery: string): CustomerSuccessToolPlan {
  const text = rewrittenQuery.toLowerCase();
  const tools = new Set<CustomerSuccessCrmTool>(["contacts", "deals"]);
  const focus = new Set<CustomerSuccessToolPlan["focus"][number]>();

  if (/kompaniya|yirik|takroriy/.test(text)) tools.add("companies");
  if (/activity|aktivit|qo'ng'iroq|email|timeline|oxirgi/.test(text)) {
    tools.add("activities");
    focus.add("last_activities");
    focus.add("calls_emails");
  }
  if (/vazifa|task|kechik|follow|aloqa/.test(text)) {
    tools.add("tasks");
    focus.add("overdue_tasks");
  }
  if (/faol/.test(text)) focus.add("active_customers");
  if (/faol bo'lmagan|inactive|aloqasiz|uzoq/.test(text)) {
    focus.add("inactive_customers");
    focus.add("no_contact_long");
  }
  if (/risk|churn|yo'qot/.test(text)) focus.add("risk_customers");
  if (/yirik|katta/.test(text)) focus.add("large_customers");
  if (/takroriy|qayta xarid/.test(text)) focus.add("repeat_buyers");
  if (/tarix|history|bitim/.test(text)) {
    focus.add("customer_history");
    focus.add("won_deals");
  }

  if (focus.size === 0) {
    focus.add("active_customers");
    focus.add("inactive_customers");
    focus.add("no_contact_long");
    focus.add("last_activities");
    focus.add("risk_customers");
    tools.add("activities");
    tools.add("tasks");
    tools.add("companies");
  }

  if (/tahlil|xavf|holat|umumiy|bahola|standart/.test(text)) {
    tools.add("activities");
    tools.add("tasks");
    tools.add("companies");
    tools.add("employees");
    focus.add("risk_customers");
    focus.add("overdue_tasks");
  }

  return {
    tools: [...tools],
    focus: [...focus],
    reason: `CS CRM: ${[...tools].join(", ")} · focus: ${[...focus].join(", ")}`,
  };
}
