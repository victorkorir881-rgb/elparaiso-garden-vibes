// supabase/functions/admin-accept-invite/index.ts
// Public endpoint (verify_jwt = false). Validates a one-time invitation
// token, creates the auth user (email pre-confirmed), then writes the
// invited role and stamps the invitation as accepted.
//
// Body: { token: string, email: string, password: string, fullName?: string,
//         phone?: string, validateOnly?: boolean }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logger, withTimedLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve((req) => withTimedLog("admin-accept-invite", async () => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: {
    token?: string; email?: string; password?: string;
    fullName?: string; phone?: string; validateOnly?: boolean;
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const token = (body.token ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.fullName ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const validateOnly = body.validateOnly === true;
  if (!token || token.length < 32) return json({ error: "Invalid token", code: "invalid" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email", code: "invalid" }, 400);
  if (!validateOnly && password.length < 6) {
    return json({ error: "Password must be at least 6 characters", code: "weak_password" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const tokenHash = await sha256Hex(token);

  // Validate invitation up front for a clean 4xx error before touching auth.
  const { data: inv, error: invErr } = await admin.from("admin_invitations")
    .select("id, role, expires_at, accepted_at, revoked_at")
    .eq("token_hash", tokenHash)
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (invErr) {
    logger.error("invitation-lookup-failed", { error: invErr.message });
    return json({ error: "Could not validate invitation", code: "lookup_failed" }, 500);
  }
  if (!inv) return json({ error: "Invitation is invalid or has been replaced", code: "invalid" }, 404);
  if (inv.accepted_at) return json({ error: "Invitation has already been used", code: "used" }, 410);
  if (inv.revoked_at) return json({ error: "Invitation has been revoked by an admin", code: "revoked" }, 410);

  if (validateOnly) {
    return json({ ok: true, role: inv.role, email, expiresAt: inv.expires_at });
  }

  // Create the auth user with email pre-confirmed. The bypass_invite_check
  // flag tells handle_new_user that this request was already validated by
  // the service role — the trigger will only create the admin_profiles row.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName || email,
      phone: phone || null,
      bypass_invite_check: true,
      invitation_token_hash: tokenHash,
    },
  });
  if (createErr || !created?.user) {
    const rawMsg = createErr?.message ?? "Failed to create account";
    logger.error("create-user-failed", { error: rawMsg });
    const lower = rawMsg.toLowerCase();
    let status = 500;
    let code = "create_failed";
    let friendly = rawMsg;
    if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
      status = 409; code = "email_exists";
      friendly = "An account with this email already exists. Try signing in instead.";
    } else if (lower.includes("password")) {
      status = 400; code = "weak_password";
    } else if (lower.includes("database error")) {
      // Trigger-level failure — surface a friendlier message.
      friendly = "We couldn't activate your account. Please ask an admin to re-send your invitation.";
    }
    return json({ error: friendly, code }, status);
  }

  const userId = created.user.id;

  // Mark invitation accepted + assign the invited role. We do this from the
  // edge function (service role) instead of inside the trigger so we get
  // clean error reporting and a single source of truth for invitation state.
  const { error: roleErr } = await admin.from("admin_roles")
    .insert({ user_id: userId, role: inv.role });
  if (roleErr && !/duplicate|unique/i.test(roleErr.message)) {
    logger.error("role-assignment-failed", { error: roleErr.message });
    // Best-effort cleanup so the invitation can be retried.
    await admin.auth.admin.deleteUser(userId);
    return json({ error: "Could not assign your admin role. Please try again.", code: "role_failed" }, 500);
  }

  await admin.from("admin_invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq("id", inv.id);

  // Persist phone on profile if provided.
  if (phone) {
    await admin.from("admin_profiles")
      .update({ phone })
      .eq("id", userId);
  }

  // Audit: invite_accepted (actor is the new user themselves)
  await admin.from("admin_activity_log").insert({
    admin_id: userId,
    action: "invite_accepted",
    table_name: "admin_invitations",
    record_id: inv.id,
    new_data: { email, role: inv.role, accepted_at: new Date().toISOString() },
  });

  return json({ ok: true });
}));
