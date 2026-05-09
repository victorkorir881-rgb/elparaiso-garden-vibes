// supabase/functions/mpesa-reversal/index.ts
// Phase 7.5 — Initiate a Daraja Reversal API refund for a successful payment.
//
// Auth: Requires a JWT belonging to an admin (admin_roles role in
// {'admin','super_admin'}). Service role bypass is also accepted (for
// internal scripts). Public callers are rejected.
//
// Body: { paymentId: string, amount?: number, reason?: string }
//   - amount defaults to the original payment amount
//   - reason is stored on the payments row (refund_reason)
//
// Behaviour:
//   1. Loads the payment, asserts status='success' and refund_status in
//      ('none','failed') and mpesa_receipt_number is present.
//   2. Calls Daraja /mpesa/reversal/v1/request with the encrypted
//      SecurityCredential (must be pre-encrypted against the Daraja
//      public certificate and stored as MPESA_SECURITY_CREDENTIAL).
//   3. Stamps payments.refund_status='pending', refund_request_id=ConversationID.
//   4. The async result lands at /functions/v1/mpesa-reversal-result and
//      flips refund_status to 'refunded' or 'failed'.
//
// Required secrets (in addition to those used by mpesa-initiate):
//   MPESA_INITIATOR_NAME         API initiator username (e.g. "testapi")
//   MPESA_SECURITY_CREDENTIAL    RSA-encrypted password (base64) — generate
//                                via Daraja portal "Security Credential" tool
//   MPESA_REVERSAL_RESULT_URL    Public URL of mpesa-reversal-result function
//   MPESA_REVERSAL_TIMEOUT_URL   (optional) timeout queue URL; falls back to
//                                MPESA_REVERSAL_RESULT_URL
//
// Deploy:  supabase functions deploy mpesa-reversal

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

async function getAccessToken(env: string, key: string, secret: string) {
  const base = env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
  const auth = btoa(`${key}:${secret}`);
  const res = await fetch(
    `${base}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  if (!res.ok) {
    throw new Error(`Daraja OAuth failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { token: data.access_token as string, base };
}

Deno.serve((req) => withTimedLog("mpesa-reversal", async () => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── AuthZ: admin only ──────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing bearer token" }, 401);
  }
  const token = authHeader.slice(7);
  let callerId: string | null = null;

  if (token !== serviceKey) {
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid token" }, 401);
    callerId = userData.user.id;

    const adminClient = createClient(url, serviceKey);
    const { data: roles } = await adminClient
      .from("admin_roles")
      .select("role")
      .eq("user_id", callerId);
    const isAdmin = (roles ?? []).some((r) =>
      r.role === "admin" || r.role === "super_admin"
    );
    if (!isAdmin) return json({ error: "Forbidden" }, 403);
  }

  const supabase = createClient(url, serviceKey);

  let body: { paymentId?: string; amount?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { paymentId, reason } = body;
  if (!paymentId) return json({ error: "paymentId required" }, 400);

  const { data: payment, error: pErr } = await supabase
    .from("payments")
    .select(
      "id, status, amount, refund_status, mpesa_receipt_number, order_id, reservation_id",
    )
    .eq("id", paymentId)
    .single();
  if (pErr || !payment) return json({ error: "Payment not found" }, 404);
  if (payment.status !== "success") {
    return json({ error: "Only successful payments can be refunded" }, 409);
  }
  if (
    payment.refund_status !== "none" && payment.refund_status !== "failed"
  ) {
    return json(
      { error: `Refund already ${payment.refund_status}` },
      409,
    );
  }
  if (!payment.mpesa_receipt_number) {
    return json({ error: "Missing M-Pesa receipt number" }, 422);
  }
  const amount = body.amount ?? payment.amount;
  if (!Number.isInteger(amount) || amount <= 0 || amount > payment.amount) {
    return json({ error: "Invalid refund amount" }, 422);
  }

  const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
  const initiator = Deno.env.get("MPESA_INITIATOR_NAME");
  const securityCred = Deno.env.get("MPESA_SECURITY_CREDENTIAL");
  const shortcode = Deno.env.get("MPESA_SHORTCODE");
  const resultUrl = Deno.env.get("MPESA_REVERSAL_RESULT_URL");
  const timeoutUrl = Deno.env.get("MPESA_REVERSAL_TIMEOUT_URL") ?? resultUrl;
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");

  if (
    !initiator || !securityCred || !shortcode || !resultUrl ||
    !consumerKey || !consumerSecret
  ) {
    return json({ error: "M-Pesa reversal secrets not configured" }, 500);
  }

  const { token: accessToken, base } = await getAccessToken(
    env,
    consumerKey,
    consumerSecret,
  );

  const reversalBody = {
    Initiator: initiator,
    SecurityCredential: securityCred,
    CommandID: "TransactionReversal",
    TransactionID: payment.mpesa_receipt_number,
    Amount: amount,
    ReceiverParty: shortcode,
    RecieverIdentifierType: "11", // shortcode
    ResultURL: resultUrl,
    QueueTimeOutURL: timeoutUrl,
    Remarks: (reason ?? "Refund").slice(0, 100),
    Occasion: "Refund",
  };

  const res = await fetch(`${base}/mpesa/reversal/v1/request`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(reversalBody),
  });
  const responseText = await res.text();
  let parsed: any = {};
  try { parsed = JSON.parse(responseText); } catch { /* keep text */ }

  if (!res.ok || parsed.ResponseCode !== "0") {
    logger.warn("mpesa-reversal: Daraja rejected", {
      status: res.status,
      response: parsed,
    });
    await supabase
      .from("payments")
      .update({
        refund_status: "failed",
        refund_amount: amount,
        refund_reason: reason ?? null,
        refund_requested_by: callerId,
        refund_result_desc: parsed.ResponseDescription ?? responseText.slice(0, 500),
      })
      .eq("id", paymentId);
    return json(
      {
        error: "Reversal request rejected",
        details: parsed.ResponseDescription ?? responseText,
      },
      502,
    );
  }

  await supabase
    .from("payments")
    .update({
      refund_status: "pending",
      refund_amount: amount,
      refund_reason: reason ?? null,
      refund_requested_by: callerId,
      refund_request_id: parsed.ConversationID ?? null,
    })
    .eq("id", paymentId);

  return json({
    ok: true,
    paymentId,
    conversationId: parsed.ConversationID,
    originatorConversationId: parsed.OriginatorConversationID,
  });
}, { request_id: req.headers.get("x-request-id") ?? undefined }));
