/**
 * Selects only Bitrix24 entity groups for Finance (BP-06).
 * Modules: deals (revenue / payments / invoice fields).
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
  // BP-06: faqat deals asosidagi moliyaviy faktlar
  const tools = new Set<FinanceCrmTool>(["deals"]);
  const focus = new Set<FinanceToolPlan["focus"][number]>();

  if (/yopilgan|tushum|savdo|sotuv|oy|bugun|hafta|daromad/.test(text)) {
    focus.add("closed_sales");
    focus.add("period_revenue");
    focus.add("amounts");
  }
  if (/summa|amount|qiymat|to'?lov|invoice|hisob/.test(text)) focus.add("amounts");
  if (/0|nol|kiritilmagan|aniqlanmagan/.test(text)) focus.add("zero_amount_deals");
  if (/katta|yirik|eng katta/.test(text)) focus.add("large_deals");
  if (/debitor|qarz/.test(text)) {
    focus.add("debt_tasks");
    focus.add("amounts");
  }

  if (focus.size === 0) {
    focus.add("closed_sales");
    focus.add("amounts");
    focus.add("zero_amount_deals");
    focus.add("period_revenue");
  }

  return {
    tools: [...tools],
    focus: [...focus],
    reason: `Finance CRM (BP-06): ${[...tools].join(", ")} · focus: ${[...focus].join(", ")}`,
  };
}
