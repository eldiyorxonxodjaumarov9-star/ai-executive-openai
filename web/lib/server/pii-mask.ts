const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\+?\d[\d\s-]{8,}\d/g;
const WEBHOOK_RE = /https?:\/\/[^\s"']+rest\/[^\s"']+/gi;
const TOKEN_RE = /\b[a-z0-9]{20,}\b/gi;

export function maskPii(text: string): string {
  return text
    .replace(WEBHOOK_RE, "[WEBHOOK_REDACTED]")
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(PHONE_RE, "[PHONE]")
    .replace(TOKEN_RE, (m) => (m.length > 24 ? "[TOKEN]" : m));
}

export function sanitizeDebugPayload<T>(obj: T): T {
  const json = maskPii(JSON.stringify(obj));
  return JSON.parse(json) as T;
}
