-- =============================================================================
-- 0004_admin_auth_triggers.sql
-- Creates the handle_new_user() and handle_first_admin() functions and wires
-- them up to auth.users so that:
--   1. Every new signup gets an admin_profiles row (full_name + email).
--   2. The very first user to sign up is granted the 'super_admin' role.
--
-- Run this in your Supabase SQL editor (uses the postgres role, which has
-- privileges on the auth schema).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Functions
-- -----------------------------------------------------------------------------

-- Create admin_profiles row whenever a new auth user is inserted.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Grant super_admin to the first signup; no-op for subsequent users.
CREATE OR REPLACE FUNCTION public.handle_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_roles) THEN
    INSERT INTO public.admin_roles (user_id, role)
    VALUES (NEW.id, 'super_admin');
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Triggers (idempotent)
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_first_admin_assignment ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_first_admin_assignment
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_first_admin();

-- =============================================================================
-- Optional backfill: if you already have users in auth.users that predate
-- these triggers, uncomment the block below to backfill profiles + role.
-- =============================================================================
-- INSERT INTO public.admin_profiles (id, full_name, email)
-- SELECT u.id,
--        COALESCE(u.raw_user_meta_data ->> 'full_name', u.email),
--        u.email
-- FROM auth.users u
-- LEFT JOIN public.admin_profiles p ON p.id = u.id
-- WHERE p.id IS NULL;
--
-- INSERT INTO public.admin_roles (user_id, role)
-- SELECT u.id, 'super_admin'::admin_role
-- FROM auth.users u
-- WHERE NOT EXISTS (SELECT 1 FROM public.admin_roles)
-- ORDER BY u.created_at ASC
-- LIMIT 1;
