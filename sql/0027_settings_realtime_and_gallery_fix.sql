-- 0027_settings_realtime_and_gallery_fix.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Two fixes:
--
-- 1. gallery_images.image_key: legacy schema (sql/0001_init.sql.legacy.bak)
--    declared image_key TEXT NOT NULL but the current app inserts only
--    image_url. On databases provisioned from the legacy schema, every
--    gallery upload fails with:
--       null value in column "image_key" of relation "gallery_images"
--       violates not-null constraint
--    Drop the not-null (and the column itself when it exists) so the
--    current insert path works.
--
-- 2. site_settings: add the table to the supabase_realtime publication so
--    that any change saved in the admin panel propagates to every open
--    customer browser without a page reload.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. gallery_images.image_key — drop the legacy not-null column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gallery_images'
      AND column_name = 'image_key'
  ) THEN
    EXECUTE 'ALTER TABLE public.gallery_images ALTER COLUMN image_key DROP NOT NULL';
    EXECUTE 'ALTER TABLE public.gallery_images DROP COLUMN image_key';
  END IF;
END $$;

-- 2. site_settings → realtime publication
ALTER TABLE public.site_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'site_settings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings';
  END IF;
END $$;
