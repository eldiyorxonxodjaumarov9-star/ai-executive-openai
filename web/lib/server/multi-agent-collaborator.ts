import type { AgentId } from "./constants";
import type { BitrixLoadedData } from "./bitrix-data-loader";
import { analyzeCrmQuery } from "./crm-query-router";
import { buildAgentAnalytics } from "./agent-analytics";
import type { CrmQueryRouting } from "./crm-query-router";

const COLLAB_AGENTS: AgentId[] = ["sales", "finance", "hr", "marketing", "customer_success"];

function questionNeedsAgent(question: string, agent: AgentId): boolean {
  const t = question.toLowerCase();
  const signals: Record<AgentId, RegExp> = {
    ceo: /^$/,
    sales: /\b(savdo|sotuv|voronka|menejer|bitim)\b/,
    finance: /\b(moliya|summa|tushum|revenue|forecast)\b/,
    hr: /\b(xodim|yuklama|ishchi|hr)\b/,
    marketing: /\b(marketing|lid|source|konversiya|manba)\b/,
    customer_success: /\b(mijoz|kontakt|retention|customer)\b/,
  };
  if (agent === "ceo") return false;
  return signals[agent].test(t);
}

export async function runMultiAgentCollaboration(
  primaryAgent: AgentId,
  question: string,
  loaded: BitrixLoadedData,
  routing: CrmQueryRouting
): Promise<Record<string, unknown>> {
  if (primaryAgent !== "ceo" && !/\b(barcha|umumiy|kompaniya|hisobot)\b/i.test(question)) {
    return {};
  }

  const insights: Record<string, unknown> = {};
  const targets = COLLAB_AGENTS.filter(
    (a) => a !== primaryAgent && (primaryAgent === "ceo" || questionNeedsAgent(question, a))
  );

  if (primaryAgent === "ceo") {
    for (const agent of COLLAB_AGENTS) {
      const bundle = buildAgentAnalytics(agent, loaded, routing, question);
      insights[agent] = {
        label: agent,
        agentSpecific: bundle.agentSpecific,
        summary: {
          totalDeals: bundle.base.summary.totalDeals,
          openDeals: bundle.base.summary.openDeals,
          wonDeals: bundle.base.summary.wonDeals,
          pipeline: bundle.base.summary.totalPipelineAmountFormatted,
        },
      };
    }
  } else {
    for (const agent of targets) {
      const bundle = buildAgentAnalytics(agent, loaded, routing, question);
      insights[agent] = { agentSpecific: bundle.agentSpecific };
    }
  }

  return insights;
}

export { analyzeCrmQuery };
