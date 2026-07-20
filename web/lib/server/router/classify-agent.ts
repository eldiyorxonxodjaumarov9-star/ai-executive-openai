import { isCompanyWideCeoQuestion } from "../org/structure";
import type { RouteResult, RoutableAgentId } from "./types";
import { ALL_DIRECTOR_AGENTS } from "./types";

interface SignalRule {
  agent: RoutableAgentId;
  weight: number;
  patterns: RegExp[];
}

const RULES: SignalRule[] = [
  {
    agent: "sales",
    weight: 3,
    patterns: [
      /savdo|sotuv|lead|bitim|shartnoma|tijoriy taklif|konversiya|menejer|pipeline|bp-0?1|bp-0?3/i,
    ],
  },
  {
    agent: "procurement",
    weight: 3,
    patterns: [
      /ta'?minot|taminot|yetkazib|yetkazib beruv|xarid|supplier|ombor|logistik|bp-0?2|bp-0?5|narx.*foyda|bozor tahlili/i,
    ],
  },
  {
    agent: "finance",
    weight: 3,
    patterns: [
      /moliya|tushum|to'?lov|debitor|kreditor|g'?azna|hisob-kitob|invoice|bp-0?6|daromad|qarz/i,
    ],
  },
  {
    agent: "customer_success",
    weight: 3,
    patterns: [
      /mijoz|customer success|retention|broker|servis|account|tajriba|bp-0?4|bp-0?7|elektron savdo/i,
    ],
  },
  {
    agent: "hr",
    weight: 3,
    patterns: [
      /xodim|hr|hiring|onboarding|performance|motivatsiya|o'?qitish|ma'muriy|davomat|vazifa.*kimda|kimda.*vazifa|ish yuklam/i,
    ],
  },
  {
    agent: "business_analytics",
    weight: 3,
    patterns: [
      /kpi|dashboard|analitika|monitoring|avtomatlashtir|bottleneck|jarayon.*kechik|bp-0?8|crm.*sifati|it tizim|bitrix.*monitor|process monitoring/i,
    ],
  },
  {
    agent: "ceo",
    weight: 2,
    patterns: [
      /kompaniya holati|firma holati|umumiy holat|executive|strategiya|korporativ|bp-0?9|rahbar/i,
    ],
  },
];

function scoreAgents(question: string): Map<RoutableAgentId, number> {
  const scores = new Map<RoutableAgentId, number>();
  for (const rule of RULES) {
    let hit = 0;
    for (const pat of rule.patterns) {
      if (pat.test(question)) hit += 1;
    }
    if (hit > 0) {
      scores.set(rule.agent, (scores.get(rule.agent) || 0) + rule.weight * hit);
    }
  }
  return scores;
}

function sortedAgents(scores: Map<RoutableAgentId, number>): RoutableAgentId[] {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([agent]) => agent);
}

export function classifyAgent(question: string): RouteResult {
  const q = question.trim();
  if (!q) {
    return {
      primaryAgent: "ceo",
      secondaryAgents: [],
      confidence: 0,
      reason: "Bo'sh savol",
    };
  }

  if (isCompanyWideCeoQuestion(q)) {
    return {
      primaryAgent: "ceo",
      secondaryAgents: [...ALL_DIRECTOR_AGENTS],
      confidence: 0.95,
      reason: "Kompaniya umumiy holati — barcha 6 direktor agent",
    };
  }

  const scores = scoreAgents(q);
  const ranked = sortedAgents(scores);

  if (ranked.length === 0) {
    return {
      primaryAgent: "ceo",
      secondaryAgents: [],
      confidence: 0.4,
      reason: "Aniq signal yo'q — CEO default",
    };
  }

  const primary = ranked[0];
  const primaryScore = scores.get(primary) || 0;
  const secondary: RoutableAgentId[] = [];

  for (let i = 1; i < ranked.length; i++) {
    const agent = ranked[i];
    const score = scores.get(agent) || 0;
    if (score >= primaryScore * 0.6 && score >= 3) {
      secondary.push(agent);
    }
  }

  const maxPossible = 9;
  const confidence = Math.min(0.95, 0.5 + primaryScore / maxPossible);

  return {
    primaryAgent: primary,
    secondaryAgents: secondary,
    confidence,
    reason: `${primary} eng yuqori signal (${primaryScore})${secondary.length ? `; qo'shimcha: ${secondary.join(", ")}` : ""}`,
  };
}
