/**
 * CEO BP-09: 6 ta direktor agent pipeline orqali strukturali hisobot yig'ish.
 */
import { runSalesAnswer } from "../sales/pipeline";
import { runFinanceAnswer } from "../finance/pipeline";
import { runHrAnswer } from "../hr/pipeline";
import { runCustomerSuccessAnswer } from "../customer-success/pipeline";
import { runProcurementAnswer } from "../procurement/pipeline";
import { runBusinessAnalyticsAnswer } from "../business-analytics/pipeline";
import type { AgentStructuredResult } from "../agent-result";
import { resolveCeoOrchestrationAgents } from "../router/route-query";
import { CEO_ORCHESTRATION_AGENTS } from "../org/structure";
import type { RoutableAgentId } from "../router/types";
import { devLog } from "../dev-log";

export interface DirectorStructuredReport {
  agentId: RoutableAgentId;
  label: string;
  structured: AgentStructuredResult;
  mode: string;
  ok: boolean;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}

export interface CeoOrchestrationBundle {
  reports: DirectorStructuredReport[];
  promptBlock: string;
  agentsConsulted: string[];
  orchestrationAgents: RoutableAgentId[];
}

const AGENT_LABELS: Record<RoutableAgentId, string> = {
  ceo: "CEO",
  sales: "Savdo direksiyasi (BP-01, BP-03)",
  procurement: "Ta'minot direksiyasi (BP-02, BP-05)",
  finance: "Moliya direksiyasi (BP-06)",
  customer_success: "Customer Success (BP-04, BP-07)",
  hr: "HR va administrativ boshqaruv",
  business_analytics: "IT va biznes analitika (BP-08)",
};

const BRIEF_QUESTIONS: Partial<Record<RoutableAgentId, string>> = {
  sales: "Savdo holatini qisqacha hisobot qil.",
  procurement: "Ta'minot va yetkazib berish holatini qisqacha hisobot qil.",
  finance: "Moliyaviy holatni qisqacha hisobot qil.",
  customer_success: "Mijozlar holatini qisqacha hisobot qil.",
  hr: "Xodimlar va vazifalar holatini qisqacha hisobot qil.",
  business_analytics: "KPI, jarayon va CRM monitoring holatini qisqacha hisobot qil.",
};

const SUB_AGENT_TIMEOUT_MS = 55_000;

type PipelineRunner = (q: string) => Promise<{
  answer: string;
  mode: string;
  structured?: AgentStructuredResult;
  knowledgeFiles?: string[];
  crmEntities?: string[];
  crmSummary?: Record<string, unknown>;
}>;

const RUNNERS: Partial<Record<RoutableAgentId, PipelineRunner>> = {
  sales: runSalesAnswer,
  procurement: runProcurementAnswer,
  finance: runFinanceAnswer,
  customer_success: runCustomerSuccessAnswer,
  hr: runHrAnswer,
  business_analytics: runBusinessAnalyticsAnswer,
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout: ${label} ${ms}ms ichida yakunlanmadi`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

async function safeDirectorReport(
  agentId: RoutableAgentId,
  originalQuestion: string
): Promise<DirectorStructuredReport> {
  const runner = RUNNERS[agentId];
  const label = AGENT_LABELS[agentId];
  const started = Date.now();
  const startedAt = new Date(started).toISOString();

  if (!runner) {
    return {
      agentId,
      label,
      structured: {
        status: "error",
        summary: "",
        keyMetrics: {},
        risks: [],
        strengths: [],
        recommendations: [],
        dataLimitations: ["Agent pipeline topilmadi."],
        knowledgeUsed: false,
        crmUsed: false,
      },
      mode: "",
      ok: false,
      error: "pipeline yo'q",
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    };
  }

  devLog(`[CEO Orchestration] START agent=${agentId} at=${startedAt}`);

  const briefQ = `${BRIEF_QUESTIONS[agentId] || "Qisqa hisobot ber."} Kontekst: ${originalQuestion}`;
  try {
    const r = await withTimeout(runner(briefQ), SUB_AGENT_TIMEOUT_MS, agentId);
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - started;
    const structured: AgentStructuredResult = r.structured || {
      status: r.answer.trim() ? "ok" : "error",
      summary: r.answer.slice(0, 1200),
      keyMetrics: {},
      risks: [],
      strengths: [],
      recommendations: [],
      dataLimitations: [],
      knowledgeUsed: Boolean(r.knowledgeFiles?.length),
      crmUsed: Boolean(r.crmEntities?.length),
    };

    devLog(
      `[CEO Orchestration] END agent=${agentId} durationMs=${durationMs}` +
        ` knowledge=${structured.knowledgeUsed} crm=${structured.crmUsed}` +
        ` status=${structured.status}`
    );

    return {
      agentId,
      label,
      structured,
      mode: r.mode,
      ok: structured.status !== "error",
      startedAt,
      finishedAt,
      durationMs,
    };
  } catch (e) {
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - started;
    const errMsg = e instanceof Error ? e.message : "xato";
    const isTimeout = /timeout/i.test(errMsg);

    devLog(
      `[CEO Orchestration] FAIL agent=${agentId} durationMs=${durationMs}` +
        ` reason=${isTimeout ? "timeout" : "error"} detail=${errMsg}`
    );

    return {
      agentId,
      label,
      structured: {
        status: "error",
        summary: "",
        keyMetrics: {},
        risks: [],
        strengths: [],
        recommendations: [],
        dataLimitations: [errMsg],
        knowledgeUsed: false,
        crmUsed: false,
      },
      mode: "",
      ok: false,
      error: isTimeout ? `timeout: ${errMsg}` : errMsg,
      startedAt,
      finishedAt,
      durationMs,
    };
  }
}

function formatStructuredBlock(report: DirectorStructuredReport): string {
  const s = report.structured;
  const lines = [
    `--- ${report.label} [${report.agentId}] status=${s.status} ---`,
    `Xulosa: ${s.summary.slice(0, 900) || "(bo'sh)"}`,
  ];
  if (Object.keys(s.keyMetrics).length) {
    lines.push(`Ko'rsatkichlar: ${JSON.stringify(s.keyMetrics)}`);
  }
  if (s.risks.length) lines.push(`Risklar: ${s.risks.join("; ")}`);
  if (s.strengths.length) lines.push(`Kuchli tomonlar: ${s.strengths.join("; ")}`);
  if (s.recommendations.length) lines.push(`Tavsiyalar: ${s.recommendations.join("; ")}`);
  if (s.dataLimitations.length) lines.push(`Cheklovlar: ${s.dataLimitations.join("; ")}`);
  lines.push(`Knowledge: ${s.knowledgeUsed ? "ha" : "yo'q"} | CRM: ${s.crmUsed ? "ha" : "yo'q"}`);
  if (!report.ok && report.error) lines.push(`Xato: ${report.error}`);
  return lines.join("\n");
}

export { isCompanyWideCeoQuestion, CEO_ORCHESTRATION_AGENTS } from "../org/structure";
export { resolveCeoOrchestrationAgents } from "../router/route-query";

export async function gatherCeoDirectorReports(
  originalQuestion: string,
  agentIds?: RoutableAgentId[]
): Promise<CeoOrchestrationBundle> {
  const orchestrationAgents =
    agentIds && agentIds.length > 0
      ? [...new Set(agentIds)]
      : resolveCeoOrchestrationAgents(originalQuestion);

  if (orchestrationAgents.length === 0) {
    return {
      reports: [],
      promptBlock: "",
      agentsConsulted: [],
      orchestrationAgents: [],
    };
  }

  const batchStarted = Date.now();
  devLog(`\n[CEO Orchestration] BP-09 START agents=${orchestrationAgents.join(",")}`);

  // Parallel: barcha sub-agent bir vaqtda
  const reports = await Promise.all(
    orchestrationAgents.map((id) => safeDirectorReport(id, originalQuestion))
  );

  devLog(
    `[CEO Orchestration] BP-09 END totalMs=${Date.now() - batchStarted}` +
      ` ok=${reports.filter((r) => r.ok).length}/${reports.length}`
  );

  const parts: string[] = [
    "=== DIREKTOR STRUKTURALI HISOBOTLAR (CEO orchestration) ===",
    `Foydalanuvchi savoli: ${originalQuestion}`,
    "",
  ];

  for (const r of reports) {
    parts.push(formatStructuredBlock(r));
    parts.push("");
  }

  parts.push(
    "=== CEO VAZIFASI ===",
    "Yuqoridagi strukturali hisobotlarni birlashtirib Executive Report yozing.",
    "Format: qisqa xulosa / bo'limlar holati / risklar / tavsiyalar / keyingi qadamlar.",
    "Agent ichki IDlari va CRM kodlarini ko'rsatmang. Faqat o'zbek tilida."
  );

  return {
    reports,
    promptBlock: parts.join("\n"),
    agentsConsulted: reports.filter((r) => r.ok).map((r) => r.agentId),
    orchestrationAgents,
  };
}
