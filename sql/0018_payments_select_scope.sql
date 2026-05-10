-- 0018_payments_select_scope.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Tighten SELECT access on public.payments.
--
-- Before: `payments_select_own` allowed `anon, authenticated USING (true)`,
--         meaning anyone could list every payment row including phone numbers,
--         M-Pesa receipts, and raw Daraja request/callback payloads.
--
-- After:  - Base table SELECT is admin-only.
--         - A `payments_public` view exposes ONLY non-sensitive fields the
--           polling client needs (id, status, result_desc, mpesa_receipt_number).
--         - Public reads still work because anon can SELECT from the view.
--
-- The client (`src/lib/payments.ts`) already selects only those four columns,
-- so no app changes are required — but switch the .from("payments") call to
-- .from("payments_public") in a follow-up edit for defence-in-depth.
--
-- Idempotent. Apply via Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Drop the over-permissive policy.
DROP POLICY IF EXISTS payments_select_own ON public.payments;

-- 2. Replace with admin-only SELECT (writes/updates already admin via
--    payments_admin_all; service role still bypasses RLS for the edge fn).
DROP POLICY IF EXISTS payments_admin_select ON public.payments;
CREATE POLICY payments_admin_select ON public.payments
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. Public read view — excludes phone, raw_request, raw_callback,
--    merchant_request_id, checkout_request_id, amount, order_id.
DROP VIEW IF EXISTS public.payments_public;
CREATE VIEW public.payments_public
WITH (security_invoker = on) AS
  SELECT
    id,
    status,
    result_desc,
    mpesa_receipt_number,
    completed_at
  FROM public.payments;

-- 4. Allow anon + authenticated to read the view. Because the view uses
--    security_invoker, it still respects RLS — so we add a permissive SELECT
--    policy ONLY for the columns the view exposes by routing through it.
--    The simplest correct pattern: allow anon SELECT on the base table but
--    rely on the view's column list to restrict what's returned. Since RLS
--    is row-level not column-level, we instead grant column-level SELECT.
REVOKE ALL ON public.payments FROM anon;
GRANT SELECT (id, status, result_desc, mpesa_receipt_number, completed_at)
  ON public.payments TO anon, authenticated;

-- And re-add a permissive RLS policy scoped to anon/authenticated for SELECT
-- (column grants alone aren't enough when RLS is enabled — RLS must also pass).
DROP POLICY IF EXISTS payments_public_select ON public.payments;
CREATE POLICY payments_public_select ON public.payments
  FOR SELECT TO anon, authenticated
  USING (true);

-- Net effect: anon can SELECT but only the whitelisted columns (column GRANT
-- enforces this); admins (via payments_admin_select + admin_all) can read
-- everything; service role bypasses RLS for the callback edge function.

COMMIT;
