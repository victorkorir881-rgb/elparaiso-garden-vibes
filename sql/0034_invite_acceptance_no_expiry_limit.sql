-- =============================================================================
-- 0034_invite_acceptance_no_expiry_limit.sql
-- Remove the hard expiry blocker from admin invitation acceptance.
--
-- Invitations remain single-use and revocable, but an invited user can still
-- complete setup after the suggested follow-up date instead of being blocked.
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
BEGIN
  INSERT INTO public.admin_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.admin_roles WHERE role = 'super_admin')
    INTO v_has_super;

  IF NOT v_has_super THEN
    RETURN NEW;
  END IF;

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