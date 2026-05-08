# Observability — Sentry + Structured Logging (Phase 9.1)

Brief operator guide for the Sentry / structured-logging integration shipped
in Phase 9.1.

## What was wired

### Browser (React app)
- `src/lib/sentry.ts` — initializes `@sentry/react` (browser tracing +
  replay-on-error). No-op when `VITE_SENTRY_DSN` is unset.
- `src/lib/logger.ts` — structured JSON logger. Warnings/errors are mirrored
  into Sentry via `captureException` / `captureMessage`.
- `src/main.tsx` calls `initSentry()` before React mounts.
- `src/lib/auth.tsx` tags every Sentry event with the signed-in admin's
  `id` + `email` and clears it on sign-out.
- `src/components/ErrorBoundary.tsx` reports the caught error + component
  stack via `logger.error`.
- `src/router.tsx` attaches a `QueryCache` / `MutationCache` `onError`
  handler so EVERY failed TanStack Query call ends up in the logs and Sentry,
  without touching individual hooks.

### Edge functions (Deno)
- `supabase/functions/_shared/logger.ts` — same logger API for Deno.
  Emits structured JSON to `console.log` (Supabase ingests it) and
  POSTs warnings/errors to the Sentry envelope endpoint when `SENTRY_DSN`
  is set.
- Each function (`send-email`, `send-sms`, `mpesa-initiate`,
  `mpesa-callback`) wraps its `Deno.serve` handler with
  `withTimedLog("<function-name>", …)` so every invocation logs:
  - start/finish lines
  - `request_id` (from `x-request-id` header or generated UUID)
  - `duration_ms`
  - thrown error + stack on failure

## Required secrets

### Browser (Vite build-time)
| Name | Required? | Purpose |
|------|-----------|---------|
| `VITE_SENTRY_DSN` | optional | Browser DSN. Leave blank to disable. |
| `VITE_APP_VERSION` | optional | Release tag (e.g. `elparaiso@1.4.0`). Defaults to `elparaiso@dev`. |

Set these as **Build Secrets** in Workspace Settings → Build Secrets. They
are inlined into the JS bundle at build time.

### Edge functions (runtime)
| Name | Required? | Purpose |
|------|-----------|---------|
| `SENTRY_DSN` | optional | Same DSN (or a separate server project). Disables Sentry forwarding when blank — JSON logs still emit. |
| `SENTRY_ENV` | optional | Environment tag (e.g. `production`, `staging`). Falls back to `ENV`, then `production`. |
| `APP_VERSION` | optional | Release tag for edge events. Defaults to `elparaiso@edge`. |

Set these as **Edge Function secrets** (`supabase secrets set …` or the
Supabase Dashboard → Functions → Secrets).

## Setting up Sentry

1. Create a Sentry account → New Project → choose **Browser JavaScript / React**
   for the client and **Node.js** for the edge functions (or share one project
   and filter by `environment`).
2. Copy the DSN from each project's **Client Keys** page.
3. Add the values:
   - `VITE_SENTRY_DSN` → Workspace Build Secrets.
   - `SENTRY_DSN` → Supabase Edge Function secrets.
4. (Optional) Set `VITE_APP_VERSION` / `APP_VERSION` to your git SHA or
   semantic version so Sentry can group releases.
5. Redeploy the app + edge functions.

## What ends up where

| Event | Browser console | Supabase logs | Sentry |
|-------|-----------------|---------------|--------|
| `logger.info` | ✅ (dev) / JSON line (prod) | ✅ | — |
| `logger.warn` | ✅ | ✅ | ✅ (`level=warning`) |
| `logger.error` | ✅ | ✅ | ✅ (`level=error`, with stack) |
| ErrorBoundary catch | ✅ | ✅ | ✅ |
| Failed `useQuery` / `useMutation` | ✅ | ✅ | ✅ |
| Edge function uncaught throw | — | ✅ JSON line | ✅ (with stack) |

## Testing locally

```bash
# Trigger a fake browser error
window.dispatchEvent(new ErrorEvent("error", { error: new Error("test sentry") }));

# Trigger an edge function error (will log + ping Sentry if DSN set)
curl -X POST https://<project>.supabase.co/functions/v1/send-sms \
  -H "Content-Type: application/json" \
  -H "x-request-id: test-$(date +%s)" \
  -d '{"template":"unknown_template","recordId":"00000000-0000-0000-0000-000000000000"}'
```

## Removing or rotating

- To disable Sentry without redeploying: blank out the `*_SENTRY_DSN` secret.
  The logger keeps emitting structured JSON; Sentry forwarding silently no-ops.
- To rotate DSNs: update the secret, then redeploy (Vite must rebuild for
  the new browser DSN to take effect).

## Future work (tracked in PROJECT_PLAN)

- 9.2 Add per-server-function structured logging when migrating to
  TanStack `createServerFn` (currently using Supabase Edge Functions).
- 9.3 Uptime monitoring on `/`, `/menu`, and the edge function URLs.
