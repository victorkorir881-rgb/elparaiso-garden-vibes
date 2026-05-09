-- =============================================================================
-- 0015_admin_invitations.sql
-- Invitation-only admin onboarding.
--
-- Flow:
--   1. The very first user to sign up (no super_admin yet) becomes super_admin
--      via the existing handle_first_admin trigger from 0004.
--   2. After a super_admin exists, ALL further auth.users inserts must come
--      from a valid pending invitation. The handle_new_user trigger validates
--      raw_user_meta_data ->> 'invitation_token_hash' against an unaccepted,
--      non-expired row in admin_invitations. On success it stamps accepted_at
--      and inserts the invited role into admin_roles. On failure it raises.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  role         public.admin_role NOT NULL DEFAULT 'staff',
  token_hash   text NOT NULL,
  invited_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at  timestamptz,
  accepted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- One outstanding invitation per email at a time.
CREATE UNIQUE INDEX IF NOT EXISTS admin_invitations_pending_email
  ON public.admin_invitations (lower(email))
  WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS admin_invitations_token_hash
  ON public.admin_invitations (token_hash);

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

-- Only admins read/write via the app. The edge functions use the service role,
-- which bypasses RLS, so no public policy is needed.
DROP POLICY IF EXISTS admin_invitations_admin_all ON public.admin_invitations;
CREATE POLICY admin_invitations_admin_all
  ON public.admin_invitations
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ─── Public RPC: does a super_admin already exist? ──────────────────────────
-- Used by the login page to hide the public registration tab once setup is
-- complete.
CREATE OR REPLACE FUNCTION public.has_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles WHERE role = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_super_admin() TO anon, authenticated;

-- ─── Replace handle_new_user: enforce invitation gate ────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_hash  text;
  v_invitation  public.admin_invitations%ROWTYPE;
  v_has_super   boolean;
BEGIN
  -- Always create the profile row.
  INSERT INTO public.admin_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.admin_roles WHERE role = 'super_admin')
    INTO v_has_super;

  -- First-ever user: handle_first_admin will assign super_admin. Allow.
  IF NOT v_has_super THEN
    RETURN NEW;
  END IF;

  -- After bootstrap: require a valid invitation.
  v_token_hash := NEW.raw_user_meta_data ->> 'invitation_token_hash';
  IF v_token_hash IS NULL OR length(v_token_hash) < 32 THEN
    RAISE EXCEPTION 'Public registration is closed. An invitation is required.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_invitation
  FROM public.admin_invitations
  WHERE token_hash = v_token_hash
    AND lower(email) = lower(NEW.email)
    AND accepted_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, or already used.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Stamp invitation and grant the invited role.
  UPDATE public.admin_invitations
     SET accepted_at = now(), accepted_by = NEW.id
   WHERE id = v_invitation.id;

  INSERT INTO public.admin_roles (user_id, role)
  VALUES (NEW.id, v_invitation.role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
