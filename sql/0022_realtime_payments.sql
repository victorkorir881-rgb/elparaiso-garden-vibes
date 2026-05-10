-- 0022_realtime_payments.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Enable Supabase Realtime for public.payments so the checkout UI receives
-- the M-Pesa callback result instantly (instead of waiting for the next 3s
-- poll). Polling stays as a fallback in case the realtime channel drops.
--
-- Same two requirements as 0021:
--   1. Table must be in the `supabase_realtime` publication.
--   2. REPLICA IDENTITY FULL so UPDATE payloads carry every column.
--
-- RLS is unchanged — anon already has column-scoped SELECT (id, status,
-- result_desc, mpesa_receipt_number, completed_at) via 0018.
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'payments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.payments';
  END IF;
END $$;
