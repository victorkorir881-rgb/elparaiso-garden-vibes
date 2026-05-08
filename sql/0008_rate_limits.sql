-- ============================================================================
-- 0008_rate_limits.sql
-- ----------------------------------------------------------------------------
-- Phase 5.5 — DB-enforced rate limiting for public mutation endpoints
--
-- Strategy:
--   A single `rate_limit_hits` table records every attempt keyed by an
--   arbitrary string (typically "<action>:<identifier>" — e.g.
--   "contact_submit:<email>" or "reservation_create:<phone>"). A SECURITY
--   DEFINER function `check_rate_limit(_key, _max, _window_seconds)` enforces
--   "no more than _max attempts per rolling _window_seconds window" and
--   raises an exception (SQLSTATE 'P0001') when the limit is exceeded.
--
--   Why a function (not a trigger):
--     - Callable via `supabase.rpc('check_rate_limit', ...)` from the
--       browser (anon key + RLS, but the function is SECURITY DEFINER so it
--       can read/write the table even though anon has no direct grants).
--     - Callable from within other triggers / functions for server-side
--       enforcement on top of client checks.
--
-- Idempotent and safe to re-run.
-- ============================================================================

BEGIN;

-- 1. Hits table
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id          bigserial PRIMARY KEY,
  key         text        NOT NULL,
  hit_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_key_time
  ON public.rate_limit_hits (key, hit_at DESC);

-- Lock the table down: no one talks to it directly. All access goes through
-- the SECURITY DEFINER function below.
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rate_limit_hits_no_access ON public.rate_limit_hits;
-- (Intentionally NO policy — RLS on with no policy = deny all for non-owners.)

REVOKE ALL ON public.rate_limit_hits FROM PUBLIC, anon, authenticated;

-- 2. The enforcement function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key             text,
  _max             integer,
  _window_seconds  integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  -- Sanity bounds (defense against accidental "infinite" limits)
  IF _key IS NULL OR length(_key) = 0 OR length(_key) > 200 THEN
    RAISE EXCEPTION 'invalid rate limit key' USING ERRCODE = '22023';
  END IF;
  IF _max IS NULL OR _max < 1 OR _max > 10000 THEN
    RAISE EXCEPTION 'invalid rate limit max' USING ERRCODE = '22023';
  END IF;
  IF _window_seconds IS NULL OR _window_seconds < 1 OR _window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid rate limit window' USING ERRCODE = '22023';
  END IF;

  -- Count hits inside the rolling window
  SELECT count(*) INTO _count
  FROM public.rate_limit_hits
  WHERE key = _key
    AND hit_at > now() - make_interval(secs => _window_seconds);

  IF _count >= _max THEN
    RAISE EXCEPTION 'rate limit exceeded: % attempts in % seconds (max %)',
      _count, _window_seconds, _max
      USING ERRCODE = 'P0001',
            HINT    = 'Please wait before trying again.';
  END IF;

  -- Record this attempt
  INSERT INTO public.rate_limit_hits (key) VALUES (_key);

  -- Opportunistic cleanup of old rows (best-effort; don't fail the request)
  BEGIN
    DELETE FROM public.rate_limit_hits
    WHERE hit_at < now() - interval '1 day';
  EXCEPTION WHEN OTHERS THEN
    -- ignore cleanup errors
    NULL;
  END;
END;
$$;

-- Allow anon + authenticated to *call* the function (function body runs as
-- definer / table owner so the function can read+write the locked table).
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer)
  TO anon, authenticated;

COMMENT ON FUNCTION public.check_rate_limit(text, integer, integer) IS
  'Phase 5.5 rate limiter. Raises P0001 when _max attempts have been recorded for _key within the last _window_seconds. Caller picks key shape: "<action>:<identifier>".';

COMMIT;
