// supabase/functions/send-whatsapp/index.ts
// Phase 6.3 — Transactional WhatsApp sender via Meta WhatsApp Business Cloud API.
//
// Triggers (mirror send-sms):
//   - Reservation booked  → confirmation
//   - Order placed        → confirmation with order number + total
//   - Order status change → status update
//   - Payment received    → receipt with M-Pesa reference
//
// Auth model:
//   Public callable (verify_jwt = false) — reused from public reservation /
//   order forms. Hardening matches send-sms:
//     1. Only a fixed set of `template` names are allowed.
//     2. Recipient phone is read from the matching DB row, never the body.
//     3. Per-record idempotency via `whatsapp_send_log` (5-minute window).
//
// WhatsApp specifics:
//   The Cloud API requires *pre-approved templates* for outbound messages
//   outside the 24-hour customer-service window. Admins approve templates
//   in Meta Business Manager, then map them via env vars:
//
//     WHATSAPP_TOKEN                  Permanent system-user access token
//     WHATSAPP_PHONE_NUMBER_ID        Cloud API phone number id
//     WHATSAPP_TEMPLATE_LANG          Template language code (default "en")
//     WHATSAPP_TEMPLATE_RESERVATION   Template name for reservations
//     WHATSAPP_TEMPLATE_ORDER         Template name for new orders
//     WHATSAPP_TEMPLATE_STATUS        Template name for status updates
//     WHATSAPP_TEMPLATE_PAYMENT       Template name for payment receipts
//     WHATSAPP_GRAPH_VERSION          (optional) e.g. "v20.0" (default)
//
//   Each template is expected to have a BODY component with positional
//   {{1}}, {{2}}, ... placeholders. The arity used per template:
//     reservation: 1=name, 2=date, 3=time, 4=party_size
//     order      : 1=name, 2=order_number, 3=total
//     status     : 1=name, 2=order_number, 3=status_phrase
//     payment    : 1=name, 2=order_number, 3=amount, 4=receipt
//
// If WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing, the function
// returns 503 "not_configured" — the helper logs a 'skipped' row and the
// caller continues normally.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logger, withTimedLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TemplateName =
  | "reservation_confirmation"
  | "order_confirmation"
  | "order_status_update"
  | "order_payment_receipt";

interface RequestBody {
  template: TemplateName;
  recordId: string;
  status?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Normalize Kenyan phone numbers to bare "2547XXXXXXXX" (no leading +). */
function normalizeKePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return "254" + digits.slice(1);
  if (/^[17]\d{8}$/.test(digits)) return "254" + digits;
  if (input.startsWith("+") && /^\+\d{10,15}$/.test(input)) return digits;
  return null;
}

function statusPhrase(status: string): string {
  const m: Record<string, string> = {
    confirmed: "has been confirmed",
    preparing: "is being prepared",
    ready: "is ready for pickup/delivery",
    completed: "has been completed",
    cancelled: "has been cancelled",
  };
  return m[status] ?? `is now: ${status}`;
}

async function recentlySent(admin: any, key: string): Promise<boolean> {
  const { data } = await admin
    .from("whatsapp_send_log")
    .select("id")
    .eq("idempotency_key", key)
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

async function logSend(admin: any, row: {
  idempotency_key: string;
  template: string;
  record_id: string;
  phone: string;
  status: "sent" | "failed" | "skipped";
  provider_message_id?: string | null;
  provider_response?: any;
  error?: string;
}) {
  await admin.from("whatsapp_send_log").insert(row).then(() => {}, () => {});
}

Deno.serve((req) => withTimedLog("send-whatsapp", async () => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: RequestBody;
  try { body = await req.json(); }
  catch { return json({ error: "invalid_json" }, 400); }

  const ALLOWED: TemplateName[] = [
    "reservation_confirmation",
    "order_confirmation",
    "order_status_update",
    "order_payment_receipt",
  ];
  if (!body?.template || !ALLOWED.includes(body.template) || !body?.recordId) {
    return json({ error: "bad_request" }, 400);
  }

  const TOKEN = Deno.env.get("WHATSAPP_TOKEN");
  const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const LANG = Deno.env.get("WHATSAPP_TEMPLATE_LANG") ?? "en";
  const GRAPH = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v20.0";

  const TEMPLATE_MAP: Record<TemplateName, string | undefined> = {
    reservation_confirmation: Deno.env.get("WHATSAPP_TEMPLATE_RESERVATION"),
    order_confirmation:       Deno.env.get("WHATSAPP_TEMPLATE_ORDER"),
    order_status_update:      Deno.env.get("WHATSAPP_TEMPLATE_STATUS"),
    order_payment_receipt:    Deno.env.get("WHATSAPP_TEMPLATE_PAYMENT"),
  };

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  if (!TOKEN || !PHONE_ID) {
    return json({ error: "not_configured" }, 503);
  }
  const templateName = TEMPLATE_MAP[body.template];
  if (!templateName) {
    return json({ error: "template_not_mapped", template: body.template }, 503);
  }

  // 1. Look up recipient + parameter values from the DB.
  let phone: string | null = null;
  let params: string[] = [];

  if (body.template === "reservation_confirmation") {
    const { data, error } = await admin.from("reservation_leads").select("*").eq("id", body.recordId).single();
    if (error || !data) return json({ error: "record_not_found" }, 404);
    phone = normalizeKePhone(data.phone);
    params = [
      String(data.name ?? "Guest"),
      String(data.date ?? ""),
      String(data.time ?? ""),
      String(data.party_size ?? ""),
    ];
  } else if (body.template === "order_confirmation") {
    const { data, error } = await admin.from("orders").select("*").eq("id", body.recordId).single();
    if (error || !data) return json({ error: "record_not_found" }, 404);
    phone = normalizeKePhone(data.customer_phone);
    params = [
      String(data.customer_name ?? "Guest"),
      String(data.order_number ?? ""),
      `KSh ${Number(data.total_amount ?? 0).toLocaleString()}`,
    ];
  } else if (body.template === "order_status_update") {
    if (!body.status) return json({ error: "status_required" }, 400);
    const { data, error } = await admin.from("orders").select("*").eq("id", body.recordId).single();
    if (error || !data) return json({ error: "record_not_found" }, 404);
    phone = normalizeKePhone(data.customer_phone);
    params = [
      String(data.customer_name ?? "Guest"),
      String(data.order_number ?? ""),
      statusPhrase(body.status),
    ];
  } else if (body.template === "order_payment_receipt") {
    const { data, error } = await admin.from("orders").select("*").eq("id", body.recordId).single();
    if (error || !data) return json({ error: "record_not_found" }, 404);
    const { data: pay } = await admin
      .from("payments")
      .select("amount, mpesa_receipt_number, status, completed_at")
      .eq("order_id", body.recordId)
      .eq("status", "success")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    phone = normalizeKePhone(data.customer_phone);
    params = [
      String(data.customer_name ?? "Guest"),
      String(data.order_number ?? ""),
      `KSh ${Number(pay?.amount ?? data.total_amount ?? 0).toLocaleString()}`,
      String(pay?.mpesa_receipt_number ?? "—"),
    ];
  }

  if (!phone) {
    return json({ skipped: "no_phone" }, 200);
  }

  const idempotencyKey = `${body.template}:${body.recordId}:${body.status ?? ""}`;
  if (await recentlySent(admin, idempotencyKey)) {
    return json({ skipped: "duplicate" }, 200);
  }

  // 2. Build template message payload.
  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: LANG },
      components: [
        {
          type: "body",
          parameters: params.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };

  let providerJson: any = null;
  let providerOk = false;
  let messageId: string | null = null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH}/${PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    providerJson = await res.json().catch(() => ({}));
    providerOk = res.ok && Array.isArray(providerJson?.messages) && providerJson.messages.length > 0;
    messageId = providerJson?.messages?.[0]?.id ?? null;
  } catch (e) {
    await logSend(admin, {
      idempotency_key: idempotencyKey,
      template: body.template,
      record_id: body.recordId,
      phone,
      status: "failed",
      error: (e as Error).message,
    });
    return json({ error: "provider_unreachable" }, 502);
  }

  await logSend(admin, {
    idempotency_key: idempotencyKey,
    template: body.template,
    record_id: body.recordId,
    phone,
    status: providerOk ? "sent" : "failed",
    provider_message_id: messageId,
    provider_response: providerJson,
  });

  if (!providerOk) {
    return json({ error: "provider_error", details: providerJson }, 502);
  }
  return json({ ok: true, to: phone, messageId });
}, { request_id: req.headers.get("x-request-id") ?? undefined }));
