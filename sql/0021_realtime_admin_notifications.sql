-- 0021_realtime_admin_notifications.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Enable Supabase Realtime broadcasts for the four public-facing tables the
-- admin dashboard listens to:
--   • reservation_leads — new reservations
--   • contact_messages  — new contact form submissions
--   • orders            — new food orders
--   • reviews           — new public testimonials
--
-- Two things have to happen for the JS realtime channel to receive change
-- events for a table:
--   1. The table must be a member of the `supabase_realtime` publication.
--   2. REPLICA IDENTITY must be set so UPDATE/DELETE payloads include the
--      old row (we use FULL so we get every column on every event).
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- REPLICA IDENTITY FULL — needed so realtime payloads include all columns,
-- which lets the admin client filter (e.g. by status) without an extra fetch.
ALTER TABLE public.reservation_leads REPLICA IDENTITY FULL;
ALTER TABLE public.contact_messages  REPLICA IDENTITY FULL;
ALTER TABLE public.orders            REPLICA IDENTITY FULL;
ALTER TABLE public.reviews           REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication. Wrapped in DO blocks so
-- the migration is idempotent: ALTER PUBLICATION ... ADD TABLE errors if
-- the table is already a member.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reservation_leads'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_leads';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contact_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_messages';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reviews'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews';
  END IF;
END $$;
