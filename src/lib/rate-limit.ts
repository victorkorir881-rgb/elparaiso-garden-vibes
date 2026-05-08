/**
 * Phase 5.5 — client-side wrapper around the `check_rate_limit` Postgres
 * function (see sql/0008_rate_limits.sql). DB-side enforcement is the source
 * of truth; this helper just gives callers a typed, friendly error.
 *
 * Usage:
 *   await enforceRateLimit({
 *     action: "contact_submit",
 *     identifier: email || phone,
 *     max: 3,
 *     windowSeconds: 600,            // 3 per 10 min
 *   });
 */
import { supabase } from "@/integrations/supabase/client";

export class RateLimitError extends Error {
  constructor(public readonly retryHint?: string) {
    super(
      retryHint ??
        "You've made too many requests recently. Please wait a moment and try again.",
    );
    this.name = "RateLimitError";
  }
}

export interface RateLimitOpts {
  /** short action name, e.g. "contact_submit", "reservation_create" */
  action: string;
  /** stable identifier (email, phone, ip surrogate). Falsy = "anon". */
  identifier?: string | null;
  /** max attempts allowed in the window */
  max: number;
  /** rolling window length in seconds (max 86400 / 24h) */
  windowSeconds: number;
}

export async function enforceRateLimit(opts: RateLimitOpts): Promise<void> {
  const id = (opts.identifier ?? "").trim().toLowerCase() || "anon";
  const key = `${opts.action}:${id}`.slice(0, 200);

  // Cast: `check_rate_limit` is added by sql/0008_rate_limits.sql and isn't
  // in the generated `types.ts` yet (run the types regen after applying the
  // migration to drop this cast).
  const { error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { code?: string; message: string } | null }>)(
    "check_rate_limit",
    { _key: key, _max: opts.max, _window_seconds: opts.windowSeconds },
  );

  if (error) {
    // Postgres custom error from the function = SQLSTATE P0001
    if (error.code === "P0001") {
      throw new RateLimitError(
        "Too many requests — please wait a minute before trying again.",
      );
    }
    // Any other RPC error: log but do NOT block the user (fail-open for
    // availability — the DB-side limit is just a guardrail, not the only
    // line of defense; admins should monitor the rate_limit_hits table).
    // eslint-disable-next-line no-console
    console.warn("[rate-limit] check_rate_limit RPC failed:", error.message);
  }
}
