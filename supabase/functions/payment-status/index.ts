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

Deno.serve(async (req) => {
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

    return json({
      id: data.id,
      status: data.status,
      result_desc: data.result_desc ?? null,
      mpesa_receipt_number: data.mpesa_receipt_number ?? null,
      completed_at: data.completed_at ?? null,
      manual_claim_status: data.manual_claim_status ?? "none",
      manual_reference: data.manual_reference ?? null,
      manual_notes: data.manual_notes ?? null,
      manual_verified_at: data.manual_verified_at ?? null,
    }, 200);
  } catch (e) {
    console.error("payment-status error", e);
    return json({ error: (e as Error).message ?? "Unknown error" }, 500);
  }
});
