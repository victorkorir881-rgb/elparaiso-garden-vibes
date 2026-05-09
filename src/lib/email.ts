/**
 * Phase 6.1 — Transactional email helper.
 *
 * Thin wrapper over the `send-email` Supabase Edge Function. Always
 * fire-and-forget: email failures must never block the underlying user
 * action (reservation, contact, order). Errors are logged for ops only.
 */
import { supabase } from "@/integrations/supabase/client";

export type EmailTemplate =
  | "reservation_confirmation"
  | "contact_ack"
  | "order_confirmation"
  | "order_status_update"
  | "order_payment_receipt";

export interface SendTransactionalEmailArgs {
  template: EmailTemplate;
  /** ID of the row in reservation_leads / contact_messages / orders */
  recordId: string;
  /** Required for `order_status_update` */
  status?: string;
}

export async function sendTransactionalEmail(args: SendTransactionalEmailArgs): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("send-email", { body: args });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[email] send-email invoke failed:", error.message);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[email] send-email threw:", (e as Error).message);
  }
}

/** Same as sendTransactionalEmail but explicitly fire-and-forget (no await). */
export function fireTransactionalEmail(args: SendTransactionalEmailArgs): void {
  void sendTransactionalEmail(args);
}
