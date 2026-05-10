-- 0023_manual_payment_claims.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Manual M-Pesa claim fallback.
--
-- When the Daraja STK Push callback never reaches us (network drop, function
-- timeout, callback URL misconfig), the customer can claim they paid by
-- typing the M-Pesa receipt code (e.g. "QGH7X8Y9ZA") into the order UI.
-- That marks the payment row with manual_claim_status='claimed' and the
-- admin sees it in /admin/orders, cross-checks the M-Pesa Business portal,
-- then verifies (→ payment success + order paid + notifications) or rejects.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── COLUMNS ────────────────────────────────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS manual_claim_status text NOT NULL DEFAULT 'none'
    CHECK (manual_claim_status IN ('none', 'claimed', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS manual_reference   text,
  ADD COLUMN IF NOT EXISTS manual_claimed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS manual_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manual_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_notes       text;

CREATE INDEX IF NOT EXISTS payments_manual_claim_status_idx
  ON public.payments(manual_claim_status)
  WHERE manual_claim_status <> 'none';

-- ─── claim_payment_manually(p_payment_id, p_reference) ──────────────────────
-- Public RPC the customer calls from OrderPage. SECURITY DEFINER so it can
-- update payments without granting anon UPDATE on the table. Only flips a
-- pending row whose order/reservation matches the payment, normalises the
-- M-Pesa code, and is a no-op if already claimed/verified.
CREATE OR REPLACE FUNCTION public.claim_payment_manually(
  p_payment_id uuid,
  p_reference  text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  v_row public.payments%ROWTYPE;
BEGIN
  IF length(v_ref) < 8 OR length(v_ref) > 20 THEN
    RAISE EXCEPTION 'Invalid M-Pesa reference (expected 8–20 alphanumeric characters)';
  END IF;

  SELECT * INTO v_row FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_row.status = 'success' OR v_row.manual_claim_status = 'verified' THEN
    -- Already paid — surface success so the UI moves on.
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', v_row.status);
  END IF;

  UPDATE public.payments SET
    manual_claim_status = 'claimed',
    manual_reference    = v_ref,
    manual_claimed_at   = now()
  WHERE id = p_payment_id;

  RETURN jsonb_build_object('ok', true, 'already', false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_payment_manually(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_payment_manually(uuid, text) TO anon, authenticated;

-- ─── verify_manual_payment(p_payment_id, p_approve, p_notes) ────────────────
-- Admin-only RPC. On approve: flips payment.status='success', stamps the
-- mpesa_receipt_number from manual_reference, and marks the linked order
-- payment_status='paid' (or reservation deposit_status='paid'). On reject:
-- just records the decision; the order stays unpaid and the customer can
-- retry STK push.
--
-- Notifications (email/SMS) are NOT sent from inside the function — the
-- admin client invokes the send-email / send-sms edge functions after this
-- RPC returns ok (mirrors the mpesa-callback flow).
CREATE OR REPLACE FUNCTION public.verify_manual_payment(
  p_payment_id uuid,
  p_approve    boolean,
  p_notes      text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.payments%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can verify manual payments';
  END IF;

  SELECT * INTO v_row FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_row.manual_claim_status <> 'claimed' THEN
    RAISE EXCEPTION 'Payment is not awaiting manual verification';
  END IF;

  IF p_approve THEN
    UPDATE public.payments SET
      status               = 'success',
      mpesa_receipt_number = COALESCE(mpesa_receipt_number, manual_reference),
      result_desc          = COALESCE(result_desc, 'Manually verified by admin'),
      manual_claim_status  = 'verified',
      manual_verified_by   = auth.uid(),
      manual_verified_at   = now(),
      manual_notes         = p_notes,
      completed_at         = COALESCE(completed_at, now())
    WHERE id = p_payment_id;

    IF v_row.order_id IS NOT NULL THEN
      UPDATE public.orders
      SET payment_status = 'paid', payment_method = 'mpesa'
      WHERE id = v_row.order_id AND payment_status <> 'paid';
    ELSIF v_row.reservation_id IS NOT NULL THEN
      UPDATE public.reservation_leads
      SET deposit_status = 'paid',
          status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END
      WHERE id = v_row.reservation_id AND deposit_status <> 'paid';
    END IF;
  ELSE
    UPDATE public.payments SET
      manual_claim_status = 'rejected',
      manual_verified_by  = auth.uid(),
      manual_verified_at  = now(),
      manual_notes        = p_notes
    WHERE id = p_payment_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'approved', p_approve,
    'order_id', v_row.order_id,
    'reservation_id', v_row.reservation_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_manual_payment(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_manual_payment(uuid, boolean, text) TO authenticated;

COMMIT;
