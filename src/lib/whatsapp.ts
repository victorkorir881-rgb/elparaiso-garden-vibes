/**
 * WhatsApp transactional helper — TEMPORARILY DISABLED.
 *
 * The `send-whatsapp` Edge Function still exists in `supabase/functions/`
 * but is not wired up to any user flow. This module is intentionally a
 * no-op so the rest of the app keeps compiling and we can re-enable
 * WhatsApp notifications later by restoring the implementation.
 */

export type WhatsappTemplate =
  | "reservation_confirmation"
  | "order_confirmation"
  | "order_status_update"
  | "order_payment_receipt";

export interface SendTransactionalWhatsappArgs {
  template: WhatsappTemplate;
  recordId: string;
  status?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendTransactionalWhatsapp(_args: SendTransactionalWhatsappArgs): Promise<void> {
  // Disabled — see file header.
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function fireTransactionalWhatsapp(_args: SendTransactionalWhatsappArgs): void {
  // Disabled — see file header.
}
