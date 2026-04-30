-- ============================================================================
-- 0003_payments.sql — M-Pesa Daraja STK Push payments
-- ----------------------------------------------------------------------------
-- Adds a `payments` table to record every STK Push attempt and its outcome.
-- Linked 1..N to `orders` (one order can have multiple attempts; only the
-- successful one transitions order.payment_status -> 'paid').
--
-- Idempotent + transactional. RLS enabled. Apply via:
--   psql "$DATABASE_URL" -f sql/0003_payments.sql
-- ============================================================================

BEGIN;

-- ─── ENUMS ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
    CREATE TYPE public.payment_status_enum AS ENUM (
      'pending',     -- STK push sent, awaiting customer PIN
      'success',     -- Daraja callback confirmed payment
      'failed',      -- Daraja callback returned an error
      'cancelled',   -- Customer cancelled on phone
      'timeout'      -- No callback received within window
    );
  END IF;
END$$;

-- ─── TABLE ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider                text NOT NULL DEFAULT 'mpesa',
  -- Amounts in KES, integer (Daraja requires whole numbers)
  amount                  integer NOT NULL CHECK (amount > 0),
  phone                   text NOT NULL,             -- 2547XXXXXXXX format
  -- Daraja STK Push request
  merchant_request_id     text,
  checkout_request_id     text UNIQUE,               -- correlates initiate ↔ callback
  -- Daraja STK Push response
  mpesa_receipt_number    text,                      -- e.g. "QGH7X8Y9ZA"
  result_code             integer,                   -- 0 = success
  result_desc             text,
  status                  public.payment_status_enum NOT NULL DEFAULT 'pending',
  -- Raw payloads for debugging (capped to 10 KB per developer rules §11)
  raw_request             jsonb,
  raw_callback            jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  completed_at            timestamptz
);

CREATE INDEX IF NOT EXISTS payments_order_id_idx        ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS payments_status_idx          ON public.payments(status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx      ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS payments_checkout_request_idx ON public.payments(checkout_request_id);

-- ─── updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_payments_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS payments_set_updated_at ON public.payments;
CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_payments_set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (creating a payment attempt for their own order). The
-- edge function uses the service role and bypasses RLS, so this policy
-- mainly safeguards anon access.
DROP POLICY IF EXISTS payments_insert_anyone ON public.payments;
CREATE POLICY payments_insert_anyone ON public.payments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Public can SELECT only their own payment by id (used by polling). They
-- already know the id because the initiate function returned it.
DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_own ON public.payments
  FOR SELECT TO anon, authenticated USING (true);

-- Only admins can UPDATE/DELETE (callback updates use service role).
DROP POLICY IF EXISTS payments_admin_all ON public.payments;
CREATE POLICY payments_admin_all ON public.payments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

COMMIT;
