import fs from "fs";
import path from "path";
import type { AgentId } from "./constants";
import type { DomainIntent } from "./intent-router";
import { BRAINS_DIR } from "./paths";

const COMMON_OPTIONAL = ["communication_style.md"];
const COMMON_DECISION = ["decision_rules.md", "decision_framework.md"];

const INTENT_BRAIN_MAP: Record<DomainIntent, string[]> = {
  kpi: ["kpis.md", "report_structure.md"],
  risk: ["risk_analysis.md", "financial_risks.md", "forbidden_actions.md"],
  forecast: ["forecast.md", "forecasting.md", "strategic_planning.md"],
  finance: ["cashflow.md", "profitability.md", "investment_logic.md", "accounting_rules.md"],
  sales_pipeline: ["pipeline.md", "lead_scoring.md", "conversion.md", "closing.md"],
  hr_workload: ["workload.md", "employee_performance.md", "motivation.md", "recruitment.md"],
  marketing_sources: ["lead_sources.md", "campaigns.md", "analytics.md", "roi.md"],
  customer_retention: ["customer_retention.md", "customer_health.md", "renewals.md", "upsell.md"],
  tasks: ["meeting_assistant.md", "workload.md", "support.md"],
  deals: ["pipeline.md", "sales_strategy.md", "profitability.md"],
  leads: ["lead_scoring.md", "conversion.md", "lead_sources.md"],
  contacts: ["customer_journey.md", "support.md", "negotiation.md"],
  strategy: ["strategic_planning.md", "business_logic.md", "recommendations.md"],
  operations: ["business_logic.md", "report_structure.md", "training.md"],
  general_summary: ["report_structure.md", "recommendations.md", "examples.md"],
  unknown: ["report_structure.md", "examples.md"],
};

const CASUAL_BRAIN_FILES = ["identity.md", "communication_style.md", "examples.md"];

function readExisting(agentDir: string, files: string[]): { files: string[]; text: string } {
  const selected: string[] = [];
  const sections: string[] = [];

  for (const filename of files) {
    if (selected.includes(filename)) continue;
    const filePath = path.join(agentDir, filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) continue;
    selected.push(filename);
    sections.push(`## Brain: ${filename}\n\n${content}`);
  }

  return { files: selected, text: sections.join("\n\n---\n\n") };
}

export function loadBrainForIntent(
  agent: AgentId,
  domainIntent: DomainIntent,
  mode: "full" | "casual" = "full"
): { files: string[]; text: string } {
  const agentDir = path.join(BRAINS_DIR, agent);
  if (!fs.existsSync(agentDir)) {
    return { files: [], text: "" };
  }

  if (mode === "casual") {
    return readExisting(agentDir, CASUAL_BRAIN_FILES);
  }

  const requested = [
    "identity.md",
    ...COMMON_DECISION,
    ...COMMON_OPTIONAL,
    ...(INTENT_BRAIN_MAP[domainIntent] || INTENT_BRAIN_MAP.unknown),
    "kpis.md",
    "report_structure.md",
  ];

  return readExisting(agentDir, requested);
}
