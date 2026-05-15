-- =============================================================================
-- 0038_allow_customer_signup.sql
-- Allow public customer accounts to sign up.
--
-- Problem:
--   The handle_new_user() trigger treats every new auth.users row as an
--   admin signup. Customer signups (no invitation_token_hash, no
--   bypass_invite_check) hit the "Public registration is closed" branch
--   and Supabase returns "Database error saving new user".
--
-- Fix:
--   Detect customer signups at the very top of the trigger and short-circuit
--   cleanly. A customer signup is one that:
--     • is not the service-role bypass path, AND
--     • has no invitation_token_hash in metadata, AND
--     • a super_admin already exists (so we are past the bootstrap window)
--
--   For customer signups we do NOTHING — no admin_profiles row, no role,
--   no invitation lookup. The auth.users row is created and that's it.
--
--   Admin logic is unchanged: invite-with-token and service-role bypass
--   paths still behave exactly as in 0037.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_hash text;
  v_invitation public.admin_invitations%ROWTYPE;
  v_has_super  boolean;
  v_bypass     boolean;
BEGIN
  v_bypass     := COALESCE((NEW.raw_user_meta_data ->> 'bypass_invite_check')::boolean, false);
  v_token_hash := NEW.raw_user_meta_data ->> 'invitation_token_hash';

  SELECT EXISTS (SELECT 1 FROM public.admin_roles WHERE role = 'super_admin')
    INTO v_has_super;

  -- Customer signup: no admin signal at all, and bootstrap is already done.
  -- Leave auth.users alone and exit. No admin tables touched.
  IF v_has_super
     AND NOT v_bypass
     AND (v_token_hash IS NULL OR length(v_token_hash) < 32)
  THEN
    RETURN NEW;
  END IF;

  -- ---- Admin paths below — identical to 0037 ----------------------------
  INSERT INTO public.admin_profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), NEW.email),
    NEW.email,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(trim(EXCLUDED.full_name), ''), public.admin_profiles.full_name),
    email     = COALESCE(EXCLUDED.email, public.admin_profiles.email),
    phone     = COALESCE(EXCLUDED.phone, public.admin_profiles.phone);

  -- Bootstrap: very first user becomes super_admin elsewhere (handle_first_admin).
  IF NOT v_has_super THEN
    RETURN NEW;
  END IF;

  -- Service-role edge function path.
  IF v_bypass THEN
    RETURN NEW;
  END IF;

  -- Manual invite acceptance.
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
