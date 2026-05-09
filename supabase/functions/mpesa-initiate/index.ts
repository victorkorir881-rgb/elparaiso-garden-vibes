// supabase/functions/mpesa-initiate/index.ts
// M-Pesa Daraja STK Push initiation.
//
// Public endpoint (no JWT). Called from the client right after an order is
// created. Returns { paymentId, checkoutRequestId } so the client can poll
// for status while the customer enters their M-Pesa PIN on the phone.
//
// Required secrets (set in Supabase Dashboard → Edge Functions → Secrets):
//   MPESA_ENV               "sandbox" | "production"
//   MPESA_CONSUMER_KEY      Daraja app consumer key
//   MPESA_CONSUMER_SECRET   Daraja app consumer secret
//   MPESA_SHORTCODE         Paybill / Till number (e.g. 174379 for sandbox)
//   MPESA_PASSKEY           Lipa Na M-Pesa Online passkey
//   MPESA_CALLBACK_URL      Public URL of the mpesa-callback function
//                           e.g. https://<project>.supabase.co/functions/v1/mpesa-callback
//   SUPABASE_URL            (auto)
//   SUPABASE_SERVICE_ROLE_KEY (auto)

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

// Normalize "07XXXXXXXX" / "+2547XXXXXXXX" / "2547XXXXXXXX" → "2547XXXXXXXX"
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return "254" + digits.slice(1);
  if (/^[17]\d{8}$/.test(digits)) return "254" + digits;
  return null;
}

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
  const base =
    env === "production"
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

Deno.serve((req) => withTimedLog("mpesa-initiate", async () => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { orderId, reservationId, phone, amount } = await req.json();

    // Exactly one of orderId or reservationId must be provided.
    const hasOrder = typeof orderId === "string" && orderId.length > 0;
    const hasReservation = typeof reservationId === "string" && reservationId.length > 0;
    if (hasOrder === hasReservation) {
      return json({ error: "Provide exactly one of orderId or reservationId" }, 400);
    }
    const normPhone = normalizePhone(String(phone ?? ""));
    if (!normPhone) {
      return json({ error: "Invalid phone (use 07XX… or 2547XX…)" }, 400);
    }
    const amt = Math.round(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) {
      return json({ error: "amount must be a positive number" }, 400);
    }

    const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const callbackUrl = Deno.env.get("MPESA_CALLBACK_URL");

    if (
      !consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl
    ) {
      return json({ error: "M-Pesa is not configured on the server" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve target (order or reservation) and verify amount + status
    let accountReference: string;
    let transactionDesc: string;
    let paymentInsert: Record<string, unknown>;

    if (hasOrder) {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, total_amount, payment_status, order_number")
        .eq("id", orderId)
        .single();
      if (orderErr || !order) return json({ error: "Order not found" }, 404);
      if (order.payment_status === "paid") {
        return json({ error: "Order already paid" }, 400);
      }
      if (Math.round(Number(order.total_amount)) !== amt) {
        return json({ error: "Amount mismatch" }, 400);
      }
      accountReference = order.order_number ?? order.id.slice(0, 12);
      transactionDesc = `Order ${order.order_number ?? ""}`.slice(0, 13);
      paymentInsert = { order_id: order.id };
    } else {
      const { data: res, error: resErr } = await supabase
        .from("reservation_leads")
        .select("id, name, deposit_amount, deposit_status")
        .eq("id", reservationId)
        .single();
      if (resErr || !res) return json({ error: "Reservation not found" }, 404);
      if (res.deposit_status === "paid") {
        return json({ error: "Deposit already paid" }, 400);
      }
      const expected = Number(res.deposit_amount ?? 0);
      if (!Number.isFinite(expected) || expected <= 0) {
        return json({ error: "No deposit configured for this reservation" }, 400);
      }
      if (Math.round(expected) !== amt) {
        return json({ error: "Amount mismatch" }, 400);
      }
      accountReference = `RSV-${res.id.slice(0, 8)}`;
      transactionDesc = `Deposit`;
      paymentInsert = { reservation_id: res.id };
    }

    // Get OAuth token
    const { token, base } = await getAccessToken(
      env,
      consumerKey,
      consumerSecret,
    );

    const timestamp = darajaTimestamp();
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    const stkBody = {
      BusinessShortCode: Number(shortcode),
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amt,
      PartyA: Number(normPhone),
      PartyB: Number(shortcode),
      PhoneNumber: Number(normPhone),
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    };

    const stkRes = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkBody),
    });
    const stkData = await stkRes.json();

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      // Persist the failed attempt for debugging
      await supabase.from("payments").insert({
        ...paymentInsert,
        provider: "mpesa",
        amount: amt,
        phone: normPhone,
        status: "failed",
        result_desc: stkData.errorMessage ?? stkData.ResponseDescription ??
          "STK push request rejected",
        raw_request: stkBody,
        raw_callback: stkData,
      });
      return json(
        {
          error: stkData.errorMessage ??
            stkData.ResponseDescription ??
            "Failed to initiate M-Pesa payment",
        },
        502,
      );
    }

    // Persist the pending attempt
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        ...paymentInsert,
        provider: "mpesa",
        amount: amt,
        phone: normPhone,
        merchant_request_id: stkData.MerchantRequestID,
        checkout_request_id: stkData.CheckoutRequestID,
        status: "pending",
        raw_request: stkBody,
      })
      .select("id")
      .single();

    if (payErr) {
      return json({ error: "Failed to record payment: " + payErr.message }, 500);
    }

    return json({
      paymentId: payment.id,
      checkoutRequestId: stkData.CheckoutRequestID,
      message: "Check your phone and enter your M-Pesa PIN",
    });
  } catch (e) {
    console.error("mpesa-initiate error", e);
    return json({ error: (e as Error).message ?? "Server error" }, 500);
  }
}, { request_id: req.headers.get("x-request-id") ?? undefined }));
