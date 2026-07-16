import fs from "fs";
import path from "path";
import type { AgentId } from "./constants";
import type { DomainIntent } from "./intent-router";
import { KNOWLEDGE_DIR } from "./paths";

const INTENT_KNOWLEDGE_PRIORITY: Record<DomainIntent, string[]> = {
  kpi: ["kpi.md", "knowledge.md", "rules.md"],
  risk: ["rules.md", "faq.md", "knowledge.md"],
  forecast: ["kpi.md", "knowledge.md", "faq.md"],
  finance: ["knowledge.md", "kpi.md", "rules.md"],
  sales_pipeline: ["knowledge.md", "faq.md", "examples.md"],
  hr_workload: ["knowledge.md", "rules.md", "kpi.md"],
  marketing_sources: ["knowledge.md", "kpi.md", "examples.md"],
  customer_retention: ["knowledge.md", "kpi.md", "faq.md"],
  tasks: ["rules.md", "knowledge.md", "faq.md"],
  deals: ["knowledge.md", "kpi.md", "faq.md"],
  leads: ["knowledge.md", "examples.md", "faq.md"],
  contacts: ["knowledge.md", "faq.md", "examples.md"],
  strategy: ["knowledge.md", "rules.md", "kpi.md"],
  operations: ["rules.md", "knowledge.md", "faq.md"],
  general_summary: ["knowledge.md", "rules.md", "kpi.md"],
  unknown: ["knowledge.md", "rules.md", "faq.md"],
};

const MAX_KNOWLEDGE_CHARS = 3500;

function loadFromDir(agentDir: string, prioritized: string[]): { files: string[]; text: string } {
  const selected: string[] = [];
  const sections: string[] = [];

  for (const filename of prioritized) {
    if (selected.length >= 5) break;
    const filePath = path.join(agentDir, filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) continue;
    selected.push(filename);
    sections.push(`### ${filename}\n${content}`);
  }

  if (selected.length < 3 && fs.existsSync(agentDir)) {
    const onDisk = fs
      .readdirSync(agentDir)
      .filter((f) => f.endsWith(".md"))
      .sort();
    for (const filename of onDisk) {
      if (selected.length >= 3) break;
      if (selected.includes(filename)) continue;
      const content = fs.readFileSync(path.join(agentDir, filename), "utf-8").trim();
      if (!content) continue;
      selected.push(filename);
      sections.push(`### ${filename}\n${content}`);
    }
  }

  let text = sections.join("\n\n");
  if (text.length > MAX_KNOWLEDGE_CHARS) {
    text = text.slice(0, MAX_KNOWLEDGE_CHARS) + "\n…[qisqartirildi]";
  }

  return { files: selected, text };
}

export function loadKnowledgeForIntent(
  agent: AgentId,
  domainIntent: DomainIntent
): { files: string[]; text: string } {
  const agentDir = path.join(KNOWLEDGE_DIR, agent);
  if (!fs.existsSync(agentDir)) {
    return { files: [], text: "" };
  }

  const prioritized = [...(INTENT_KNOWLEDGE_PRIORITY[domainIntent] || INTENT_KNOWLEDGE_PRIORITY.unknown)];
  for (const fallback of ["examples.md", "faq.md"]) {
    if (!prioritized.includes(fallback)) prioritized.push(fallback);
  }

  return loadFromDir(agentDir, prioritized);
}

export function loadKnowledgeOverview(agent: AgentId): { files: string[]; text: string } {
  return loadKnowledgeForIntent(agent, "unknown");
}
