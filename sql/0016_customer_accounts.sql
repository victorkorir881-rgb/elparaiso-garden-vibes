-- ============================================================================
-- 0016 — Customer accounts + order ownership
--
-- Lets logged-in customers see their order history:
--   • orders gain a nullable user_id (auth.uid()) column
--   • new orders placed while signed in are auto-linked via a trigger
--   • a SECURITY DEFINER RPC backfills past guest orders that match a user's
--     verified email address (called from the client right after sign-in)
--   • new RLS SELECT policy lets owners read their own orders (by user_id OR
--     by matching auth.email() to customer_email — covers pre-link guest orders)
--
-- Idempotent — safe to re-run.
-- ============================================================================
BEGIN;

-- 1. Column ----------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_email   ON public.orders(lower(customer_email));

-- 2. Auto-attach trigger ---------------------------------------------------
-- When a row is inserted by an authenticated session and user_id is null,
-- stamp it with the caller's uid. Guest checkouts (anon role) are unaffected.
CREATE OR REPLACE FUNCTION public.orders_attach_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_attach_user ON public.orders;
CREATE TRIGGER trg_orders_attach_user
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_attach_user();

-- 3. Backfill RPC ----------------------------------------------------------
-- Called by the client right after sign-in. Links any unowned orders whose
-- customer_email matches the caller's verified auth email.
CREATE OR REPLACE FUNCTION public.link_orders_to_current_user()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid   uuid := auth.uid();
  mail  text;
  cnt   integer := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT lower(email) INTO mail FROM auth.users WHERE id = uid;
  IF mail IS NULL OR mail = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.orders
     SET user_id = uid
   WHERE user_id IS NULL
     AND lower(customer_email) = mail;

  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$;

REVOKE ALL ON FUNCTION public.link_orders_to_current_user() FROM public;
GRANT EXECUTE ON FUNCTION public.link_orders_to_current_user() TO authenticated;

-- 4. RLS — owner read ------------------------------------------------------
DROP POLICY IF EXISTS orders_owner_read ON public.orders;
CREATE POLICY orders_owner_read
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      auth.email() IS NOT NULL
      AND customer_email IS NOT NULL
      AND lower(customer_email) = lower(auth.email())
    )
  );

COMMIT;
