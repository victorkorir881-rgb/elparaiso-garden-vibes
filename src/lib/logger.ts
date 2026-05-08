// Phase 9.1 — Structured application logger.
//
// Goals:
//   - Single call site for app-level logs (`logger.info`, `.warn`, `.error`).
//   - Always emits structured JSON in production so log aggregators (Vercel,
//     Cloudflare, Supabase) can index fields like `user_id`, `request_id`,
//     `duration_ms`. In development, falls back to a readable line so the
//     browser console stays useful.
//   - Mirrors warnings/errors into Sentry (when initialized) so we get the
//     full stack + breadcrumbs without double-calling everywhere.
//
// Use sites:
//   - Mutation `onError` callbacks in `src/lib/supabase-hooks.ts`
//   - Error boundaries
//   - Server route handlers (via `src/routes/api/_logger.ts`)
//
// Edge functions have their own copy at
// `supabase/functions/_shared/logger.ts` because they run in Deno.

import { captureException, captureMessage } from "./sentry";

type Level = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown> & {
  user_id?: string | null;
  request_id?: string;
  duration_ms?: number;
  source?: string;
};

const isDev = (() => {
  try {
    return import.meta.env.DEV;
  } catch {
    return false;
  }
})();

function emit(level: Level, message: string, ctx?: LogContext, error?: unknown) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(ctx ?? {}),
    ...(error instanceof Error
      ? { error_name: error.name, error_message: error.message, error_stack: error.stack }
      : error !== undefined
        ? { error: String(error) }
        : {}),
  };

  // Console output: structured JSON in prod, readable in dev.
  const out = isDev ? `[${level}] ${message}` : JSON.stringify(entry);
  const fn =
    level === "error" ? console.error : level === "warn" ? console.warn : level === "debug" ? console.debug : console.info;
  if (isDev) fn(out, ctx ?? "", error ?? "");
  else fn(out);

  // Mirror warnings/errors to Sentry.
  if (level === "error") {
    if (error !== undefined) captureException(error, { message, ...(ctx ?? {}) });
    else captureMessage(message, "error", ctx);
  } else if (level === "warn") {
    captureMessage(message, "warning", ctx);
  }
}

export const logger = {
  debug: (message: string, ctx?: LogContext) => emit("debug", message, ctx),
  info: (message: string, ctx?: LogContext) => emit("info", message, ctx),
  warn: (message: string, ctx?: LogContext, error?: unknown) => emit("warn", message, ctx, error),
  error: (message: string, error?: unknown, ctx?: LogContext) => emit("error", message, ctx, error),
};

/** Wrap an async operation with timing + structured logs. */
export async function withTimedLog<T>(
  operation: string,
  fn: () => Promise<T>,
  baseCtx: LogContext = {},
): Promise<T> {
  const request_id = baseCtx.request_id ?? cryptoRandomId();
  const ctx: LogContext = { ...baseCtx, request_id, source: operation };
  const started = performance.now();
  try {
    const result = await fn();
    logger.info(`${operation} ok`, { ...ctx, duration_ms: Math.round(performance.now() - started) });
    return result;
  } catch (e) {
    logger.error(`${operation} failed`, e, { ...ctx, duration_ms: Math.round(performance.now() - started) });
    throw e;
  }
}

function cryptoRandomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}
