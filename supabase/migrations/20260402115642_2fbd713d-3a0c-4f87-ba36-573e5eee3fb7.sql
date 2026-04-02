
-- =============================================================================
-- ELPARAISO GARDEN KISII — Complete Admin Panel Database Schema
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1: ENUM & HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin', 'manager', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Timestamp auto-update function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 2: CORE TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- Chatbot FAQs (TEXT IDs)
CREATE TABLE IF NOT EXISTS public.chatbot_faqs (
  id           text        PRIMARY KEY,
  intent       text        NOT NULL,
  question     text        NOT NULL,
  answer       text        NOT NULL,
  keywords     jsonb       NOT NULL DEFAULT '[]',
  suggestions  jsonb       DEFAULT '[]',
  is_active    boolean     NOT NULL DEFAULT true,
  priority     integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_intent ON public.chatbot_faqs (intent);
CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_is_active ON public.chatbot_faqs (is_active);
CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_priority ON public.chatbot_faqs (priority DESC);

-- Chatbot Conversations
CREATE TABLE IF NOT EXISTS public.chatbot_conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text        NOT NULL,
  user_agent  text,
  source      text        NOT NULL DEFAULT 'website',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_session_id ON public.chatbot_conversations (session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_created_at ON public.chatbot_conversations (created_at DESC);

-- Chatbot Messages
CREATE TABLE IF NOT EXISTS public.chatbot_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid        NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  session_id       text        NOT NULL,
  role             text        NOT NULL CHECK (role IN ('user', 'assistant')),
  message          text        NOT NULL,
  intent           text,
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_messages_conversation_id ON public.chatbot_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session_id ON public.chatbot_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_intent ON public.chatbot_messages (intent);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_created_at ON public.chatbot_messages (created_at DESC);

-- Reservation Leads
CREATE TABLE IF NOT EXISTS public.reservation_leads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  phone       text        NOT NULL,
  email       text,
  date        date,
  time        text,
  party_size  integer,
  notes       text,
  source      text        NOT NULL DEFAULT 'chatbot',
  status      text        NOT NULL DEFAULT 'new',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_leads_status ON public.reservation_leads (status);
CREATE INDEX IF NOT EXISTS idx_reservation_leads_created_at ON public.reservation_leads (created_at DESC);

-- Menu Categories (TEXT IDs)
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id          text        PRIMARY KEY,
  name        text        NOT NULL,
  description text,
  sort_order  integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Menu Items (TEXT IDs)
CREATE TABLE IF NOT EXISTS public.menu_items (
  id           text        PRIMARY KEY,
  category_id  text        NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  description  text,
  price        numeric(10,2) NOT NULL,
  image_url    text,
  is_available boolean     NOT NULL DEFAULT true,
  is_featured  boolean     NOT NULL DEFAULT false,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items (category_id);

-- Events
CREATE TABLE IF NOT EXISTS public.events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  description text,
  event_date  date        NOT NULL,
  start_time  text,
  end_time    text,
  image_url   text,
  is_featured boolean     NOT NULL DEFAULT false,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name text        NOT NULL,
  rating      integer     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     text,
  source      text        NOT NULL DEFAULT 'website',
  is_approved boolean     NOT NULL DEFAULT false,
  is_featured boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Site Settings
CREATE TABLE IF NOT EXISTS public.site_settings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        NOT NULL UNIQUE,
  value      text        NOT NULL,
  category   text        NOT NULL DEFAULT 'general',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 3: ADMIN AUTH & ROLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id         uuid PRIMARY KEY,
  full_name  text NOT NULL,
  email      text,
  avatar_url text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid        NOT NULL,
  role    admin_role  NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid        NOT NULL,
  action      text        NOT NULL,
  table_name  text,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Security definer functions for role checks (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid, _role admin_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 4: AUTO-CREATE PROFILE + AUTO-ASSIGN FIRST ADMIN
-- ─────────────────────────────────────────────────────────────────────────────

-- When a new user signs up, auto-create their admin profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-assign super_admin role to the FIRST registered user
CREATE OR REPLACE FUNCTION public.handle_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_roles) THEN
    INSERT INTO public.admin_roles (user_id, role)
    VALUES (NEW.id, 'super_admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_first_admin_assignment
  AFTER INSERT ON public.admin_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_first_admin();

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 5: UPDATED_AT TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'chatbot_faqs', 'chatbot_conversations', 'reservation_leads',
      'admin_profiles', 'menu_categories', 'menu_items',
      'events', 'reviews', 'site_settings'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON public.%I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 6: ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.chatbot_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read active FAQs" ON public.chatbot_faqs FOR SELECT USING (is_active = true);
CREATE POLICY "Public insert conversations" ON public.chatbot_conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read conversations" ON public.chatbot_conversations FOR SELECT USING (true);
CREATE POLICY "Public insert messages" ON public.chatbot_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read messages" ON public.chatbot_messages FOR SELECT USING (true);
CREATE POLICY "Public insert reservation leads" ON public.reservation_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read active menu categories" ON public.menu_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public read available menu items" ON public.menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "Public read active events" ON public.events FOR SELECT USING (is_active = true);
CREATE POLICY "Public read approved reviews" ON public.reviews FOR SELECT USING (is_approved = true);
CREATE POLICY "Public insert reviews" ON public.reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read site settings" ON public.site_settings FOR SELECT USING (true);

-- Admin profiles: users can read their own profile
CREATE POLICY "Users read own profile" ON public.admin_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.admin_profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Admin roles: users can read their own roles
CREATE POLICY "Users read own roles" ON public.admin_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Admin full access policies (using security definer function to avoid recursion)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'chatbot_faqs', 'chatbot_conversations', 'chatbot_messages',
      'reservation_leads', 'menu_categories', 'menu_items',
      'events', 'reviews', 'site_settings', 'admin_activity_log',
      'admin_profiles', 'admin_roles'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY "Admin full access %I" ON public.%I FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 7: ANALYTICS VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_daily_conversation_stats AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) AS total_conversations,
  COUNT(DISTINCT session_id) AS unique_sessions
FROM public.chatbot_conversations
GROUP BY 1 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.v_popular_menu_items AS
SELECT
  mi.id, mi.name, mi.price, mc.name AS category,
  mi.is_available, mi.is_featured
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE mi.is_available = true
ORDER BY mi.is_featured DESC, mi.sort_order ASC;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 8: SEED DATA
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.site_settings (key, value, category) VALUES
  ('business_name',    'Elparaiso Garden Kisii',          'general'),
  ('phone',            '0791 224513',                     'contact'),
  ('whatsapp',         '+254 791 224513',                 'contact'),
  ('address',          'County Government Street, Kisii', 'contact'),
  ('plus_code',        '8QCF+4R Kisii, Kenya',            'contact'),
  ('opening_hours',    '24/7',                            'hours'),
  ('tagline',          'The Ultimate Nyama Choma & Entertainment Destination', 'branding'),
  ('primary_color',    '#D4AF37',                         'branding'),
  ('google_maps_url',  'https://maps.app.goo.gl/FqhMsWgy9vYx4neC6', 'contact')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.menu_categories (id, name, description, sort_order) VALUES
  ('cat-grill-001',  'The Grill',      'Famous Nyama Choma & grilled meats', 1),
  ('cat-bar-001',    'The Bar',        'Craft cocktails, cold beer, premium spirits', 2),
  ('cat-snacks-001', 'Snacks & Bites', 'Light bites for any time of day', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.menu_items (id, category_id, name, description, price, is_featured, sort_order) VALUES
  ('item-001', 'cat-grill-001',  'Nyama Choma (500g)',  'Slow-roasted goat meat, served with ugali & kachumbari', 800.00,  true, 1),
  ('item-002', 'cat-grill-001',  'Mutura',              'Kenyan-style sausage, smoky and spiced',                 200.00,  true, 2),
  ('item-003', 'cat-grill-001',  'Chicken Quarter',     'Grilled quarter chicken with chips or ugali',            600.00,  false, 3),
  ('item-005', 'cat-bar-001',    'Cold Tusker',         'Ice-cold Tusker Lager (500ml)',                          250.00,  false, 1),
  ('item-009', 'cat-snacks-001', 'Samosas (4 pcs)',     'Crispy meat-filled samosas',                             200.00,  false, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.chatbot_faqs (id, intent, question, answer, keywords, suggestions, is_active, priority) VALUES
  ('faq-hours-001', 'hours', 'What are your opening hours?',
   'Elparaiso Garden Kisii is open **24 hours a day, 7 days a week** — including public holidays! 🕐',
   '["open","hours","time","24"]', '["Where are you located?"]', true, 10),
  ('faq-location-001', 'location', 'Where are you located?',
   E'We''re located at **County Government Street, Kisii** (Plus Code: 8QCF+4R Kisii, Kenya). 📍',
   '["where","location","address","kisii"]', '["What time do you open?"]', true, 9),
  ('faq-menu-001', 'menu', 'What food do you serve?',
   E'Our menu is all about **great Kenyan grills**:\n\n🔥 **The Grill** — Famous Nyama Choma\n🍹 **The Bar** — Cold drinks',
   '["menu","food","eat","choma"]', '["How do I reserve?"]', true, 8)
ON CONFLICT (id) DO NOTHING;
