const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
/** Avoid matching ISO timestamps (2026-07-17T...) */
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2,4}\b/g;
const WEBHOOK_RE = /https?:\/\/[^\s"']+rest\/[^\s"']+/gi;
const TOKEN_RE = /\b(?:sk-|whsec_|bitrix_)[a-zA-Z0-9_-]{16,}\b/g;

export function maskPii(text: string): string {
  return text
    .replace(WEBHOOK_RE, "[WEBHOOK_REDACTED]")
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(PHONE_RE, (m) => {
      // Skip ISO date fragments
      if (/^\d{4}-\d{2}-\d{2}/.test(m) || /T\d{2}:/.test(m)) return m;
      return "[PHONE]";
    })
    .replace(TOKEN_RE, "[TOKEN]");
}

export function sanitizeDebugPayload<T>(obj: T): T {
  try {
    const json = maskPii(JSON.stringify(obj));
    return JSON.parse(json) as T;
  } catch {
    return obj;
  }
}
