// Phase 9.1 — Shared structured logger for Supabase Edge Functions (Deno).
//
// Mirrors `src/lib/logger.ts` API surface so call sites look the same on both
// sides. Always emits structured JSON to stdout — Supabase ingests these
// lines into the Functions log explorer where you can filter by any field.
//
// Optionally posts events to Sentry via the Envelope endpoint when
// `SENTRY_DSN` is set. We use the Envelope endpoint (not @sentry/deno) to
// keep cold-start tiny and avoid a heavy native dep in every function.

type Level = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown> & {
  user_id?: string | null;
  request_id?: string;
  duration_ms?: number;
  function?: string;
};

const SENTRY_DSN = Deno.env.get("SENTRY_DSN") ?? "";
const ENVIRONMENT = Deno.env.get("SENTRY_ENV") ?? Deno.env.get("ENV") ?? "production";
const RELEASE = Deno.env.get("APP_VERSION") ?? "elparaiso@edge";

let sentryConfig: { url: string; auth: string; projectId: string } | null = null;

if (SENTRY_DSN) {
  try {
    // DSN format: https://<key>@oXXX.ingest.sentry.io/<project>
    const u = new URL(SENTRY_DSN);
    const projectId = u.pathname.replace(/^\//, "");
    const host = u.host;
    sentryConfig = {
      url: `https://${host}/api/${projectId}/envelope/`,
      auth: `Sentry sentry_version=7, sentry_key=${u.username}, sentry_client=elparaiso-edge/1.0`,
      projectId,
    };
  } catch (e) {
    console.error(JSON.stringify({ level: "error", message: "Invalid SENTRY_DSN", error: String(e) }));
  }
}

function emit(level: Level, message: string, ctx?: LogContext, error?: unknown) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    env: ENVIRONMENT,
    release: RELEASE,
    ...(ctx ?? {}),
    ...(error instanceof Error
      ? { error_name: error.name, error_message: error.message, error_stack: error.stack }
      : error !== undefined
        ? { error: String(error) }
        : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  if (sentryConfig && (level === "error" || level === "warn")) {
    sendToSentry(level, message, entry, error).catch(() => {});
  }
}

async function sendToSentry(level: Level, message: string, entry: Record<string, unknown>, error: unknown) {
  if (!sentryConfig) return;
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const event: Record<string, unknown> = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    level: level === "warn" ? "warning" : level,
    platform: "javascript",
    environment: ENVIRONMENT,
    release: RELEASE,
    message: { formatted: message },
    extra: entry,
  };
  if (error instanceof Error) {
    event.exception = {
      values: [{ type: error.name, value: error.message, stacktrace: { frames: parseStack(error.stack) } }],
    };
  }
  const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() });
  const itemHeader = JSON.stringify({ type: "event" });
  const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}\n`;
  await fetch(sentryConfig.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": sentryConfig.auth },
    body,
  });
}

function parseStack(stack?: string) {
  if (!stack) return [];
  return stack
    .split("\n")
    .slice(1)
    .map((line) => ({ filename: line.trim() }))
    .reverse();
}

export const logger = {
  debug: (m: string, c?: LogContext) => emit("debug", m, c),
  info: (m: string, c?: LogContext) => emit("info", m, c),
  warn: (m: string, c?: LogContext, e?: unknown) => emit("warn", m, c, e),
  error: (m: string, e?: unknown, c?: LogContext) => emit("error", m, c, e),
};

export async function withTimedLog<T>(
  operation: string,
  fn: () => Promise<T>,
  baseCtx: LogContext = {},
): Promise<T> {
  const request_id = baseCtx.request_id ?? crypto.randomUUID();
  const ctx: LogContext = { ...baseCtx, request_id, function: operation };
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
