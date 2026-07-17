const WEBHOOK_RE = /https?:\/\/[^\s]+rest\/[^\s]+/gi;
const API_KEY_RE = /\b(sk-[a-zA-Z0-9_-]{20,}|Bearer\s+[a-zA-Z0-9._-]+)\b/gi;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function sanitizeExportContent(text: string): string {
  return text
    .replace(WEBHOOK_RE, "[WEBHOOK_REDACTED]")
    .replace(API_KEY_RE, "[TOKEN_REDACTED]")
    .replace(EMAIL_RE, "[EMAIL_REDACTED]");
}
