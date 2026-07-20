/**
 * CEO orchestration uchun engil direktor brieflari.
 * To'liq OpenAI pipeline chaqirilmaydi — faqat knowledge + CRM agregatsiya.
 * Yakuniy Executive Report faqat CEO OpenAI chaqiruvida yoziladi.
 */
import { retrieveSalesChunks } from "../sales/retriever";
import { planSalesCrmTools } from "../sales/tool-planner";
import { fetchSalesCrmData } from "../sales/crm-fetcher";
import { retrieveProcurementChunks } from "../procurement/retriever";
import { planProcurementCrmTools } from "../procurement/tool-planner";
import { fetchProcurementCrmData } from "../procurement/crm-fetcher";
import { retrieveFinanceChunks } from "../finance/retriever";
import { planFinanceCrmTools } from "../finance/tool-planner";
import { fetchFinanceCrmData } from "../finance/crm-fetcher";
import { retrieveCustomerSuccessChunks } from "../customer-success/retriever";
import { planCustomerSuccessCrmTools } from "../customer-success/tool-planner";
import { fetchCustomerSuccessCrmData } from "../customer-success/crm-fetcher";
import { retrieveHrChunks } from "../hr/retriever";
import { planHrCrmTools } from "../hr/tool-planner";
import { fetchHrCrmData } from "../hr/crm-fetcher";
import { retrieveBusinessAnalyticsChunks } from "../business-analytics/retriever";
import { planBusinessAnalyticsCrmTools } from "../business-analytics/tool-planner";
import { fetchBusinessAnalyticsCrmData } from "../business-analytics/crm-fetcher";
import { buildStructuredFromPipeline, type AgentStructuredResult } from "../agent-result";
import type { RoutableAgentId } from "../router/types";

function snippetFromHits(hits: { chunk: { text: string } }[], max = 700): string {
  if (!hits.length) return "";
  return hits
    .slice(0, 3)
    .map((h) => h.chunk.text.slice(0, 240))
    .join(" … ");
}

export async function collectDirectorBrief(
  agentId: RoutableAgentId,
  question: string
): Promise<{
  structured: AgentStructuredResult;
  mode: string;
  knowledgeFiles: string[];
  crmEntities: string[];
}> {
  const q = `${question} qisqa holat hisobot`;

  switch (agentId) {
    case "sales": {
      const plan = planSalesCrmTools(q);
      const [knowledge, crm] = await Promise.all([
        retrieveSalesChunks(q, { topK: 4, log: false }).catch(() => null),
        fetchSalesCrmData(plan.tools, plan.focus).catch(() => null),
      ]);
      const summary =
        snippetFromHits(knowledge?.hits || []) ||
        (crm && !crm.empty
          ? `Savdo CRM: bitimlar=${crm.counts?.deals ?? 0}, leadlar=${crm.counts?.leads ?? 0}.`
          : "Savdo bo'yicha knowledge/CRM qisqa ma'lumot cheklangan.");
      return {
        mode: "sales_brief",
        knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
        crmEntities: plan.tools,
        structured: buildStructuredFromPipeline({
          answer: summary,
          domainIntent: "sales_brief",
          crmSummary: { counts: crm?.counts, limitations: crm?.limitations },
          knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
          crmEntities: plan.tools,
          knowledgeInPrompt: Boolean(knowledge?.hits.length),
          crmMissing: !crm || crm.empty,
          limitations: crm?.limitations,
          knowledgeLabel: "Savdo",
        }),
      };
    }
    case "procurement": {
      const plan = planProcurementCrmTools(q);
      const [knowledge, crm] = await Promise.all([
        retrieveProcurementChunks(q, { topK: 4, log: false }).catch(() => null),
        fetchProcurementCrmData(plan.tools, plan.focus).catch(() => null),
      ]);
      const summary =
        snippetFromHits(knowledge?.hits || []) ||
        (crm && !crm.empty
          ? `Ta'minot CRM: kompaniyalar=${crm.counts?.companies ?? 0}, vazifalar=${crm.counts?.tasks ?? 0}.`
          : "Ta'minot knowledge asosida: supplier entity cheklovlari bo'lishi mumkin.");
      return {
        mode: "procurement_brief",
        knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
        crmEntities: plan.tools,
        structured: buildStructuredFromPipeline({
          answer: summary,
          domainIntent: "procurement_brief",
          crmSummary: { counts: crm?.counts, limitations: crm?.limitations },
          knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
          crmEntities: plan.tools,
          knowledgeInPrompt: Boolean(knowledge?.hits.length),
          crmMissing: !crm || crm.empty,
          limitations: crm?.limitations,
          knowledgeLabel: "Ta'minot",
        }),
      };
    }
    case "finance": {
      const plan = planFinanceCrmTools(q);
      const [knowledge, crm] = await Promise.all([
        retrieveFinanceChunks(q, { topK: 4, log: false }).catch(() => null),
        fetchFinanceCrmData(plan.tools, plan.focus).catch(() => null),
      ]);
      const summary =
        snippetFromHits(knowledge?.hits || []) ||
        (crm && !crm.empty
          ? `Moliya CRM: bitimlar=${crm.counts?.deals ?? 0}.`
          : "Moliya knowledge/CRM cheklangan.");
      return {
        mode: "finance_brief",
        knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
        crmEntities: plan.tools,
        structured: buildStructuredFromPipeline({
          answer: summary,
          domainIntent: "finance_brief",
          crmSummary: { counts: crm?.counts, limitations: crm?.limitations },
          knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
          crmEntities: plan.tools,
          knowledgeInPrompt: Boolean(knowledge?.hits.length),
          crmMissing: !crm || crm.empty,
          limitations: crm?.limitations,
          knowledgeLabel: "Moliya",
        }),
      };
    }
    case "customer_success": {
      const plan = planCustomerSuccessCrmTools(q);
      const [knowledge, crm] = await Promise.all([
        retrieveCustomerSuccessChunks(q, { topK: 4, log: false }).catch(() => null),
        fetchCustomerSuccessCrmData(plan.tools, plan.focus).catch(() => null),
      ]);
      const summary =
        snippetFromHits(knowledge?.hits || []) ||
        (crm && !crm.empty
          ? `CS CRM: kontaktlar=${crm.counts?.contacts ?? 0}, activities=${crm.counts?.activities ?? 0}.`
          : "Customer Success knowledge/CRM cheklangan.");
      return {
        mode: "customer_success_brief",
        knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
        crmEntities: plan.tools,
        structured: buildStructuredFromPipeline({
          answer: summary,
          domainIntent: "cs_brief",
          crmSummary: { counts: crm?.counts, limitations: crm?.limitations },
          knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
          crmEntities: plan.tools,
          knowledgeInPrompt: Boolean(knowledge?.hits.length),
          crmMissing: !crm || crm.empty,
          limitations: crm?.limitations,
          knowledgeLabel: "Customer Success",
        }),
      };
    }
    case "hr": {
      const plan = planHrCrmTools(q);
      const [knowledge, crm] = await Promise.all([
        retrieveHrChunks(q, { topK: 4, log: false }).catch(() => null),
        fetchHrCrmData(plan.tools, plan.focus).catch(() => null),
      ]);
      const summary =
        snippetFromHits(knowledge?.hits || []) ||
        (crm && !crm.empty
          ? `HR CRM: xodimlar=${crm.counts?.users ?? 0}, vazifalar=${crm.counts?.tasks ?? 0}.`
          : "HR knowledge/CRM cheklangan.");
      return {
        mode: "hr_brief",
        knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
        crmEntities: plan.tools,
        structured: buildStructuredFromPipeline({
          answer: summary,
          domainIntent: "hr_brief",
          crmSummary: { counts: crm?.counts, limitations: crm?.limitations },
          knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
          crmEntities: plan.tools,
          knowledgeInPrompt: Boolean(knowledge?.hits.length),
          crmMissing: !crm || crm.empty,
          limitations: crm?.limitations,
          knowledgeLabel: "HR",
        }),
      };
    }
    case "business_analytics": {
      const plan = planBusinessAnalyticsCrmTools(q);
      const [knowledge, crm] = await Promise.all([
        retrieveBusinessAnalyticsChunks(q, { topK: 4, log: false }).catch(() => null),
        fetchBusinessAnalyticsCrmData(plan.tools, plan.focus).catch(() => null),
      ]);
      const summary =
        snippetFromHits(knowledge?.hits || []) ||
        (crm && !crm.empty
          ? `IT/BA CRM agregatsiya: deals=${crm.counts?.deals ?? 0}, tasks=${crm.counts?.tasks ?? 0}.`
          : "IT/BA knowledge/CRM cheklangan.");
      return {
        mode: "business_analytics_brief",
        knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
        crmEntities: plan.tools,
        structured: buildStructuredFromPipeline({
          answer: summary,
          domainIntent: "ba_brief",
          crmSummary: { counts: crm?.counts, limitations: crm?.limitations },
          knowledgeFiles: [...new Set(knowledge?.hits.map((h) => h.chunk.meta.fileName) || [])],
          crmEntities: plan.tools,
          knowledgeInPrompt: Boolean(knowledge?.hits.length),
          crmMissing: !crm || crm.empty,
          limitations: crm?.limitations,
          knowledgeLabel: "IT/BA",
        }),
      };
    }
    default:
      return {
        mode: "none",
        knowledgeFiles: [],
        crmEntities: [],
        structured: {
          status: "error",
          summary: "",
          keyMetrics: {},
          risks: [],
          strengths: [],
          recommendations: [],
          dataLimitations: ["Noma'lum agent"],
          knowledgeUsed: false,
          crmUsed: false,
        },
      };
  }
}
