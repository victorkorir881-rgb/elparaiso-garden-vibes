-- =============================================================================
-- 0033_invitation_revocation.sql
-- Adds explicit revocation support for admin invitations.
--
-- Changes:
--   1. admin_invitations gains revoked_at + revoked_by columns.
--   2. handle_new_user() now rejects revoked invitations (in addition to
--      already-accepted / expired ones).
--   3. The pending-email uniqueness index excludes revoked rows so a fresh
--      invitation can be issued after revocation.
--   4. v_invite_audit gains an invite_revoked event sourced directly from
--      admin_invitations (exact timestamp), and excludes revoked rows from
--      the synthesized "expired" stream so they don't show up twice.
--      The view also surfaces invite_revoked rows from admin_activity_log
--      to keep actor attribution consistent across event types.
-- =============================================================================

ALTER TABLE public.admin_invitations
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Recreate the pending uniqueness index to also exclude revoked rows.
DROP INDEX IF EXISTS public.admin_invitations_pending_email;
CREATE UNIQUE INDEX admin_invitations_pending_email
  ON public.admin_invitations (lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- Update handle_new_user to honour revoked_at.
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
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, revoked, or already used.'
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

-- Refresh v_invite_audit: include revoked, exclude revoked-as-expired duplicates.
CREATE OR REPLACE VIEW public.v_invite_audit
WITH (security_invoker = true) AS
WITH logged AS (
  SELECT
    l.id::text                                            AS id,
    l.created_at                                          AS event_at,
    l.action                                              AS event,
    COALESCE(l.new_data->>'email', l.old_data->>'email')  AS email,
    COALESCE(l.new_data->>'role',  l.old_data->>'role')   AS role,
    l.record_id                                           AS invitation_id,
    l.admin_id                                            AS actor_id,
    l.new_data                                            AS details
  FROM public.admin_activity_log l
  WHERE l.action IN ('invite_sent', 'invite_accepted', 'invite_revoked')
),
expired AS (
  SELECT
    ('expired:' || i.id::text)        AS id,
    i.expires_at                      AS event_at,
    'invite_expired'::text            AS event,
    i.email                           AS email,
    i.role::text                      AS role,
    i.id::text                        AS invitation_id,
    i.invited_by                      AS actor_id,
    jsonb_build_object(
      'email', i.email,
      'role',  i.role,
      'expired_at', i.expires_at
    )                                 AS details
  FROM public.admin_invitations i
  WHERE i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at < now()
)
SELECT * FROM logged
UNION ALL
SELECT * FROM expired;

GRANT SELECT ON public.v_invite_audit TO authenticated;
