


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."admin_role" AS ENUM (
    'super_admin',
    'admin',
    'manager',
    'staff'
);


ALTER TYPE "public"."admin_role" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'super_admin',
    'admin',
    'manager',
    'staff'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."payment_status_enum" AS ENUM (
    'pending',
    'success',
    'failed',
    'cancelled',
    'timeout'
);


ALTER TYPE "public"."payment_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."refund_status_enum" AS ENUM (
    'none',
    'pending',
    'refunded',
    'failed'
);


ALTER TYPE "public"."refund_status_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("_key" "text", "_max" integer, "_window_seconds" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."check_rate_limit"("_key" "text", "_max" integer, "_window_seconds" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_rate_limit"("_key" "text", "_max" integer, "_window_seconds" integer) IS 'Phase 5.5 rate limiter. Raises P0001 when _max attempts have been recorded for _key within the last _window_seconds. Caller picks key shape: "<action>:<identifier>".';



CREATE OR REPLACE FUNCTION "public"."enforce_order_state_machine"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."enforce_order_state_machine"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_audit_site_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.business_rules_audit (rule_key, old_value, new_value, changed_by)
    VALUES (NEW.key, OLD.value, NEW.value, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_audit_site_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_award_loyalty_points"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."fn_award_loyalty_points"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_increment_coupon_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.coupon_code IS NOT NULL AND NEW.coupon_code <> '' THEN
    UPDATE public.coupons SET used_count = used_count + 1 WHERE code = NEW.coupon_code;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_increment_coupon_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_menu_item_stock_signals"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."fn_menu_item_stock_signals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_track_inventory_on_order"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."fn_track_inventory_on_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validate_coupon_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."fn_validate_coupon_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validate_order_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fn_validate_order_status_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validate_payment_before_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Payment required before marking order as completed'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_validate_payment_before_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_first_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_roles) THEN
    INSERT INTO public.admin_roles (user_id, role)
    VALUES (NEW.id, 'super_admin');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_first_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_token_hash  text;
  v_invitation  public.admin_invitations%ROWTYPE;
  v_has_super   boolean;
BEGIN
  -- Always create the profile row.
  INSERT INTO public.admin_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.admin_roles WHERE role = 'super_admin')
    INTO v_has_super;

  -- First-ever user: handle_first_admin will assign super_admin. Allow.
  IF NOT v_has_super THEN
    RETURN NEW;
  END IF;

  -- After bootstrap: require a valid invitation.
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
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, or already used.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Stamp invitation and grant the invited role.
  UPDATE public.admin_invitations
     SET accepted_at = now(), accepted_by = NEW.id
   WHERE id = v_invitation.id;

  INSERT INTO public.admin_roles (user_id, role)
  VALUES (NEW.id, v_invitation.role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_admin_role"("_user_id" "uuid", "_role" "public"."admin_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;


ALTER FUNCTION "public"."has_admin_role"("_user_id" "uuid", "_role" "public"."admin_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.has_admin_role(_user_id, _role::text::public.admin_role);
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") IS 'Lovable-convention alias for has_admin_role. SECURITY DEFINER, RLS-safe.';



CREATE OR REPLACE FUNCTION "public"."has_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles WHERE role = 'super_admin'
  );
$$;


ALTER FUNCTION "public"."has_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin','manager','staff')
  );
$$;


ALTER FUNCTION "public"."is_admin"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_user"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE open_id = auth.uid()::TEXT
      AND role IN ('admin', 'manager', 'editor')
  );
END;
$$;


ALTER FUNCTION "public"."is_admin_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_orders_to_current_user"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."link_orders_to_current_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."orders_attach_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."orders_attach_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reservations_max_per_slot"() RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."reservations_max_per_slot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reservations_prevent_conflicts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."reservations_prevent_conflicts"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reservations_prevent_conflicts"() IS 'Phase 6.5: blocks duplicate-phone bookings of the same slot and enforces business_rules-driven slot capacity (default 6).';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_payments_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;


ALTER FUNCTION "public"."tg_payments_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" integer NOT NULL,
    "user_id" integer,
    "action" character varying(255) NOT NULL,
    "entity_type" character varying(64),
    "entity_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."activity_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."activity_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."activity_logs_id_seq" OWNED BY "public"."activity_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."admin_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "table_name" "text",
    "record_id" "text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."admin_role" DEFAULT 'staff'::"public"."admin_role" NOT NULL,
    "token_hash" "text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "accepted_by" "uuid"
);


ALTER TABLE "public"."admin_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "avatar_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."admin_role" NOT NULL
);


ALTER TABLE "public"."admin_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_rules_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_key" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_rules_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chatbot_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text" NOT NULL,
    "user_agent" "text",
    "source" "text" DEFAULT 'website'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chatbot_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chatbot_faqs" (
    "id" "text" NOT NULL,
    "intent" "text" NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "keywords" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "suggestions" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chatbot_faqs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chatbot_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "session_id" "text" NOT NULL,
    "role" "text" NOT NULL,
    "message" "text" NOT NULL,
    "intent" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chatbot_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."chatbot_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "phone" character varying(32) NOT NULL,
    "email" character varying(320),
    "inquiry_type" character varying(64) DEFAULT 'General Inquiry'::character varying NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_messages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."contact_messages_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."contact_messages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."contact_messages_id_seq" OWNED BY "public"."contact_messages"."id";



CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "discount_type" "text" DEFAULT 'percentage'::"text" NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_to" "date" NOT NULL,
    "max_uses" integer,
    "used_count" integer DEFAULT 0 NOT NULL,
    "min_order_value" numeric(10,2) DEFAULT 0 NOT NULL,
    "applicable_categories" "jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coupons_date_range_chk" CHECK (("valid_from" <= "valid_to")),
    CONSTRAINT "coupons_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"]))),
    CONSTRAINT "coupons_discount_value_check" CHECK (("discount_value" > (0)::numeric)),
    CONSTRAINT "coupons_min_order_value_check" CHECK (("min_order_value" >= (0)::numeric)),
    CONSTRAINT "coupons_uses_chk" CHECK ((("max_uses" IS NULL) OR ("used_count" <= "max_uses")))
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "event_date" "date" NOT NULL,
    "start_time" "text",
    "end_time" "text",
    "image_url" "text",
    "is_featured" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gallery_images" (
    "id" integer NOT NULL,
    "image_url" "text" NOT NULL,
    "image_key" "text" NOT NULL,
    "alt_text" character varying(255),
    "category" character varying(64) DEFAULT 'general'::character varying NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gallery_images_category_check" CHECK ((("category")::"text" = ANY ((ARRAY['food'::character varying, 'drinks'::character varying, 'ambiance'::character varying, 'events'::character varying, 'team'::character varying, 'general'::character varying])::"text"[])))
);


ALTER TABLE "public"."gallery_images" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."gallery_images_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."gallery_images_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."gallery_images_id_seq" OWNED BY "public"."gallery_images"."id";



CREATE TABLE IF NOT EXISTS "public"."holidays" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "date" "date" NOT NULL,
    "is_closed" boolean DEFAULT true NOT NULL,
    "special_hours" "jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."holidays" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."holidays_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."holidays_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."holidays_id_seq" OWNED BY "public"."holidays"."id";



CREATE TABLE IF NOT EXISTS "public"."inventory_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_item_id" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "type" "text" NOT NULL,
    "order_id" "uuid",
    "notes" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_transactions_quantity_check" CHECK (("quantity" <> 0)),
    CONSTRAINT "inventory_transactions_type_check" CHECK (("type" = ANY (ARRAY['sale'::"text", 'restock'::"text", 'adjustment'::"text", 'damage'::"text"])))
);


ALTER TABLE "public"."inventory_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "total_spent" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_orders" integer DEFAULT 0 NOT NULL,
    "last_order_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loyalty_points_points_check" CHECK (("points" >= 0)),
    CONSTRAINT "loyalty_points_total_spent_check" CHECK (("total_spent" >= (0)::numeric))
);


ALTER TABLE "public"."loyalty_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "points" integer NOT NULL,
    "type" "text" NOT NULL,
    "order_id" "uuid",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loyalty_transactions_type_check" CHECK (("type" = ANY (ARRAY['earn'::"text", 'redeem'::"text"])))
);


ALTER TABLE "public"."loyalty_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_categories" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."menu_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "image_url" "text",
    "is_available" boolean DEFAULT true NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quantity" integer DEFAULT 999 NOT NULL,
    "low_stock_threshold" integer DEFAULT 10 NOT NULL,
    "reorder_quantity" integer DEFAULT 50 NOT NULL,
    CONSTRAINT "menu_items_quantity_chk" CHECK (("quantity" >= 0))
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "related_entity_type" "text",
    "related_entity_id" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "customer_email" "text",
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "order_type" "text" DEFAULT 'pickup'::"text" NOT NULL,
    "delivery_address" "text",
    "payment_method" "text",
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "estimated_time" integer,
    "special_instructions" "text",
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "coupon_code" "text",
    "user_id" "uuid",
    CONSTRAINT "orders_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "provider" "text" DEFAULT 'mpesa'::"text" NOT NULL,
    "amount" integer NOT NULL,
    "phone" "text" NOT NULL,
    "merchant_request_id" "text",
    "checkout_request_id" "text",
    "mpesa_receipt_number" "text",
    "result_code" integer,
    "result_desc" "text",
    "status" "public"."payment_status_enum" DEFAULT 'pending'::"public"."payment_status_enum" NOT NULL,
    "raw_request" "jsonb",
    "raw_callback" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "reservation_id" "uuid",
    "refund_status" "public"."refund_status_enum" DEFAULT 'none'::"public"."refund_status_enum" NOT NULL,
    "refund_amount" integer,
    "refund_reason" "text",
    "refund_requested_by" "uuid",
    "refund_request_id" "text",
    "refund_result_code" integer,
    "refund_result_desc" "text",
    "refund_raw_callback" "jsonb",
    "refunded_at" timestamp with time zone,
    CONSTRAINT "payments_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "payments_target_xor_chk" CHECK ((((("order_id" IS NOT NULL))::integer + (("reservation_id" IS NOT NULL))::integer) = 1))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_hits" (
    "id" bigint NOT NULL,
    "key" "text" NOT NULL,
    "hit_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limit_hits" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."rate_limit_hits_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rate_limit_hits_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."rate_limit_hits_id_seq" OWNED BY "public"."rate_limit_hits"."id";



CREATE TABLE IF NOT EXISTS "public"."reservation_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "date" "date",
    "time" "text",
    "party_size" integer,
    "notes" "text",
    "source" "text" DEFAULT 'chatbot'::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deposit_amount" integer,
    "deposit_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    CONSTRAINT "reservation_leads_deposit_amount_check" CHECK ((("deposit_amount" IS NULL) OR ("deposit_amount" > 0))),
    CONSTRAINT "reservation_leads_deposit_status_check" CHECK (("deposit_status" = ANY (ARRAY['unpaid'::"text", 'paid'::"text", 'waived'::"text"])))
);


ALTER TABLE "public"."reservation_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "phone" character varying(32) NOT NULL,
    "email" character varying(320),
    "date" character varying(16) NOT NULL,
    "time" character varying(8) NOT NULL,
    "guests" integer DEFAULT 2 NOT NULL,
    "special_request" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reservations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'cancelled'::character varying, 'completed'::character varying])::"text"[])))
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."reservations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."reservations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."reservations_id_seq" OWNED BY "public"."reservations"."id";



CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_name" "text" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "source" "text" DEFAULT 'website'::"text" NOT NULL,
    "is_approved" boolean DEFAULT false NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" integer NOT NULL,
    "role" "public"."admin_role" NOT NULL,
    "permission" "text" NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."role_permissions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."role_permissions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."role_permissions_id_seq" OWNED BY "public"."role_permissions"."id";



CREATE TABLE IF NOT EXISTS "public"."seo_settings" (
    "id" integer NOT NULL,
    "page" character varying(64) NOT NULL,
    "seo_title" character varying(255),
    "meta_description" "text",
    "og_title" character varying(255),
    "og_description" "text",
    "og_image" "text",
    "canonical_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."seo_settings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."seo_settings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."seo_settings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."seo_settings_id_seq" OWNED BY "public"."seo_settings"."id";



CREATE TABLE IF NOT EXISTS "public"."site_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_send_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "template" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "phone" "text" NOT NULL,
    "status" "text" NOT NULL,
    "provider_response" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sms_send_log_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sms_send_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."testimonials" (
    "id" integer NOT NULL,
    "reviewer_name" character varying(255) NOT NULL,
    "rating" integer DEFAULT 5 NOT NULL,
    "review_text" "text" NOT NULL,
    "source_label" character varying(64) DEFAULT 'Google'::character varying,
    "is_featured" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "testimonials_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."testimonials" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."testimonials_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."testimonials_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."testimonials_id_seq" OWNED BY "public"."testimonials"."id";



CREATE OR REPLACE VIEW "public"."user_roles" AS
 SELECT "id",
    "user_id",
    (("role")::"text")::"public"."app_role" AS "role"
   FROM "public"."admin_roles";


ALTER VIEW "public"."user_roles" OWNER TO "postgres";


COMMENT ON VIEW "public"."user_roles" IS 'Lovable-convention alias for public.admin_roles. Read-only; writes go through admin_roles.';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" integer NOT NULL,
    "open_id" character varying(64) NOT NULL,
    "name" "text",
    "email" character varying(320),
    "login_method" character varying(64),
    "role" character varying(20) DEFAULT 'user'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_signed_in" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "users_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['user'::character varying, 'admin'::character varying, 'manager'::character varying, 'editor'::character varying])::"text"[])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."users_id_seq" OWNED BY "public"."users"."id";



CREATE OR REPLACE VIEW "public"."v_daily_conversation_stats" AS
 SELECT ("date_trunc"('day'::"text", "created_at"))::"date" AS "day",
    "count"(*) AS "total_conversations",
    "count"(DISTINCT "session_id") AS "unique_sessions"
   FROM "public"."chatbot_conversations"
  GROUP BY (("date_trunc"('day'::"text", "created_at"))::"date")
  ORDER BY (("date_trunc"('day'::"text", "created_at"))::"date") DESC;


ALTER VIEW "public"."v_daily_conversation_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_popular_menu_items" AS
 SELECT "mi"."id",
    "mi"."name",
    "mi"."price",
    "mi"."is_featured",
    "mi"."is_available",
    "mc"."name" AS "category"
   FROM ("public"."menu_items" "mi"
     LEFT JOIN "public"."menu_categories" "mc" ON (("mc"."id" = "mi"."category_id")))
  WHERE ("mi"."is_available" = true)
  ORDER BY "mi"."is_featured" DESC, "mi"."sort_order", "mi"."name";


ALTER VIEW "public"."v_popular_menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."valid_status_transitions" (
    "id" integer NOT NULL,
    "from_status" "text" NOT NULL,
    "to_status" "text" NOT NULL
);


ALTER TABLE "public"."valid_status_transitions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."valid_status_transitions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."valid_status_transitions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."valid_status_transitions_id_seq" OWNED BY "public"."valid_status_transitions"."id";



CREATE TABLE IF NOT EXISTS "public"."whatsapp_send_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "template" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "phone" "text" NOT NULL,
    "status" "text" NOT NULL,
    "provider_message_id" "text",
    "provider_response" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "whatsapp_send_log_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."whatsapp_send_log" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."activity_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."contact_messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."contact_messages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."gallery_images" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."gallery_images_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."holidays" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."holidays_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."rate_limit_hits" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."rate_limit_hits_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."reservations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."reservations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."role_permissions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."role_permissions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."seo_settings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."seo_settings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."testimonials" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."testimonials_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."users_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."valid_status_transitions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."valid_status_transitions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_activity_log"
    ADD CONSTRAINT "admin_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_invitations"
    ADD CONSTRAINT "admin_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_profiles"
    ADD CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."business_rules_audit"
    ADD CONSTRAINT "business_rules_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chatbot_conversations"
    ADD CONSTRAINT "chatbot_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chatbot_faqs"
    ADD CONSTRAINT "chatbot_faqs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chatbot_messages"
    ADD CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gallery_images"
    ADD CONSTRAINT "gallery_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_points"
    ADD CONSTRAINT "loyalty_points_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."loyalty_points"
    ADD CONSTRAINT "loyalty_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_checkout_request_id_key" UNIQUE ("checkout_request_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_refund_request_id_key" UNIQUE ("refund_request_id");



ALTER TABLE ONLY "public"."rate_limit_hits"
    ADD CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservation_leads"
    ADD CONSTRAINT "reservation_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_permission_key" UNIQUE ("role", "permission");



ALTER TABLE ONLY "public"."seo_settings"
    ADD CONSTRAINT "seo_settings_page_key" UNIQUE ("page");



ALTER TABLE ONLY "public"."seo_settings"
    ADD CONSTRAINT "seo_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_send_log"
    ADD CONSTRAINT "sms_send_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testimonials"
    ADD CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_open_id_key" UNIQUE ("open_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."valid_status_transitions"
    ADD CONSTRAINT "valid_status_transitions_from_status_to_status_key" UNIQUE ("from_status", "to_status");



ALTER TABLE ONLY "public"."valid_status_transitions"
    ADD CONSTRAINT "valid_status_transitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_send_log"
    ADD CONSTRAINT "whatsapp_send_log_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "admin_invitations_pending_email" ON "public"."admin_invitations" USING "btree" ("lower"("email")) WHERE ("accepted_at" IS NULL);



CREATE INDEX "admin_invitations_token_hash" ON "public"."admin_invitations" USING "btree" ("token_hash");



CREATE INDEX "idx_activity_logs_created" ON "public"."activity_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_logs_user" ON "public"."activity_logs" USING "btree" ("user_id");



CREATE INDEX "idx_admin_activity_admin" ON "public"."admin_activity_log" USING "btree" ("admin_id");



CREATE INDEX "idx_admin_roles_user" ON "public"."admin_roles" USING "btree" ("user_id");



CREATE INDEX "idx_audit_rule_key" ON "public"."business_rules_audit" USING "btree" ("rule_key");



CREATE INDEX "idx_chatbot_conversations_created_at" ON "public"."chatbot_conversations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_chatbot_conversations_session_id" ON "public"."chatbot_conversations" USING "btree" ("session_id");



CREATE INDEX "idx_chatbot_faqs_active" ON "public"."chatbot_faqs" USING "btree" ("is_active");



CREATE INDEX "idx_chatbot_faqs_intent" ON "public"."chatbot_faqs" USING "btree" ("intent");



CREATE INDEX "idx_chatbot_faqs_is_active" ON "public"."chatbot_faqs" USING "btree" ("is_active");



CREATE INDEX "idx_chatbot_faqs_priority" ON "public"."chatbot_faqs" USING "btree" ("priority" DESC);



CREATE INDEX "idx_chatbot_messages_conversation_id" ON "public"."chatbot_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_chatbot_messages_created_at" ON "public"."chatbot_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_chatbot_messages_intent" ON "public"."chatbot_messages" USING "btree" ("intent");



CREATE INDEX "idx_chatbot_messages_session_id" ON "public"."chatbot_messages" USING "btree" ("session_id");



CREATE INDEX "idx_chatbot_msgs_conv" ON "public"."chatbot_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_chatbot_msgs_session" ON "public"."chatbot_messages" USING "btree" ("session_id");



CREATE INDEX "idx_contact_messages_read" ON "public"."contact_messages" USING "btree" ("is_read");



CREATE INDEX "idx_contact_unread" ON "public"."contact_messages" USING "btree" ("is_read");



CREATE INDEX "idx_coupons_active" ON "public"."coupons" USING "btree" ("is_active");



CREATE INDEX "idx_coupons_code" ON "public"."coupons" USING "btree" ("code");



CREATE INDEX "idx_events_active" ON "public"."events" USING "btree" ("is_active");



CREATE INDEX "idx_events_date" ON "public"."events" USING "btree" ("event_date");



CREATE INDEX "idx_events_featured" ON "public"."events" USING "btree" ("is_featured");



CREATE INDEX "idx_gallery_category" ON "public"."gallery_images" USING "btree" ("category");



CREATE INDEX "idx_gallery_featured" ON "public"."gallery_images" USING "btree" ("is_featured");



CREATE INDEX "idx_inv_tx_menu_item" ON "public"."inventory_transactions" USING "btree" ("menu_item_id");



CREATE INDEX "idx_inv_tx_type" ON "public"."inventory_transactions" USING "btree" ("type");



CREATE INDEX "idx_loyalty_tx_phone" ON "public"."loyalty_transactions" USING "btree" ("phone");



CREATE INDEX "idx_menu_items_available" ON "public"."menu_items" USING "btree" ("is_available");



CREATE INDEX "idx_menu_items_category" ON "public"."menu_items" USING "btree" ("category_id");



CREATE INDEX "idx_menu_items_category_id" ON "public"."menu_items" USING "btree" ("category_id");



CREATE INDEX "idx_menu_items_featured" ON "public"."menu_items" USING "btree" ("is_featured");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type");



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_orders_created" ON "public"."orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_orders_email" ON "public"."orders" USING "btree" ("lower"("customer_email"));



CREATE INDEX "idx_orders_phone" ON "public"."orders" USING "btree" ("customer_phone");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_user_id" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "idx_rate_limit_hits_key_time" ON "public"."rate_limit_hits" USING "btree" ("key", "hit_at" DESC);



CREATE INDEX "idx_reservation_leads_created_at" ON "public"."reservation_leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reservation_leads_status" ON "public"."reservation_leads" USING "btree" ("status");



CREATE INDEX "idx_reservations_date" ON "public"."reservations" USING "btree" ("date");



CREATE INDEX "idx_reservations_status" ON "public"."reservations" USING "btree" ("status");



CREATE INDEX "idx_reviews_featured" ON "public"."reviews" USING "btree" ("is_featured");



CREATE INDEX "payments_checkout_request_idx" ON "public"."payments" USING "btree" ("checkout_request_id");



CREATE INDEX "payments_created_at_idx" ON "public"."payments" USING "btree" ("created_at" DESC);



CREATE INDEX "payments_order_id_idx" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "payments_refund_status_idx" ON "public"."payments" USING "btree" ("refund_status");



CREATE INDEX "payments_reservation_id_idx" ON "public"."payments" USING "btree" ("reservation_id");



CREATE INDEX "payments_status_idx" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "reservations_deposit_status_idx" ON "public"."reservation_leads" USING "btree" ("deposit_status");



CREATE INDEX "sms_send_log_idem_recent_idx" ON "public"."sms_send_log" USING "btree" ("idempotency_key", "created_at" DESC);



CREATE INDEX "sms_send_log_record_idx" ON "public"."sms_send_log" USING "btree" ("record_id", "created_at" DESC);



CREATE INDEX "whatsapp_send_log_idem_recent_idx" ON "public"."whatsapp_send_log" USING "btree" ("idempotency_key", "created_at" DESC);



CREATE INDEX "whatsapp_send_log_record_idx" ON "public"."whatsapp_send_log" USING "btree" ("record_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "payments_set_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."tg_payments_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."admin_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."chatbot_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."chatbot_faqs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."menu_categories" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."reservation_leads" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."site_settings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_admin_profiles_updated_at" BEFORE UPDATE ON "public"."admin_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_chatbot_conversations_updated_at" BEFORE UPDATE ON "public"."chatbot_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_chatbot_faqs_updated_at" BEFORE UPDATE ON "public"."chatbot_faqs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_contact_messages_updated_at" BEFORE UPDATE ON "public"."contact_messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_coupons_updated_at" BEFORE UPDATE ON "public"."coupons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_gallery_images_updated_at" BEFORE UPDATE ON "public"."gallery_images" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_loyalty_points_updated_at" BEFORE UPDATE ON "public"."loyalty_points" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_menu_categories_updated_at" BEFORE UPDATE ON "public"."menu_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_menu_items_stock_signals" BEFORE UPDATE OF "quantity" ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."fn_menu_item_stock_signals"();



CREATE OR REPLACE TRIGGER "trg_menu_items_updated_at" BEFORE UPDATE ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_orders_attach_user" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."orders_attach_user"();



CREATE OR REPLACE TRIGGER "trg_orders_award_loyalty" AFTER UPDATE OF "status" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_award_loyalty_points"();



CREATE OR REPLACE TRIGGER "trg_orders_increment_coupon" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_increment_coupon_usage"();



CREATE OR REPLACE TRIGGER "trg_orders_state_machine" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_order_state_machine"();



CREATE OR REPLACE TRIGGER "trg_orders_track_inventory" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_track_inventory_on_order"();



CREATE OR REPLACE TRIGGER "trg_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_orders_validate_coupon" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validate_coupon_usage"();



CREATE OR REPLACE TRIGGER "trg_orders_validate_payment" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validate_payment_before_completion"();



CREATE OR REPLACE TRIGGER "trg_orders_validate_status" BEFORE UPDATE OF "status" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validate_order_status_transition"();



CREATE OR REPLACE TRIGGER "trg_reservation_leads_updated_at" BEFORE UPDATE ON "public"."reservation_leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_reservations_prevent_conflicts" BEFORE INSERT OR UPDATE OF "date", "time", "phone", "status" ON "public"."reservation_leads" FOR EACH ROW EXECUTE FUNCTION "public"."reservations_prevent_conflicts"();



CREATE OR REPLACE TRIGGER "trg_reservations_updated_at" BEFORE UPDATE ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_reviews_updated_at" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_seo_settings_updated_at" BEFORE UPDATE ON "public"."seo_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_site_settings_audit" AFTER UPDATE ON "public"."site_settings" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit_site_settings"();



CREATE OR REPLACE TRIGGER "trg_site_settings_updated_at" BEFORE UPDATE ON "public"."site_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_testimonials_updated_at" BEFORE UPDATE ON "public"."testimonials" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_activity_log"
    ADD CONSTRAINT "admin_activity_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_invitations"
    ADD CONSTRAINT "admin_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_invitations"
    ADD CONSTRAINT "admin_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_profiles"
    ADD CONSTRAINT "admin_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chatbot_messages"
    ADD CONSTRAINT "chatbot_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chatbot_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_refund_requested_by_fkey" FOREIGN KEY ("refund_requested_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation_leads"("id") ON DELETE CASCADE;



CREATE POLICY "Admin full access admin_activity_log" ON "public"."admin_activity_log" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admin full access chatbot_conversations" ON "public"."chatbot_conversations" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admin full access chatbot_faqs" ON "public"."chatbot_faqs" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admin full access chatbot_messages" ON "public"."chatbot_messages" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admin full access events" ON "public"."events" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admin full access menu_categories" ON "public"."menu_categories" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admin full access menu_items" ON "public"."menu_items" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admin full access reservation_leads" ON "public"."reservation_leads" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admin full access reviews" ON "public"."reviews" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admin full access site_settings" ON "public"."site_settings" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Public insert conversations" ON "public"."chatbot_conversations" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public insert messages" ON "public"."chatbot_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public insert orders" ON "public"."orders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public insert reservation leads" ON "public"."reservation_leads" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public insert reviews" ON "public"."reviews" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public read active FAQs" ON "public"."chatbot_faqs" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public read active events" ON "public"."events" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public read active menu categories" ON "public"."menu_categories" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public read approved reviews" ON "public"."reviews" FOR SELECT USING (("is_approved" = true));



CREATE POLICY "Public read available menu items" ON "public"."menu_items" FOR SELECT USING (("is_available" = true));



CREATE POLICY "Public read own orders by phone" ON "public"."orders" FOR SELECT USING (true);



CREATE POLICY "Public read site settings" ON "public"."site_settings" FOR SELECT USING (true);



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_logs_admin_all" ON "public"."activity_logs" USING ("public"."is_admin_user"());



CREATE POLICY "admin_activity_admin_all" ON "public"."admin_activity_log" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."admin_activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_invitations_admin_all" ON "public"."admin_invitations" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."admin_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_profiles_admin_all" ON "public"."admin_profiles" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_profiles_self_read" ON "public"."admin_profiles" FOR SELECT USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."admin_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_roles_admin_all" ON "public"."admin_roles" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "audit_admin_read" ON "public"."business_rules_audit" FOR SELECT USING ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."business_rules_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chatbot_conv_admin_read" ON "public"."chatbot_conversations" FOR SELECT USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "chatbot_conv_public_insert" ON "public"."chatbot_conversations" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."chatbot_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chatbot_faqs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chatbot_faqs_admin_write" ON "public"."chatbot_faqs" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "chatbot_faqs_public_read" ON "public"."chatbot_faqs" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."chatbot_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chatbot_msg_admin_read" ON "public"."chatbot_messages" FOR SELECT USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "chatbot_msg_public_insert" ON "public"."chatbot_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "contact_admin_all" ON "public"."contact_messages" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contact_public_insert" ON "public"."contact_messages" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coupons_admin_write" ON "public"."coupons" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "coupons_public_read" ON "public"."coupons" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_admin_write" ON "public"."events" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "events_public_read" ON "public"."events" FOR SELECT USING ((("is_active" = true) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "gallery_admin_write" ON "public"."gallery_images" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."gallery_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gallery_public_read" ON "public"."gallery_images" FOR SELECT USING (true);



ALTER TABLE "public"."holidays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "holidays_admin_write" ON "public"."holidays" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "holidays_public_read" ON "public"."holidays" FOR SELECT USING (true);



CREATE POLICY "inv_tx_admin_all" ON "public"."inventory_transactions" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."inventory_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_points" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_pts_admin_all" ON "public"."loyalty_points" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."loyalty_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_tx_admin_all" ON "public"."loyalty_transactions" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."menu_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_categories_admin_write" ON "public"."menu_categories" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "menu_categories_public_read" ON "public"."menu_categories" FOR SELECT USING ((("is_active" = true) OR "public"."is_admin"("auth"."uid"())));



ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_items_admin_write" ON "public"."menu_items" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "menu_items_public_read" ON "public"."menu_items" FOR SELECT USING ((("is_available" = true) OR "public"."is_admin"("auth"."uid"())));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifs_admin_all" ON "public"."notifications" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_admin_all" ON "public"."orders" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "orders_owner_read" ON "public"."orders" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (("auth"."email"() IS NOT NULL) AND ("customer_email" IS NOT NULL) AND ("lower"("customer_email") = "lower"("auth"."email"())))));



CREATE POLICY "orders_public_insert" ON "public"."orders" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_admin_all" ON "public"."payments" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "payments_insert_anyone" ON "public"."payments" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "payments_select_own" ON "public"."payments" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."rate_limit_hits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reservation_admin_all" ON "public"."reservation_leads" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."reservation_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reservation_public_insert" ON "public"."reservation_leads" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reservations_admin_all" ON "public"."reservations" USING ("public"."is_admin_user"());



CREATE POLICY "reservations_public_insert" ON "public"."reservations" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_admin_write" ON "public"."reviews" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "reviews_public_insert" ON "public"."reviews" FOR INSERT WITH CHECK (true);



CREATE POLICY "reviews_public_read" ON "public"."reviews" FOR SELECT USING ((("is_approved" = true) OR "public"."is_admin"("auth"."uid"())));



ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "role_perms_admin_all" ON "public"."role_permissions" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."seo_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seo_settings_admin_write" ON "public"."seo_settings" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "seo_settings_public_read" ON "public"."seo_settings" FOR SELECT USING (true);



ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "site_settings_admin_write" ON "public"."site_settings" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "site_settings_public_read" ON "public"."site_settings" FOR SELECT USING (true);



ALTER TABLE "public"."sms_send_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_send_log_admin_read" ON "public"."sms_send_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."testimonials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "testimonials_admin_write" ON "public"."testimonials" USING ("public"."is_admin_user"());



CREATE POLICY "testimonials_public_read" ON "public"."testimonials" FOR SELECT USING ((("is_featured" = true) OR "public"."is_admin_user"()));



CREATE POLICY "transitions_admin_all" ON "public"."valid_status_transitions" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_admin_all" ON "public"."users" USING ("public"."is_admin_user"());



CREATE POLICY "users_self_read" ON "public"."users" FOR SELECT USING ((("open_id")::"text" = ("auth"."uid"())::"text"));



ALTER TABLE "public"."valid_status_transitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_send_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_send_log_admin_read" ON "public"."whatsapp_send_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."check_rate_limit"("_key" "text", "_max" integer, "_window_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("_key" "text", "_max" integer, "_window_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("_key" "text", "_max" integer, "_window_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_order_state_machine"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_order_state_machine"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_order_state_machine"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_audit_site_settings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_audit_site_settings"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_award_loyalty_points"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_award_loyalty_points"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_increment_coupon_usage"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_increment_coupon_usage"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_menu_item_stock_signals"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_menu_item_stock_signals"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_track_inventory_on_order"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_track_inventory_on_order"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_validate_coupon_usage"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validate_coupon_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_validate_order_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_validate_order_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validate_order_status_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_validate_payment_before_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_validate_payment_before_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validate_payment_before_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_first_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_first_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_first_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_admin_role"("_user_id" "uuid", "_role" "public"."admin_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_admin_role"("_user_id" "uuid", "_role" "public"."admin_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_admin_role"("_user_id" "uuid", "_role" "public"."admin_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."has_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."link_orders_to_current_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."link_orders_to_current_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_orders_to_current_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_orders_to_current_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."orders_attach_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."orders_attach_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."orders_attach_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reservations_max_per_slot"() TO "anon";
GRANT ALL ON FUNCTION "public"."reservations_max_per_slot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reservations_max_per_slot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reservations_prevent_conflicts"() TO "anon";
GRANT ALL ON FUNCTION "public"."reservations_prevent_conflicts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reservations_prevent_conflicts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_payments_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_payments_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_payments_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."admin_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_invitations" TO "anon";
GRANT ALL ON TABLE "public"."admin_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."admin_profiles" TO "anon";
GRANT ALL ON TABLE "public"."admin_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."admin_roles" TO "anon";
GRANT ALL ON TABLE "public"."admin_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_roles" TO "service_role";



GRANT ALL ON TABLE "public"."business_rules_audit" TO "anon";
GRANT ALL ON TABLE "public"."business_rules_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."business_rules_audit" TO "service_role";



GRANT ALL ON TABLE "public"."chatbot_conversations" TO "anon";
GRANT ALL ON TABLE "public"."chatbot_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."chatbot_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."chatbot_faqs" TO "anon";
GRANT ALL ON TABLE "public"."chatbot_faqs" TO "authenticated";
GRANT ALL ON TABLE "public"."chatbot_faqs" TO "service_role";



GRANT ALL ON TABLE "public"."chatbot_messages" TO "anon";
GRANT ALL ON TABLE "public"."chatbot_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chatbot_messages" TO "service_role";



GRANT ALL ON TABLE "public"."contact_messages" TO "anon";
GRANT ALL ON TABLE "public"."contact_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."contact_messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."contact_messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."contact_messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coupons" TO "anon";
GRANT ALL ON TABLE "public"."coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."gallery_images" TO "anon";
GRANT ALL ON TABLE "public"."gallery_images" TO "authenticated";
GRANT ALL ON TABLE "public"."gallery_images" TO "service_role";



GRANT ALL ON SEQUENCE "public"."gallery_images_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."gallery_images_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."gallery_images_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."holidays" TO "anon";
GRANT ALL ON TABLE "public"."holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."holidays" TO "service_role";



GRANT ALL ON SEQUENCE "public"."holidays_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."holidays_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."holidays_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transactions" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_points" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_points" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_points" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_transactions" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."menu_categories" TO "anon";
GRANT ALL ON TABLE "public"."menu_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_categories" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_hits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rate_limit_hits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rate_limit_hits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rate_limit_hits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reservation_leads" TO "anon";
GRANT ALL ON TABLE "public"."reservation_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."reservation_leads" TO "service_role";



GRANT ALL ON TABLE "public"."reservations" TO "anon";
GRANT ALL ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reservations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reservations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reservations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."seo_settings" TO "anon";
GRANT ALL ON TABLE "public"."seo_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."seo_settings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."seo_settings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."seo_settings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."seo_settings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."site_settings" TO "anon";
GRANT ALL ON TABLE "public"."site_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."site_settings" TO "service_role";



GRANT ALL ON TABLE "public"."sms_send_log" TO "anon";
GRANT ALL ON TABLE "public"."sms_send_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_send_log" TO "service_role";



GRANT ALL ON TABLE "public"."testimonials" TO "anon";
GRANT ALL ON TABLE "public"."testimonials" TO "authenticated";
GRANT ALL ON TABLE "public"."testimonials" TO "service_role";



GRANT ALL ON SEQUENCE "public"."testimonials_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."testimonials_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."testimonials_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."v_daily_conversation_stats" TO "anon";
GRANT ALL ON TABLE "public"."v_daily_conversation_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."v_daily_conversation_stats" TO "service_role";



GRANT ALL ON TABLE "public"."v_popular_menu_items" TO "anon";
GRANT ALL ON TABLE "public"."v_popular_menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."v_popular_menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."valid_status_transitions" TO "anon";
GRANT ALL ON TABLE "public"."valid_status_transitions" TO "authenticated";
GRANT ALL ON TABLE "public"."valid_status_transitions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."valid_status_transitions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."valid_status_transitions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."valid_status_transitions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_send_log" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_send_log" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_send_log" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

drop policy "payments_insert_anyone" on "public"."payments";

drop policy "payments_select_own" on "public"."payments";

revoke delete on table "public"."rate_limit_hits" from "anon";

revoke insert on table "public"."rate_limit_hits" from "anon";

revoke references on table "public"."rate_limit_hits" from "anon";

revoke select on table "public"."rate_limit_hits" from "anon";

revoke trigger on table "public"."rate_limit_hits" from "anon";

revoke truncate on table "public"."rate_limit_hits" from "anon";

revoke update on table "public"."rate_limit_hits" from "anon";

revoke delete on table "public"."rate_limit_hits" from "authenticated";

revoke insert on table "public"."rate_limit_hits" from "authenticated";

revoke references on table "public"."rate_limit_hits" from "authenticated";

revoke select on table "public"."rate_limit_hits" from "authenticated";

revoke trigger on table "public"."rate_limit_hits" from "authenticated";

revoke truncate on table "public"."rate_limit_hits" from "authenticated";

revoke update on table "public"."rate_limit_hits" from "authenticated";

alter table "public"."gallery_images" drop constraint "gallery_images_category_check";

alter table "public"."reservations" drop constraint "reservations_status_check";

alter table "public"."users" drop constraint "users_role_check";

alter table "public"."gallery_images" add constraint "gallery_images_category_check" CHECK (((category)::text = ANY ((ARRAY['food'::character varying, 'drinks'::character varying, 'ambiance'::character varying, 'events'::character varying, 'team'::character varying, 'general'::character varying])::text[]))) not valid;

alter table "public"."gallery_images" validate constraint "gallery_images_category_check";

alter table "public"."reservations" add constraint "reservations_status_check" CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'cancelled'::character varying, 'completed'::character varying])::text[]))) not valid;

alter table "public"."reservations" validate constraint "reservations_status_check";

alter table "public"."users" add constraint "users_role_check" CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying, 'manager'::character varying, 'editor'::character varying])::text[]))) not valid;

alter table "public"."users" validate constraint "users_role_check";


  create policy "payments_insert_anyone"
  on "public"."payments"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "payments_select_own"
  on "public"."payments"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_first_admin_assignment AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_first_admin();


  create policy "media_admin_delete"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'media'::text) AND public.is_admin_user()));



  create policy "media_admin_insert"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'media'::text) AND public.is_admin_user()));



  create policy "media_admin_update"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'media'::text) AND public.is_admin_user()))
with check (((bucket_id = 'media'::text) AND public.is_admin_user()));



  create policy "media_public_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'media'::text));



