-- 0029_gallery_category_check_fix.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- The legacy schema (sql/0001_init.sql.legacy.bak) created
-- gallery_images.category with a CHECK constraint that limited values to
-- ('food','drinks','ambiance','events','team','general'). The current admin
-- UI uses a richer set of categories ("General", "Food & Drinks", "Ambience",
-- "Outdoor Seating", "Night Vibes", "Events", "Bar Area"), so every insert
-- fails on databases provisioned from the legacy schema with:
--   new row for relation "gallery_images" violates check constraint
--   "gallery_images_category_check"
--
-- Drop the legacy constraint (any name) so the current category list works.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  cons_name text;
BEGIN
  FOR cons_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.gallery_images'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.gallery_images DROP CONSTRAINT %I', cons_name);
  END LOOP;
END $$;
