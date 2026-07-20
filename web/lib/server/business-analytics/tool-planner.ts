/**
 * Selects Bitrix24 entity groups for Business Analytics (BP-08).
 * Modules: leads, deals, contacts, companies, tasks, activities, users, departments.
 */

export type BusinessAnalyticsCrmTool =
  | "leads"
  | "deals"
  | "contacts"
  | "companies"
  | "tasks"
  | "open_tasks"
  | "overdue_tasks"
  | "activities"
  | "users"
  | "departments"
  | "workload"
  | "conversion"
  | "data_quality";

export interface BusinessAnalyticsToolPlan {
  tools: BusinessAnalyticsCrmTool[];
  reason: string;
  focus: Array<
    | "leads_pipeline"
    | "deals_pipeline"
    | "conversion"
    | "overdue_tasks"
    | "open_tasks"
    | "workload_by_dept"
    | "workload_by_user"
    | "activities"
    | "contacts_coverage"
    | "companies_coverage"
    | "data_quality"
    | "stalled_deals"
    | "departments"
    | "active_users"
  >;
}

export function planBusinessAnalyticsCrmTools(rewrittenQuery: string): BusinessAnalyticsToolPlan {
  const text = rewrittenQuery.toLowerCase();
  const tools = new Set<BusinessAnalyticsCrmTool>(["deals", "leads", "tasks", "users"]);
  const focus = new Set<BusinessAnalyticsToolPlan["focus"][number]>();

  if (/lead|lid|manba|pipeline/.test(text)) {
    tools.add("leads");
    focus.add("leads_pipeline");
  }

  if (/bitim|deal|pipeline|bosqich|stage/.test(text)) {
    tools.add("deals");
    focus.add("deals_pipeline");
  }

  if (/konversiya|conversion|lead.*bitim/.test(text)) {
    tools.add("conversion");
    tools.add("leads");
    tools.add("deals");
    focus.add("conversion");
  }

  if (/kontakt|contact|mijoz/.test(text)) {
    tools.add("contacts");
    focus.add("contacts_coverage");
  }

  if (/kompaniya|company|yirik/.test(text)) {
    tools.add("companies");
    focus.add("companies_coverage");
  }

  if (/kechik|overdue|deadline|muddati/.test(text)) {
    tools.add("overdue_tasks");
    focus.add("overdue_tasks");
  }

  if (/ochiq|open|faol vazifa/.test(text)) {
    tools.add("open_tasks");
    focus.add("open_tasks");
  }

  if (/yuklama|workload|band|bo'lim/.test(text)) {
    tools.add("workload");
    tools.add("departments");
    focus.add("workload_by_dept");
    focus.add("workload_by_user");
    focus.add("departments");
  }

  if (/activity|aktivit|qo'ng'iroq|email|timeline/.test(text)) {
    tools.add("activities");
    focus.add("activities");
  }

  if (/ma'lumot sifati|data quality|bo'sh maydon|0 summa|eskirgan|aniqlanmagan/.test(text)) {
    tools.add("data_quality");
    tools.add("deals");
    tools.add("contacts");
    tools.add("companies");
    focus.add("data_quality");
  }

  if (/turib qol|stalled|uzoq/.test(text)) {
    tools.add("deals");
    focus.add("stalled_deals");
  }

  if (/bo'lim|department|struktura/.test(text)) {
    tools.add("departments");
    focus.add("departments");
  }

  if (/xodim|menejer|jamoa|faol/.test(text)) {
    tools.add("users");
    focus.add("active_users");
  }

  if (focus.size === 0) {
    focus.add("conversion");
    focus.add("overdue_tasks");
    focus.add("workload_by_dept");
    focus.add("data_quality");
    focus.add("deals_pipeline");
    tools.add("overdue_tasks");
    tools.add("workload");
    tools.add("departments");
    tools.add("activities");
    tools.add("contacts");
    tools.add("companies");
    tools.add("data_quality");
    tools.add("conversion");
  }

  if (/tahlil|holat|umumiy|bahola|hisobot|dashboard|monitor|kpi|aggregat/.test(text)) {
    tools.add("departments");
    tools.add("activities");
    tools.add("data_quality");
    tools.add("conversion");
    focus.add("data_quality");
    focus.add("conversion");
    focus.add("workload_by_dept");
  }

  return {
    tools: [...tools],
    focus: [...focus],
    reason: `BA CRM (BP-08): ${[...tools].join(", ")} · focus: ${[...focus].join(", ")}`,
  };
}
