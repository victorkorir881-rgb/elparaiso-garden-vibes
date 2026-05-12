-- 0031: allow each admin to update their own admin_profiles row.
-- Without this, the AdminProfile page can fail with "Failed to save profile"
-- when the broader admin-all policy is missing or the user's role lookup is
-- still hydrating. Idempotent — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'admin_profiles'
      AND policyname = 'admin_profiles_self_update'
  ) THEN
    CREATE POLICY "admin_profiles_self_update"
      ON public.admin_profiles
      FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;
