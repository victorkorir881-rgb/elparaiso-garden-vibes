// Phase 9.1 — Sentry browser initialization.
//
// Sentry is OPTIONAL: if `VITE_SENTRY_DSN` is unset (e.g. local dev or PR
// previews), every helper here becomes a no-op so we don't crash the app or
// spam the console. In production, set `VITE_SENTRY_DSN` to enable error
// reporting + performance tracing.
//
// Companion: `src/lib/logger.ts` for structured app logs that also flush
// breadcrumbs into Sentry when it's active.

import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return; // no-op when DSN not configured

  const env = (import.meta.env.MODE || "development") as string;
  const release = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "elparaiso@dev";

  Sentry.init({
    dsn,
    environment: env,
    release,
    // Performance monitoring — sample 10% of traffic by default.
    tracesSampleRate: env === "production" ? 0.1 : 1.0,
    // Session replay (errors only) — cheap and high-signal.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    // Reduce noise from extension / network errors we can't fix.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
      "Non-Error promise rejection captured",
      /^NetworkError when attempting to fetch/i,
    ],
  });

  initialized = true;
}

/** Tag every future event with the signed-in admin user (or clear on logout). */
export function setSentryUser(user: { id: string; email?: string | null } | null) {
  if (!initialized) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, email: user.email ?? undefined });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) {
    // Always surface in console even without Sentry, so dev still sees errors.
    console.error("[error]", error, context ?? {});
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, unknown>,
) {
  if (!initialized) {
    const log = level === "error" ? console.error : level === "warning" ? console.warn : console.info;
    log(`[${level}]`, message, context ?? {});
    return;
  }
  Sentry.captureMessage(message, { level, extra: context });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
