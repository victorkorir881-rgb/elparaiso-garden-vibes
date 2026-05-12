-- 0030_order_state_machine_relaxed.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Relax the order status state machine introduced in
-- sql/0006_order_state_machine.sql. Admins frequently need to skip steps
-- (e.g. mark a pending order directly as `ready` for dine-in, or jump
-- straight to `out-for-delivery`). The strict next-step graph forced extra
-- clicks and made the per-order dropdown only show 1-2 options.
--
-- New rule:
--   * From any non-terminal status (pending, preparing, ready,
--     out-for-delivery) the order may move to ANY other non-terminal
--     status, OR to `completed`, OR to `cancelled`.
--   * Terminal statuses (completed, cancelled) remain terminal.
--   * Completing an `unpaid` order is still forbidden — cash orders must
--     be marked paid first; mpesa flips to paid via the callback.
--   * payment_status transitions are unchanged.
--
-- Idempotent + transactional. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_order_state_machine()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  active_states   text[] := ARRAY['pending','preparing','ready','out-for-delivery'];
  allowed_status  text[];
  allowed_payment text[];
BEGIN
  NEW.updated_at := now();

  -- ── status transitions ──────────────────────────────────────────────
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = ANY(active_states) THEN
      -- Any active state can move to any other active state, or to a terminal one.
      allowed_status := active_states || ARRAY['completed','cancelled'];
    ELSE
      -- Terminal states are frozen.
      allowed_status := ARRAY[]::text[];
    END IF;

    IF NOT (NEW.status = ANY(allowed_status)) THEN
      RAISE EXCEPTION
        'Invalid order status transition: % → % (allowed: %)',
        OLD.status, NEW.status, allowed_status
        USING ERRCODE = 'check_violation';
    END IF;

    -- Cannot complete an unpaid order
    IF NEW.status = 'completed' AND NEW.payment_status = 'unpaid' THEN
      RAISE EXCEPTION
        'Cannot mark order % as completed while payment_status is unpaid',
        NEW.order_number
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- ── payment_status transitions (unchanged) ──────────────────────────
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    allowed_payment := CASE OLD.payment_status
      WHEN 'unpaid'   THEN ARRAY['paid','refunded']
      WHEN 'paid'     THEN ARRAY['refunded']
      WHEN 'refunded' THEN ARRAY[]::text[]
      ELSE ARRAY[]::text[]
    END;

    IF NOT (NEW.payment_status = ANY(allowed_payment)) THEN
      RAISE EXCEPTION
        'Invalid payment_status transition: % → % (allowed: %)',
        OLD.payment_status, NEW.payment_status, allowed_payment
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already created in 0006; recreate defensively.
DROP TRIGGER IF EXISTS trg_orders_state_machine ON public.orders;
CREATE TRIGGER trg_orders_state_machine
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_state_machine();

COMMIT;
