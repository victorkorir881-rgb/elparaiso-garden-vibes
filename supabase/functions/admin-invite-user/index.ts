// supabase/functions/admin-invite-user/index.ts
// Admin-only: create an invitation row + email the invitee a one-time link.
//
// Auth: caller must be signed in and have role in (super_admin, admin).
// Body: { email: string, role: 'super_admin'|'admin'|'manager'|'staff' }
//
// Required secrets:
//   RESEND_API_KEY
// Optional secrets:
//   EMAIL_FROM   (default: "Elparaiso Garden <onboarding@resend.dev>")
//   SITE_URL     (default: "https://elparaisogardens.vercel.app")

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logger, withTimedLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALLOWED_ROLES = new Set(["super_admin", "admin", "manager", "staff"]);

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve((req) => withTimedLog("admin-invite-user", async () => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing bearer token" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: callerRes, error: callerErr } = await admin.auth.getUser(jwt);
  if (callerErr || !callerRes?.user) return json({ error: "Invalid session" }, 401);
  const callerId = callerRes.user.id;

  const { data: roleRow } = await admin.from("admin_roles").select("role").eq("user_id", callerId).limit(1);
  const callerRole = roleRow?.[0]?.role ?? null;
  if (!callerRole || !["super_admin", "admin"].includes(callerRole)) {
    return json({ error: "Forbidden — admin only" }, 403);
  }

  let body: { email?: string; role?: string; returnLinkOnly?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const email = (body.email ?? "").trim().toLowerCase();
  const role = (body.role ?? "staff").trim();
  const returnLinkOnly = body.returnLinkOnly === true;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email" }, 400);
  if (!ALLOWED_ROLES.has(role)) return json({ error: "Invalid role" }, 400);
  if (role === "super_admin" && callerRole !== "super_admin") {
    return json({ error: "Only a super_admin can invite another super_admin" }, 403);
  }

  // Reject if email already belongs to an existing user.
  const { data: existing } = await admin.from("admin_profiles").select("id").eq("email", email).limit(1);
  if (existing && existing.length > 0) return json({ error: "A user with that email already exists" }, 409);

  // Revoke any previous pending invitations for this email so the new one
  // is the only acceptable token. Marking as revoked (not accepted) keeps
  // the audit trail accurate.
  await admin.from("admin_invitations")
    .update({ revoked_at: new Date().toISOString(), revoked_by: callerId })
    .is("accepted_at", null).is("revoked_at", null).eq("email", email);

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: inv, error: invErr } = await admin.from("admin_invitations")
    .insert({ email, role, token_hash: tokenHash, invited_by: callerId, expires_at: expiresAt })
    .select("id, expires_at").single();
  if (invErr || !inv) {
    logger.error("invite-insert-failed", { error: invErr?.message });
    return json({ error: invErr?.message ?? "Failed to create invitation" }, 500);
  }

  // Audit: invite_sent
  await admin.from("admin_activity_log").insert({
    admin_id: callerId,
    action: "invite_sent",
    table_name: "admin_invitations",
    record_id: inv.id,
    new_data: { email, role, expires_at: inv.expires_at, invited_by: callerId },
  });

  // Resolve site URL: explicit SITE_URL env wins; otherwise fall back to the
  // request's Origin / Referer header so links land on the host that called us
  // (works for preview + production without reconfiguring secrets).
  const originHeader = req.headers.get("origin") ?? "";
  const refererHeader = req.headers.get("referer") ?? "";
  let siteUrl = (Deno.env.get("SITE_URL") ?? "").trim();
  if (!siteUrl) {
    if (originHeader) siteUrl = originHeader;
    else if (refererHeader) {
      try { siteUrl = new URL(refererHeader).origin; } catch { /* ignore */ }
    }
  }
  if (!siteUrl) siteUrl = "https://elparaisogardens.vercel.app";
  siteUrl = siteUrl.replace(/\/$/, "");
  const link = `${siteUrl}/admin/accept-invite?token=${token}&email=${encodeURIComponent(email)}`;

  // "Copy link" path: caller wants the URL only, no email send.
  if (returnLinkOnly) {
    return json({ ok: true, invitationId: inv.id, link });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    logger.warn("RESEND_API_KEY missing — invitation created but email not sent", { invitationId: inv.id });
    return json({ ok: true, invitationId: inv.id, link, warning: "Email not configured. Copy this link and send it to the invitee manually." });
  }

  const from = Deno.env.get("EMAIL_FROM") ?? "Elparaiso Garden <onboarding@resend.dev>";
  const subject = "You're invited to the Elparaiso admin panel";
  const html = `<!doctype html><html><body style="margin:0;background:#fff;font-family:Inter,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-family:'Playfair Display',Georgia,serif;color:#0f0f0f;margin:0 0 8px;">Elparaiso Garden Kisii</h1>
    <div style="height:3px;width:48px;background:#c9a96e;margin:0 0 24px;"></div>
    <p>You have been invited to join the Elparaiso admin team as <strong>${role}</strong>.</p>
    <p>This link is single-use and expires in 7 days. Click below to set your password and activate your account:</p>
    <p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#c9a96e;color:#0f0f0f;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">Accept invitation</a></p>
    <p style="font-size:12px;color:#6b7280;">Or copy this URL into your browser:<br/><span style="word-break:break-all;">${link}</span></p>
    <p style="font-size:12px;color:#9ca3af;margin-top:32px;">If you weren't expecting this invitation you can safely ignore this email.</p>
  </div></body></html>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject, html }),
  });
  if (!r.ok) {
    const text = await r.text();
    logger.error("resend-failed", { status: r.status, body: text });
    // Don't fail the whole flow — invitation row exists. Surface the link so
    // the admin can deliver it manually while email config is being fixed.
    return json({
      ok: true,
      invitationId: inv.id,
      link,
      warning: `Could not send the invitation email (${r.status}). Copy this link and send it to the invitee. Details: ${text.slice(0, 200)}`,
    });
  }
  return json({ ok: true, invitationId: inv.id });
}));
