-- ============================================================================
-- 0009_reservation_conflicts.sql
-- ----------------------------------------------------------------------------
-- Phase 6.5 — reservation conflict detection (anti double-booking)
--
-- Goals:
--   1. Block duplicate reservations from the same phone for the same
--      date+time slot while still pending/confirmed.
--   2. Cap concurrent reservations per (date, time) slot so the venue
--      isn't oversold beyond a configurable max-per-slot threshold.
--      Threshold is read from public.business_rules
--      (rule_key = 'reservations.max_per_slot') with a default of 6 if
--      the rule isn't set.
--
-- Cancelled / completed / no_show reservations don't count toward the cap.
-- Admins can still force-insert via UPDATE if business_rules adjusts.
--
-- Idempotent and safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Helper: read max-per-slot from business_rules (with sane default)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservations_max_per_slot()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _val integer;
BEGIN
  -- business_rules table may store JSON, text, or be absent in older DBs.
  BEGIN
    SELECT (rule_value)::integer INTO _val
    FROM public.business_rules
    WHERE rule_key = 'reservations.max_per_slot'
      AND COALESCE(is_active, true) = true
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    _val := NULL;
  END;
  RETURN COALESCE(_val, 6);
END;
$$;

-- ----------------------------------------------------------------------------
-- Trigger function: enforce no-double-book + slot cap
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservations_prevent_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _dup_count   integer;
  _slot_count  integer;
  _slot_max    integer;
BEGIN
  -- Only enforce when date AND time are both set. Walk-in / open-ended
  -- requests (date OR time NULL) bypass slot logic.
  IF NEW.date IS NULL OR NEW.time IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip enforcement when admin moves a reservation to a terminal state.
  IF TG_OP = 'UPDATE' AND NEW.status IN ('cancelled','no_show','completed') THEN
    RETURN NEW;
  END IF;

  -- 1. Block same phone double-booking the same slot (active statuses only)
  SELECT count(*) INTO _dup_count
  FROM public.reservation_leads r
  WHERE r.phone  = NEW.phone
    AND r.date   = NEW.date
    AND r.time   = NEW.time
    AND r.status IN ('pending','confirmed')
    AND (TG_OP = 'INSERT' OR r.id <> NEW.id);

  IF _dup_count > 0 THEN
    RAISE EXCEPTION
      'You already have a reservation for % at %. Please call us if you need to change it.',
      NEW.date, NEW.time
      USING ERRCODE = 'P0001',
            HINT    = 'duplicate_reservation';
  END IF;

  -- 2. Slot capacity cap
  _slot_max := public.reservations_max_per_slot();

  SELECT count(*) INTO _slot_count
  FROM public.reservation_leads r
  WHERE r.date   = NEW.date
    AND r.time   = NEW.time
    AND r.status IN ('pending','confirmed')
    AND (TG_OP = 'INSERT' OR r.id <> NEW.id);

  IF _slot_count >= _slot_max THEN
    RAISE EXCEPTION
      'The % slot on % is fully booked. Please pick a different time.',
      NEW.time, NEW.date
      USING ERRCODE = 'P0001',
            HINT    = 'slot_full';
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Wire up the trigger (drop+create so re-runs replace cleanly)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_reservations_prevent_conflicts ON public.reservation_leads;

CREATE TRIGGER trg_reservations_prevent_conflicts
  BEFORE INSERT OR UPDATE OF date, time, phone, status
  ON public.reservation_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.reservations_prevent_conflicts();

COMMENT ON FUNCTION public.reservations_prevent_conflicts() IS
  'Phase 6.5: blocks duplicate-phone bookings of the same slot and enforces business_rules-driven slot capacity (default 6).';

COMMIT;
