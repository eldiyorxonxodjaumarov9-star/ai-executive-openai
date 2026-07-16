import type { AgentId } from "./constants";
import { AGENT_DISPLAY_NAMES } from "./constants";

export type BitrixEntityType = "deals" | "leads" | "contacts" | "companies" | "tasks" | "activities" | "stages";

export const AGENT_CRM_ENTITIES: Record<AgentId, BitrixEntityType[]> = {
  ceo: ["deals", "leads", "contacts", "tasks", "companies", "stages"],
  finance: ["deals", "contacts", "stages"],
  sales: ["deals", "leads", "stages"],
  hr: ["deals", "tasks", "stages"],
  marketing: ["leads", "deals", "contacts", "stages"],
  customer_success: ["contacts", "deals", "companies", "activities", "stages"],
};

export const AGENT_PROFESSIONAL_INSTRUCTIONS: Record<AgentId, string> = {
  ceo: `Sen kompaniya direktori uchun ishlaydigan AI Executive Analystsan. Bitrix24'dan olingan REAL va YANGI ma'lumotlarni tahlil qilib, raqamlar, muammolar, risklar va aniq boshqaruv tavsiyalarini ber. Oldingi suhbatdagi raqamlarga ishonma — faqat hozirgi contextdagi analytics.`,
  finance: `Sen CFO darajasidagi AI moliya analystsan. Bitrix24 bitimlari, summalar, valyuta va moliyaviy trendlarni tahlil qil. Kutilayotgan tushum, o'rtacha bitim qiymati va moliyaviy risklarni aniq ko'rsat.`,
  sales: `Sen Head of Sales darajasidagi AI analystsan. Voronka, menejerlar, bitimlar, konversiya va savdo risklarini tahlil qil. Tiqilib qolgan bitimlar va amaliy savdo tavsiyalarini ber.`,
  hr: `Sen HR Business Partner AI analystsan. Xodimlar yuklamasi, ochiq bitimlar va faollikni tahlil qil. E'tibor: faqat bitim soni to'liq xodim baholash emas — adolatli va ehtiyotkor xulosa ber.`,
  marketing: `Sen Marketing Analytics AI specialistsan. Lead manbalari, konversiya va source-based revenue tahlil qil. SOURCE_ID yoki UTM maydonlari yo'q bo'lsa, buni aniq ayt.`,
  customer_success: `Sen Customer Success AI analystsan. Mijozlar, takroriy bitimlar, faol/nofaol mijozlar va saqlab qolish (retention) bo'yicha tavsiyalar ber.`,
};

export function getAgentRole(agent: AgentId): string {
  return AGENT_DISPLAY_NAMES[agent];
}

export function entitiesForAgent(agent: AgentId): BitrixEntityType[] {
  return AGENT_CRM_ENTITIES[agent];
}
