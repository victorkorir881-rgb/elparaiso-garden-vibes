-- ============================================================================
-- 0006_order_state_machine.sql — Enforce valid order/payment status transitions
-- ----------------------------------------------------------------------------
-- Phase 6.4 of the project plan. Adds a BEFORE UPDATE trigger on
-- public.orders that:
--   * Rejects status transitions outside the allowed graph
--   * Rejects payment_status transitions outside the allowed graph
--   * Forbids marking an order `completed` while it is still `unpaid`
--     (cash orders must be marked `paid` first; mpesa orders flip to
--      `paid` automatically via the mpesa-callback edge function)
--   * Auto-bumps `updated_at` on every change
--
-- Idempotent + transactional. Safe to re-run.
-- ============================================================================

BEGIN;

-- ─── Allowed transitions ───────────────────────────────────────────────────
-- status:
--   pending          → preparing | cancelled
--   preparing        → ready | cancelled
--   ready            → out-for-delivery | completed | cancelled
--   out-for-delivery → completed | cancelled
--   completed        → (terminal)
--   cancelled        → (terminal)
--
-- payment_status:
--   unpaid   → paid | refunded
--   paid     → refunded
--   refunded → (terminal)

CREATE OR REPLACE FUNCTION public.enforce_order_state_machine()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed_status        text[];
  allowed_payment       text[];
BEGIN
  -- Always touch updated_at on any update
  NEW.updated_at := now();

  -- ── status transitions ──────────────────────────────────────────────
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    allowed_status := CASE OLD.status
      WHEN 'pending'          THEN ARRAY['preparing','cancelled']
      WHEN 'preparing'        THEN ARRAY['ready','cancelled']
      WHEN 'ready'            THEN ARRAY['out-for-delivery','completed','cancelled']
      WHEN 'out-for-delivery' THEN ARRAY['completed','cancelled']
      WHEN 'completed'        THEN ARRAY[]::text[]
      WHEN 'cancelled'        THEN ARRAY[]::text[]
      ELSE ARRAY[]::text[]
    END;

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

  -- ── payment_status transitions ──────────────────────────────────────
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

DROP TRIGGER IF EXISTS trg_orders_state_machine ON public.orders;
CREATE TRIGGER trg_orders_state_machine
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_state_machine();

COMMIT;
