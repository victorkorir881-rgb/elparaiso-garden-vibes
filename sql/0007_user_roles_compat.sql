-- ============================================================================
-- 0007_user_roles_compat.sql
-- ----------------------------------------------------------------------------
-- Phase 5.2 / 5.3 — Lovable-convention `user_roles` + `has_role()` compat layer
--
-- Background:
--   The schema baseline (0001_init.sql) already follows the security best
--   practice that roles MUST live in a dedicated table, separate from the
--   profile, accessed exclusively through SECURITY DEFINER helpers so RLS
--   policies cannot recurse:
--
--     - public.admin_role        ENUM ('super_admin','admin','manager','staff')
--     - public.admin_roles       (user_id uuid, role admin_role)
--     - public.has_admin_role()  SECURITY DEFINER, STABLE, search_path=public
--     - public.is_admin()        SECURITY DEFINER, STABLE, search_path=public
--
--   Every RLS policy in 0001 already uses public.is_admin(auth.uid()), so
--   the privilege-escalation risk described in the Lovable docs is already
--   mitigated. There is no role column on profiles.
--
-- What this migration adds:
--   A thin compatibility layer that exposes the canonical Lovable names
--   (`app_role` enum + `public.has_role(uuid, app_role)` function + a
--   read-only `user_roles` view) so future scaffolding, AI codegen, and
--   shared snippets that target the convention work unchanged.
--
-- Idempotent and safe to re-run.
-- ============================================================================

BEGIN;

-- 1. Lovable-convention enum (mirrors public.admin_role values 1:1)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'manager', 'staff');
  END IF;
END$$;

-- 2. Read-only view that mirrors admin_roles under the conventional name.
--    Writes still go through admin_roles directly (admin UI already targets it).
CREATE OR REPLACE VIEW public.user_roles AS
  SELECT
    id,
    user_id,
    role::text::public.app_role AS role
  FROM public.admin_roles;

COMMENT ON VIEW public.user_roles IS
  'Lovable-convention alias for public.admin_roles. Read-only; writes go through admin_roles.';

-- 3. has_role(uuid, app_role) — convention helper, delegates to has_admin_role.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_admin_role(_user_id, _role::text::public.admin_role);
$$;

COMMENT ON FUNCTION public.has_role(uuid, public.app_role) IS
  'Lovable-convention alias for has_admin_role. SECURITY DEFINER, RLS-safe.';

COMMIT;
