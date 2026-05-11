-- 0025_payments_public_manual_claim.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Defensive re-apply of the `payments_public` view + anon column grants so
-- that polling from the checkout UI never breaks if migration 0024 was
-- skipped on a given environment. Symptom this fixes: customer pays
-- successfully, mpesa-callback updates payments.status='success', but the
-- UI stays on "Waiting for confirmation" because the polling query errored
-- on missing columns and never returned data.
--
-- Idempotent. Apply via Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

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

COMMIT;
