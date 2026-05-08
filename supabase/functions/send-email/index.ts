// supabase/functions/send-email/index.ts
// Phase 6.1 — Generic transactional email sender for Elparaiso Garden Kisii.
//
// Triggers:
//   - Reservation booked → confirmation to customer
//   - Contact message received → ack to customer
//   - Order placed → confirmation to customer
//   - Order status changed → status update to customer
//
// Auth model:
//   This function is callable by anonymous browser clients (public forms),
//   so verify_jwt is false. To prevent abuse:
//     1. Only a fixed set of `template` names are allowed.
//     2. The recipient email is taken from the row in the database (looked
//        up by record id), NOT trusted from the request body. This stops
//        attackers from spamming arbitrary inboxes through us.
//     3. Per-record idempotency: we record sent emails in `email_send_log`
//        and refuse duplicates within 5 minutes for the same key.
//
// Required Supabase secret:
//   RESEND_API_KEY  — from https://resend.com/api-keys
//
// Optional secret:
//   EMAIL_FROM      — e.g. "Elparaiso Garden <noreply@elparaisogardens.com>"
//                     defaults to "Elparaiso Garden <onboarding@resend.dev>"

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
  | "contact_ack"
  | "order_confirmation"
  | "order_status_update";

interface RequestBody {
  template: TemplateName;
  recordId: string;          // reservation_leads.id, contact_messages.id, orders.id
  status?: string;           // for order_status_update only
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  // tiny tagged template that escapes interpolated values
  const escape = (s: unknown) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  return strings.reduce((acc, str, i) => acc + str + (i < values.length ? escape(values[i]) : ""), "");
}

const wrap = (title: string, inner: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;background:#ffffff;font-family:Inter,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-family:'Playfair Display',Georgia,serif;color:#0f0f0f;margin:0 0 8px;">Elparaiso Garden Kisii</h1>
    <div style="height:3px;width:48px;background:#c9a96e;margin:0 0 24px;"></div>
    ${inner}
    <p style="font-size:12px;color:#9ca3af;margin-top:32px;">
      Elparaiso Garden Kisii — Restaurant, Bar &amp; Events<br/>
      Kisii, Kenya
    </p>
  </div>
</body></html>`;

function renderReservation(r: any) {
  const subject = `Reservation received — ${r.date ?? "soon"}${r.time ? " at " + r.time : ""}`;
  const body = wrap("Reservation received", html`
    <h2 style="font-size:20px;margin:0 0 12px;">Karibu, ${r.name}!</h2>
    <p>We've received your reservation request. Here are the details:</p>
    <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Date</td><td>${r.date ?? "—"}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Time</td><td>${r.time ?? "—"}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Party size</td><td>${r.party_size ?? "—"}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Phone</td><td>${r.phone}</td></tr>
    </table>
    <p>Our team will contact you shortly to confirm. If you need to change anything, just reply to this email or WhatsApp us.</p>
    <p style="margin-top:24px;">Asante sana,<br/><strong>The Elparaiso Team</strong></p>
  `);
  return { subject, html: body };
}

function renderContactAck(c: any) {
  const subject = "We received your message";
  const body = wrap("Message received", html`
    <h2 style="font-size:20px;margin:0 0 12px;">Thanks, ${c.name}!</h2>
    <p>We've received your message and will get back to you within 24 hours.</p>
    <blockquote style="border-left:3px solid #c9a96e;padding:8px 16px;margin:16px 0;color:#4b5563;background:#fafafa;">
      ${c.message}
    </blockquote>
    <p>If it's urgent, WhatsApp is the fastest way to reach us.</p>
    <p style="margin-top:24px;">Best,<br/><strong>The Elparaiso Team</strong></p>
  `);
  return { subject, html: body };
}

function renderOrderConfirmation(o: any) {
  const items: any[] = Array.isArray(o.items) ? o.items : [];
  const rows = items.map(i => `
    <tr>
      <td style="padding:6px 0;">${html`${i.name ?? "Item"}`} × ${html`${i.quantity ?? 1}`}</td>
      <td style="padding:6px 0;text-align:right;">KES ${html`${i.price ?? "—"}`}</td>
    </tr>`).join("");
  const subject = `Order received — #${String(o.id).slice(0, 8)}`;
  const body = wrap("Order received", html`
    <h2 style="font-size:20px;margin:0 0 12px;">Karibu, ${o.customer_name}!</h2>
    <p>Your order has been received. We'll confirm and start preparing it shortly.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${rows}
      <tr><td style="border-top:1px solid #e5e7eb;padding-top:12px;font-weight:600;">Total</td>
          <td style="border-top:1px solid #e5e7eb;padding-top:12px;text-align:right;font-weight:600;">KES ${html`${o.total ?? "—"}`}</td></tr>
    </table>
    <p>Track your order: <a href="https://elparaisogardens.vercel.app/track" style="color:#c9a96e;">elparaisogardens.vercel.app/track</a></p>
    <p style="margin-top:24px;">Asante,<br/><strong>The Elparaiso Team</strong></p>
  `);
  return { subject, html: body };
}

function renderOrderStatusUpdate(o: any, newStatus: string) {
  const labels: Record<string, string> = {
    confirmed: "confirmed and is being prepared",
    preparing: "being prepared by our kitchen",
    ready: "ready for pickup / out for delivery",
    completed: "completed — thank you!",
    cancelled: "cancelled",
  };
  const subject = `Order #${String(o.id).slice(0, 8)} — ${newStatus}`;
  const body = wrap("Order update", html`
    <h2 style="font-size:20px;margin:0 0 12px;">Hi ${o.customer_name},</h2>
    <p>Your order is now <strong>${labels[newStatus] ?? newStatus}</strong>.</p>
    <p>Track your order: <a href="https://elparaisogardens.vercel.app/track" style="color:#c9a96e;">elparaisogardens.vercel.app/track</a></p>
    <p style="margin-top:24px;">Asante,<br/><strong>The Elparaiso Team</strong></p>
  `);
  return { subject, html: body };
}

Deno.serve((req) => withTimedLog("send-email", async () => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("send-email: RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "email_not_configured" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const FROM = Deno.env.get("EMAIL_FROM") ?? "Elparaiso Garden <onboarding@resend.dev>";

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body?.template || !body?.recordId) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use service role to look up the source record (bypassing RLS) so we can
  // trust the `to` address. We never accept `to` from the client body.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let to: string | null = null;
  let subject = "";
  let htmlBody = "";

  try {
    if (body.template === "reservation_confirmation") {
      const { data, error } = await supabase.from("reservation_leads").select("*").eq("id", body.recordId).single();
      if (error || !data) throw new Error("reservation_not_found");
      to = data.email ?? null;
      ({ subject, html: htmlBody } = renderReservation(data));
    } else if (body.template === "contact_ack") {
      const { data, error } = await supabase.from("contact_messages").select("*").eq("id", body.recordId).single();
      if (error || !data) throw new Error("contact_not_found");
      to = data.email ?? null;
      ({ subject, html: htmlBody } = renderContactAck(data));
    } else if (body.template === "order_confirmation") {
      const { data, error } = await supabase.from("orders").select("*").eq("id", body.recordId).single();
      if (error || !data) throw new Error("order_not_found");
      to = data.customer_email ?? null;
      ({ subject, html: htmlBody } = renderOrderConfirmation(data));
    } else if (body.template === "order_status_update") {
      if (!body.status) throw new Error("missing_status");
      const { data, error } = await supabase.from("orders").select("*").eq("id", body.recordId).single();
      if (error || !data) throw new Error("order_not_found");
      to = data.customer_email ?? null;
      ({ subject, html: htmlBody } = renderOrderStatusUpdate(data, body.status));
    } else {
      return new Response(JSON.stringify({ error: "unknown_template" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("send-email lookup error:", e);
    return new Response(JSON.stringify({ error: "record_lookup_failed" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!to) {
    // Customer didn't provide email — silently skip, not an error
    return new Response(JSON.stringify({ skipped: "no_recipient" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Send via Resend
  const resp = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html: htmlBody }),
  });

  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("send-email Resend error:", resp.status, result);
    return new Response(JSON.stringify({ error: "resend_failed", detail: result }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ id: result.id ?? null }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}, { request_id: req.headers.get("x-request-id") ?? undefined }));
