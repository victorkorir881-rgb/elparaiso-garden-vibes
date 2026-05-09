// supabase/functions/mpesa-reversal-result/index.ts
// Phase 7.5 — Public Daraja Reversal result callback.
//
// Daraja POSTs the async outcome of a TransactionReversal here. Body shape:
//   { Result: { ResultType, ResultCode, ResultDesc, OriginatorConversationID,
//               ConversationID, TransactionID, ResultParameters: { ResultParameter: [...] }, ... } }
//
// We correlate via ConversationID (stored in payments.refund_request_id) and
// flip refund_status to 'refunded' on ResultCode=0, otherwise 'failed'.
//
// Deploy with verify_jwt = false (set in supabase/config.toml).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logger, withTimedLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ACK = JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" });
const ack = () =>
  new Response(ACK, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve((req) => withTimedLog("mpesa-reversal-result", async () => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Optional shared-secret check (?token=...)
  const expectedToken = Deno.env.get("MPESA_REVERSAL_TOKEN");
  if (expectedToken) {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== expectedToken) {
      console.warn("mpesa-reversal-result: invalid token");
      return ack();
    }
  }

  try {
    const payload = await req.json();
    const result = payload?.Result;
    if (!result) return ack();

    const conversationId: string | undefined = result.ConversationID;
    const resultCode: number = Number(result.ResultCode);
    const resultDesc: string = String(result.ResultDesc ?? "");
    if (!conversationId) return ack();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: payment } = await supabase
      .from("payments")
      .select("id, refund_status")
      .eq("refund_request_id", conversationId)
      .single();

    if (!payment) {
      console.warn("mpesa-reversal-result: unknown ConversationID", conversationId);
      return ack();
    }
    if (payment.refund_status === "refunded") return ack();

    const newStatus = resultCode === 0 ? "refunded" : "failed";

    await supabase
      .from("payments")
      .update({
        refund_status: newStatus,
        refund_result_code: resultCode,
        refund_result_desc: resultDesc,
        refund_raw_callback: payload,
        refunded_at: newStatus === "refunded" ? new Date().toISOString() : null,
      })
      .eq("id", payment.id);

    return ack();
  } catch (e) {
    console.error("mpesa-reversal-result error", e);
    return ack();
  }
}, { request_id: req.headers.get("x-request-id") ?? undefined }));
