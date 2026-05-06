
-- Mark trigger functions as SECURITY DEFINER so they bypass RLS on internal
-- bookkeeping tables (inventory_transactions, loyalty_*, notifications,
-- business_rules_audit, coupons) when fired by anonymous public actions.

CREATE OR REPLACE FUNCTION public.fn_track_inventory_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  item_id text;
  item_qty integer;
BEGIN
  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
    item_id  := item->>'id';
    item_qty := COALESCE((item->>'quantity')::integer, 1);
    IF item_id IS NULL THEN CONTINUE; END IF;

    IF EXISTS (SELECT 1 FROM public.menu_items WHERE id = item_id) THEN
      UPDATE public.menu_items
        SET quantity = GREATEST(0, quantity - item_qty)
        WHERE id = item_id;

      INSERT INTO public.inventory_transactions (menu_item_id, quantity, type, order_id)
      VALUES (item_id, -item_qty, 'sale', NEW.id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_validate_coupon_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coupon_code IS NOT NULL AND NEW.coupon_code <> '' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.coupons
      WHERE code = NEW.coupon_code
        AND is_active = true
        AND CURRENT_DATE BETWEEN valid_from AND valid_to
        AND (max_uses IS NULL OR used_count < max_uses)
        AND NEW.total_amount >= min_order_value
    ) THEN
      RAISE EXCEPTION 'Invalid or expired coupon code: %', NEW.coupon_code
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_increment_coupon_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coupon_code IS NOT NULL AND NEW.coupon_code <> '' THEN
    UPDATE public.coupons SET used_count = used_count + 1 WHERE code = NEW.coupon_code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_menu_item_stock_signals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity <= 0 AND OLD.is_available = true THEN
    NEW.is_available := false;
    INSERT INTO public.notifications (type, title, message, related_entity_type, related_entity_id)
    VALUES ('out_of_stock',
            NEW.name || ' is out of stock',
            'Menu item ' || NEW.name || ' has been automatically disabled.',
            'menu_item', NEW.id);
  ELSIF NEW.quantity <= NEW.low_stock_threshold AND OLD.quantity > NEW.low_stock_threshold THEN
    INSERT INTO public.notifications (type, title, message, related_entity_type, related_entity_id)
    VALUES ('low_stock',
            NEW.name || ' is low on stock',
            NEW.name || ' is below reorder threshold (' || NEW.low_stock_threshold || ' units).',
            'menu_item', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_award_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pts integer;
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    pts := floor(NEW.total_amount)::integer;

    INSERT INTO public.loyalty_points (phone, points, total_spent, total_orders, last_order_date)
    VALUES (NEW.customer_phone, pts, NEW.total_amount, 1, now())
    ON CONFLICT (phone) DO UPDATE SET
      points          = public.loyalty_points.points       + EXCLUDED.points,
      total_spent     = public.loyalty_points.total_spent  + EXCLUDED.total_spent,
      total_orders    = public.loyalty_points.total_orders + 1,
      last_order_date = now(),
      updated_at      = now();

    INSERT INTO public.loyalty_transactions (phone, points, type, order_id, description)
    VALUES (NEW.customer_phone, pts, 'earn', NEW.id, 'Order #' || NEW.order_number);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_audit_site_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.business_rules_audit (rule_key, old_value, new_value, changed_by)
    VALUES (NEW.key, OLD.value, NEW.value, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
