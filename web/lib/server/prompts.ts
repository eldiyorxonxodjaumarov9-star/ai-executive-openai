import fs from "fs";
import path from "path";
import type { AgentId } from "./constants";

const cache = new Map<string, string>();

export function loadAgentPrompt(agent: AgentId): string {
  if (cache.has(agent)) return cache.get(agent)!;

  const filePath = path.join(process.cwd(), "prompts", `${agent}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt fayli topilmadi: ${agent}.md`);
  }
  const content = fs.readFileSync(filePath, "utf-8").trim();
  cache.set(agent, content);
  return content;
}
