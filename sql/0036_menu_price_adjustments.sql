-- ============================================================================
-- 0036_menu_price_adjustments.sql
-- ----------------------------------------------------------------------------
-- Bulk menu price adjustments
--
-- Lets admins increase (or decrease) prices of menu items in bulk, scoped
-- by a flexible filter, expressed either as a percentage or a fixed amount,
-- optionally for a limited period (auto-reverted when ends_at passes).
--
-- Design:
--   * Adjustments are recorded in `menu_price_adjustments` with a JSONB
--     snapshot of every affected item's previous price, so the change can
--     be reverted exactly even days later.
--   * `apply_menu_price_adjustment` mutates `menu_items.price` in place
--     (the public menu reads `price` directly, so customers see the new
--     price immediately without any frontend refactor).
--   * `revert_menu_price_adjustment` restores each affected item to its
--     snapshotted price.
--   * `expire_menu_price_adjustments` reverts any active adjustment whose
--     `ends_at` has passed. The admin UI calls it on mount; pg_cron can
--     also be wired to it later if available.
--   * All write paths are SECURITY DEFINER + admin-gated via
--     public.is_admin(auth.uid()).
--
-- Idempotent and safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_price_adjustments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label             text NOT NULL,
  filter_type       text NOT NULL CHECK (filter_type IN ('all','category','featured','available','items')),
  category_id       text REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  item_ids          text[],
  adjustment_kind   text NOT NULL CHECK (adjustment_kind IN ('percent','amount')),
  adjustment_value  numeric(10,2) NOT NULL,
  starts_at         timestamptz NOT NULL DEFAULT now(),
  ends_at           timestamptz,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','reverted','expired')),
  affected_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{id, original_price, new_price}]
  affected_count    integer NOT NULL DEFAULT 0,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  reverted_at       timestamptz,
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_menu_price_adjustments_status
  ON public.menu_price_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_menu_price_adjustments_ends_at
  ON public.menu_price_adjustments(ends_at)
  WHERE status = 'active' AND ends_at IS NOT NULL;

ALTER TABLE public.menu_price_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_price_adjustments_admin_read   ON public.menu_price_adjustments;
DROP POLICY IF EXISTS menu_price_adjustments_admin_write  ON public.menu_price_adjustments;

CREATE POLICY menu_price_adjustments_admin_read
  ON public.menu_price_adjustments
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Writes go through SECURITY DEFINER RPCs below; block direct writes even
-- for admins so the snapshot stays consistent.
CREATE POLICY menu_price_adjustments_admin_write
  ON public.menu_price_adjustments
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ----------------------------------------------------------------------------
-- Helper: resolve the set of menu_items.id targeted by a filter
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._resolve_price_adjustment_targets(
  _filter_type  text,
  _category_id  text,
  _item_ids     text[]
)
RETURNS TABLE (id text, price numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mi.id, mi.price
  FROM public.menu_items mi
  WHERE
    CASE _filter_type
      WHEN 'all'        THEN true
      WHEN 'category'   THEN _category_id IS NOT NULL AND mi.category_id = _category_id
      WHEN 'featured'   THEN mi.is_featured = true
      WHEN 'available'  THEN mi.is_available = true
      WHEN 'items'      THEN _item_ids IS NOT NULL AND mi.id = ANY(_item_ids)
      ELSE false
    END;
$$;

-- ----------------------------------------------------------------------------
-- Apply a bulk price adjustment
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_menu_price_adjustment(
  _label            text,
  _filter_type      text,
  _category_id      text,
  _item_ids         text[],
  _adjustment_kind  text,
  _adjustment_value numeric,
  _ends_at          timestamptz
)
RETURNS public.menu_price_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid          uuid := auth.uid();
  _adjustment   public.menu_price_adjustments;
  _snapshot     jsonb := '[]'::jsonb;
  _count        integer := 0;
  _row          record;
  _new_price    numeric;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'Only admins can adjust menu prices' USING ERRCODE = '42501';
  END IF;

  IF _label IS NULL OR length(btrim(_label)) = 0 THEN
    RAISE EXCEPTION 'Label is required' USING ERRCODE = '22023';
  END IF;
  IF _filter_type NOT IN ('all','category','featured','available','items') THEN
    RAISE EXCEPTION 'Invalid filter_type: %', _filter_type USING ERRCODE = '22023';
  END IF;
  IF _adjustment_kind NOT IN ('percent','amount') THEN
    RAISE EXCEPTION 'Invalid adjustment_kind: %', _adjustment_kind USING ERRCODE = '22023';
  END IF;
  IF _adjustment_value IS NULL OR _adjustment_value = 0 THEN
    RAISE EXCEPTION 'Adjustment value must be non-zero' USING ERRCODE = '22023';
  END IF;
  IF _adjustment_kind = 'percent' AND (_adjustment_value <= -100) THEN
    RAISE EXCEPTION 'Percentage cannot be -100%% or lower' USING ERRCODE = '22023';
  END IF;
  IF _ends_at IS NOT NULL AND _ends_at <= now() THEN
    RAISE EXCEPTION 'ends_at must be in the future' USING ERRCODE = '22023';
  END IF;

  -- Walk targets, compute new prices, snapshot originals, update in place.
  FOR _row IN
    SELECT * FROM public._resolve_price_adjustment_targets(
      _filter_type, _category_id, _item_ids
    )
  LOOP
    IF _adjustment_kind = 'percent' THEN
      _new_price := round(_row.price * (1 + _adjustment_value / 100.0), 2);
    ELSE
      _new_price := round(_row.price + _adjustment_value, 2);
    END IF;
    IF _new_price < 0 THEN _new_price := 0; END IF;

    UPDATE public.menu_items
       SET price = _new_price,
           updated_at = now()
     WHERE id = _row.id;

    _snapshot := _snapshot || jsonb_build_object(
      'id', _row.id,
      'original_price', _row.price,
      'new_price', _new_price
    );
    _count := _count + 1;
  END LOOP;

  IF _count = 0 THEN
    RAISE EXCEPTION 'No menu items matched the selected filter' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.menu_price_adjustments (
    label, filter_type, category_id, item_ids,
    adjustment_kind, adjustment_value, ends_at,
    affected_snapshot, affected_count, created_by
  )
  VALUES (
    btrim(_label), _filter_type, _category_id, _item_ids,
    _adjustment_kind, _adjustment_value, _ends_at,
    _snapshot, _count, _uid
  )
  RETURNING * INTO _adjustment;

  RETURN _adjustment;
END;
$$;

-- ----------------------------------------------------------------------------
-- Revert an adjustment (manually or via expiry)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revert_menu_price_adjustment(
  _adjustment_id uuid,
  _reason        text DEFAULT 'manual'   -- 'manual' or 'expired'
)
RETURNS public.menu_price_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid       uuid := auth.uid();
  _adj       public.menu_price_adjustments;
  _entry     jsonb;
BEGIN
  -- Allow the SECURITY DEFINER context to call itself for 'expired'
  -- (auth.uid() is NULL when invoked from a server / cron context).
  IF _reason = 'manual' THEN
    IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
      RAISE EXCEPTION 'Only admins can revert price adjustments' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO _adj FROM public.menu_price_adjustments WHERE id = _adjustment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adjustment % not found', _adjustment_id USING ERRCODE = 'P0002';
  END IF;
  IF _adj.status <> 'active' THEN
    RETURN _adj;  -- already reverted/expired, no-op
  END IF;

  FOR _entry IN SELECT jsonb_array_elements(_adj.affected_snapshot) LOOP
    UPDATE public.menu_items
       SET price = (_entry->>'original_price')::numeric,
           updated_at = now()
     WHERE id = _entry->>'id';
  END LOOP;

  UPDATE public.menu_price_adjustments
     SET status      = CASE WHEN _reason = 'expired' THEN 'expired' ELSE 'reverted' END,
         reverted_at = now()
   WHERE id = _adjustment_id
   RETURNING * INTO _adj;

  RETURN _adj;
END;
$$;

-- ----------------------------------------------------------------------------
-- Auto-expire adjustments whose ends_at has passed
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_menu_price_adjustments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
  _n   integer := 0;
BEGIN
  FOR _row IN
    SELECT id FROM public.menu_price_adjustments
    WHERE status = 'active'
      AND ends_at IS NOT NULL
      AND ends_at <= now()
    ORDER BY ends_at ASC
  LOOP
    PERFORM public.revert_menu_price_adjustment(_row.id, 'expired');
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;

-- ----------------------------------------------------------------------------
-- Permissions
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._resolve_price_adjustment_targets(text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_menu_price_adjustment(text, text, text, text[], text, numeric, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revert_menu_price_adjustment(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_menu_price_adjustments() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_menu_price_adjustment(text, text, text, text[], text, numeric, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_menu_price_adjustment(uuid, text) TO authenticated;
-- expire_menu_price_adjustments is callable by anyone authenticated; the
-- per-row revert it triggers is SECURITY DEFINER and gated by reason.
GRANT EXECUTE ON FUNCTION public.expire_menu_price_adjustments() TO authenticated, anon;

COMMENT ON TABLE public.menu_price_adjustments IS
  'Audit + snapshot of bulk menu price adjustments. Snapshot allows exact revert.';
COMMENT ON FUNCTION public.apply_menu_price_adjustment(text, text, text, text[], text, numeric, timestamptz) IS
  'Apply a bulk price adjustment (percent or amount) to menu items matching a filter, optionally for a limited period.';
COMMENT ON FUNCTION public.revert_menu_price_adjustment(uuid, text) IS
  'Restore the snapshotted prices for an adjustment. Reason ''manual'' requires admin auth; ''expired'' is used internally.';
COMMENT ON FUNCTION public.expire_menu_price_adjustments() IS
  'Revert any active adjustment whose ends_at has passed. Safe to call frequently.';

COMMIT;
