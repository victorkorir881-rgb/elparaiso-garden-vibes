-- =============================================================================
-- ELPARAISO GARDEN KISII — Admin Panel Complete Database Schema
-- =============================================================================
-- Run all blocks in order in the Supabase SQL Editor.
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1: CORE TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Chatbot FAQs
CREATE TABLE IF NOT EXISTS public.chatbot_faqs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_intent    ON public.chatbot_faqs (intent);
CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_is_active ON public.chatbot_faqs (is_active);
CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_priority  ON public.chatbot_faqs (priority DESC);

-- 1b. Chatbot Conversations
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

-- 1c. Chatbot Messages
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
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session_id      ON public.chatbot_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_intent          ON public.chatbot_messages (intent);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_created_at      ON public.chatbot_messages (created_at DESC);

-- 1d. Reservation Leads
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

CREATE INDEX IF NOT EXISTS idx_reservation_leads_status     ON public.reservation_leads (status);
CREATE INDEX IF NOT EXISTS idx_reservation_leads_created_at ON public.reservation_leads (created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 2: ADMIN AUTH & ROLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Admin role enum
DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin', 'manager', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2b. Admin profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text NOT NULL,
  avatar_url text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2c. Admin roles (separate table for security)
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id      uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    admin_role NOT NULL,
  UNIQUE (user_id, role)
);

-- 2d. Security-definer helper functions (bypass RLS safely)
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

-- 2e. Activity log for audit trail
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  table_name  text,
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_id   ON public.admin_activity_log (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action     ON public.admin_activity_log (action);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON public.admin_activity_log (created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 3: MENU MANAGEMENT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.menu_categories (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text    NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid    NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  description text,
  price       numeric(10,2) NOT NULL,
  image_url   text,
  is_available boolean NOT NULL DEFAULT true,
  is_featured  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_id  ON public.menu_items (category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON public.menu_items (is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_featured  ON public.menu_items (is_featured);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 4: EVENTS MANAGEMENT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.events (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text    NOT NULL,
  description text,
  event_date  date    NOT NULL,
  start_time  text,
  end_time    text,
  image_url   text,
  is_featured boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_is_active  ON public.events (is_active);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 5: REVIEWS / TESTIMONIALS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name text    NOT NULL,
  rating      integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     text,
  source      text    NOT NULL DEFAULT 'website',
  is_approved boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON public.reviews (is_approved);
CREATE INDEX IF NOT EXISTS idx_reviews_is_featured ON public.reviews (is_featured);
CREATE INDEX IF NOT EXISTS idx_reviews_rating      ON public.reviews (rating DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 6: SITE SETTINGS (key-value store)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL UNIQUE,
  value      text NOT NULL,
  category   text NOT NULL DEFAULT 'general',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_settings_key      ON public.site_settings (key);
CREATE INDEX IF NOT EXISTS idx_site_settings_category ON public.site_settings (category);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 7: AUTO-UPDATE TIMESTAMPS TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at
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
-- BLOCK 8: ANALYTICS VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_daily_conversation_stats AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) AS total_conversations,
  COUNT(DISTINCT session_id) AS unique_sessions
FROM public.chatbot_conversations
GROUP BY 1 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.v_intent_distribution AS
SELECT
  intent,
  COUNT(*) AS count
FROM public.chatbot_messages
WHERE intent IS NOT NULL
GROUP BY intent ORDER BY count DESC;

CREATE OR REPLACE VIEW public.v_reservation_stats AS
SELECT
  status,
  COUNT(*) AS count,
  date_trunc('day', created_at)::date AS day
FROM public.reservation_leads
GROUP BY status, day ORDER BY day DESC;

CREATE OR REPLACE VIEW public.v_popular_menu_items AS
SELECT
  mi.id, mi.name, mi.price, mc.name AS category,
  mi.is_available, mi.is_featured
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE mi.is_available = true
ORDER BY mi.is_featured DESC, mi.sort_order ASC;

CREATE OR REPLACE VIEW public.v_review_summary AS
SELECT
  COUNT(*) AS total_reviews,
  COUNT(*) FILTER (WHERE is_approved) AS approved,
  COUNT(*) FILTER (WHERE NOT is_approved) AS pending,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating
FROM public.reviews;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 9: ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
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

-- ── Public access policies (anonymous visitors) ──

-- FAQs: public read active only
DROP POLICY IF EXISTS "Public read active FAQs" ON public.chatbot_faqs;
CREATE POLICY "Public read active FAQs" ON public.chatbot_faqs
  FOR SELECT USING (is_active = true);

-- Conversations: public insert
DROP POLICY IF EXISTS "Public insert conversations" ON public.chatbot_conversations;
CREATE POLICY "Public insert conversations" ON public.chatbot_conversations
  FOR INSERT WITH CHECK (true);

-- Messages: public insert
DROP POLICY IF EXISTS "Public insert messages" ON public.chatbot_messages;
CREATE POLICY "Public insert messages" ON public.chatbot_messages
  FOR INSERT WITH CHECK (true);

-- Reservation leads: public insert
DROP POLICY IF EXISTS "Public insert reservation leads" ON public.reservation_leads;
CREATE POLICY "Public insert reservation leads" ON public.reservation_leads
  FOR INSERT WITH CHECK (true);

-- Menu categories: public read active
DROP POLICY IF EXISTS "Public read active menu categories" ON public.menu_categories;
CREATE POLICY "Public read active menu categories" ON public.menu_categories
  FOR SELECT USING (is_active = true);

-- Menu items: public read available
DROP POLICY IF EXISTS "Public read available menu items" ON public.menu_items;
CREATE POLICY "Public read available menu items" ON public.menu_items
  FOR SELECT USING (is_available = true);

-- Events: public read active
DROP POLICY IF EXISTS "Public read active events" ON public.events;
CREATE POLICY "Public read active events" ON public.events
  FOR SELECT USING (is_active = true);

-- Reviews: public read approved only
DROP POLICY IF EXISTS "Public read approved reviews" ON public.reviews;
CREATE POLICY "Public read approved reviews" ON public.reviews
  FOR SELECT USING (is_approved = true);

-- Reviews: public insert (visitors can submit)
DROP POLICY IF EXISTS "Public insert reviews" ON public.reviews;
CREATE POLICY "Public insert reviews" ON public.reviews
  FOR INSERT WITH CHECK (true);

-- Site settings: public read
DROP POLICY IF EXISTS "Public read site settings" ON public.site_settings;
CREATE POLICY "Public read site settings" ON public.site_settings
  FOR SELECT USING (true);

-- ── Admin access policies (authenticated admins) ──

-- Macro: admin full CRUD on all content tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'chatbot_faqs', 'chatbot_conversations', 'chatbot_messages',
      'reservation_leads', 'menu_categories', 'menu_items',
      'events', 'reviews', 'site_settings', 'admin_activity_log'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin full access %I" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Admin full access %I" ON public.%I FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Admin profiles: admins can read all, update own
DROP POLICY IF EXISTS "Admin read profiles" ON public.admin_profiles;
CREATE POLICY "Admin read profiles" ON public.admin_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin update own profile" ON public.admin_profiles;
CREATE POLICY "Admin update own profile" ON public.admin_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin roles: only super_admin can manage
DROP POLICY IF EXISTS "Super admin manage roles" ON public.admin_roles;
CREATE POLICY "Super admin manage roles" ON public.admin_roles
  FOR ALL TO authenticated
  USING (public.has_admin_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_admin_role(auth.uid(), 'super_admin'));

-- Admin roles: admins can read all roles
DROP POLICY IF EXISTS "Admin read roles" ON public.admin_roles;
CREATE POLICY "Admin read roles" ON public.admin_roles
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 10: SEED DATA — Site Settings
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


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 11: SEED DATA — Menu Categories & Items
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.menu_categories (id, name, description, sort_order) VALUES
  ('cat-grill-001',  'The Grill',      'Famous Nyama Choma & grilled meats', 1),
  ('cat-bar-001',    'The Bar',        'Craft cocktails, cold beer, premium spirits', 2),
  ('cat-snacks-001', 'Snacks & Bites', 'Light bites for any time of day', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.menu_items (id, category_id, name, description, price, is_featured, sort_order) VALUES
  ('item-001', 'cat-grill-001',  'Nyama Choma (500g)',  'Slow-roasted goat meat, served with ugali & kachumbari', 800.00,  true, 1),
  ('item-002', 'cat-grill-001',  'Mutura',              'Kenyan-style sausage, smoky and spiced',                 200.00,  true, 2),
  ('item-003', 'cat-grill-001',  'Chicken Quarter',     'Grilled quarter chicken with chips or ugali',            600.00,  false, 3),
  ('item-004', 'cat-grill-001',  'Beef Ribs',           'Tender beef ribs, marinated and grilled to perfection',  900.00,  false, 4),
  ('item-005', 'cat-bar-001',    'Cold Tusker',         'Ice-cold Tusker Lager (500ml)',                          250.00,  false, 1),
  ('item-006', 'cat-bar-001',    'Signature Cocktail',  'House special cocktail of the day',                      450.00,  true, 2),
  ('item-007', 'cat-bar-001',    'Glass of Wine',       'Red or white wine, per glass',                           400.00,  false, 3),
  ('item-008', 'cat-snacks-001', 'Chips & Kachumbari',  'Crispy chips with fresh tomato-onion salad',             300.00,  false, 1),
  ('item-009', 'cat-snacks-001', 'Samosas (4 pcs)',     'Crispy meat-filled samosas',                             200.00,  false, 2)
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 12: SEED DATA — FAQ (same as existing chatbot schema)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.chatbot_faqs (id, intent, question, answer, keywords, suggestions, is_active, priority) VALUES
  ('faq-hours-001', 'hours', 'What are your opening hours?',
   'Elparaiso Garden Kisii is open **24 hours a day, 7 days a week** — including public holidays! Whether you want a late-night choma or an early morning coffee, we''ve got you covered. 🕐',
   '["open","hours","time","24","night","closing","schedule","when","always"]',
   '["Where are you located?","Do you take reservations?"]', true, 10),

  ('faq-location-001', 'location', 'Where are you located?',
   'We''re located at **County Government Street, Kisii** (Plus Code: 8QCF+4R Kisii, Kenya). We''re easy to find in the heart of Kisii town. 📍',
   '["where","location","address","find","directions","map","kisii","county","how to get"]',
   '["What time do you open?","Is there parking available?"]', true, 9),

  ('faq-reservation-001', 'reservation', 'How do I make a reservation?',
   E'We''d love to have you! You can make a reservation by:\n\n• Using the **Reserve a Table** form on this page\n• Calling us on **0791 224513**\n• Messaging us on **WhatsApp**\n\nWe''re open 24/7 and welcome groups, families, and solo guests alike! 🍽️',
   '["reserve","booking","table","book","seat","party","group","reservation"]',
   '["What''s on the menu?","Call Now"]', true, 9),

  ('faq-menu-001', 'menu', 'What food do you serve?',
   E'Our menu is all about **great Kenyan grills and flavour**:\n\n🔥 **The Grill** — Famous Nyama Choma & delicious Mutura (avg KES 500–1,000)\n🍹 **The Bar** — Craft cocktails, cold beer, premium spirits, wine\n🥗 **Snacks & Bites** — Light bites for any time of day',
   '["menu","food","eat","choma","mutura","nyama","grill","price","dish","serve","meal"]',
   '["Do you do delivery?","How do I reserve?"]', true, 8),

  ('faq-delivery-001', 'delivery', 'Do you offer delivery or takeaway?',
   E'Yes! We offer multiple service options:\n\n🚗 **Drive-Through** — Quick pick-up at the venue\n🛍️ **Takeaway** — Order and collect\n🚚 **Delivery** — We can arrange delivery for you\n🍽️ **Dine-In** — Enjoy the full garden experience\n\nCall **0791 224513** or WhatsApp us to arrange your order!',
   '["delivery","takeaway","take away","drive through","order","deliver","bring"]',
   '["What''s on the menu?","Contact / WhatsApp"]', true, 7),

  ('faq-parking-001', 'parking', 'Is there parking available?',
   'Yes! We have **free, ample, and secure parking** on site. You can also take advantage of our unique **Car Wash & Dine** experience — get your car cleaned while you enjoy a meal! 🚗✨',
   '["parking","park","car","vehicle","space","lot","secure"]',
   '["Where are you located?","What''s the car wash experience?"]', true, 7),

  ('faq-payment-001', 'payment', 'What payment methods do you accept?',
   E'We accept a wide range of payment methods:\n\n💳 **Debit & Credit Cards**\n📱 **NFC Contactless Payments**\n📲 **M-Pesa / Mobile Money**\n💵 **Cash**',
   '["pay","payment","cash","card","mpesa","nfc","mobile money","debit","credit","accepted"]',
   '["How do I make a reservation?","Where are you located?"]', true, 6),

  ('faq-contact-001', 'contact', 'How do I contact you?',
   E'You can reach us through:\n\n📞 **Phone:** 0791 224513\n💬 **WhatsApp:** +254 791 224513\n📍 **Visit:** County Government Street, Kisii\n\nOur team is available 24/7 to assist you!',
   '["contact","call","phone","number","whatsapp","reach","talk"]',
   '["Where are you located?","How do I reserve?"]', true, 8),

  ('faq-music-001', 'music', 'Do you have live music or entertainment?',
   E'Absolutely! Elparaiso Garden is famous for its **great vibes and entertainment**:\n\n🎵 **Live Music & DJ sets**\n🌿 **Garden atmosphere** perfect for chilling\n🎊 **Weekend parties and events**\n\nThe vibe here is unmatched in Kisii — come experience it yourself! 🔥',
   '["music","dj","live","band","vibe","vibes","entertainment","dance","party","event"]',
   '["What''s on the menu?","How do I reserve?"]', true, 6),

  ('faq-amenities-001', 'amenities', 'What amenities do you offer?',
   E'Elparaiso Garden has everything you need:\n\n♿ **Wheelchair-accessible toilet**\n🚗 **Free, ample & secure parking**\n💳 **NFC & card payments**\n📅 **Table service & reservations accepted**\n🎵 **Live music & DJ vibes**\n🚿 **On-site car wash**\n🕐 **Open 24/7**',
   '["amenity","amenities","features","facilities","wheelchair","accessible","toilet","service"]',
   '["Is there parking?","What are your hours?"]', true, 5),

  ('faq-carwash-001', 'carwash', 'Tell me about the car wash experience.',
   E'Our **Car Wash & Dine** experience is one of a kind in Kisii! 🚗✨\n\nDrop off your car for a thorough wash, then sit back and enjoy:\n• Famous **Nyama Choma** or light snacks\n• Ice-cold drinks from the bar\n• Great garden atmosphere\n\nBy the time you''ve finished eating, your car will be gleaming!',
   '["car wash","carwash","wash","clean car","vehicle clean"]',
   '["Is there parking?","What''s on the menu?"]', true, 6)

ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- ✅ DONE — All tables, RLS, triggers, views, and seed data are ready.
-- =============================================================================
--
-- QUICK START:
-- 1. Run this entire file in Supabase SQL Editor
-- 2. Create your first admin user via Supabase Auth (email/password)
-- 3. Insert their role:
--      INSERT INTO public.admin_roles (user_id, role)
--      VALUES ('<YOUR_USER_UUID>', 'super_admin');
-- 4. Build the admin panel UI pointing at these tables
--
-- TABLES CREATED:
--   chatbot_faqs, chatbot_conversations, chatbot_messages,
--   reservation_leads, admin_profiles, admin_roles,
--   admin_activity_log, menu_categories, menu_items,
--   events, reviews, site_settings
--
-- VIEWS CREATED:
--   v_daily_conversation_stats, v_intent_distribution,
--   v_reservation_stats, v_popular_menu_items, v_review_summary
--
-- FUNCTIONS CREATED:
--   is_admin(), has_admin_role(), handle_updated_at()
-- =============================================================================
