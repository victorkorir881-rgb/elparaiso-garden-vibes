// supabase/functions/admin-delete-user/index.ts
// Phase 5.4 — Admin / self account deletion.
//
// Authenticated endpoint. The caller's JWT is verified by the gateway
// (`verify_jwt = true`, the default — DO NOT add an override in
// supabase/config.toml).
//
// Body: { userId: string }
//   - userId === caller.id  → self-delete (any signed-in user can delete
//                              their own account)
//   - userId !== caller.id  → admin-only (caller must have a role in
//                              ('admin','super_admin') in admin_roles)
//
// Deletes the auth.users row via the service-role admin API. ON DELETE
// CASCADE in `sql/0001_init.sql` handles `admin_profiles` + `admin_roles`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logger, withTimedLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve((req) => withTimedLog("admin-delete-user", async () => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Resolve caller from the Authorization header ─────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing bearer token" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerRes, error: callerErr } = await admin.auth.getUser(jwt);
  if (callerErr || !callerRes?.user) {
    return json({ error: "Invalid or expired session" }, 401);
  }
  const callerId = callerRes.user.id;

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const targetId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!targetId) return json({ error: "userId is required" }, 400);

  const isSelf = targetId === callerId;

  // ── Authorisation ────────────────────────────────────────────────────────
  if (!isSelf) {
    // Caller must be admin to delete someone else
    const { data: roleRows, error: roleErr } = await admin
      .from("admin_roles")
      .select("role")
      .eq("user_id", callerId);
    if (roleErr) {
      return json({ error: "Failed to verify caller role" }, 500);
    }
    const isAdmin = (roleRows ?? []).some(
      (r) => r.role === "admin" || r.role === "super_admin",
    );
    if (!isAdmin) return json({ error: "Forbidden" }, 403);
  }

  // ── Last-admin guard ─────────────────────────────────────────────────────
  // Refuse to delete an account if doing so would leave zero
  // admin/super_admin accounts in the system.
  const { data: targetRoles } = await admin
    .from("admin_roles")
    .select("role")
    .eq("user_id", targetId);
  const targetIsAdmin = (targetRoles ?? []).some(
    (r) => r.role === "admin" || r.role === "super_admin",
  );

  if (targetIsAdmin) {
    const { count } = await admin
      .from("admin_roles")
      .select("user_id", { count: "exact", head: true })
      .in("role", ["admin", "super_admin"]);
    if ((count ?? 0) <= 1) {
      return json(
        { error: "Cannot delete the last remaining admin account" },
        409,
      );
    }
  }

  // ── Delete the auth user (cascades to admin_profiles / admin_roles) ──────
  const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
  if (delErr) {
    logger.error("admin-delete-user: deleteUser failed", {
      error_message: delErr.message,
      target_id: targetId,
    });
    return json({ error: delErr.message ?? "Failed to delete user" }, 500);
  }

  logger.info("admin-delete-user: deleted", {
    target_id: targetId,
    caller_id: callerId,
    self: isSelf,
  });

  return json({ ok: true, deletedId: targetId, self: isSelf });
}, { request_id: req.headers.get("x-request-id") ?? undefined }));
