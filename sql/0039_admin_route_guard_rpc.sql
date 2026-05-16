-- ============================================================================
-- 0039 — Server-side admin route guard RPC
--
-- Adds public.get_current_admin_role(), a SECURITY DEFINER function that
-- returns the calling user's admin role from public.admin_roles, or NULL if
-- the caller is not authenticated or has no admin role.
--
-- This is the authoritative server-side check used by the /admin/* route
-- guard. Because it runs SECURITY DEFINER with a locked search_path, it does
-- not depend on RLS on admin_roles being correct — even if that policy is
-- ever loosened, this function still returns only the caller's own role.
--
-- Idempotent — safe to re-run.
-- ============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.get_current_admin_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
    FROM public.admin_roles
   WHERE user_id = auth.uid()
   ORDER BY CASE role::text
              WHEN 'super_admin' THEN 1
              WHEN 'admin'       THEN 2
              WHEN 'manager'     THEN 3
              WHEN 'staff'       THEN 4
              ELSE 99
            END
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_current_admin_role() FROM public;
GRANT EXECUTE ON FUNCTION public.get_current_admin_role() TO authenticated;

COMMENT ON FUNCTION public.get_current_admin_role() IS
  'Returns the calling user''s highest admin role, or NULL. Used by the /admin/* route guard as the authoritative server-side admin check.';

COMMIT;
