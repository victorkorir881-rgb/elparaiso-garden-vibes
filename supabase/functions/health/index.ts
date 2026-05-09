// supabase/functions/health/index.ts
// Phase 9.3 — Public health endpoint for UptimeRobot / Pingdom.
//
// GET https://<project>.supabase.co/functions/v1/health
//   200 { status: "ok",       db: "ok",   version }
//   503 { status: "degraded", db: "down", error, version }
//
// Hits Supabase REST against `site_settings` with the service role to verify
// network → API → Postgres path. No body required from the caller. Public
// (verify_jwt = false) so monitoring tools can hit it without auth.

import { logger, withTimedLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

Deno.serve((req) => withTimedLog("health", async () => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const version = Deno.env.get("APP_VERSION") ?? "elparaiso@edge";

  if (!url || !key) {
    return json({ status: "degraded", db: "unknown", error: "env missing", version }, 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/site_settings?select=id&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (!res.ok) {
      return json({ status: "degraded", db: "down", error: `supabase ${res.status}`, version }, 503);
    }
    return json({ status: "ok", db: "ok", version }, 200);
  } catch (e) {
    clearTimeout(timer);
    return json({ status: "degraded", db: "down", error: (e as Error).message, version }, 503);
  }
}, { request_id: req.headers.get("x-request-id") ?? undefined }));
