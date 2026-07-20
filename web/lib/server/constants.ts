export const VALID_AGENTS = [
  "ceo",
  "sales",
  "procurement",
  "finance",
  "marketing",
  "customer_success",
  "hr",
  "business_analytics",
] as const;

export type AgentId = (typeof VALID_AGENTS)[number];

export const AGENT_DISPLAY_NAMES: Record<AgentId, string> = {
  ceo: "Rahbar agenti",
  sales: "Savdo agenti",
  procurement: "Ta'minot agenti",
  finance: "Moliya agenti",
  marketing: "Targ'ibot agenti",
  customer_success: "Mijozlar agenti",
  hr: "Xodimlar agenti",
  business_analytics: "IT va biznes analitika",
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

export const CASUAL_ANSWER_INSTRUCTION = `Oddiy suhbat rejimidasiz. Tabiiy, iliq va qisqa javob bering (2–6 jumla).
Agent roli va imkoniyatlaringizni tushuntiring. Bitrix24 yoki CRM haqida gapirmang.
"CRMda ma'lumot topilmadi" kabi iboralarni hech qachon ishlatmang.`;

export const KNOWLEDGE_ANSWER_INSTRUCTION = `Bilim bazasi va agent promptiga tayangan holda javob bering (2–8 jumla).
Aniq, foydali va o'zbek tilida bo'lsin. CRM ma'lumotlari talab qilinmaydi — ularni o'zingizdan uydirmang.
"CRMda ma'lumot topilmadi" iborasini ishlatmang.`;

export const CRM_ANSWER_INSTRUCTION = `Bitrix24 dan olingan jonli ma'lumotlarga asoslanib javob bering (2–10 jumla).
Raqamlar aniq bo'lsin. Faqat berilgan analytics va statistikadan foydalaning — taxmin qilmang.
Umumiy bazada bitimlar mavjud bo'lsa, davr bo'yicha 0 natija bo'lsa ham umumiy statistikani tushuntiring.
Masalan: "Bugun yangi bitim yo'q, lekin jami bazada 52 ta bitim mavjud."
Faqat Bitrix24 dan hech qanday ma'lumot kelmaganda "Bitrix24 da bu savolga javob beradigan aniq ma'lumot topilmadi" deb yozing.
Ichki CRM kodlarini ko'rsatmang.`;

export const HYBRID_ANSWER_INSTRUCTION = `Bilim bazasi qoidalarini va Bitrix24 jonli ma'lumotlarini birlashtirib javob bering (3–10 jumla).
Avval qoida/norma, keyin faktik ma'lumot. Ikkalasini bog'lab tushuntiring.
Agar Bitrix24 dan ma'lumot topilmasa:
"Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi. Menda mavjud bilimlar asosida qisqacha tushuntiraman:" deb davom eting.
"CRMda yetarli ma'lumot topilmadi" iborasini ishlatmang.`;

export const USER_OUTPUT_INSTRUCTION = `MUHIM: Javob faqat o'zbek tilida (lotin) bo'lsin. CRM ichki kodlari, STAGE_ID, UC_*, NEW, LOSE, SUCCESS foydalanuvchiga ko'rinmasin.`;
