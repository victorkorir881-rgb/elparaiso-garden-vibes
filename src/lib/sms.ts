/**
 * Phase 6.2 — Transactional SMS helper (Africa's Talking via Edge Function).
 *
 * Thin wrapper over the `send-sms` Supabase Edge Function. Always
 * fire-and-forget: SMS failures must never block the underlying user
 * action (reservation, order). Errors are logged for ops only.
 */
import { supabase } from "@/integrations/supabase/client";

export type SmsTemplate =
  | "reservation_confirmation"
  | "order_confirmation"
  | "order_status_update"
  | "order_payment_receipt";

export interface SendTransactionalSmsArgs {
  template: SmsTemplate;
  /** ID of the row in reservation_leads / orders */
  recordId: string;
  /** Required for `order_status_update` */
  status?: string;
}

export async function sendTransactionalSms(args: SendTransactionalSmsArgs): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("send-sms", { body: args });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[sms] send-sms invoke failed:", error.message);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[sms] send-sms threw:", (e as Error).message);
  }
}

/** Same as sendTransactionalSms but explicitly fire-and-forget (no await). */
export function fireTransactionalSms(args: SendTransactionalSmsArgs): void {
  void sendTransactionalSms(args);
}
