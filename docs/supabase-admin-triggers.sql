-- =============================================================
-- ElParaiso Admin Panel — Supplementary SQL
-- Run this in your Supabase SQL Editor AFTER the main schema
-- =============================================================

-- ─── 1. Ensure triggers exist on auth.users ─────────────────
-- These auto-create admin_profiles and assign super_admin to first user

-- Trigger: on new user signup → create admin profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: first admin profile → auto-assign super_admin
CREATE OR REPLACE FUNCTION public.handle_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_roles) THEN
    INSERT INTO public.admin_roles (user_id, role)
    VALUES (NEW.id, 'super_admin');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_first_admin_assignment ON public.admin_profiles;
CREATE TRIGGER on_first_admin_assignment
  AFTER INSERT ON public.admin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_first_admin();

-- ─── 2. Auto-update updated_at columns ──────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
      AND table_name NOT LIKE 'v_%'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I;
       CREATE TRIGGER update_%s_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─── 3. RLS policies insert for admin_profiles (allow trigger) ──

-- The handle_new_user trigger runs as SECURITY DEFINER so it
-- bypasses RLS. No additional policy needed for the trigger insert.
-- Users can read and update their own profile:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_profiles' AND policyname = 'Users read own profile'
  ) THEN
    CREATE POLICY "Users read own profile"
      ON public.admin_profiles FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_profiles' AND policyname = 'Users update own profile'
  ) THEN
    CREATE POLICY "Users update own profile"
      ON public.admin_profiles FOR UPDATE
      TO authenticated
      USING (id = auth.uid());
  END IF;
END;
$$;

-- ─── 4. Site URL for email confirmations ─────────────────────
-- In Supabase Dashboard → Authentication → URL Configuration:
--   Site URL: https://elparaisogardens.vercel.app
--   Redirect URLs: https://elparaisogardens.vercel.app/admin
--
-- This ensures the "Confirm your email" link redirects correctly.

-- ─── 5. Verify everything is in place ────────────────────────
-- Quick check queries:

-- Check triggers exist:
-- SELECT trigger_name, event_object_table FROM information_schema.triggers
-- WHERE trigger_schema = 'public' OR event_object_schema = 'auth';

-- Check admin_roles enum:
-- SELECT enum_range(NULL::admin_role);

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = true;
