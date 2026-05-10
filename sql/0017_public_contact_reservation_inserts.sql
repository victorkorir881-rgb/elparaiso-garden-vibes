-- 0017_public_contact_reservation_inserts.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Fix RLS denials on public website forms.
--
-- Symptom (in production):
--   - "new row violates row-level security policy for table contact_messages"
--     when a visitor submits the Contact form.
--   - "new row violates row-level security policy for table reservation_leads"
--     when a visitor submits the Reservations form.
--
-- Cause: the existing INSERT policies were not granted to the `anon` role,
-- so anonymous (logged-out) website visitors were blocked by RLS.
--
-- Fix: (re)create the public-insert policies and grant them to BOTH `anon`
-- and `authenticated`. Admin-only SELECT/UPDATE/DELETE policies created in
-- earlier migrations are unchanged.
--
-- Apply in: Supabase SQL Editor (idempotent — safe to re-run).
-- ─────────────────────────────────────────────────────────────────────────────

-- contact_messages: allow public INSERT
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_public_insert" ON public.contact_messages;
CREATE POLICY "contact_public_insert"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- reservation_leads: allow public INSERT
ALTER TABLE public.reservation_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservation_public_insert" ON public.reservation_leads;
CREATE POLICY "reservation_public_insert"
  ON public.reservation_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
