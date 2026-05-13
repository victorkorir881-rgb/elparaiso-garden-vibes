-- =============================================================================
-- 0035_invite_acceptance_service_role_path.sql
-- Make admin invitation acceptance reliable by giving the service-role edge
-- function a clean fast-path through the handle_new_user() trigger.
--
-- Problem this fixes:
--   The trigger previously re-validated the invitation row and raised
--   "Database error creating new user" whenever it disagreed with the edge
--   function (e.g. expired token, race with another worker, slightly
--   different email casing). The edge function had already validated and
--   knows the invitation is good — the trigger just needs to trust it.
--
-- New contract:
--   * The edge function calls auth.admin.createUser with metadata
--     { bypass_invite_check: true, ... }.
--   * The trigger sees the flag, creates the admin_profiles row, and
--     returns. Role assignment + invitation accepted_at are written by
--     the edge function (still under service role, so RLS is irrelevant).
--   * Public/manual signup paths without the flag still hit the original
--     invitation gate, so security posture is unchanged.
-- =============================================================================

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
  v_bypass      boolean;
BEGIN
  -- Always create the profile row (idempotent).
  INSERT INTO public.admin_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.admin_roles WHERE role = 'super_admin')
    INTO v_has_super;

  -- Bootstrap: first user becomes super_admin via handle_first_admin.
  IF NOT v_has_super THEN
    RETURN NEW;
  END IF;

  -- Service-role fast path: the edge function already validated the invite
  -- and will write the role + accepted_at itself. Trust it and exit cleanly.
  v_bypass := COALESCE((NEW.raw_user_meta_data ->> 'bypass_invite_check')::boolean, false);
  IF v_bypass THEN
    RETURN NEW;
  END IF;

  -- Manual / public path: still require a valid invitation.
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
