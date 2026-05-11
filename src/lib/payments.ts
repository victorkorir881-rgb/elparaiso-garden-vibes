import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Manual M-Pesa claim — fallback when the Daraja callback never reaches us.
 * Customer types the receipt code (e.g. "QGH7X8Y9ZA") from their phone; the
 * payment row is flagged as `manual_claim_status='claimed'` and an admin
 * cross-checks the M-Pesa Business portal before approving.
 */
export function useClaimManualPayment() {
  return useMutation<
    { ok: true; already?: boolean },
    Error,
    { paymentId: string; reference: string }
  >({
    mutationFn: async ({ paymentId, reference }) => {
      const { data, error } = await (supabase as any).rpc("claim_payment_manually", {
        p_payment_id: paymentId,
        p_reference: reference,
      });
      if (error) throw new Error(error.message ?? "Failed to submit reference");
      return (data ?? { ok: true }) as { ok: true; already?: boolean };
    },
  });
}

/** Admin-only: approve or reject a manual M-Pesa claim. */
export function useVerifyManualPayment() {
  const qc = useQueryClient();
  return useMutation<
    { ok: true; approved: boolean; order_id: string | null; reservation_id: string | null },
    Error,
    { paymentId: string; approve: boolean; notes?: string }
  >({
    mutationFn: async ({ paymentId, approve, notes }) => {
      const { data, error } = await (supabase as any).rpc("verify_manual_payment", {
        p_payment_id: paymentId,
        p_approve: approve,
        p_notes: notes ?? null,
      });
      if (error) throw new Error(error.message ?? "Verification failed");
      return data as { ok: true; approved: boolean; order_id: string | null; reservation_id: string | null };
    },
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: ["orderPayments"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["manualClaims"] });
      // Mirror mpesa-callback: fire receipt notifications when an order is approved.
      if (data.approved && data.order_id) {
        const invoke = (fn: string) =>
          supabase.functions
            .invoke(fn, { body: { template: "order_payment_receipt", recordId: data.order_id } })
            .catch(() => {});
        void invoke("send-email");
        void invoke("send-sms");
      }
    },
  });
}

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

export type ManualClaimStatus = "none" | "claimed" | "verified" | "rejected";

export interface PaymentRow {
  id: string;
  status: PaymentStatus;
  result_desc: string | null;
  mpesa_receipt_number: string | null;
  manual_claim_status?: ManualClaimStatus;
  manual_reference?: string | null;
  manual_notes?: string | null;
  manual_verified_at?: string | null;
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
      // Keep polling while waiting for either the M-Pesa callback OR an admin
      // decision on a manual claim.
      if (!d) return intervalMs;
      if (d.status === "pending") return intervalMs;
      if (d.manual_claim_status === "claimed") return intervalMs;
      return false;
    },
    queryFn: async () => {
      if (!paymentId) return null;
      // Read via the dedicated `payment-status` edge function (service role)
      // instead of the `payments_public` view. This bypasses RLS / view-grant
      // drift that previously caused the UI to stay stuck on "Waiting for
      // confirmation" even after mpesa-callback had updated the row.
      const { data, error } = await supabase.functions.invoke<PaymentRow>(
        "payment-status",
        { body: { paymentId } },
      );
      if (error) throw new Error(error.message ?? "Failed to fetch payment status");
      if (!data) return null;
      return {
        id: data.id,
        status: data.status,
        result_desc: data.result_desc ?? null,
        mpesa_receipt_number: data.mpesa_receipt_number ?? null,
        manual_claim_status: data.manual_claim_status ?? "none",
        manual_reference: data.manual_reference ?? null,
        manual_notes: data.manual_notes ?? null,
        manual_verified_at: data.manual_verified_at ?? null,
      } satisfies PaymentRow;
    },
  });

  // Realtime: instantly reflect the M-Pesa callback OR admin verification the
  // moment it lands. Polling stays as a fallback in case realtime drops.
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
            manual_claim_status: row.manual_claim_status ?? "none",
            manual_reference: row.manual_reference ?? null,
            manual_notes: row.manual_notes ?? null,
            manual_verified_at: row.manual_verified_at ?? null,
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
