-- ============================================================================
-- 0001_init.sql — ELPARAISO GARDEN KISII — Baseline schema (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
-- This migration is the SINGLE source of truth for the live database schema
-- as currently deployed on Supabase project `gnlvmszcysogydomahbk`. It is
-- derived from the generated `src/integrations/supabase/types.ts`.
--
-- Properties:
--   * 100% Postgres / Supabase compatible (no MySQL syntax)
--   * Idempotent: safe to re-run on a fresh database OR on the live DB
--   * Transactional: wrapped in BEGIN; ... COMMIT;
--   * RLS enabled on every table + at least one explicit policy
--   * Roles live in dedicated `admin_roles` table (NOT on profiles)
--     with a SECURITY DEFINER `has_admin_role()` / `is_admin()` helper
--     to avoid recursive RLS (per DEVELOPER_RULES.md §6).
--
-- Verification on a fresh local Postgres:
--   See sql/00_README.md → "How to verify a migration before committing".
--   Note: the `auth.uid()` references resolve to NULL on a non-Supabase
--   Postgres (the `auth` schema + helpers are stubbed below for local runs).
-- ============================================================================

BEGIN;

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ─── Local-dev shim for Supabase's auth.uid() ────────────────────────────────
-- On Supabase this schema and function are provided by the platform.
-- On a vanilla Postgres (used for migration verification) we create a
-- harmless no-op so the file applies cleanly. The shim is created ONLY if
-- the auth schema does not already exist, so it never overrides Supabase.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
    $f$;
  END IF;
END$$;

-- ============================================================================
-- ENUMS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role') THEN
    CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin', 'manager', 'staff');
  END IF;
END$$;

-- ============================================================================
-- TABLES (alphabetical within group)
-- ============================================================================

-- ─── ADMIN ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id          uuid PRIMARY KEY,                       -- = auth.users.id on Supabase
  full_name   text NOT NULL,
  email       text,
  avatar_url  text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL,
  role     public.admin_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL,
  action      text NOT NULL,
  table_name  text,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── CHATBOT ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chatbot_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text NOT NULL,
  source      text NOT NULL DEFAULT 'web',
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chatbot_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  session_id      text NOT NULL,
  role            text NOT NULL,                       -- 'user' | 'assistant' | 'system'
  message         text NOT NULL,
  intent          text,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chatbot_faqs (
  id          text PRIMARY KEY,
  intent      text NOT NULL,
  question    text NOT NULL,
  answer      text NOT NULL,
  keywords    jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggestions jsonb,
  priority    integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── PUBLIC CONTENT ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  value       text NOT NULL,
  category    text NOT NULL DEFAULT 'general',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page             text NOT NULL UNIQUE,
  seo_title        text,
  meta_description text,
  og_title         text,
  og_description   text,
  og_image         text,
  canonical_url    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.menu_categories (
  id          text PRIMARY KEY,                        -- slug-style stable id
  name        text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id           text PRIMARY KEY,
  category_id  text NOT NULL REFERENCES public.menu_categories(id) ON DELETE RESTRICT,
  name         text NOT NULL,
  description  text,
  price        numeric(10,2) NOT NULL CHECK (price >= 0),
  image_url    text,
  is_available boolean NOT NULL DEFAULT true,
  is_featured  boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  event_date   date NOT NULL,
  start_time   text,
  end_time     text,
  image_url    text,
  is_active    boolean NOT NULL DEFAULT true,
  is_featured  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gallery_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url   text NOT NULL,
  alt_text    text,
  category    text NOT NULL DEFAULT 'general',
  is_featured boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name  text NOT NULL,
  rating       integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text,
  source       text NOT NULL DEFAULT 'website',
  is_featured  boolean NOT NULL DEFAULT false,
  is_approved  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reservation_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  phone       text NOT NULL,
  email       text,
  date        date,
  time        text,
  party_size  integer CHECK (party_size IS NULL OR party_size > 0),
  notes       text,
  source      text NOT NULL DEFAULT 'website',
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  phone        text NOT NULL,
  email        text,
  inquiry_type text NOT NULL DEFAULT 'general',
  message      text NOT NULL,
  is_read      boolean NOT NULL DEFAULT false,
  admin_notes  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number         text NOT NULL UNIQUE,
  customer_name        text NOT NULL,
  customer_phone       text NOT NULL,
  customer_email       text,
  items                jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount         numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  order_type           text NOT NULL DEFAULT 'pickup',  -- pickup | delivery | dine-in | drive-through
  delivery_address     text,
  payment_method       text,
  payment_status       text NOT NULL DEFAULT 'unpaid',  -- unpaid | paid | refunded
  status               text NOT NULL DEFAULT 'pending', -- pending | preparing | ready | out-for-delivery | completed | cancelled
  estimated_time       integer,                          -- minutes
  special_instructions text,
  admin_notes          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_menu_items_category   ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_featured   ON public.menu_items(is_featured);
CREATE INDEX IF NOT EXISTS idx_menu_items_available  ON public.menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_events_active         ON public.events(is_active);
CREATE INDEX IF NOT EXISTS idx_events_date           ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_gallery_category      ON public.gallery_images(category);
CREATE INDEX IF NOT EXISTS idx_gallery_featured      ON public.gallery_images(is_featured);
CREATE INDEX IF NOT EXISTS idx_reviews_featured      ON public.reviews(is_featured);
CREATE INDEX IF NOT EXISTS idx_reservations_date     ON public.reservation_leads(date);
CREATE INDEX IF NOT EXISTS idx_reservations_status   ON public.reservation_leads(status);
CREATE INDEX IF NOT EXISTS idx_contact_unread        ON public.contact_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phone          ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_created        ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_roles_user      ON public.admin_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin  ON public.admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_msgs_conv     ON public.chatbot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_msgs_session  ON public.chatbot_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_active   ON public.chatbot_faqs(is_active);

-- ============================================================================
-- updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'admin_profiles','chatbot_conversations','chatbot_faqs','site_settings',
    'seo_settings','menu_categories','menu_items','events','gallery_images',
    'reviews','reservation_leads','contact_messages','orders'
  ];
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
-- SECURITY DEFINER role helpers (avoid recursive RLS — DEVELOPER_RULES §6)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid, _role public.admin_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin','manager','staff')
  );
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.admin_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_faqs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_leads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                 ENABLE ROW LEVEL SECURITY;

-- Helper to (re)create a policy idempotently
DO $do$
DECLARE
  r record;
  policies text[][] := ARRAY[
    -- admin_profiles
    ARRAY['admin_profiles', 'admin_profiles_self_read',   'SELECT', 'id = auth.uid()',                         ''],
    ARRAY['admin_profiles', 'admin_profiles_admin_all',   'ALL',    'public.is_admin(auth.uid())',             'public.is_admin(auth.uid())'],

    -- admin_roles (only admins can read/manage)
    ARRAY['admin_roles', 'admin_roles_admin_all', 'ALL', 'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'],

    -- admin_activity_log (admin only)
    ARRAY['admin_activity_log', 'admin_activity_admin_all', 'ALL', 'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())'],

    -- chatbot (public can insert their own session, admins can read everything)
    ARRAY['chatbot_conversations', 'chatbot_conv_public_insert', 'INSERT', '',                              'true'],
    ARRAY['chatbot_conversations', 'chatbot_conv_admin_read',    'SELECT', 'public.is_admin(auth.uid())',   ''],
    ARRAY['chatbot_messages',      'chatbot_msg_public_insert',  'INSERT', '',                              'true'],
    ARRAY['chatbot_messages',      'chatbot_msg_admin_read',     'SELECT', 'public.is_admin(auth.uid())',   ''],
    ARRAY['chatbot_faqs',          'chatbot_faqs_public_read',   'SELECT', 'is_active = true',              ''],
    ARRAY['chatbot_faqs',          'chatbot_faqs_admin_write',   'ALL',    'public.is_admin(auth.uid())',   'public.is_admin(auth.uid())'],

    -- site/seo settings: public read, admin write
    ARRAY['site_settings', 'site_settings_public_read', 'SELECT', 'true',                              ''],
    ARRAY['site_settings', 'site_settings_admin_write', 'ALL',    'public.is_admin(auth.uid())',       'public.is_admin(auth.uid())'],
    ARRAY['seo_settings',  'seo_settings_public_read',  'SELECT', 'true',                              ''],
    ARRAY['seo_settings',  'seo_settings_admin_write',  'ALL',    'public.is_admin(auth.uid())',       'public.is_admin(auth.uid())'],

    -- menu (public can see active/available, admin manages all)
    ARRAY['menu_categories', 'menu_categories_public_read', 'SELECT', 'is_active = true OR public.is_admin(auth.uid())', ''],
    ARRAY['menu_categories', 'menu_categories_admin_write', 'ALL',    'public.is_admin(auth.uid())',                     'public.is_admin(auth.uid())'],
    ARRAY['menu_items',      'menu_items_public_read',      'SELECT', 'is_available = true OR public.is_admin(auth.uid())', ''],
    ARRAY['menu_items',      'menu_items_admin_write',      'ALL',    'public.is_admin(auth.uid())',                     'public.is_admin(auth.uid())'],

    -- events / gallery / reviews
    ARRAY['events',         'events_public_read',         'SELECT', 'is_active = true OR public.is_admin(auth.uid())',   ''],
    ARRAY['events',         'events_admin_write',         'ALL',    'public.is_admin(auth.uid())',                       'public.is_admin(auth.uid())'],
    ARRAY['gallery_images', 'gallery_public_read',        'SELECT', 'true',                                              ''],
    ARRAY['gallery_images', 'gallery_admin_write',        'ALL',    'public.is_admin(auth.uid())',                       'public.is_admin(auth.uid())'],
    ARRAY['reviews',        'reviews_public_read',        'SELECT', 'is_approved = true OR public.is_admin(auth.uid())', ''],
    ARRAY['reviews',        'reviews_public_insert',      'INSERT', '',                                                  'true'],
    ARRAY['reviews',        'reviews_admin_write',        'ALL',    'public.is_admin(auth.uid())',                       'public.is_admin(auth.uid())'],

    -- inbound forms: anyone can insert, admin manages
    ARRAY['reservation_leads', 'reservation_public_insert', 'INSERT', '',                              'true'],
    ARRAY['reservation_leads', 'reservation_admin_all',     'ALL',    'public.is_admin(auth.uid())',   'public.is_admin(auth.uid())'],
    ARRAY['contact_messages',  'contact_public_insert',     'INSERT', '',                              'true'],
    ARRAY['contact_messages',  'contact_admin_all',         'ALL',    'public.is_admin(auth.uid())',   'public.is_admin(auth.uid())'],

    -- orders: anyone can place, customers can read by phone (enforced app-side); admin full access
    ARRAY['orders', 'orders_public_insert', 'INSERT', '',                            'true'],
    ARRAY['orders', 'orders_admin_all',     'ALL',    'public.is_admin(auth.uid())', 'public.is_admin(auth.uid())']
  ];
BEGIN
  FOR i IN 1 .. array_upper(policies, 1) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policies[i][2], policies[i][1]);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR %s%s%s',
      policies[i][2],
      policies[i][1],
      policies[i][3],
      CASE WHEN policies[i][4] <> '' THEN ' USING (' || policies[i][4] || ')' ELSE '' END,
      CASE WHEN policies[i][5] <> '' THEN ' WITH CHECK (' || policies[i][5] || ')' ELSE '' END
    );
  END LOOP;
END $do$;

-- ============================================================================
-- VIEWS (used by analytics dashboards)
-- ============================================================================
DROP VIEW IF EXISTS public.v_daily_conversation_stats;
CREATE VIEW public.v_daily_conversation_stats AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*)                            AS total_conversations,
  COUNT(DISTINCT session_id)          AS unique_sessions
FROM public.chatbot_conversations
GROUP BY 1
ORDER BY 1 DESC;

DROP VIEW IF EXISTS public.v_popular_menu_items;
CREATE VIEW public.v_popular_menu_items AS
SELECT
  mi.id,
  mi.name,
  mi.price,
  mi.is_featured,
  mi.is_available,
  mc.name AS category
FROM public.menu_items mi
LEFT JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE mi.is_available = true
ORDER BY mi.is_featured DESC, mi.sort_order, mi.name;

-- ============================================================================
-- SEED DATA (idempotent — only inserts if absent)
-- ============================================================================
INSERT INTO public.site_settings (key, value, category) VALUES
  ('siteName',               'Elparaiso Garden',                                                                'general'),
  ('tagline',                'Where Every Meal Becomes a Memory',                                              'general'),
  ('description',            'Kisii''s premier 24/7 bar, grill & chill spot.',                                'general'),
  ('phone',                  '0791 224513',                                                                    'contact'),
  ('email',                  'info@elparaisogarden.co.ke',                                                     'contact'),
  ('address',                'Kisii Town, along Hospital Road',                                                'contact'),
  ('whatsapp',               '254791224513',                                                                   'contact'),
  ('heroTitle',              'Kisii''s 24/7 Bar, Grill & Chill Spot',                                         'hero'),
  ('heroSubtitle',           'Great food, chilled drinks, good music, and unforgettable vibes.',              'hero'),
  ('heroCtaLabel',           'Reserve a Table',                                                                'hero'),
  ('heroCtaUrl',             '/reservations',                                                                  'hero'),
  ('announcementBar',        '',                                                                               'general'),
  ('announcementBarEnabled', 'false',                                                                          'general')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.seo_settings (page, seo_title, meta_description) VALUES
  ('home',         'Elparaiso Garden Kisii — 24/7 Bar, Grill & Chill Spot', 'Kisii''s premier 24/7 restaurant and bar. Dine in, drive-through, takeaway or delivery.'),
  ('menu',         'Menu — Elparaiso Garden Kisii',                          'Explore our full menu of grills, cocktails, local dishes, and more.'),
  ('about',        'About Us — Elparaiso Garden Kisii',                      'Learn the story of Elparaiso Garden — Kisii''s favourite dining destination.'),
  ('gallery',      'Gallery — Elparaiso Garden Kisii',                       'Browse photos of our restaurant, food, drinks, and events.'),
  ('contact',      'Contact Us — Elparaiso Garden Kisii',                    'Get in touch with Elparaiso Garden Kisii. Call, WhatsApp, or send us a message.'),
  ('reservations', 'Reserve a Table — Elparaiso Garden Kisii',               'Book a table at Elparaiso Garden Kisii.'),
  ('events',       'Events & Offers — Elparaiso Garden Kisii',               'Upcoming events, live music, special offers and promotions.')
ON CONFLICT (page) DO NOTHING;

COMMIT;
