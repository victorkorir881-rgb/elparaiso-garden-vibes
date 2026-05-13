// supabase/functions/admin-accept-invite/index.ts
// Public endpoint (verify_jwt = false). Validates a one-time invitation
// token, creates the auth user (email pre-confirmed), and lets the
// handle_new_user trigger assign the invited role + mark the invitation
// accepted atomically.
//
// Body: { token: string, email: string, password: string, fullName?: string }

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

  let body: { token?: string; email?: string; password?: string; fullName?: string; validateOnly?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const token = (body.token ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.fullName ?? "").trim();
  const validateOnly = body.validateOnly === true;
  if (!token || token.length < 32) return json({ error: "Invalid token", code: "invalid" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email", code: "invalid" }, 400);
  if (!validateOnly && password.length < 8) {
    return json({ error: "Password must be at least 8 characters", code: "weak_password" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const tokenHash = await sha256Hex(token);

  // Validate invitation up front for a clean 4xx error before touching auth.
  const { data: inv } = await admin.from("admin_invitations")
    .select("id, role, expires_at, accepted_at, revoked_at")
    .eq("token_hash", tokenHash).eq("email", email).limit(1).maybeSingle();
  if (!inv) return json({ error: "Invitation is invalid or has been replaced", code: "invalid" }, 404);
  if (inv.accepted_at) return json({ error: "Invitation has already been used", code: "used" }, 410);
  if (inv.revoked_at) return json({ error: "Invitation has been revoked by an admin", code: "revoked" }, 410);
  if (new Date(inv.expires_at).getTime() < Date.now()) return json({ error: "Invitation has expired", code: "expired" }, 410);

  if (validateOnly) {
    return json({ ok: true, role: inv.role, email, expiresAt: inv.expires_at });
  }

  // Create the auth user with email pre-confirmed. Pass token hash via
  // raw_user_meta_data so the trigger can validate + consume it.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName || email,
      invitation_token_hash: tokenHash,
    },
  });
  if (createErr || !created?.user) {
    logger.error("create-user-failed", { error: createErr?.message });
    const msg = createErr?.message ?? "Failed to create account";
    const status = /already/i.test(msg) ? 409 : 500;
    return json({ error: msg }, status);
  }

  // Audit: invite_accepted (actor is the new user themselves)
  await admin.from("admin_activity_log").insert({
    admin_id: created.user.id,
    action: "invite_accepted",
    table_name: "admin_invitations",
    record_id: inv.id,
    new_data: { email, role: inv.role, accepted_at: new Date().toISOString() },
  });

  return json({ ok: true });
}));
