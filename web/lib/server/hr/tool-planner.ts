/**
 * Selects only Bitrix24 entity groups needed for the rewritten HR query.
 */

export type HrCrmTool =
  | "users"
  | "departments"
  | "tasks"
  | "completed_tasks"
  | "open_tasks"
  | "overdue_tasks"
  | "activities"
  | "deals"
  | "workload";

export interface HrToolPlan {
  tools: HrCrmTool[];
  reason: string;
  focus: Array<
    | "active_users"
    | "departments"
    | "overdue_tasks"
    | "open_tasks"
    | "completed_today"
    | "workload"
    | "responsible_employee"
    | "task_creator"
    | "deadlines"
    | "employee_deals"
    | "activities"
  >;
}

export function planHrCrmTools(rewrittenQuery: string): HrToolPlan {
  const text = rewrittenQuery.toLowerCase();
  const tools = new Set<HrCrmTool>(["tasks", "users"]);
  const focus = new Set<HrToolPlan["focus"][number]>();

  if (/bo'lim|department|struktura/.test(text)) {
    tools.add("departments");
    focus.add("departments");
  }

  if (/kechik|overdue|deadline|muddati/.test(text)) {
    tools.add("overdue_tasks");
    focus.add("overdue_tasks");
    focus.add("deadlines");
    focus.add("responsible_employee");
  }

  if (/ochiq|open|faol vazifa/.test(text)) {
    tools.add("open_tasks");
    focus.add("open_tasks");
  }

  if (/bajardi|bajarilgan|completed|bugun.*vazifa/.test(text)) {
    tools.add("completed_tasks");
    focus.add("completed_today");
  }

  if (/yuklama|workload|ko'p vazifa|eng band/.test(text)) {
    tools.add("workload");
    focus.add("workload");
    focus.add("open_tasks");
  }

  if (/activity|aktivit|qo'ng'iroq|email/.test(text)) {
    tools.add("activities");
    focus.add("activities");
  }

  if (/bitim|savdo|deal|natija/.test(text)) {
    tools.add("deals");
    focus.add("employee_deals");
  }

  if (/faol xodim|xodimlar ro'yxati|jamoa/.test(text)) {
    focus.add("active_users");
  }

  if (/mas'ul|responsible|kimda/.test(text)) {
    focus.add("responsible_employee");
  }

  if (/yarat|creator|kim yarat/.test(text)) {
    focus.add("task_creator");
  }

  if (focus.size === 0) {
    focus.add("overdue_tasks");
    focus.add("open_tasks");
    focus.add("workload");
    focus.add("active_users");
    tools.add("overdue_tasks");
    tools.add("open_tasks");
    tools.add("workload");
  }

  if (/tahlil|holat|umumiy|bahola/.test(text)) {
    tools.add("departments");
    tools.add("overdue_tasks");
    tools.add("workload");
    tools.add("activities");
    focus.add("overdue_tasks");
    focus.add("workload");
    focus.add("departments");
  }

  return {
    tools: [...tools],
    focus: [...focus],
    reason: `HR CRM: ${[...tools].join(", ")} · focus: ${[...focus].join(", ")}`,
  };
}
