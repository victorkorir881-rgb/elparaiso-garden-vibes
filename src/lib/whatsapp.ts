/**
 * Phase 6.3 — Transactional WhatsApp helper (Meta Cloud API via Edge Function).
 *
 * Thin wrapper over the `send-whatsapp` Supabase Edge Function. Always
 * fire-and-forget: WhatsApp failures must never block the underlying user
 * action (reservation, order). Errors are logged for ops only.
 */
import { supabase } from "@/integrations/supabase/client";

export type WhatsappTemplate =
  | "reservation_confirmation"
  | "order_confirmation"
  | "order_status_update"
  | "order_payment_receipt";

export interface SendTransactionalWhatsappArgs {
  template: WhatsappTemplate;
  /** ID of the row in reservation_leads / orders */
  recordId: string;
  /** Required for `order_status_update` */
  status?: string;
}

export async function sendTransactionalWhatsapp(
  args: SendTransactionalWhatsappArgs,
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("send-whatsapp", { body: args });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[whatsapp] invoke failed:", error.message);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[whatsapp] threw:", (e as Error).message);
  }
}

/** Same as sendTransactionalWhatsapp but explicitly fire-and-forget (no await). */
export function fireTransactionalWhatsapp(args: SendTransactionalWhatsappArgs): void {
  void sendTransactionalWhatsapp(args);
}
