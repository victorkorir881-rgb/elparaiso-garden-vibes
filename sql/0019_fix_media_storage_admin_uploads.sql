-- 0019_fix_media_storage_admin_uploads.sql
-- Fix admin media uploads after the admin role helper was standardized.
-- Apply manually in Supabase SQL Editor. Idempotent; no data is changed.

BEGIN;

-- Ensure the shared media bucket exists and remains public-read for website images.
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Replace the old storage write policies that referenced public.is_admin_user().
DROP POLICY IF EXISTS media_public_read ON storage.objects;
DROP POLICY IF EXISTS media_admin_insert ON storage.objects;
DROP POLICY IF EXISTS media_admin_update ON storage.objects;
DROP POLICY IF EXISTS media_admin_delete ON storage.objects;

CREATE POLICY media_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'media');

CREATE POLICY media_admin_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.is_admin(auth.uid()));

CREATE POLICY media_admin_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'media' AND public.is_admin(auth.uid()));

CREATE POLICY media_admin_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'media' AND public.is_admin(auth.uid()));

COMMIT;