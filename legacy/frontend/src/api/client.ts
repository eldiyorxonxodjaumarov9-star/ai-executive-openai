import { API_BASE, SECRET_KEY, type AgentId } from "../lib/constants";

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

export function getSecret(): string {
  return localStorage.getItem(SECRET_KEY) || "";
}

export function saveSecret(value: string): void {
  if (value.trim()) localStorage.setItem(SECRET_KEY, value.trim());
  else localStorage.removeItem(SECRET_KEY);
}

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const secret = getSecret();
  if (secret) h["X-Connector-Secret"] = secret;
  return h;
}

function parseError(status: number, body: string): ApiError {
  try {
    const data = JSON.parse(body);
    const detail = data?.detail;
    const code = typeof detail === "object" ? detail?.code : data?.code;
    const message =
      (typeof detail === "object" ? detail?.message : detail) ||
      data?.error ||
      data?.message ||
      `Server xatosi (${status})`;
    if (status === 404) return new ApiError("Endpoint topilmadi — server yangilanganini tekshiring.", code, status);
    if (status === 401) return new ApiError("Ulanish kaliti noto'g'ri yoki kiritilmagan.", code, status);
    if (code === "crm_error") return new ApiError("CRM ma'lumot olishda xato.", code, status);
    if (code === "ai_timeout" || code === "claude_timeout")
      return new ApiError(message || "AI javob bermadi — vaqt tugadi.", code, status);
    if (code === "ai_config_error")
      return new ApiError(message || "AI provider sozlanmagan.", code, status);
    if (code === "ai_error" || code === "claude_error")
      return new ApiError(message || "AI javob bermadi.", code, status);
    if (code === "agent_invalid") return new ApiError("Agent nomi noto'g'ri.", code, status);
    return new ApiError(message, code, status);
  } catch {
    return new ApiError(`Server xatosi (${status})`, undefined, status);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 65000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { ...headers(), ...(options.headers as Record<string, string>) },
    });
    const text = await res.text();
    if (!res.ok) throw parseError(res.status, text);
    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError("So'rov vaqti tugadi.", "timeout");
    }
    throw new ApiError(e instanceof Error ? e.message : "Tarmoq xatosi", "network");
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function quickChat(agent: AgentId, question: string): Promise<string> {
  const data = await request<{
    success: boolean;
    answer?: string;
    error?: string;
  }>(`/chat/agent/${agent}`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
  if (!data.success) throw new ApiError(data.error || "Javob olinmadi");
  return data.answer || "Ma'lumot yetarli emas.";
}

export async function fullReport(
  agent: AgentId,
  question: string,
  onProgress?: (stage: string) => void
): Promise<string> {
  onProgress?.("Vazifa yaratilmoqda...");
  const start = await request<{
    success: boolean;
    data?: { job_id?: string };
    error?: string;
  }>(
    `/tools/agent/${agent}?async=1`,
    { method: "POST", body: JSON.stringify({ question, attachments: [] }) },
    120000
  );
  if (!start.success) throw new ApiError(start.error || "Vazifa boshlanmadi");
  const jobId = start.data?.job_id;
  if (!jobId) throw new ApiError("Server vazifa identifikatorini qaytarmadi.");

  const deadline = Date.now() + 480000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    onProgress?.("Hisobot tayyorlanmoqda...");
    const poll = await request<{
      success: boolean;
      data?: {
        status: string;
        stage?: string;
        result?: { data?: { answer?: string } };
        error?: string;
      };
    }>(`/tools/agent/jobs/${jobId}`, { method: "GET" }, 45000);

    if (!poll.success) continue;
    const job = poll.data;
    if (job?.status === "completed" && job.result) {
      const answer =
        job.result?.data?.answer ||
        (job.result as { answer?: string }).answer ||
        "";
      return answer || "Ma'lumot yetarli emas.";
    }
    if (job?.status === "failed") {
      throw new ApiError(job.error || "Tahlil muvaffaqiyatsiz");
    }
  }
  throw new ApiError("Hisobot vaqti tugadi — «Davom etish» uchun qayta urinib ko'ring.", "timeout");
}

export async function fetchAnalytics(): Promise<Record<string, unknown>> {
  const data = await request<{ success: boolean; summary?: Record<string, unknown> }>(
    "/dashboard/api/analytics"
  );
  if (!data.success) throw new ApiError("Analitika yuklanmadi");
  return data.summary || {};
}
