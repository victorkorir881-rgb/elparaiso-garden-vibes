-- 0026_realtime_admin_extended.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Extend the supabase_realtime publication so the admin panel auto-refreshes
-- list views the instant any row changes — without the admin hitting reload.
--
-- Already in the publication (via 0021/0022):
--   reservation_leads, contact_messages, orders, reviews, payments
--
-- Added here:
--   menu_items, menu_categories, events, gallery_images
--
-- REPLICA IDENTITY FULL is set so UPDATE/DELETE payloads carry every column,
-- which lets the client filter without an extra fetch.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.menu_items      REPLICA IDENTITY FULL;
ALTER TABLE public.menu_categories REPLICA IDENTITY FULL;
ALTER TABLE public.events          REPLICA IDENTITY FULL;
ALTER TABLE public.gallery_images  REPLICA IDENTITY FULL;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['menu_items','menu_categories','events','gallery_images']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
