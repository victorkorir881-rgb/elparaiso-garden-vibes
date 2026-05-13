-- =============================================================================
-- 0032_invite_audit_view.sql
-- Read-only view that unifies the invitation audit trail:
--   * invite_sent      — from admin_activity_log (action='invite_sent')
--   * invite_accepted  — from admin_activity_log (action='invite_accepted')
--   * invite_expired   — synthesized from admin_invitations rows whose
--                        expires_at < now() and accepted_at IS NULL.
--                        No background job required.
--
-- Admin-only access enforced via the underlying tables' RLS, plus a
-- security_invoker view so callers' privileges (not the view owner's) apply.
-- =============================================================================

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
  WHERE l.action IN ('invite_sent', 'invite_accepted')
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
    AND i.expires_at < now()
)
SELECT * FROM logged
UNION ALL
SELECT * FROM expired;

GRANT SELECT ON public.v_invite_audit TO authenticated;
