-- ============================================================
-- ELPARAISO GARDEN KISII — SUPABASE SQL SCHEMA
-- Version: 1.0.0
-- Description: Complete schema with RLS policies for Supabase
--              migration from the built-in MySQL/TiDB database.
-- ============================================================
-- NOTE: This schema is provided for teams who wish to migrate
-- to Supabase (PostgreSQL). The app currently uses the built-in
-- MySQL database. See INTEGRATION.md for migration instructions.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  open_id     VARCHAR(64) NOT NULL UNIQUE,
  name        TEXT,
  email       VARCHAR(320),
  login_method VARCHAR(64),
  role        VARCHAR(20) NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'admin', 'manager', 'editor')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_signed_in TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SITE SETTINGS ────────────────────────────────────────────────────────────
-- Key-value store for all site configuration
CREATE TABLE IF NOT EXISTS site_settings (
  id         SERIAL PRIMARY KEY,
  key        VARCHAR(128) NOT NULL UNIQUE,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO site_settings (key, value) VALUES
  ('siteName',              'Elparaiso Garden'),
  ('tagline',               'Where Every Meal Becomes a Memory'),
  ('description',           'Kisii''s premier 24/7 bar, grill & chill spot. Great food, chilled drinks, good music, and unforgettable vibes.'),
  ('phone',                 '0791 224513'),
  ('phone2',                ''),
  ('email',                 'info@elparaisogarden.co.ke'),
  ('address',               'Kisii Town, along Hospital Road'),
  ('city',                  'Kisii'),
  ('mapUrl',                'https://maps.google.com/?q=Kisii+Garden+Restaurant'),
  ('whatsapp',              '254791224513'),
  ('facebook',              ''),
  ('instagram',             ''),
  ('twitter',               ''),
  ('tiktok',                ''),
  ('youtube',               ''),
  ('enableReservations',    'true'),
  ('enableGallery',         'true'),
  ('enableEvents',          'true'),
  ('enableTestimonials',    'true'),
  ('heroTitle',             'Kisii''s 24/7 Bar, Grill & Chill Spot'),
  ('heroSubtitle',          'Great food, chilled drinks, good music, and unforgettable vibes — dine in, drive-through, takeaway, or order delivery anytime.'),
  ('heroCtaLabel',          'Reserve a Table'),
  ('heroCtaUrl',            '/reservations'),
  ('announcementBar',       ''),
  ('announcementBarEnabled','false')
ON CONFLICT (key) DO NOTHING;

-- ─── SEO SETTINGS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_settings (
  id               SERIAL PRIMARY KEY,
  page             VARCHAR(64) NOT NULL UNIQUE,
  seo_title        VARCHAR(255),
  meta_description TEXT,
  og_title         VARCHAR(255),
  og_description   TEXT,
  og_image         TEXT,
  canonical_url    TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default SEO for each page
INSERT INTO seo_settings (page, seo_title, meta_description) VALUES
  ('home',         'Elparaiso Garden Kisii — 24/7 Bar, Grill & Chill Spot', 'Kisii''s premier restaurant and bar. Great food, chilled drinks, good music. Open 24/7. Dine in, drive-through, takeaway or delivery.'),
  ('menu',         'Menu — Elparaiso Garden Kisii',                          'Explore our full menu of grills, cocktails, local dishes, and more at Elparaiso Garden Kisii.'),
  ('about',        'About Us — Elparaiso Garden Kisii',                      'Learn the story of Elparaiso Garden — Kisii''s favourite dining and entertainment destination.'),
  ('gallery',      'Gallery — Elparaiso Garden Kisii',                       'Browse photos of our restaurant, food, drinks, and events at Elparaiso Garden Kisii.'),
  ('contact',      'Contact Us — Elparaiso Garden Kisii',                    'Get in touch with Elparaiso Garden Kisii. Call, WhatsApp, or send us a message.'),
  ('reservations', 'Reserve a Table — Elparaiso Garden Kisii',               'Book a table at Elparaiso Garden Kisii. Online reservations available 24/7.'),
  ('events',       'Events & Offers — Elparaiso Garden Kisii',               'Upcoming events, live music, special offers and promotions at Elparaiso Garden Kisii.')
ON CONFLICT (page) DO NOTHING;

-- ─── MENU CATEGORIES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── MENU ITEMS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id           SERIAL PRIMARY KEY,
  category_id  INTEGER REFERENCES menu_categories(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  price        NUMERIC(10,2) NOT NULL,
  image_url    TEXT,
  image_key    TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured  BOOLEAN NOT NULL DEFAULT FALSE,
  is_vegetarian BOOLEAN NOT NULL DEFAULT FALSE,
  is_spicy     BOOLEAN NOT NULL DEFAULT FALSE,
  tags         TEXT,                          -- comma-separated tags
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RESERVATIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  phone           VARCHAR(32) NOT NULL,
  email           VARCHAR(320),
  date            VARCHAR(16) NOT NULL,        -- YYYY-MM-DD
  time            VARCHAR(8) NOT NULL,         -- HH:MM
  guests          INTEGER NOT NULL DEFAULT 2,
  special_request TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── EVENTS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id               SERIAL PRIMARY KEY,
  title            VARCHAR(255) NOT NULL,
  slug             VARCHAR(255) NOT NULL UNIQUE,
  description      TEXT,
  event_type       VARCHAR(64) NOT NULL DEFAULT 'event'
                     CHECK (event_type IN ('event', 'offer', 'promotion', 'announcement')),
  start_date       TIMESTAMPTZ,
  end_date         TIMESTAMPTZ,
  image_url        TEXT,
  image_key        TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured      BOOLEAN NOT NULL DEFAULT FALSE,  -- show on homepage
  show_on_homepage BOOLEAN NOT NULL DEFAULT FALSE,
  cta_label        VARCHAR(128),
  cta_url          TEXT,
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── GALLERY IMAGES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gallery_images (
  id         SERIAL PRIMARY KEY,
  image_url  TEXT NOT NULL,
  image_key  TEXT NOT NULL,
  alt_text   VARCHAR(255),
  category   VARCHAR(64) NOT NULL DEFAULT 'general'
               CHECK (category IN ('food', 'drinks', 'ambiance', 'events', 'team', 'general')),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS testimonials (
  id             SERIAL PRIMARY KEY,
  reviewer_name  VARCHAR(255) NOT NULL,
  rating         INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  review_text    TEXT NOT NULL,
  source_label   VARCHAR(64) DEFAULT 'Google',
  is_featured    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CONTACT MESSAGES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  phone        VARCHAR(32) NOT NULL,
  email        VARCHAR(320),
  inquiry_type VARCHAR(64) NOT NULL DEFAULT 'General Inquiry',
  message      TEXT NOT NULL,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  admin_notes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ACTIVITY LOGS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(255) NOT NULL,
  entity_type  VARCHAR(64),
  entity_id    INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_menu_items_category     ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_featured     ON menu_items(is_featured);
CREATE INDEX IF NOT EXISTS idx_reservations_date       ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_status     ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_events_active           ON events(is_active);
CREATE INDEX IF NOT EXISTS idx_events_featured         ON events(is_featured);
CREATE INDEX IF NOT EXISTS idx_gallery_category        ON gallery_images(category);
CREATE INDEX IF NOT EXISTS idx_contact_messages_read   ON contact_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user      ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created   ON activity_logs(created_at DESC);

-- ─── UPDATED_AT TRIGGERS ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'site_settings', 'seo_settings', 'menu_categories',
    'menu_items', 'reservations', 'events', 'gallery_images',
    'testimonials', 'contact_messages'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      t, t
    );
  END LOOP;
END;
$$;

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images     ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs      ENABLE ROW LEVEL SECURITY;

-- Helper function: check if the calling user has an admin/manager/editor role
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE open_id = auth.uid()::TEXT
      AND role IN ('admin', 'manager', 'editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── PUBLIC READ policies (no auth required) ──────────────────────────────────

-- Site settings: public read, admin write
CREATE POLICY "site_settings_public_read"  ON site_settings FOR SELECT USING (TRUE);
CREATE POLICY "site_settings_admin_write"  ON site_settings FOR ALL    USING (is_admin_user());

-- SEO settings: public read, admin write
CREATE POLICY "seo_settings_public_read"   ON seo_settings  FOR SELECT USING (TRUE);
CREATE POLICY "seo_settings_admin_write"   ON seo_settings  FOR ALL    USING (is_admin_user());

-- Menu categories: public read active, admin write all
CREATE POLICY "menu_categories_public_read" ON menu_categories FOR SELECT USING (is_active = TRUE OR is_admin_user());
CREATE POLICY "menu_categories_admin_write" ON menu_categories FOR ALL    USING (is_admin_user());

-- Menu items: public read available, admin write all
CREATE POLICY "menu_items_public_read"  ON menu_items FOR SELECT USING (is_available = TRUE OR is_admin_user());
CREATE POLICY "menu_items_admin_write"  ON menu_items FOR ALL    USING (is_admin_user());

-- Events: public read active, admin write all
CREATE POLICY "events_public_read"  ON events FOR SELECT USING (is_active = TRUE OR is_admin_user());
CREATE POLICY "events_admin_write"  ON events FOR ALL    USING (is_admin_user());

-- Gallery: public read all, admin write
CREATE POLICY "gallery_public_read"  ON gallery_images FOR SELECT USING (TRUE);
CREATE POLICY "gallery_admin_write"  ON gallery_images FOR ALL    USING (is_admin_user());

-- Testimonials: public read featured, admin write all
CREATE POLICY "testimonials_public_read"  ON testimonials FOR SELECT USING (is_featured = TRUE OR is_admin_user());
CREATE POLICY "testimonials_admin_write"  ON testimonials FOR ALL    USING (is_admin_user());

-- ── WRITE-ONLY for anonymous users ───────────────────────────────────────────

-- Reservations: anyone can INSERT, only admins can SELECT/UPDATE/DELETE
CREATE POLICY "reservations_public_insert" ON reservations FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "reservations_admin_all"     ON reservations FOR ALL    USING (is_admin_user());

-- Contact messages: anyone can INSERT, only admins can SELECT/UPDATE/DELETE
CREATE POLICY "contact_public_insert" ON contact_messages FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "contact_admin_all"     ON contact_messages FOR ALL    USING (is_admin_user());

-- ── ADMIN-ONLY tables ─────────────────────────────────────────────────────────

-- Users: admins only
CREATE POLICY "users_admin_all"         ON users         FOR ALL USING (is_admin_user());
CREATE POLICY "users_self_read"         ON users         FOR SELECT USING (open_id = auth.uid()::TEXT);

-- Activity logs: admin read only
CREATE POLICY "activity_logs_admin_all" ON activity_logs FOR ALL USING (is_admin_user());

-- ─── STORAGE BUCKETS (run in Supabase dashboard Storage section) ──────────────
-- These are SQL representations; actual bucket creation is via the Supabase UI or API.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('elparaiso-media', 'elparaiso-media', true);
-- CREATE POLICY "media_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'elparaiso-media');
-- CREATE POLICY "media_admin_write"  ON storage.objects FOR ALL    USING (bucket_id = 'elparaiso-media' AND is_admin_user());
