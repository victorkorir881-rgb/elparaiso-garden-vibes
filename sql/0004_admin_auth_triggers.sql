-- =============================================================================
-- 0004_admin_auth_triggers.sql
-- Wires up the existing handle_new_user() and handle_first_admin() functions
-- to auth.users so that:
--   1. Every new signup gets an admin_profiles row (full_name + email).
--   2. The very first user to sign up is granted the 'super_admin' role.
--
-- Run this in your Supabase SQL editor (it must be run by a role with
-- privileges on the auth schema — the SQL editor uses the postgres role,
-- which is fine).
-- =============================================================================

-- Safety: drop any pre-existing versions so the script is idempotent.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_first_admin_assignment ON auth.users;

-- 1. Create admin_profiles row on every new signup.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 2. Grant super_admin to the first signup (no-op for subsequent users).
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
