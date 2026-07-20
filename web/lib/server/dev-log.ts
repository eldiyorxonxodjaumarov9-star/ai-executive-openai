/**
 * Development-only logging. Production (NODE_ENV=production) da o'chiriladi.
 * Secret/URL/API key hech qachon logga chiqmasin.
 */
export function isDevLoggingEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function devLog(...args: unknown[]): void {
  if (!isDevLoggingEnabled()) return;
  console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (!isDevLoggingEnabled()) return;
  console.warn(...args);
}

export function devError(...args: unknown[]): void {
  if (!isDevLoggingEnabled()) return;
  console.error(...args);
}
