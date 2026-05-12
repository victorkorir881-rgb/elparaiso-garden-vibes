// supabase/functions/mpesa-callback/index.ts
// Public webhook receiving STK Push results from Safaricom Daraja.
//
// Daraja does NOT sign callbacks. Two security measures are applied:
//   1. We only update payments whose CheckoutRequestID we previously stored.
//   2. An optional shared secret can be appended to MPESA_CALLBACK_URL as
//      ?token=XXX and matched against MPESA_CALLBACK_TOKEN.
//
// IMPORTANT: deploy with verify_jwt = false (set in supabase/config.toml).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logger, withTimedLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Daraja expects this exact response body
const ACK = JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" });
const ackResponse = () =>
  new Response(ACK, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve((req) => withTimedLog("mpesa-callback", async () => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Optional shared-secret check
  const expectedToken = Deno.env.get("MPESA_CALLBACK_TOKEN");
  if (expectedToken) {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== expectedToken) {
      console.warn("mpesa-callback: invalid token");
      return ackResponse(); // Always ACK so Daraja stops retrying
    }
  }

  try {
    const payload = await req.json();
    const stk = payload?.Body?.stkCallback;
    if (!stk) {
      console.warn("mpesa-callback: missing stkCallback", payload);
      return ackResponse();
    }

    const checkoutRequestId: string | undefined = stk.CheckoutRequestID;
    const resultCode: number = Number(stk.ResultCode);
    const resultDesc: string = String(stk.ResultDesc ?? "");

    if (!checkoutRequestId) return ackResponse();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: payment } = await supabase
      .from("payments")
      .select("id, order_id, reservation_id, status")
      .eq("checkout_request_id", checkoutRequestId)
      .single();

    if (!payment) {
      console.warn("mpesa-callback: unknown CheckoutRequestID", checkoutRequestId);
      return ackResponse();
    }
    if (payment.status === "success") return ackResponse(); // already processed

    // Parse metadata items into a map
    const meta: Record<string, unknown> = {};
    const items = stk?.CallbackMetadata?.Item ?? [];
    for (const it of items) {
      if (it?.Name) meta[it.Name] = it.Value;
    }
    const receipt = (meta.MpesaReceiptNumber as string | undefined) ?? null;

    let newStatus: "success" | "failed" | "cancelled" | "timeout" = "failed";
    if (resultCode === 0) newStatus = "success";
    else if (resultCode === 1032) newStatus = "cancelled"; // user cancelled
    else if (resultCode === 1037) newStatus = "timeout";   // DS timeout

    await supabase
      .from("payments")
      .update({
        status: newStatus,
        result_code: resultCode,
        result_desc: resultDesc,
        mpesa_receipt_number: receipt,
        raw_callback: payload,
        completed_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const invoke = (fn: string, body: Record<string, unknown>) =>
      fetch(`${supabaseUrl}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
        body: JSON.stringify(body),
      }).catch((e) => console.warn(`mpesa-callback: ${fn} invoke failed`, e));

    if (newStatus === "success") {
      if (payment.order_id) {
        // ── ORDER PAYMENT ─────────────────────────────────────────────────
        const { data: orderRow } = await supabase
          .from("orders")
          .select("payment_status")
          .eq("id", payment.order_id)
          .single();

        const wasUnpaid = orderRow?.payment_status !== "paid";

        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            payment_method: "mpesa",
          })
          .eq("id", payment.order_id);

        if (wasUnpaid) {
          // Fire-and-forget receipt notifications. The send-email and send-sms
          // functions have their own 5-minute idempotency window, so retries
          // by Daraja still won't double-send.
          void invoke("send-email", { template: "order_payment_receipt", recordId: payment.order_id });
          void invoke("send-sms", { template: "order_payment_receipt", recordId: payment.order_id });
          // Notify admins of the new paid order via SMS.
          void invoke("send-sms", { template: "admin_new_order", recordId: payment.order_id });
          // WhatsApp notifications are temporarily disabled.
          // void invoke("send-whatsapp", { template: "order_payment_receipt", recordId: payment.order_id });
        }
      } else if (payment.reservation_id) {
        // ── RESERVATION DEPOSIT ───────────────────────────────────────────
        const { data: resRow } = await supabase
          .from("reservation_leads")
          .select("deposit_status, status")
          .eq("id", payment.reservation_id)
          .single();

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
    } else if (payment.order_id) {
      // ── FAILED / CANCELLED / TIMED-OUT ORDER PAYMENT ───────────────────
      // Mirror the failure on the order so it is excluded from the admin
      // panel (which only shows payment_status = "paid"). We never overwrite
      // a row that was somehow already paid.
      await supabase
        .from("orders")
        .update({ payment_status: newStatus === "cancelled" ? "cancelled" : "failed" })
        .eq("id", payment.order_id)
        .neq("payment_status", "paid");
    }

    return ackResponse();
  } catch (e) {
    console.error("mpesa-callback error", e);
    return ackResponse(); // Always ACK
  }
}, { request_id: req.headers.get("x-request-id") ?? undefined }));
