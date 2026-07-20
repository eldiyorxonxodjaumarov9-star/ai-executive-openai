import type { AgentId } from "./constants";
import { AGENT_DISPLAY_NAMES } from "./constants";

export type BitrixEntityType = "deals" | "leads" | "contacts" | "companies" | "tasks" | "activities" | "stages";

export const AGENT_CRM_ENTITIES: Record<AgentId, BitrixEntityType[]> = {
  ceo: ["deals", "leads", "contacts", "tasks", "companies", "stages"],
  finance: ["deals", "stages"],
  sales: ["deals", "leads", "stages"],
  procurement: ["companies", "contacts", "deals", "tasks", "activities", "stages"],
  hr: ["tasks", "stages"],
  marketing: ["leads", "deals", "contacts", "stages"],
  customer_success: ["contacts", "deals", "companies", "activities", "stages"],
  business_analytics: ["deals", "leads", "contacts", "companies", "tasks", "activities", "stages"],
};

export const AGENT_PROFESSIONAL_INSTRUCTIONS: Record<AgentId, string> = {
  ceo: `Sen Xaridlar.uz bosh direktor (CEO) AI agentisan — BP-09. 6 ta direktor agent pipeline orqali tahlil olib Executive Report yozasan. Boshqa agent knowledge papkasini to'g'ridan-to'g'ri o'qimaysan.`,
  finance: `Sen Moliya direksiyasi AI agentisan — BP-06. Faqat moliya qo'llanmalari va Bitrix24 deals/revenue/payments/invoice maydonlari.`,
  sales: `Sen Savdo direksiyasi AI agentisan — BP-01 va BP-03. Faqat savdo hujjatlari va Bitrix24 leads/deals/managers/revenue.`,
  procurement: `Sen Ta'minot direksiyasi AI agentisan — BP-02 va BP-05. Faqat ta'minot hujjatlari va Bitrix24 kompaniya/kontakt/bitim/vazifa ma'lumotlari. Alohida supplier API yo'q bo'lsa — ochiq ayt.`,
  hr: `Sen HR AI agentisan. Faqat HR hujjatlari va Bitrix24 users/departments/tasks/activities.`,
  marketing: `Sen Marketing Analytics AI specialistsan (tuzilmada asosiy direksiya emas).`,
  customer_success: `Sen Customer Success AI agentisan — BP-04 va BP-07. Faqat CS hujjatlari va Bitrix24 contacts/companies/activities/deals.`,
  business_analytics: `Sen IT va biznes analitika AI agentisan — BP-08. Faqat analitika hujjatlari. Bitrix24 dan agregatsiya qil — raw JSON qaytarmasdan.`,
};

export function getAgentRole(agent: AgentId): string {
  return AGENT_DISPLAY_NAMES[agent];
}

export function entitiesForAgent(agent: AgentId): BitrixEntityType[] {
  return AGENT_CRM_ENTITIES[agent];
}
