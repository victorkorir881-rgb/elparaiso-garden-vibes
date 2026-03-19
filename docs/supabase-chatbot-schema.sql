-- =============================================================================
-- Elparaiso Garden Kisii — Chatbot Supabase Schema + Seed Data
-- =============================================================================
-- Copy and paste this entire file into the Supabase SQL Editor.
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: chatbot_faqs
-- Stores curated FAQ / canned answers for keyword + intent matching.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chatbot_faqs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  intent       text        NOT NULL,
  question     text        NOT NULL,
  answer       text        NOT NULL,
  keywords     jsonb       NOT NULL DEFAULT '[]',
  suggestions  jsonb                 DEFAULT '[]',
  is_active    boolean     NOT NULL DEFAULT true,
  priority     integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_intent     ON public.chatbot_faqs (intent);
CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_is_active  ON public.chatbot_faqs (is_active);
CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_priority   ON public.chatbot_faqs (priority DESC);

ALTER TABLE public.chatbot_faqs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous website visitors to read active FAQs only
CREATE POLICY IF NOT EXISTS "Public read active FAQs"
  ON public.chatbot_faqs
  FOR SELECT
  USING (is_active = true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: chatbot_conversations
-- Stores one row per chat session initiated on the website.
-- ─────────────────────────────────────────────────────────────────────────────

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

ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;

-- Allow anonymous visitors to insert their own conversation rows
CREATE POLICY IF NOT EXISTS "Public insert conversations"
  ON public.chatbot_conversations
  FOR INSERT
  WITH CHECK (true);

-- Visitors may only read their own conversation (by session_id match is done server-side;
-- for now allow insert-only from anonymous users — no public reads needed)


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: chatbot_messages
-- Stores every individual message in each conversation.
-- ─────────────────────────────────────────────────────────────────────────────

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

ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;

-- Allow anonymous visitors to insert messages
CREATE POLICY IF NOT EXISTS "Public insert messages"
  ON public.chatbot_messages
  FOR INSERT
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 4: reservation_leads
-- Captures reservation requests from the chatbot and contact form.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reservation_leads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  phone       text        NOT NULL,
  date        date,
  time        text,
  party_size  integer,
  notes       text,
  source      text        NOT NULL DEFAULT 'chatbot',
  status      text        NOT NULL DEFAULT 'new',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_leads_status     ON public.reservation_leads (status);
CREATE INDEX IF NOT EXISTS idx_reservation_leads_created_at ON public.reservation_leads (created_at DESC);

ALTER TABLE public.reservation_leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous visitors to submit reservation leads
CREATE POLICY IF NOT EXISTS "Public insert reservation leads"
  ON public.reservation_leads
  FOR INSERT
  WITH CHECK (true);


-- =============================================================================
-- FAQ SEED DATA
-- Run this after table creation. Uses ON CONFLICT DO NOTHING to stay idempotent.
-- =============================================================================

INSERT INTO public.chatbot_faqs (id, intent, question, answer, keywords, suggestions, is_active, priority)
VALUES

  (
    'faq-hours-001',
    'hours',
    'What are your opening hours?',
    'Elparaiso Garden Kisii is open **24 hours a day, 7 days a week** — including public holidays! Whether you want a late-night choma or an early morning coffee, we''ve got you covered. 🕐',
    '["open", "hours", "time", "24", "night", "closing", "schedule", "when", "always"]',
    '["Where are you located?", "Do you take reservations?"]',
    true,
    10
  ),

  (
    'faq-location-001',
    'location',
    'Where are you located?',
    'We''re located at **County Government Street, Kisii** (Plus Code: 8QCF+4R Kisii, Kenya). We''re easy to find in the heart of Kisii town. You can also get directions via Google Maps. 📍',
    '["where", "location", "address", "find", "directions", "map", "kisii", "county", "how to get"]',
    '["What time do you open?", "Is there parking available?"]',
    true,
    9
  ),

  (
    'faq-reservation-001',
    'reservation',
    'How do I make a reservation?',
    'We''d love to have you! You can make a reservation by:

• Using the **Reserve a Table** form on this page
• Calling us on **0791 224513**
• Messaging us on **WhatsApp**

We''re open 24/7 and welcome groups, families, and solo guests alike! 🍽️',
    '["reserve", "booking", "table", "book", "seat", "party", "group", "reservation"]',
    '["What''s on the menu?", "Call Now"]',
    true,
    9
  ),

  (
    'faq-menu-001',
    'menu',
    'What food do you serve?',
    'Our menu is all about **great Kenyan grills and flavour**:

🔥 **The Grill** — Famous Nyama Choma & delicious Mutura (avg KES 500–1,000)
🍹 **The Bar** — Craft cocktails, cold beer, premium spirits, wine
🥗 **Snacks & Bites** — Light bites for any time of day

Plenty of options for everyone!',
    '["menu", "food", "eat", "choma", "mutura", "nyama", "grill", "price", "dish", "serve", "meal"]',
    '["Do you do delivery?", "How do I reserve?"]',
    true,
    8
  ),

  (
    'faq-delivery-001',
    'delivery',
    'Do you offer delivery or takeaway?',
    'Yes! We offer multiple service options:

🚗 **Drive-Through** — Quick pick-up at the venue
🛍️ **Takeaway** — Order and collect
🚚 **Delivery** — We can arrange delivery for you
🍽️ **Dine-In** — Enjoy the full garden experience

Call **0791 224513** or WhatsApp us to arrange your order!',
    '["delivery", "takeaway", "take away", "drive through", "order", "deliver", "bring"]',
    '["What''s on the menu?", "Contact / WhatsApp"]',
    true,
    7
  ),

  (
    'faq-parking-001',
    'parking',
    'Is there parking available?',
    'Yes! We have **free, ample, and secure parking** on site. We can accommodate many vehicles comfortably. You can also take advantage of our unique **Car Wash & Dine** experience — get your car cleaned while you enjoy a meal! 🚗✨',
    '["parking", "park", "car", "vehicle", "space", "lot", "secure"]',
    '["Where are you located?", "What''s the car wash experience?"]',
    true,
    7
  ),

  (
    'faq-payment-001',
    'payment',
    'What payment methods do you accept?',
    'We accept a wide range of payment methods:

💳 **Debit & Credit Cards**
📱 **NFC Contactless Payments**
📲 **M-Pesa / Mobile Money**
💵 **Cash**

No need to worry about having the right method — we''ve got you covered!',
    '["pay", "payment", "cash", "card", "mpesa", "nfc", "mobile money", "debit", "credit", "accepted"]',
    '["How do I make a reservation?", "Where are you located?"]',
    true,
    6
  ),

  (
    'faq-contact-001',
    'contact',
    'How do I contact you?',
    'You can reach us through:

📞 **Phone:** 0791 224513
💬 **WhatsApp:** +254 791 224513
📍 **Visit:** County Government Street, Kisii

Our team is available 24/7 to assist you!',
    '["contact", "call", "phone", "number", "whatsapp", "reach", "talk"]',
    '["Where are you located?", "How do I reserve?"]',
    true,
    8
  ),

  (
    'faq-music-001',
    'music',
    'Do you have live music or entertainment?',
    'Absolutely! Elparaiso Garden is famous for its **great vibes and entertainment**:

🎵 **Live Music & DJ sets**
🌿 **Garden atmosphere** perfect for chilling
🎊 **Weekend parties and events**

The vibe here is unmatched in Kisii — come experience it yourself! 🔥',
    '["music", "dj", "live", "band", "vibe", "vibes", "entertainment", "dance", "party", "event"]',
    '["What''s on the menu?", "How do I reserve?"]',
    true,
    6
  ),

  (
    'faq-amenities-001',
    'amenities',
    'What amenities do you offer?',
    'Elparaiso Garden has everything you need:

♿ **Wheelchair-accessible toilet**
🚗 **Free, ample & secure parking**
💳 **NFC & card payments**
📅 **Table service & reservations accepted**
🎵 **Live music & DJ vibes**
🚿 **On-site car wash**
🕐 **Open 24/7**',
    '["amenity", "amenities", "features", "facilities", "wheelchair", "accessible", "toilet", "service"]',
    '["Is there parking?", "What are your hours?"]',
    true,
    5
  ),

  (
    'faq-carwash-001',
    'carwash',
    'Tell me about the car wash experience.',
    'Our **Car Wash & Dine** experience is one of a kind in Kisii! 🚗✨

Drop off your car for a thorough wash, then sit back and enjoy:
• Famous **Nyama Choma** or light snacks
• Ice-cold drinks from the bar
• Great garden atmosphere

By the time you''ve finished eating, your car will be gleaming! Plenty of free secure parking too.',
    '["car wash", "carwash", "wash", "clean car", "vehicle clean"]',
    '["Is there parking?", "What''s on the menu?"]',
    true,
    6
  )

ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- DONE ✅
-- Tables created, RLS enabled, policies applied, FAQ seed data inserted.
-- =============================================================================
