import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery } from "@tanstack/react-query";

/**
 * Initiate input — pass exactly one of `orderId` or `reservationId`.
 *  - `orderId`        → pays a placed food order in full
 *  - `reservationId`  → pays the deposit configured on a reservation lead
 */
export interface InitiatePaymentInput {
  orderId?: string;
  reservationId?: string;
  phone: string;
  amount: number;
}

export interface InitiatePaymentResult {
  paymentId: string;
  checkoutRequestId: string;
  message: string;
}

/** Triggers the STK Push by calling the `mpesa-initiate` edge function. */
export function useInitiateMpesaPayment() {
  return useMutation<InitiatePaymentResult, Error, InitiatePaymentInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke<InitiatePaymentResult>(
        "mpesa-initiate",
        { body: input },
      );
      if (error) {
        // supabase-js returns a generic "non-2xx" message on errors; dig into
        // the underlying Response so the user sees Daraja's actual reason
        // (e.g. "Invalid PassKey", "Invalid CallBackURL", "Bad Request").
        let detail: string | undefined;
        try {
          const resp = (error as unknown as { context?: { response?: Response } })
            .context?.response;
          if (resp) {
            const body = await resp.clone().json().catch(() => null);
            detail = (body && (body.error || body.message)) || undefined;
          }
        } catch { /* ignore */ }
        throw new Error(detail ?? error.message ?? "Failed to start payment");
      }
      if (!data) throw new Error("No response from payment service");
      return data;
    },
  });
}

export type PaymentStatus =
  | "pending"
  | "success"
  | "failed"
  | "cancelled"
  | "timeout";

export interface PaymentRow {
  id: string;
  status: PaymentStatus;
  result_desc: string | null;
  mpesa_receipt_number: string | null;
}

/**
 * Polls the `payments` row every `intervalMs` while the payment is pending.
 * Pass `paymentId = null` to disable.
 */
export function usePaymentStatus(paymentId: string | null, intervalMs = 3000) {
  return useQuery<PaymentRow | null>({
    queryKey: ["payment", paymentId],
    enabled: !!paymentId,
    refetchInterval: (q) => {
      const d = q.state.data as PaymentRow | null | undefined;
      return d && d.status !== "pending" ? false : intervalMs;
    },
    queryFn: async () => {
      if (!paymentId) return null;
      // `payments` table is created by sql/0003_payments.sql; cast around
      // the generated Database types until the user regenerates them.
      const { data, error } = await (supabase as any)
        .from("payments")
        .select("id, status, result_desc, mpesa_receipt_number")
        .eq("id", paymentId)
        .maybeSingle();
      if (error) throw error;
      return (data as PaymentRow | null) ?? null;
    },
  });
}
