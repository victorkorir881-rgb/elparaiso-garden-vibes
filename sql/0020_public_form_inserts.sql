-- 0020_public_form_inserts.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Allow logged-out (anon) website visitors to submit:
--   • Reservations  → reservation_leads
--   • Contact form  → contact_messages
--   • Food orders   → orders
--   • Reviews       → reviews
--
-- Symptom this fixes:
--   "new row violates row-level security policy for table reservation_leads"
--   (and the same for contact_messages / orders / reviews).
--
-- Cause: existing public-insert policies were created without an explicit
-- TO clause, so the `anon` role was effectively blocked by RLS in some
-- Supabase environments. This migration recreates the policies with
-- TO anon, authenticated and WITH CHECK (true) so anonymous form
-- submissions are accepted.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── reservation_leads ──────────────────────────────────────────────────────
ALTER TABLE public.reservation_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservation_public_insert"     ON public.reservation_leads;
DROP POLICY IF EXISTS "Public insert reservation leads" ON public.reservation_leads;

CREATE POLICY "reservation_public_insert"
  ON public.reservation_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ─── contact_messages ───────────────────────────────────────────────────────
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_public_insert"     ON public.contact_messages;
DROP POLICY IF EXISTS "Public insert contact messages" ON public.contact_messages;

CREATE POLICY "contact_public_insert"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ─── orders ─────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_public_insert"  ON public.orders;
DROP POLICY IF EXISTS "Public insert orders"  ON public.orders;

CREATE POLICY "orders_public_insert"
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ─── reviews ────────────────────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_public_insert" ON public.reviews;
DROP POLICY IF EXISTS "Public insert reviews" ON public.reviews;

-- Public submissions land as not-approved / not-featured. Admins moderate.
CREATE POLICY "reviews_public_insert"
  ON public.reviews
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    COALESCE(is_approved, false) = false
    AND COALESCE(is_featured, false) = false
  );
