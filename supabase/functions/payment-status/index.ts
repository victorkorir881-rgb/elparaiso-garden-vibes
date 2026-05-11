// supabase/functions/payment-status/index.ts
// Public endpoint the checkout UI polls to learn the latest M-Pesa payment
// status. Uses the service role to read directly from `public.payments`,
// bypassing RLS / view drift that previously caused the UI to stay stuck on
// "Waiting for confirmation" even after mpesa-callback had written the row.
//
// Safe to expose: returns only the fields needed by the polling UI, keyed by
// the unguessable payment id (uuid) that the initiate function returned to
// that exact browser session.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logger, withTimedLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function darajaTimestamp(d = new Date()): string {
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
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

function mapResultCodeToStatus(resultCode: number) {
  if (resultCode === 0) return "success" as const;
  if (resultCode === 1032) return "cancelled" as const;
  if (resultCode === 1037) return "timeout" as const;
  return "failed" as const;
}

async function fanOutOrderReceipt(orderId: string, supabaseUrl: string, serviceKey: string) {
  const invoke = (fn: string) =>
    fetch(`${supabaseUrl}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
      body: JSON.stringify({
        template: "order_payment_receipt",
        recordId: orderId,
      }),
    }).catch((e) => logger.warn(`payment-status ${fn} invoke failed`, { order_id: orderId }, e));

  await Promise.allSettled([invoke("send-email"), invoke("send-sms")]);
}

async function finalizeSuccessfulTarget(
  supabase: ReturnType<typeof createClient>,
  payment: Record<string, any>,
  serviceKey: string,
  supabaseUrl: string,
) {
  if (payment.order_id) {
    const { data: orderRow } = await supabase
      .from("orders")
      .select("payment_status")
      .eq("id", payment.order_id)
      .maybeSingle();

    const wasUnpaid = orderRow?.payment_status !== "paid";

    await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_method: "mpesa",
      })
      .eq("id", payment.order_id);

    if (wasUnpaid) {
      await fanOutOrderReceipt(payment.order_id, supabaseUrl, serviceKey);
    }
    return;
  }

  if (payment.reservation_id) {
    const { data: resRow } = await supabase
      .from("reservation_leads")
      .select("deposit_status, status")
      .eq("id", payment.reservation_id)
      .maybeSingle();

    if (resRow?.deposit_status !== "paid") {
      await supabase
        .from("reservation_leads")
        .update({
          deposit_status: "paid",
          status: resRow?.status === "pending" ? "confirmed" : resRow?.status,
        })
        .eq("id", payment.reservation_id);
    }
  }
}

async function reconcilePayment(supabase: ReturnType<typeof createClient>, payment: Record<string, any>) {
  if (!payment?.checkout_request_id || payment.status !== "pending") return payment;

  const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
  const shortcode = Deno.env.get("MPESA_SHORTCODE");
  const passkey = Deno.env.get("MPESA_PASSKEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
    logger.warn("payment-status missing Daraja config", { payment_id: payment.id });
    return payment;
  }

  const createdAtMs = Date.parse(payment.created_at ?? "");
  if (Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 15_000) {
    return payment;
  }

  const { token, base } = await getAccessToken(env, consumerKey, consumerSecret);
  const timestamp = darajaTimestamp();
  const password = btoa(`${shortcode}${passkey}${timestamp}`);

  const res = await fetch(`${base}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: Number(shortcode),
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: payment.checkout_request_id,
    }),
  });

  const body = await res.json().catch(() => null);
  logger.info("payment-status daraja query", {
    payment_id: payment.id,
    http_status: res.status,
    result_code: body?.ResultCode,
    response_code: body?.ResponseCode,
    response_desc: body?.ResponseDescription,
  });

  if (!res.ok || !body) {
    return payment;
  }

  const rawResultCode = body.ResultCode;
  const resultCode = Number(rawResultCode);
  const resultDesc = String(body.ResultDesc ?? body.ResponseDescription ?? "");
  if (!Number.isFinite(resultCode)) return payment;

  const stillPending =
    String(rawResultCode ?? "") === "1" &&
    /processing|progress|pending|queue|await/i.test(resultDesc);
  if (stillPending) {
    return payment;
  }

  if (resultCode === 0 || [1032, 1037].includes(resultCode) || resultCode >= 1) {
    const nextStatus = mapResultCodeToStatus(resultCode);
    const completedAt = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("payments")
      .update({
        status: nextStatus,
        result_code: resultCode,
        result_desc: resultDesc,
        raw_callback: body,
        completed_at: completedAt,
      })
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (updateError) {
      logger.warn("payment-status reconcile update failed", { payment_id: payment.id }, updateError);
    }

    const resolvedPayment = updated ?? {
      ...payment,
      status: nextStatus,
      result_code: resultCode,
      result_desc: resultDesc,
      completed_at: completedAt,
      raw_callback: body,
    };

    if (resolvedPayment.status === "success") {
      await finalizeSuccessfulTarget(supabase, resolvedPayment, serviceKey, supabaseUrl);
    }

    return resolvedPayment;
  }

  return payment;
}

Deno.serve((req) => withTimedLog("payment-status", async () => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let paymentId: string | null = null;
    if (req.method === "GET") {
      paymentId = new URL(req.url).searchParams.get("id");
    } else {
      const body = await req.json().catch(() => ({}));
      paymentId = body?.paymentId ?? body?.id ?? null;
    }

    if (!paymentId || !/^[0-9a-f-]{36}$/i.test(paymentId)) {
      return json({ error: "Invalid paymentId" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();

    if (error) {
      console.error("payment-status query error", error);
      return json({ error: error.message }, 500);
    }
    if (!data) return json({ error: "Not found" }, 404);

    const resolved = await reconcilePayment(supabase, data);

    return json({
      id: resolved.id,
      status: resolved.status,
      result_desc: resolved.result_desc ?? null,
      mpesa_receipt_number: resolved.mpesa_receipt_number ?? null,
      completed_at: resolved.completed_at ?? null,
      manual_claim_status: resolved.manual_claim_status ?? "none",
      manual_reference: resolved.manual_reference ?? null,
      manual_notes: resolved.manual_notes ?? null,
      manual_verified_at: resolved.manual_verified_at ?? null,
    }, 200);
  } catch (e) {
    console.error("payment-status error", e);
    return json({ error: (e as Error).message ?? "Unknown error" }, 500);
  }
}, { request_id: req.headers.get("x-request-id") ?? undefined }));
