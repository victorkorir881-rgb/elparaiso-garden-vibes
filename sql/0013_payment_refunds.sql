-- ============================================================================
-- 0013_payment_refunds.sql — Phase 7.5 Daraja Reversal API refunds
-- ----------------------------------------------------------------------------
-- Tracks refund attempts on a successful payment. A payment may be reversed
-- once via the Daraja Reversal API; we store the reversal request id and
-- final status. The original payment row stays as-is (status='success') so
-- reconciliation history is preserved; refund_status reflects the reversal.
--
-- Idempotent + transactional. Apply via:
--   psql "$DATABASE_URL" -f sql/0013_payment_refunds.sql
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status_enum') THEN
    CREATE TYPE public.refund_status_enum AS ENUM (
      'none',         -- never refunded
      'pending',      -- reversal request sent, awaiting Daraja result callback
      'refunded',     -- Daraja confirmed reversal
      'failed'        -- Daraja rejected reversal
    );
  END IF;
END$$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS refund_status        public.refund_status_enum NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_amount        integer,
  ADD COLUMN IF NOT EXISTS refund_reason        text,
  ADD COLUMN IF NOT EXISTS refund_requested_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_request_id    text UNIQUE,    -- Daraja ConversationID
  ADD COLUMN IF NOT EXISTS refund_result_code   integer,
  ADD COLUMN IF NOT EXISTS refund_result_desc   text,
  ADD COLUMN IF NOT EXISTS refund_raw_callback  jsonb,
  ADD COLUMN IF NOT EXISTS refunded_at          timestamptz;

CREATE INDEX IF NOT EXISTS payments_refund_status_idx ON public.payments(refund_status);

COMMIT;
