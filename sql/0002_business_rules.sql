-- ============================================================================
-- 0002_business_rules.sql — Postgres-native business rules layer
-- ----------------------------------------------------------------------------
-- Replaces the legacy MySQL file (kept as 0002_business_rules.sql.mysql.bak).
--
-- Implements:
--   * Order status transition validation (trigger)
--   * Payment-required-before-completion guard (trigger)
--   * Coupons + applied-coupon validation
--   * Loyalty points (auto-earned on order completion)
--   * Inventory tracking on menu_items + auto-disable on out-of-stock
--   * Holidays table (informational; consumed by the booking app)
--   * Notifications table (low-stock, out-of-stock, etc.)
--   * Business-rule audit log on site_settings changes
--
-- All triggers are PL/pgSQL; all tables are RLS-enabled with admin-only access.
-- Idempotent and transactional. Safe to re-run.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. VALID ORDER STATUS TRANSITIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.valid_status_transitions (
  id           serial PRIMARY KEY,
  from_status  text NOT NULL,
  to_status    text NOT NULL,
  UNIQUE (from_status, to_status)
);

INSERT INTO public.valid_status_transitions (from_status, to_status) VALUES
  ('pending',          'preparing'),
  ('pending',          'cancelled'),
  ('preparing',        'ready'),
  ('preparing',        'cancelled'),
  ('ready',            'out-for-delivery'),
  ('ready',            'completed'),
  ('ready',            'cancelled'),
  ('out-for-delivery', 'completed'),
  ('out-for-delivery', 'cancelled')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- ============================================================================
-- 2. ROLE → PERMISSIONS MAP (informational; enforcement is via has_admin_role)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id          serial PRIMARY KEY,
  role        public.admin_role NOT NULL,
  permission  text NOT NULL,
  UNIQUE (role, permission)
);

INSERT INTO public.role_permissions (role, permission) VALUES
  ('super_admin', 'manage_all'),
  ('super_admin', 'manage_users'),
  ('super_admin', 'manage_settings'),
  ('super_admin', 'manage_business_rules'),
  ('super_admin', 'view_analytics'),
  ('super_admin', 'view_audit_logs'),
  ('admin',       'manage_orders'),
  ('admin',       'manage_reservations'),
  ('admin',       'manage_events'),
  ('admin',       'manage_testimonials'),
  ('admin',       'manage_menu'),
  ('admin',       'manage_gallery'),
  ('admin',       'view_messages'),
  ('admin',       'view_analytics'),
  ('manager',     'manage_orders'),
  ('manager',     'manage_reservations'),
  ('manager',     'manage_events'),
  ('manager',     'manage_gallery'),
  ('manager',     'view_messages'),
  ('staff',       'view_orders'),
  ('staff',       'view_reservations')
ON CONFLICT (role, permission) DO NOTHING;

-- ============================================================================
-- 3. COUPONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   text NOT NULL UNIQUE,
  description            text,
  discount_type          text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed')),
  discount_value         numeric(10,2) NOT NULL CHECK (discount_value > 0),
  valid_from             date NOT NULL,
  valid_to               date NOT NULL,
  max_uses               integer,
  used_count             integer NOT NULL DEFAULT 0,
  min_order_value        numeric(10,2) NOT NULL DEFAULT 0 CHECK (min_order_value >= 0),
  applicable_categories  jsonb,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_date_range_chk CHECK (valid_from <= valid_to),
  CONSTRAINT coupons_uses_chk       CHECK (max_uses IS NULL OR used_count <= max_uses)
);
CREATE INDEX IF NOT EXISTS idx_coupons_code   ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active);

-- Add an optional coupon code on orders (idempotent column add)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text;

-- ============================================================================
-- 4. HOLIDAYS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.holidays (
  id             serial PRIMARY KEY,
  name           text NOT NULL,
  date           date NOT NULL UNIQUE,
  is_closed      boolean NOT NULL DEFAULT true,
  special_hours  jsonb,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. INVENTORY (extends menu_items)
-- ============================================================================
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS quantity              integer NOT NULL DEFAULT 999,
  ADD COLUMN IF NOT EXISTS low_stock_threshold   integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS reorder_quantity      integer NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_quantity_chk'
  ) THEN
    ALTER TABLE public.menu_items
      ADD CONSTRAINT menu_items_quantity_chk CHECK (quantity >= 0);
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id  text NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity      integer NOT NULL CHECK (quantity <> 0),
  type          text NOT NULL CHECK (type IN ('sale','restock','adjustment','damage')),
  order_id      uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  notes         text,
  recorded_by   uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_tx_menu_item ON public.inventory_transactions(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_type      ON public.inventory_transactions(type);

-- ============================================================================
-- 6. LOYALTY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           text NOT NULL UNIQUE,
  points          integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  total_spent     numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  total_orders    integer NOT NULL DEFAULT 0,
  last_order_date timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text NOT NULL,
  points       integer NOT NULL,
  type         text NOT NULL CHECK (type IN ('earn','redeem')),
  order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_phone ON public.loyalty_transactions(phone);

-- ============================================================================
-- 7. NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                text NOT NULL,
  title               text NOT NULL,
  message             text,
  related_entity_type text,
  related_entity_id   text,
  is_read             boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type   ON public.notifications(type);

-- ============================================================================
-- 8. BUSINESS RULES AUDIT
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.business_rules_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key    text NOT NULL,
  old_value   text,
  new_value   text,
  changed_by  uuid,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_rule_key ON public.business_rules_audit(rule_key);

-- ============================================================================
-- 9. updated_at triggers for the new tables
-- ============================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['coupons','loyalty_points'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END$$;

-- ============================================================================
-- 10. TRIGGER: validate order status transitions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_validate_order_status_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.valid_status_transitions
      WHERE from_status = OLD.status AND to_status = NEW.status
    ) THEN
      RAISE EXCEPTION 'Invalid order status transition from % to %', OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_validate_status ON public.orders;
CREATE TRIGGER trg_orders_validate_status
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_order_status_transition();

-- ============================================================================
-- 11. TRIGGER: payment must be paid before order can be completed
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_validate_payment_before_completion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Payment required before marking order as completed'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_validate_payment ON public.orders;
CREATE TRIGGER trg_orders_validate_payment
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_payment_before_completion();

-- ============================================================================
-- 12. TRIGGER: validate coupon when used on insert
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_validate_coupon_usage()
RETURNS trigger LANGUAGE plpgsql AS $$
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

DROP TRIGGER IF EXISTS trg_orders_validate_coupon ON public.orders;
CREATE TRIGGER trg_orders_validate_coupon
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_coupon_usage();

-- ============================================================================
-- 13. TRIGGER: increment coupon used_count after order insert
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_increment_coupon_usage()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.coupon_code IS NOT NULL AND NEW.coupon_code <> '' THEN
    UPDATE public.coupons SET used_count = used_count + 1 WHERE code = NEW.coupon_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_increment_coupon ON public.orders;
CREATE TRIGGER trg_orders_increment_coupon
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_increment_coupon_usage();

-- ============================================================================
-- 14. TRIGGER: decrement inventory + log inventory_transactions on order insert
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_track_inventory_on_order()
RETURNS trigger LANGUAGE plpgsql AS $$
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

    -- Best-effort: only track if the menu item still exists
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

DROP TRIGGER IF EXISTS trg_orders_track_inventory ON public.orders;
CREATE TRIGGER trg_orders_track_inventory
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_track_inventory_on_order();

-- ============================================================================
-- 15. TRIGGER: auto-disable menu items when out of stock + low-stock alerts
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_menu_item_stock_signals()
RETURNS trigger LANGUAGE plpgsql AS $$
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

DROP TRIGGER IF EXISTS trg_menu_items_stock_signals ON public.menu_items;
CREATE TRIGGER trg_menu_items_stock_signals
  BEFORE UPDATE OF quantity ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_menu_item_stock_signals();

-- ============================================================================
-- 16. TRIGGER: award loyalty points when an order moves to 'completed'
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_award_loyalty_points()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pts integer;
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    pts := floor(NEW.total_amount)::integer; -- 1 point per whole currency unit

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

DROP TRIGGER IF EXISTS trg_orders_award_loyalty ON public.orders;
CREATE TRIGGER trg_orders_award_loyalty
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_award_loyalty_points();

-- ============================================================================
-- 17. TRIGGER: audit changes to site_settings values
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_audit_site_settings()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.business_rules_audit (rule_key, old_value, new_value, changed_by)
    VALUES (NEW.key, OLD.value, NEW.value, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_settings_audit ON public.site_settings;
CREATE TRIGGER trg_site_settings_audit
  AFTER UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_site_settings();

-- ============================================================================
-- 18. RLS — admin-only on all business-rules tables
-- ============================================================================
ALTER TABLE public.valid_status_transitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_rules_audit      ENABLE ROW LEVEL SECURITY;

DO $do$
DECLARE
  policies text[][] := ARRAY[
    -- read-mostly tables: public can read coupons (to validate at checkout), holidays (to show on UI)
    ARRAY['coupons',  'coupons_public_read',  'SELECT', 'is_active = true', ''],
    ARRAY['coupons',  'coupons_admin_write',  'ALL',    'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'],
    ARRAY['holidays', 'holidays_public_read', 'SELECT', 'true', ''],
    ARRAY['holidays', 'holidays_admin_write', 'ALL',    'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'],

    -- everything else: admin only
    ARRAY['valid_status_transitions', 'transitions_admin_all', 'ALL', 'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'],
    ARRAY['role_permissions',         'role_perms_admin_all',  'ALL', 'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'],
    ARRAY['inventory_transactions',   'inv_tx_admin_all',      'ALL', 'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'],
    ARRAY['loyalty_points',           'loyalty_pts_admin_all', 'ALL', 'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'],
    ARRAY['loyalty_transactions',     'loyalty_tx_admin_all',  'ALL', 'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'],
    ARRAY['notifications',            'notifs_admin_all',      'ALL', 'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'],
    ARRAY['business_rules_audit',     'audit_admin_read',      'SELECT', 'public.is_admin(auth.uid())', '']
  ];
BEGIN
  FOR i IN 1 .. array_upper(policies, 1) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policies[i][2], policies[i][1]);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR %s%s%s',
      policies[i][2], policies[i][1], policies[i][3],
      CASE WHEN policies[i][4] <> '' THEN ' USING (' || policies[i][4] || ')' ELSE '' END,
      CASE WHEN policies[i][5] <> '' THEN ' WITH CHECK (' || policies[i][5] || ')' ELSE '' END
    );
  END LOOP;
END $do$;

COMMIT;
