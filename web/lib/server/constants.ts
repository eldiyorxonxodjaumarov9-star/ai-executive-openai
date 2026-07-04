export const VALID_AGENTS = [
  "ceo",
  "sales",
  "finance",
  "marketing",
  "customer_success",
  "hr",
] as const;

export type AgentId = (typeof VALID_AGENTS)[number];

export const AGENT_DISPLAY_NAMES: Record<AgentId, string> = {
  ceo: "Bosh direktor agenti",
  sales: "Sotuv agenti",
  finance: "Moliya agenti",
  marketing: "Marketing agenti",
  customer_success: "Mijozlar muvaffaqiyati agenti",
  hr: "Kadrlar agenti",
};

export function normalizeAgent(name: string): AgentId {
  const normalized = name.trim().toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
  if (!VALID_AGENTS.includes(normalized as AgentId)) {
    throw new Error(
      `Agent nomi noto'g'ri: '${name}'. Qo'llab-quvvatlanadi: ${VALID_AGENTS.join(", ")}`
    );
  }
  return normalized as AgentId;
}

export const QUICK_ANSWER_INSTRUCTION = `Foydalanuvchi savoliga faqat kerakli ma'lumot asosida qisqa, aniq va o'zbek tilida javob ber.
Javob 5–12 jumladan oshmasin. Katta hisobot yozma. Keraksiz bo'limlar ochma.
Jadval, uzun ro'yxat va keng risk tahlilini faqat savol aniq talab qilsa ishlat.
Ichki CRM kodlarini (STAGE_ID, STATUS_ID va h.k.) ko'rsatma — faqat o'zbekcha tushunarli nomlar.
Inglizcha va ruscha so'z ishlatma.
Agar ma'lumot yetarli bo'lmasa: 'Bu savolga aniq javob berish uchun CRMda yetarli ma'lumot topilmadi.'`;

export const USER_OUTPUT_INSTRUCTION = `MUHIM: Javob faqat o'zbek tilida (lotin) bo'lsin. CRM ichki kodlari, STAGE_ID, UC_*, NEW, LOSE, SUCCESS foydalanuvchiga ko'rinmasin.`;
