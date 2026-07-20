/**
 * Selects only Bitrix24 entity groups for Sales (BP-01, BP-03).
 * Modules: leads, deals, managers (employees), revenue.
 */

export type SalesCrmTool = "deals" | "leads" | "tasks" | "employees";

export interface SalesToolPlan {
  tools: SalesCrmTool[];
  reason: string;
  focus: Array<
    | "new_leads"
    | "active_deals"
    | "closed_won"
    | "closed_lost"
    | "amounts"
    | "stages"
    | "manager_sales"
    | "conversion"
    | "stalled_deals"
    | "overdue_tasks"
    | "followup_gaps"
    | "sources"
    | "large_deals"
    | "zero_amount_deals"
    | "period_sales"
  >;
}

export function planSalesCrmTools(rewrittenQuery: string): SalesToolPlan {
  const text = rewrittenQuery.toLowerCase();
  const tools = new Set<SalesCrmTool>(["deals", "leads"]);
  const focus = new Set<SalesToolPlan["focus"][number]>();

  if (/lead|lid|yangi/.test(text)) focus.add("new_leads");
  if (/faol|ochiq|pipeline/.test(text)) focus.add("active_deals");
  if (/yopilgan|yutgan|won|tushum|savdo|sotuv|oy|bugun|hafta/.test(text)) {
    focus.add("closed_won");
    focus.add("period_sales");
    focus.add("amounts");
  }
  if (/yutqazilgan|yo'qotilgan|lose|lost|nega/.test(text)) focus.add("closed_lost");
  if (/bosqich|stage|pipeline|taklif|offer/.test(text)) focus.add("stages");
  if (/menejer|solishtir|kesim|manager/.test(text)) {
    focus.add("manager_sales");
    tools.add("employees");
  }
  if (/konversiya/.test(text)) focus.add("conversion");
  if (/turib qolgan|uzoq|stalled/.test(text)) focus.add("stalled_deals");
  if (/manba|source/.test(text)) focus.add("sources");
  if (/katta|yirik/.test(text)) focus.add("large_deals");
  if (/0|nol|kiritilmagan/.test(text)) focus.add("zero_amount_deals");

  if (focus.size === 0) {
    focus.add("new_leads");
    focus.add("closed_won");
    focus.add("active_deals");
    focus.add("conversion");
    focus.add("stalled_deals");
    focus.add("period_sales");
  }

  if (/tahlil|xavf|holat|umumiy|bahola|hisobot/.test(text)) {
    tools.add("employees");
    focus.add("manager_sales");
  }

  return {
    tools: [...tools],
    focus: [...focus],
    reason: `Sales CRM (BP-01/BP-03): ${[...tools].join(", ")} · focus: ${[...focus].join(", ")}`,
  };
}
