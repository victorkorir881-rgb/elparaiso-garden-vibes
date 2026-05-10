import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

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
  const queryClient = useQueryClient();
  const query = useQuery<PaymentRow | null>({
    queryKey: ["payment", paymentId],
    enabled: !!paymentId,
    refetchInterval: (q) => {
      const d = q.state.data as PaymentRow | null | undefined;
      return d && d.status !== "pending" ? false : intervalMs;
    },
    queryFn: async () => {
      if (!paymentId) return null;
      // Read through the `payments_public` view (sql/0018) which exposes only
      // the non-sensitive columns and is readable by anon. Falls back to the
      // base table if the view doesn't exist yet (column GRANT also allows
      // anon to read these specific columns).
      const sb = supabase as any;
      let { data, error } = await sb
        .from("payments_public")
        .select("id, status, result_desc, mpesa_receipt_number")
        .eq("id", paymentId)
        .maybeSingle();
      if (error) {
        const fallback = await sb
          .from("payments")
          .select("id, status, result_desc, mpesa_receipt_number")
          .eq("id", paymentId)
          .maybeSingle();
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      }
      return (data as PaymentRow | null) ?? null;
    },
  });

  // Realtime: instantly reflect the M-Pesa callback the moment it lands,
  // instead of waiting up to `intervalMs` for the next poll. Polling stays
  // as a fallback in case the realtime channel drops.
  useEffect(() => {
    if (!paymentId) return;
    const channel = (supabase as any)
      .channel(`payment:${paymentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payments",
          filter: `id=eq.${paymentId}`,
        },
        (payload: any) => {
          const row = payload?.new as PaymentRow | undefined;
          if (!row) {
            queryClient.invalidateQueries({ queryKey: ["payment", paymentId] });
            return;
          }
          queryClient.setQueryData(["payment", paymentId], {
            id: row.id,
            status: row.status,
            result_desc: row.result_desc ?? null,
            mpesa_receipt_number: row.mpesa_receipt_number ?? null,
          } satisfies PaymentRow);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [paymentId, queryClient]);

  return query;
}
