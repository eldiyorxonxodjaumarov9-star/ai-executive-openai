/**
 * Foydalanuvchiga ko'rsatiladigan xato xabarlari — stack trace yo'q.
 */
import { BitrixError } from "./bitrix";
import { OpenAIError } from "./openai";

export interface UserFacingError {
  code: string;
  message: string;
  httpStatus: number;
}

const EMPTY_KNOWLEDGE_MSG =
  "Ushbu mavzu bo'yicha ichki qo'llanma mavjud emas.";

export { EMPTY_KNOWLEDGE_MSG };

export function mapThrownError(e: unknown): UserFacingError {
  if (e instanceof BitrixError) {
    const status = e.statusCode;
    if (status === 401) {
      return {
        code: "crm_unauthorized",
        message: "Bitrix24 ulanishi ruxsat etilmadi. Administrator webhook tokenini tekshirishi kerak.",
        httpStatus: 502,
      };
    }
    if (status === 403 || e.code === "permission_denied") {
      return {
        code: "crm_forbidden",
        message: "Bitrix24 ruxsati yetarli emas. Kerakli modul uchun webhook permission qo'shing.",
        httpStatus: 502,
      };
    }
    if (status === 500 || (status !== undefined && status >= 500)) {
      return {
        code: "crm_server_error",
        message: "Bitrix24 serverida vaqtincha xato. Keyinroq qayta urinib ko'ring.",
        httpStatus: 502,
      };
    }
    if (
      e.message.includes("vaqti") ||
      e.message.includes("timeout") ||
      e.message.includes("javob kelmadi")
    ) {
      return {
        code: "crm_timeout",
        message: "Bitrix24 javobi kechikdi. Qayta urinib ko'ring.",
        httpStatus: 504,
      };
    }
    return {
      code: "crm_error",
      message: "CRM ma'lumot olishda xato — Bitrix24 ulanishini tekshiring.",
      httpStatus: 502,
    };
  }

  if (e instanceof OpenAIError) {
    const msg = e.message;
    if (msg.includes("vaqti tugadi") || msg.includes("timeout")) {
      return {
        code: "ai_timeout",
        message: "AI javobi vaqti tugadi — qayta urinib ko'ring.",
        httpStatus: 504,
      };
    }
    if (msg.includes("sozlanmagan") || msg.includes("kaliti")) {
      return {
        code: "ai_config_error",
        message: "AI sozlamalari to'liq emas. Administrator bilan bog'laning.",
        httpStatus: 503,
      };
    }
    return {
      code: "ai_error",
      message: "AI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.",
      httpStatus: 502,
    };
  }

  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("Agent nomi")) {
    return { code: "agent_invalid", message: msg, httpStatus: 400 };
  }
  if (msg.includes("bo'sh")) {
    return {
      code: "validation_error",
      message: "Savol bo'sh bo'lishi mumkin emas.",
      httpStatus: 422,
    };
  }
  if (/ECONNREFUSED|ENOTFOUND|fetch failed|network/i.test(msg)) {
    return {
      code: "network_error",
      message: "Tarmoq xatosi — ulanishni tekshirib qayta urinib ko'ring.",
      httpStatus: 502,
    };
  }

  return {
    code: "internal_error",
    message: "Server ichki xatosi. Keyinroq qayta urinib ko'ring.",
    httpStatus: 500,
  };
}
