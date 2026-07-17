import type { AgentId } from "./constants";

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function userFacingMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("claude") || lower.includes("anthropic") || lower.includes("authentication")) {
    return "OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.";
  }
  if (lower.includes("timeout") || lower.includes("vaqti tugadi")) {
    return "OpenAI javobi vaqti tugadi — qayta urinib ko'ring.";
  }
  if (message.includes("OpenAI") || message.includes("CRM") || message.includes("Savol")) {
    return message;
  }
  return "OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.";
}

function parseError(status: number, body: string): ApiError {
  try {
    const data = JSON.parse(body);
    const detail = data?.detail;
    const code = typeof detail === "object" ? detail?.code : data?.code;
    const raw =
      (typeof detail === "object" ? detail?.message : detail) ||
      data?.error ||
      data?.message ||
      `Server xatosi (${status})`;
    const message = userFacingMessage(String(raw));
    if (code === "crm_error")
      return new ApiError("CRM ma'lumot olishda xato — Bitrix24 ulanishini tekshiring.", code, status);
    if (code === "ai_timeout")
      return new ApiError("OpenAI javobi vaqti tugadi — qayta urinib ko'ring.", code, status);
    if (code === "ai_config_error")
      return new ApiError("OpenAI sozlamasi to'liq emas — administrator bilan bog'laning.", code, status);
    if (code === "ai_error") return new ApiError(message, code, status);
    if (code === "agent_invalid" || code === "agent_mismatch") return new ApiError(message, code, status);
    return new ApiError(message, code, status);
  } catch {
    return new ApiError(`Server xatosi (${status})`, undefined, status);
  }
}

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = 90000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string>) },
    });
    const text = await res.text();
    if (!res.ok) throw parseError(res.status, text);
    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError("OpenAI javobi vaqti tugadi — qayta urinib ko'ring.", "timeout");
    }
    throw new ApiError("Tarmoq xatosi — internetni tekshiring.", "network");
  } finally {
    clearTimeout(timer);
  }
}

export interface HealthResponse {
  ok: boolean;
  ai_provider: string;
  ai_configured: boolean;
  openai_configured: boolean;
  ai_model?: string;
}

export interface ChatRequestOptions {
  refresh?: boolean;
  conversationId?: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health", { method: "GET" }, 15000);
}

export interface ChatStreamCallbacks {
  onStatus?: (message: string) => void;
  onDelta?: (text: string) => void;
}

export async function quickChatStream(
  agent: AgentId,
  question: string,
  options: ChatRequestOptions & ChatStreamCallbacks = {}
): Promise<string> {
  const conversationId = options.conversationId || `conv-${agent}-${Date.now()}`;
  const res = await fetch(`/api/chat/agent/${agent}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: agent,
      message: question,
      conversationId,
      refresh: Boolean(options.refresh),
    }),
  });

  if (!res.ok || !res.body) {
    return quickChat(agent, question, options);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type: string;
          message?: string;
          text?: string;
          answer?: string;
        };
        if (event.type === "status" && event.message) options.onStatus?.(event.message);
        if (event.type === "delta" && event.text) {
          answer += event.text;
          options.onDelta?.(event.text);
        }
        if (event.type === "done" && event.answer) answer = event.answer;
        if (event.type === "error") throw new ApiError(event.message || "Stream xatosi");
      } catch (e) {
        if (e instanceof ApiError) throw e;
      }
    }
  }

  return answer || quickChat(agent, question, options);
}

export async function quickChat(
  agent: AgentId,
  question: string,
  options: ChatRequestOptions = {}
): Promise<string> {
  const conversationId = options.conversationId || `conv-${agent}-${Date.now()}`;
  const data = await request<{ success: boolean; answer?: string; error?: string }>(
    `/api/chat/agent/${agent}`,
    {
      method: "POST",
      body: JSON.stringify({
        agentId: agent,
        message: question,
        conversationId,
        refresh: Boolean(options.refresh),
      }),
    }
  );
  if (!data.success) throw new ApiError("OpenAI bilan javob olishda xato yuz berdi.");
  return data.answer || "Ma'lumot yetarli emas.";
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function looksLikeCrmQuestion(question: string): boolean {
  const t = question.toLowerCase();
  return /\b(bugun|bitim|savdo|sotuv|jami|mijoz|menejer|hisobot|voronka|moliya|xodim|marketing|lid|kontakt|yopil|ochiq|summasi|risk|tahlil|yuklama|reyting|pipeline|kpi)\b/.test(
    t
  );
}
