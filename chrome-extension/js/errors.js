/**
 * Unified Uzbek error formatting — single entry for all UI surfaces.
 */
(function (global) {
  "use strict";

  const C = () => global.AIEP?.constants?.MESSAGES || {};

  function parseApiBody(body) {
    if (!body) return { code: null, message: null };
    try {
      const parsed = JSON.parse(body);
      const detail = parsed?.detail;
      if (detail && typeof detail === "object") {
        return { code: detail.code || null, message: detail.message || null };
      }
      if (typeof detail === "string") {
        return { code: null, message: detail };
      }
      return {
        code: parsed?.error_code || parsed?.code || null,
        message: parsed?.error || parsed?.message || null,
      };
    } catch {
      return { code: null, message: null };
    }
  }

  function parseHttpError(status, body, debug) {
    const text = (body || "").toLowerCase();
    const secretSet = debug?.secretSet;
    const url = debug?.url || "";
    const { code, message } = parseApiBody(body);

    if (code === "agent_invalid") {
      return message || "Agent nomi noto'g'ri — ro'yxatdan agent tanlang.";
    }
    if (code === "crm_error") {
      return message || "CRM ma'lumot olishda xato — Bitrix24 ulanishini tekshiring.";
    }
    if (code === "ai_timeout" || code === "claude_timeout") {
      return message || "OpenAI javobi vaqti tugadi — qayta urinib ko'ring.";
    }
    if (code === "ai_error" || code === "claude_error") {
      return message || "OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.";
    }

    if (status === 401) {
      if (!secretSet) return "Ulanish kaliti kiritilmagan — kengaytma sozlamalaridan kalitni saqlang.";
      if (text.includes("invalid") || text.includes("missing") || text.includes("unauthorized")) {
        return "Ulanish kaliti noto'g'ri — sozlamalardagi qiymatni tekshiring.";
      }
      return "Ruxsat berilmadi — ulanish kalitini tekshiring.";
    }
    if (status === 403) return "Kirish taqiqlangan — ushbu resursga ruxsatingiz yo'q.";
    if (status === 404) {
      if (url.includes("/chat/") || text.includes("not found")) {
        return "Chat endpoint topilmadi — server yangilanganini tekshiring (POST /chat/agent).";
      }
      return "Endpoint topilmadi — server yo'li o'zgargan bo'lishi mumkin.";
    }
    if (status === 422) {
      return message || "So'rov formati noto'g'ri — savol bo'sh yoki juda uzun.";
    }
    if (status === 429) return "So'rovlar chegarasi — biroz kutib, qayta urinib ko'ring.";
    if (status === 500) {
      return message || "Server ichki xatosi — keyinroq qayta urinib ko'ring.";
    }
    if (status === 502) {
      if (message) return message;
      return message || "OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.";
    }
    if (status === 503) return "Server javobi kechikmoqda — 30 soniyadan keyin qayta urinib ko'ring.";
    if (status === 504) return message || C().TIMEOUT || "OpenAI javobi vaqti tugadi — qayta urinib ko'ring.";

    return message || `Server xatosi (${status})`;
  }

  function parseBackendError(err, debug) {
    if (!err) return C().AGENT_FAILED || "So'rov bajarilmadi.";

    if (err.type === "auth") {
      return err.message || C().SECRET_MISSING;
    }
    if (err.type === "endpoint_not_found") {
      return err.message || "Chat endpoint topilmadi — server yangilanganini tekshiring.";
    }
    if (err.type === "validation_error") {
      return err.message || "So'rov formati noto'g'ri.";
    }
    if (err.type === "agent_invalid") {
      return err.message || "Agent nomi noto'g'ri.";
    }
    if (err.type === "crm_error") {
      return err.message || "CRM ma'lumot olishda xato — Bitrix24 ulanishini tekshiring.";
    }
    if (err.type === "ai_timeout" || err.type === "claude_timeout") {
      return err.message || "OpenAI javobi vaqti tugadi — qayta urinib ko'ring.";
    }
    if (err.type === "ai_error" || err.type === "claude_error") {
      return err.message || "OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.";
    }
    if (err.type === "internal_error") {
      return err.message || "Server ichki xatosi.";
    }
    if (err.type === "timeout") {
      return err.message || C().TIMEOUT;
    }
    if (err.type === "still_running") {
      return C().STILL_RUNNING || err.message;
    }
    if (err.type === "aborted") {
      return "So'rov bekor qilindi.";
    }
    if (err.type === "agent") {
      return sanitizeTechnical(err.message || C().AGENT_FAILED);
    }
    if (err.type === "http") {
      return parseHttpError(err.status, err.body, { ...debug, url: err.url });
    }
    if (err.type === "network" || err.type === "disconnect") {
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("bitrix24") || msg.includes("crm")) {
        return "CRM ma'lumotlari olinmadi — Bitrix24 ulanishini tekshiring.";
      }
      if (global.AIEP?.constants?.PORT_CLOSED_RE?.test(err.message || "")) {
        return C().PORT_DISCONNECTED;
      }
      if (msg.includes("failed to fetch")) {
        return C().SERVER_WAKING || "Server uyg'onmoqda — qayta urinib ko'ring.";
      }
      return C().NETWORK || "Tarmoq xatosi — internetni tekshiring.";
    }

    return sanitizeTechnical(err.message || C().AGENT_FAILED);
  }

  function sanitizeTechnical(text) {
    if (!text) return C().AGENT_FAILED || "So'rov bajarilmadi.";
    let out = String(text);
    if (/unknown agent|valid agents/i.test(out)) {
      return "Agent nomi noto'g'ri — ro'yxatdan to'g'ri agentni tanlang.";
    }
    if (/openai.*timeout|claude.*timeout|vaqti tugadi/i.test(out)) {
      return "OpenAI javobi vaqti tugadi — qayta urinib ko'ring.";
    }
    if (/claude|anthropic|authentication|api_key/i.test(out)) {
      return "OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.";
    }
    if (/bitrix24|crm/i.test(out)) {
      return "CRM ma'lumot olishda xato — Bitrix24 ulanishini tekshiring.";
    }
    out = out.replace(/Bitrix24 network error:\s*/gi, "CRM ulanish xatosi: ");
    out = out.replace(/Failed to fetch/gi, "Serverga ulanib bo'lmadi");
    out = out.replace(/message port closed.*/gi, C().PORT_DISCONNECTED || "");
    out = out.replace(/Unknown error/gi, "Kutilmagan xato");
    out = out.replace(/HTTP \d+/gi, "");
    out = out.replace(/stack trace.*/gi, "");
    return out.trim() || C().AGENT_FAILED;
  }

  function titleForError(errType, detail) {
    if (errType === "auth" || (detail && detail.includes("kalit"))) return "Ulanish kaliti";
    if (errType === "endpoint_not_found") return "Endpoint topilmadi";
    if (errType === "validation_error") return "Noto'g'ri so'rov";
    if (errType === "agent_invalid") return "Agent nomi noto'g'ri";
    if (errType === "crm_error") return "CRM xatosi";
    if (errType === "ai_timeout" || errType === "claude_timeout") return "OpenAI javobi kechikdi";
    if (errType === "ai_error" || errType === "claude_error") return "OpenAI xatosi";
    if (errType === "internal_error") return "Server ichki xatosi";
    if (errType === "timeout") return "So'rov vaqti tugadi";
    if (errType === "still_running") return "Tahlil davom etmoqda";
    if (errType === "aborted") return "Bekor qilindi";
    if (errType === "disconnect") return "Ulanish uzildi";
    if (errType === "agent") return "Javob olinmadi";
    if (errType === "http") return "Server xatosi";
    if (errType === "network") return "Tarmoq xatosi";
    return "So'rov xatosi";
  }

  function isRetryable(errType, status) {
    if (errType === "auth" || errType === "aborted" || errType === "agent_invalid") return false;
    if (errType === "validation_error") return false;
    if (errType === "endpoint_not_found") return false;
    if (errType === "disconnect") return true;
    if (errType === "timeout" || errType === "claude_timeout") return true;
    if (errType === "http" && status >= 500) return true;
    if (status === 429 || status === 503) return true;
    return errType === "network" || errType === "agent" || errType === "crm_error" || errType === "claude_error";
  }

  function formatEnvelope(envelope) {
    if (!envelope) {
      return { title: "Javob yo'q", detail: "Fon xizmati javob bermadi.", retryable: true };
    }

    if (envelope.ok === false) {
      const details = envelope.details;
      const err = details?.error;
      const errType = err?.type || "network";
      const detail = sanitizeTechnical(
        envelope.error || parseBackendError(err, { ...details?.debug, url: err?.url })
      );
      const resumeJobId =
        envelope.resumeJobId || details?.resumeJobId || details?.debug?.jobId || null;
      return {
        title: titleForError(errType, detail),
        detail,
        retryable: isRetryable(errType, err?.status),
        resumeJobId,
      };
    }

    const response = envelope.data;
    if (!response) {
      return { title: "Javob yo'q", detail: "Serverdan bo'sh javob keldi.", retryable: true };
    }

    if (response.success === false) {
      const err = response.error;
      const errType = typeof err === "object" ? err?.type : "agent";
      const detail = sanitizeTechnical(
        typeof err === "string" ? err : parseBackendError(err, response.debug)
      );
      const resumeJobId = response.resumeJobId || response.debug?.jobId || null;
      return {
        title: titleForError(errType, detail),
        detail,
        retryable: isRetryable(errType, err?.status),
        resumeJobId,
      };
    }

    const inner = response.data;
    if (inner && inner.success === false) {
      return {
        title: "Javob olinmadi",
        detail: sanitizeTechnical(inner.message || inner.error || C().AGENT_FAILED),
        retryable: true,
      };
    }

    return null;
  }

  function formatApiError(response) {
    const fake = { ok: response?.success !== false, data: response };
    if (response?.success === false) {
      return formatEnvelope({ ok: false, details: response, error: response.error?.message });
    }
    return formatEnvelope(fake) || {
      title: "Noma'lum xato",
      detail: "Kutilmagan javob formati.",
      retryable: true,
    };
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.errors = {
    formatEnvelope,
    formatApiError,
    parseHttpError,
    parseBackendError,
    sanitizeTechnical,
    titleForError,
    isRetryable,
  };
})(typeof window !== "undefined" ? window : self);
