-- ============================================================================
-- 0012_reservation_deposits.sql — Phase 7.4b
-- ----------------------------------------------------------------------------
-- Allows a `payments` row to be linked to either an order OR a reservation
-- (mutually exclusive). Adds optional deposit tracking on reservation_leads
-- and a `reservation_deposit_amount` site setting (KES, integer).
--
-- Idempotent + transactional. Apply via:
--   psql "$DATABASE_URL" -f sql/0012_reservation_deposits.sql
-- ============================================================================

BEGIN;

-- ─── payments: relax order_id, add reservation_id ───────────────────────────
ALTER TABLE public.payments
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS reservation_id uuid
    REFERENCES public.reservation_leads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS payments_reservation_id_idx
  ON public.payments(reservation_id);

-- Exactly one of (order_id, reservation_id) must be set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_target_xor_chk'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_target_xor_chk
      CHECK (
        (order_id IS NOT NULL)::int + (reservation_id IS NOT NULL)::int = 1
      );
  END IF;
END$$;

-- ─── reservation_leads: deposit columns ─────────────────────────────────────
ALTER TABLE public.reservation_leads
  ADD COLUMN IF NOT EXISTS deposit_amount  integer
    CHECK (deposit_amount IS NULL OR deposit_amount > 0);

ALTER TABLE public.reservation_leads
  ADD COLUMN IF NOT EXISTS deposit_status  text
    NOT NULL DEFAULT 'unpaid'
    CHECK (deposit_status IN ('unpaid','paid','waived'));

CREATE INDEX IF NOT EXISTS reservations_deposit_status_idx
  ON public.reservation_leads(deposit_status);

-- ─── site_settings: default deposit amount ──────────────────────────────────
-- 0 = no deposit required. Owner can change in Admin → Settings.
INSERT INTO public.site_settings (key, value, category)
VALUES ('reservation_deposit_amount', '0', 'reservations')
ON CONFLICT (key) DO NOTHING;

COMMIT;
