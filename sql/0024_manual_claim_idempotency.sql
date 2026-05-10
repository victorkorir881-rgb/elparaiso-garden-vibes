-- 0024_manual_claim_idempotency.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Harden manual M-Pesa claim flow:
--
-- 1. Re-create `payments_public` to include manual_claim_status fields so the
--    customer's OrderPage can poll for admin verification.
-- 2. Strengthen `claim_payment_manually` so duplicate / conflicting submissions
--    are deterministic and never leave the row in an inconsistent state:
--       • same reference re-submitted   → idempotent ok (already=true)
--       • already verified              → ok already (status=success)
--       • already claimed (diff. ref)   → ERROR, no state change
--       • previously rejected           → allow a fresh claim (overwrites)
--       • another payment row on the same order/reservation already has
--         this reference (claimed or verified) → ERROR (conflict)
--
-- Idempotent. Apply via Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── Expose manual claim status on the public view ──────────────────────────
DROP VIEW IF EXISTS public.payments_public;
CREATE VIEW public.payments_public
WITH (security_invoker = on) AS
  SELECT
    id,
    status,
    result_desc,
    mpesa_receipt_number,
    completed_at,
    manual_claim_status,
    manual_reference,
    manual_notes,
    manual_verified_at
  FROM public.payments;

GRANT SELECT (
  id, status, result_desc, mpesa_receipt_number, completed_at,
  manual_claim_status, manual_reference, manual_notes, manual_verified_at
) ON public.payments TO anon, authenticated;

-- ─── Idempotent + conflict-safe claim ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_payment_manually(
  p_payment_id uuid,
  p_reference  text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref      text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  v_row      public.payments%ROWTYPE;
  v_conflict uuid;
BEGIN
  IF length(v_ref) < 8 OR length(v_ref) > 20 THEN
    RAISE EXCEPTION 'Invalid M-Pesa reference (expected 8–20 alphanumeric characters)'
      USING ERRCODE = '22023';
  END IF;

  -- Lock the target row so two concurrent submissions can't race.
  SELECT * INTO v_row FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
  END IF;

  -- Already paid (callback landed, or admin already verified) → no-op success.
  IF v_row.status = 'success' OR v_row.manual_claim_status = 'verified' THEN
    RETURN jsonb_build_object(
      'ok', true, 'already', true,
      'status', v_row.status,
      'manual_claim_status', v_row.manual_claim_status,
      'reference', v_row.manual_reference
    );
  END IF;

  -- Same row already in 'claimed' state.
  IF v_row.manual_claim_status = 'claimed' THEN
    IF v_row.manual_reference = v_ref THEN
      -- Exact same submission — idempotent.
      RETURN jsonb_build_object(
        'ok', true, 'already', true,
        'status', v_row.status,
        'manual_claim_status', 'claimed',
        'reference', v_row.manual_reference
      );
    END IF;
    RAISE EXCEPTION
      'A different M-Pesa reference (%) is already pending verification for this payment. Wait for an admin decision before submitting another.',
      v_row.manual_reference
      USING ERRCODE = '40001';
  END IF;

  -- Cross-row guard: another payment attempt on the same order/reservation
  -- already locked in this same reference. Prevents two siblings claiming the
  -- same M-Pesa receipt.
  IF v_row.order_id IS NOT NULL THEN
    SELECT id INTO v_conflict
      FROM public.payments
     WHERE order_id = v_row.order_id
       AND id <> v_row.id
       AND manual_reference = v_ref
       AND manual_claim_status IN ('claimed', 'verified')
     LIMIT 1;
  ELSIF v_row.reservation_id IS NOT NULL THEN
    SELECT id INTO v_conflict
      FROM public.payments
     WHERE reservation_id = v_row.reservation_id
       AND id <> v_row.id
       AND manual_reference = v_ref
       AND manual_claim_status IN ('claimed', 'verified')
     LIMIT 1;
  END IF;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION
      'This M-Pesa reference is already submitted for another attempt on the same order.'
      USING ERRCODE = '40001';
  END IF;

  -- Fresh claim, or replacing a previously rejected one.
  UPDATE public.payments SET
    manual_claim_status = 'claimed',
    manual_reference    = v_ref,
    manual_claimed_at   = now(),
    manual_verified_by  = NULL,
    manual_verified_at  = NULL,
    manual_notes        = NULL
  WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'ok', true, 'already', false,
    'status', v_row.status,
    'manual_claim_status', 'claimed',
    'reference', v_ref
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_payment_manually(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_payment_manually(uuid, text) TO anon, authenticated;

-- Partial unique index — defence-in-depth against two rows sharing an active
-- claim on the same reference within the same order/reservation. NULLs mean
-- "no order" or "no reservation"; coalesce keeps the index keys stable.
CREATE UNIQUE INDEX IF NOT EXISTS payments_manual_ref_unique_per_order
  ON public.payments (
    coalesce(order_id::text, reservation_id::text, id::text),
    manual_reference
  )
  WHERE manual_claim_status IN ('claimed', 'verified')
    AND manual_reference IS NOT NULL;

COMMIT;
