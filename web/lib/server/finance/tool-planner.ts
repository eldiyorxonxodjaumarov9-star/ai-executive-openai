/**
 * Selects only Bitrix24 entity groups needed for the rewritten finance query.
 */

export type FinanceCrmTool = "deals" | "tasks" | "employees";

export interface FinanceToolPlan {
  tools: FinanceCrmTool[];
  reason: string;
  focus: Array<
    | "closed_sales"
    | "amounts"
    | "debt_tasks"
    | "overdue_tasks"
    | "manager_sales"
    | "period_revenue"
    | "large_deals"
    | "zero_amount_deals"
  >;
}

export function planFinanceCrmTools(rewrittenQuery: string): FinanceToolPlan {
  const text = rewrittenQuery.toLowerCase();
  const tools = new Set<FinanceCrmTool>(["deals"]);
  const focus = new Set<FinanceToolPlan["focus"][number]>();

  if (/yopilgan|tushum|savdo|sotuv|oy|bugun|hafta/.test(text)) {
    focus.add("closed_sales");
    focus.add("period_revenue");
    focus.add("amounts");
  }
  if (/summa|amount|qiymat/.test(text)) focus.add("amounts");
  if (/0|nol|kiritilmagan|aniqlanmagan/.test(text)) focus.add("zero_amount_deals");
  if (/katta|yirik|eng katta/.test(text)) focus.add("large_deals");
  if (/menejer|xodim|kesim/.test(text)) {
    focus.add("manager_sales");
    tools.add("employees");
  }
  if (/qarz|debitor|to'lov|kechik/.test(text)) {
    focus.add("debt_tasks");
    focus.add("overdue_tasks");
    tools.add("tasks");
    tools.add("employees");
  }
  if (/vazifa|task/.test(text)) {
    tools.add("tasks");
    focus.add("overdue_tasks");
  }

  if (focus.size === 0) {
    focus.add("closed_sales");
    focus.add("amounts");
    focus.add("zero_amount_deals");
    focus.add("period_revenue");
  }

  // Manager breakdown often useful for finance executive questions
  if (/tahlil|xavf|holat|umumiy/.test(text)) {
    tools.add("employees");
    focus.add("manager_sales");
  }

  return {
    tools: [...tools],
    focus: [...focus],
    reason: `Finance CRM: ${[...tools].join(", ")} · focus: ${[...focus].join(", ")}`,
  };
}
