// supabase/functions/send-sms/index.ts
// Phase 6.2 — Transactional SMS sender for Elparaiso Garden Kisii.
//
// Provider: Africa's Talking (https://africastalking.com)
// Triggers: Reservation, Order placed, Order status change, Payment receipt.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logger, withTimedLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TemplateName =
  | "reservation_confirmation"
  | "order_confirmation"
  | "order_status_update"
  | "order_payment_receipt"
  | "admin_new_order";

interface RequestBody {
  template: TemplateName;
  recordId: string;
  status?: string; // for order_status_update
}

const SANDBOX_ENDPOINT = "https://api.sandbox.africastalking.com/version1/messaging";
const LIVE_ENDPOINT = "https://api.africastalking.com/version1/messaging";

/** Normalize Kenyan phone numbers to E.164 (+254...). */
function normalizeKePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return "+" + digits;
  if (/^0[17]\d{8}$/.test(digits)) return "+254" + digits.slice(1);
  if (/^[17]\d{8}$/.test(digits)) return "+254" + digits;
  if (input.startsWith("+") && /^\+\d{10,15}$/.test(input)) return input;
  return null;
}

function renderReservation(r: any): string {
  const when = [r.date, r.time].filter(Boolean).join(" at ");
  const party = r.party_size ? ` for ${r.party_size}` : "";
  return `Karibu ${r.name ?? ""}! Your reservation${party}${when ? " on " + when : ""} at Elparaiso Garden Kisii is received. We'll confirm shortly. Call 0791 224513.`.trim();
}

function renderOrderConfirmation(o: any): string {
  const total = o.total_amount != null ? ` KSh ${Number(o.total_amount).toLocaleString()}` : "";
  return `Asante ${o.customer_name ?? ""}! Order ${o.order_number} received${total}. We'll update you as it progresses. — Elparaiso Garden Kisii`.trim();
}

function renderOrderStatus(o: any, status: string): string {
  const friendly: Record<string, string> = {
    confirmed: "has been confirmed",
    preparing: "is being prepared",
    ready: "is ready for pickup/delivery",
    completed: "has been completed. Asante sana!",
    cancelled: "has been cancelled. Contact us if this is unexpected.",
  };
  const phrase = friendly[status] ?? `is now: ${status}`;
  return `Hi ${o.customer_name ?? ""}, your order ${o.order_number} ${phrase}. — Elparaiso Garden Kisii`.trim();
}

function renderOrderPaymentReceipt(o: any, p: any): string {
  const amt = p?.amount ?? o.total_amount;
  const amtStr = amt != null ? ` KSh ${Number(amt).toLocaleString()}` : "";
  const rcpt = p?.mpesa_receipt_number ? ` Receipt: ${p.mpesa_receipt_number}.` : "";
  return `Asante ${o.customer_name ?? ""}! Payment${amtStr} for order ${o.order_number} received.${rcpt} Order is now confirmed. — Elparaiso Garden Kisii`.trim();
}

function renderAdminNewOrder(o: any): string {
  const total = o.total_amount != null ? ` KSh ${Number(o.total_amount).toLocaleString()}` : "";
  const type = o.order_type ? ` (${o.order_type})` : "";
  return `New PAID order ${o.order_number}${type}${total} from ${o.customer_name ?? "customer"} ${o.customer_phone ?? ""}. Open admin panel. — Elparaiso`.trim();
}

/** 
 * Checks the log to prevent spamming the same SMS multiple times 
 * for the same record within 5 minutes.
 */
async function recentlySent(
  admin: ReturnType<typeof createClient>,
  key: string,
): Promise<boolean> {
  const { data } = await admin
    .from("sms_send_log")
    .select("id")
    .eq("idempotency_key", key)
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

async function logSend(
  admin: ReturnType<typeof createClient>,
  row: { 
    idempotency_key: string; 
    template: string; 
    record_id: string; 
    phone: string; 
    status: "sent" | "failed"; 
    provider_response?: any; 
    error?: string 
  },
) {
  await admin.from("sms_send_log").insert(row).then(() => {}, () => {});
}

Deno.serve(async (req) => {
  return await withTimedLog("send-sms", async () => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const ALLOWED: TemplateName[] = ["reservation_confirmation", "order_confirmation", "order_status_update", "order_payment_receipt", "admin_new_order"];
    if (!body?.template || !ALLOWED.includes(body.template) || !body?.recordId) {
      return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const AT_API_KEY = Deno.env.get("AT_API_KEY");
    const AT_USERNAME = Deno.env.get("AT_USERNAME");
    const AT_SENDER_ID = Deno.env.get("AT_SENDER_ID") ?? "";
    const AT_ENV = (Deno.env.get("AT_ENV") ?? "sandbox").toLowerCase();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!AT_API_KEY || !AT_USERNAME) {
      return new Response(JSON.stringify({ error: "sms_not_configured" }), { status: 503, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 1. Look up the record + recipient phone server-side.
    let phone: string | null = null;
    let message = "";

    if (body.template === "reservation_confirmation") {
      const { data, error } = await admin.from("reservation_leads").select("*").eq("id", body.recordId).single();
      if (error || !data) return new Response(JSON.stringify({ error: "record_not_found" }), { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } });
      phone = normalizeKePhone(data.phone);
      message = renderReservation(data);
    } else if (body.template === "order_confirmation") {
      const { data, error } = await admin.from("orders").select("*").eq("id", body.recordId).single();
      if (error || !data) return new Response(JSON.stringify({ error: "record_not_found" }), { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } });
      phone = normalizeKePhone(data.customer_phone);
      message = renderOrderConfirmation(data);
    } else if (body.template === "order_status_update") {
      if (!body.status) return new Response(JSON.stringify({ error: "status_required" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
      const { data, error } = await admin.from("orders").select("*").eq("id", body.recordId).single();
      if (error || !data) return new Response(JSON.stringify({ error: "record_not_found" }), { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } });
      phone = normalizeKePhone(data.customer_phone);
      message = renderOrderStatus(data, body.status);
    } else if (body.template === "order_payment_receipt") {
      const { data, error } = await admin.from("orders").select("*").eq("id", body.recordId).single();
      if (error || !data) return new Response(JSON.stringify({ error: "record_not_found" }), { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } });
      const { data: pay } = await admin
        .from("payments")
        .select("amount, mpesa_receipt_number, phone, status, completed_at")
        .eq("order_id", body.recordId)
        .eq("status", "success")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      phone = normalizeKePhone(pay?.phone ?? data.customer_phone);
      message = renderOrderPaymentReceipt(data, pay);
    } else if (body.template === "admin_new_order") {
      const { data, error } = await admin.from("orders").select("*").eq("id", body.recordId).single();
      if (error || !data) return new Response(JSON.stringify({ error: "record_not_found" }), { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } });

      // Send to ALL active admins that have a phone number on their profile.
      // Falls back to ADMIN_NOTIFY_PHONES env var only if no admin phones exist.
      const { data: allAdmins } = await admin
        .from("admin_profiles")
        .select("phone")
        .eq("is_active", true)
        .not("phone", "is", null);

      let adminPhones = (allAdmins ?? [])
        .map((r: { phone: string | null }) => normalizeKePhone(r.phone ?? ""))
        .filter((p): p is string => !!p);

      if (adminPhones.length === 0) {
        const adminPhonesRaw = Deno.env.get("ADMIN_NOTIFY_PHONES") ?? "";
        adminPhones = adminPhonesRaw
          .split(",")
          .map((p) => normalizeKePhone(p.trim()))
          .filter((p): p is string => !!p);
      }

      // De-duplicate
      adminPhones = Array.from(new Set(adminPhones));

      if (adminPhones.length === 0) {
        return new Response(JSON.stringify({ skipped: "no_admin_phones" }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
      }

      const idemKey = `admin_new_order:${body.recordId}:`;
      if (await recentlySent(admin, idemKey)) {
        return new Response(JSON.stringify({ skipped: "duplicate" }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
      }

      const adminMessage = renderAdminNewOrder(data);
      const endpoint = AT_ENV === "production" ? LIVE_ENDPOINT : SANDBOX_ENDPOINT;
      const form = new URLSearchParams();
      form.set("username", AT_USERNAME);
      form.set("to", adminPhones.join(","));
      form.set("message", adminMessage);
      if (AT_SENDER_ID) form.set("from", AT_SENDER_ID);

      let providerJson: any = null;
      let providerOk = false;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "apiKey": AT_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
          },
          body: form.toString(),
        });
        providerJson = await res.json().catch(() => ({}));
        const recipients = providerJson?.SMSMessageData?.Recipients ?? [];
        providerOk = res.ok && recipients.some((r: any) => r?.status === "Success");
      } catch (e) {
        await logSend(admin, { idempotency_key: idemKey, template: body.template, record_id: body.recordId, phone: adminPhones.join(","), status: "failed", error: (e as Error).message });
        return new Response(JSON.stringify({ error: "provider_unreachable" }), { status: 502, headers: { ...corsHeaders, "content-type": "application/json" } });
      }

      await logSend(admin, {
        idempotency_key: idemKey,
        template: body.template,
        record_id: body.recordId,
        phone: adminPhones.join(","),
        status: providerOk ? "sent" : "failed",
        provider_response: providerJson,
      });

      return new Response(JSON.stringify({ ok: providerOk, to: adminPhones }), { status: providerOk ? 200 : 502, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    if (!phone) {
      return new Response(JSON.stringify({ skipped: "no_phone" }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const idempotencyKey = `${body.template}:${body.recordId}:${body.status ?? ""}`;
    if (await recentlySent(admin, idempotencyKey)) {
      return new Response(JSON.stringify({ skipped: "duplicate" }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    // 2. POST to Africa's Talking.
    const endpoint = AT_ENV === "production" ? LIVE_ENDPOINT : SANDBOX_ENDPOINT;
    const form = new URLSearchParams();
    form.set("username", AT_USERNAME);
    form.set("to", phone);
    form.set("message", message);
    if (AT_SENDER_ID) form.set("from", AT_SENDER_ID);

    let providerJson: any = null;
    let providerOk = false;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "apiKey": AT_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: form.toString(),
      });
      providerJson = await res.json().catch(() => ({}));
      const recipients = providerJson?.SMSMessageData?.Recipients ?? [];
      providerOk = res.ok && recipients.some((r: any) => r?.status === "Success");
    } catch (e) {
      await logSend(admin, { idempotency_key: idempotencyKey, template: body.template, record_id: body.recordId, phone, status: "failed", error: (e as Error).message });
      return new Response(JSON.stringify({ error: "provider_unreachable" }), { status: 502, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    await logSend(admin, {
      idempotency_key: idempotencyKey,
      template: body.template,
      record_id: body.recordId,
      phone,
      status: providerOk ? "sent" : "failed",
      provider_response: providerJson,
    });

    if (!providerOk) {
      return new Response(JSON.stringify({ error: "provider_error", details: providerJson }), { status: 502, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, to: phone }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
  }, { request_id: req.headers.get("x-request-id") ?? undefined });
});