-- =============================================================================
-- 0037_fix_admin_invite_acceptance.sql
-- Harden admin invitation acceptance for the service-role edge function.
--
-- Fixes the "Database error saving new user" failure by making the auth.users
-- trigger tolerate the edge-function fast path, ensuring expected profile
-- columns exist, and moving post-user creation writes into one transactional RPC.
-- =============================================================================

ALTER TABLE public.admin_profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.admin_invitations
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS public.admin_invitations_pending_email;
CREATE UNIQUE INDEX IF NOT EXISTS admin_invitations_pending_email
  ON public.admin_invitations (lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_hash text;
  v_invitation public.admin_invitations%ROWTYPE;
  v_has_super boolean;
  v_bypass boolean;
BEGIN
  INSERT INTO public.admin_profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), NEW.email),
    NEW.email,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(trim(EXCLUDED.full_name), ''), public.admin_profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.admin_profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.admin_profiles.phone);

  SELECT EXISTS (SELECT 1 FROM public.admin_roles WHERE role = 'super_admin')
    INTO v_has_super;

  IF NOT v_has_super THEN
    RETURN NEW;
  END IF;

  -- Service-role edge function path. The function has already validated the
  -- token and will assign the role + mark the invitation accepted after auth
  -- user creation succeeds.
  v_bypass := COALESCE((NEW.raw_user_meta_data ->> 'bypass_invite_check')::boolean, false);
  IF v_bypass THEN
    RETURN NEW;
  END IF;

  -- Manual/browser signup fallback remains invitation-gated.
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
    AND revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is invalid, revoked, or already used.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.admin_invitations
     SET accepted_at = now(), accepted_by = NEW.id
   WHERE id = v_invitation.id;

  INSERT INTO public.admin_roles (user_id, role)
  VALUES (NEW.id, v_invitation.role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_admin_invite_acceptance(
  _invitation_id uuid,
  _user_id uuid,
  _role public.admin_role,
  _full_name text,
  _email text,
  _phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invitation public.admin_invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_invitation
  FROM public.admin_invitations
  WHERE id = _invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_invitation.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has been revoked' USING ERRCODE = 'check_violation';
  END IF;

  IF v_invitation.accepted_at IS NOT NULL AND v_invitation.accepted_by IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Invitation has already been used' USING ERRCODE = 'unique_violation';
  END IF;

  IF lower(v_invitation.email) <> lower(_email) THEN
    RAISE EXCEPTION 'Invitation email does not match user email' USING ERRCODE = 'check_violation';
  END IF;

  IF v_invitation.role <> _role THEN
    RAISE EXCEPTION 'Invitation role does not match requested role' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.admin_profiles (id, full_name, email, phone)
  VALUES (
    _user_id,
    COALESCE(NULLIF(trim(_full_name), ''), _email),
    lower(_email),
    NULLIF(trim(COALESCE(_phone, '')), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(trim(EXCLUDED.full_name), ''), public.admin_profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.admin_profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.admin_profiles.phone);

  INSERT INTO public.admin_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT DO NOTHING;

  UPDATE public.admin_invitations
     SET accepted_at = COALESCE(accepted_at, now()), accepted_by = COALESCE(accepted_by, _user_id)
   WHERE id = _invitation_id;

  INSERT INTO public.admin_activity_log (admin_id, action, table_name, record_id, new_data)
  VALUES (
    _user_id,
    'invite_accepted',
    'admin_invitations',
    _invitation_id::text,
    jsonb_build_object('email', lower(_email), 'role', _role, 'accepted_at', now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_admin_invite_acceptance(uuid, uuid, public.admin_role, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_admin_invite_acceptance(uuid, uuid, public.admin_role, text, text, text) TO service_role;
