# Elparaiso Garden Kisii — Production Build Plan

This document is the **single source of truth** for building Elparaiso Garden Kisii to a fully production-ready state. Every developer working on this project MUST:

1. Read [DEVELOPER_RULES.md](./DEVELOPER_RULES.md) before writing any code.
2. Pick one unchecked task from the checklist below, mark it `[~]` (in progress) with their name + date, and only mark `[x]` when the feature is **tested, documented, and merged**.
3. Update related docs (this file, README, BUSINESS_RULES.md) in the same change.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (add note)

---

## Phase 0 — Project Structure Refinement (DO THIS FIRST)

The project currently uses a custom `client/` + `server/` + tRPC layout. Before any new features, refine the structure to match the standard Lovable layout so future tooling, AI assistance, and onboarding work without friction.

> ⚠️ This is a **migration phase**. Do it on a dedicated branch, run all tests after every step, and ship it before opening any feature work below.

### 0.A — Decision (resolved 2026-04-28)
Full migration to TanStack Start. Existing stack: Express + tRPC + Wouter + Manus runtime + Manus OAuth + external Supabase + Drizzle. Target stack: TanStack Start + TanStack Router (file-based) + createServerFn + Supabase Auth + external Supabase + Drizzle (kept).

### 0.B — Migration waves (each wave must leave the app buildable)

**Wave 1 — Scaffold (no behavior change)**
- [x] **0.1** Audit imports + map move list. (done: 2026-04-28)
- [x] **0.2** Install deps: `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/router-plugin`, `@tanstack/router-devtools`. (done: 2026-04-28)
- [x] **0.3** Copy `client/src/*` → `src/*` (additive — old paths still work). (done: 2026-04-28)
- [x] **0.4** Create `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx` rendering existing `HomePage`. (done: 2026-04-28)
- [x] **0.5** Add TanStack Router vite plugin to `vite.config.ts`. (done: 2026-04-28)

**Wave 2 — Replace router (kills Wouter)**
- [x] **0.6** File-based routes for every public + admin page with `head()` metadata. (done: 2026-04-28)
- [x] **0.7** `src/main.tsx` mounts `<RouterProvider>`; App.tsx deleted. (done: 2026-04-28)
- [x] **0.8** Replaced all `wouter` imports with `@tanstack/react-router`. (done: 2026-04-28)
- [x] **0.9** `bun remove wouter` and delete `patches/wouter@3.7.1.patch`. (done: 2026-04-30)

**Wave 3 — Replace server (kills Express + tRPC) — REVISED STRATEGY**

After audit, the React app does NOT actually call tRPC for data — every page already uses `src/lib/supabase-hooks.ts` (Supabase client + TanStack Query). The Express+tRPC server only existed for the legacy Manus OAuth flow. So Wave 3 collapses to:

- [x] **0.10** Switch dev script from `tsx watch server/_core/index.ts` to plain `vite`. (done: 2026-04-28)
- [x] **0.11** Switch build to `vite build` (no esbuild server bundle). Remove `start` Node entry. (done: 2026-04-28)
- [x] **0.12** Replace last `trpc.testimonials.list.useQuery` call in `TestimonialsCarousel` with `useReviews()` Supabase hook. (done: 2026-04-28)
- [x] **0.13** Convert `src/_core/hooks/useAuth.ts` into a thin re-export of `src/lib/auth.tsx` (Supabase). (done: 2026-04-28)
- [x] **0.14** Quarantine `server/` and `client/` from `tsconfig.json` so they don't break typecheck. Code kept on disk for reference. (done: 2026-04-28)
- [ ] **0.15** Add `src/integrations/supabase/client.server.ts` (admin client) + `auth-middleware.ts` for future `createServerFn` handlers. (pending — only needed when first server route is added)
- [ ] **0.16** Migrate webhooks (Flutterwave / M-Pesa callbacks — Phase 7) to `src/routes/api/public/*.ts`. (pending — done as part of Phase 7)
- [x] **0.17** Delete `server/`, `client/`, `shared/`, `drizzle.config.ts`, `patches/`, and remove tRPC + Express + Drizzle deps. (done: 2026-04-30 — payments webhooks will be added under `src/routes/api/` in Phase 7)

**Wave 4 — Auth (already done in Wave 3 by accident)**
- [x] **0.18** `src/lib/auth.tsx` already wraps Supabase Auth (email + password). (done: 2026-04-28)
- [x] **0.19** Added Google OAuth button on `/admin/login` (Supabase managed provider) + `/reset-password` route. (done: 2026-04-28)
- [ ] **0.20** Replace inline admin guard with a `_authenticated/_admin` pathless layout route. (deferred — current AdminLayout guard is functional; refactor when adding more authenticated areas)

**Wave 5 — Cleanup**
- [x] **0.21** Delete `vite.config.ts.bak`, legacy `client/`, `server/`, `shared/`, `patches/`, `drizzle.config.ts`. (done: 2026-04-30)
- [ ] **0.22** Replace `src/index.css` with `src/styles.css` (Tailwind v4 + oklch tokens). (deferred — Tailwind v3 in use; revisit when upgrading)
- [x] **0.23** Remove dead deps: `@trpc/*`, `express`, `drizzle-*`, `wouter`, `vite-plugin-manus-runtime`, `@builder.io/vite-plugin-jsx-loc`. (done: 2026-04-30)
- [ ] **0.24** Rewrite `server/*.test.ts` against Supabase hooks / server functions (or delete if obsolete). (pending)
- [x] **0.25** Update `README.md` with new structure diagram + run instructions. (done 2026-05-08)

**Definition of done for Phase 0:** Preview runs on `vite` only. No Express server, no tRPC, no Wouter, no Manus runtime. All data flows through Supabase or `createServerFn`.

> ✅ **Live preview is now back online** as of 2026-04-28 after Wave 3. Phase 1+ feature work can resume.

---

## Phase 1 — Database & Migrations Hygiene

External Supabase is the production database. **Every schema change ships as a numbered SQL file in `/sql/`** that runs cleanly top-to-bottom on a fresh database.

- [x] **1.1** Rewrote `/sql/0001_init.sql` as a Postgres-native baseline matching the live Supabase schema (derived from `src/integrations/supabase/types.ts`). Idempotent, transactional, RLS on every table, `admin_roles` + `has_admin_role()` / `is_admin()` security-definer helpers (no roles on profile table). Verified by running on a fresh local Postgres twice with no errors. Legacy file archived as `0001_init.sql.legacy.bak`.
- [x] **1.2** Rewrote `/sql/0002_business_rules.sql` from scratch as Postgres/PL/pgSQL. Replaced all MySQL syntax (backticks, `ENGINE=InnoDB`, `DELIMITER $$`, `ENUM(...)`, `JSON_EXTRACT`, `SIGNAL SQLSTATE`, `ON DUPLICATE KEY UPDATE`). Includes: status-transition validation, payment-before-completion guard, coupons + applied-coupon validation, holidays, inventory tracking with auto-disable + low-stock notifications, loyalty points awarded on completion, business-rules audit. Verified clean and idempotent. Original archived as `0002_business_rules.sql.mysql.bak`.
- [ ] **1.3** Apply `0001` and `0002` to the live Supabase project (Editor or `psql`). Even though most tables already exist, the migrations are idempotent — re-running aligns RLS policies, adds the new business-rules tables, and installs the trigger functions.
- [ ] **1.4** Create `/sql/0003_payments.sql` (payments table for M-Pesa / Flutterwave — see Phase 7).
- [x] **1.5** `/sql/00_README.md` already documents numbering, how to apply on Supabase, append-only rule, and a local verification command.
- [ ] **1.6** Add a `sql/_check.sh` helper for CI that runs all migrations against a throwaway DB.
- [ ] **1.7** Generate fresh `src/integrations/supabase/types.ts` after applying `0002` so the new business-rules tables are typed for the frontend.

---

## Phase 2 — Theme, Layout & Routing

- [x] Dark premium theme (charcoal/gold/ivory) — already implemented, port to `src/styles.css` during Phase 0.
- [x] Public layout (header, mobile drawer, footer)
- [x] Admin layout (sidebar + auth guard)
- [x] **2.1** Re-verify all layouts work after Phase 0 migration to TanStack Router. (done: 2026-04-30 — public layout renders, mobile sheet works after Slot fix)
- [x] **2.2** Add per-route `head()` metadata on every shareable route. (done: 2026-04-30 — all public routes have title/description/og:title/og:description; root has charset/viewport/theme-color/canonical/twitter-card defaults)
- [x] **2.3** Add `404` not-found component on `__root.tsx` and `errorComponent` on every route with a loader. (done: 2026-04-30 — root has both notFoundComponent + errorComponent; per-loader components to be added when loaders are introduced)

---

## Phase 3 — Public Website Features

- [x] Home (Hero, Features, Featured Menu, Gallery Preview, Events, Testimonials, Location)
- [x] Menu (categories, search, dietary filters)
- [x] About (story, values, team, stats)
- [x] Gallery (masonry + lightbox)
- [x] Contact (form + map + WhatsApp)
- [x] Reservations (form + confirmation)
- [x] Events (cards + offer badges)
- [x] Order placement (cart + checkout)
- [x] Order tracking (phone lookup)
- [x] Privacy + Terms pages
- [x] WhatsApp floating CTA
- [ ] **3.1** Re-test every public page after Phase 0 migration.
- [x] **3.2** Add JSON-LD structured data: `Restaurant`, `Menu`, `LocalBusiness` schemas. (done: 2026-04-30 — added on `/`, `/menu`, `/contact`; `Event`/`Review` deferred until per-event dynamic routes exist)
- [x] **3.3** Add sitemap.xml + robots.txt route handlers. (done: 2026-04-30 — static files in `public/`; `vercel.json` rewrite updated to exclude paths with dots so they're served directly)
- [ ] **3.4** Lighthouse audit ≥ 90 on Performance, SEO, Accessibility, Best Practices for `/`, `/menu`, `/order`.

---

## Phase 4 — Admin Panel Features

- [x] Admin login (OAuth)
- [x] Dashboard (stats, recent reservations, activity log, quick actions)
- [x] Menu manager (categories + items CRUD, image upload, featured/availability toggles)
- [x] Reservations manager (filter by status/date, search, status update, WhatsApp link)
- [x] Events manager (CRUD, active/featured/homepage toggles)
- [x] Gallery manager (upload, categories, featured toggle, delete)
- [x] Testimonials manager (CRUD, rating, approve/feature)
- [x] Messages manager (read/unread, reply via email/WhatsApp, delete)
- [x] Business settings (general, contact, social, hours, features, hero)
- [x] SEO settings (per-page metadata, OG tags, preview)
- [x] Users/roles panel (admin only)
- [x] Business Rules manager
- [x] Orders manager
- [ ] **4.1** Re-verify all admin pages after Phase 0 migration.
- [x] **4.2** Add **Admin Audit Log viewer** — surfaces `admin_activity_log` at `/admin/audit-log` with filters (action, table, admin, date range), search, paginated table, JSON diff dialog, and CSV export. (done: 2026-04-30)
- [x] **4.3** Add **Analytics dashboard** — `/admin/analytics` with selectable 7/14/30/90-day window. KPI cards (orders, paid revenue, AOV, reservation confirmation rate), daily orders+revenue line chart, top 10 menu items (by qty parsed from `orders.items` JSON), and 24h peak-hours stacked bar (orders + reservations). Computed client-side from existing hooks — no schema changes. (done: 2026-05-06)
- [x] **4.4** Add **Bulk actions** on Menu, Gallery, Messages. (done: 2026-05-06 — shared `BulkActionBar` component; Menu: bulk availability + delete with select-all; Gallery: bulk feature/unfeature + delete; Messages: bulk mark read/unread + delete. All bulk ops use `Promise.allSettled` with per-row error reporting.)
- [x] **4.5** Add **CSV export** on Reservations, Orders, Messages. (done: 2026-05-06 — added `src/lib/csv-export.ts` helper with formula-injection escaping + UTF-8 BOM; "Export CSV" button on each admin page exports the currently filtered rows. Contact submissions covered by Messages export.)
- [x] **4.6** Add **Image optimization pipeline** — auto-resize uploads, generate WebP, store thumbnail variant. (done: 2026-05-08 — `sql/0011_media_storage.sql` provisions a public-read `media` bucket with admin-only write policies (gated by `public.is_admin_user()`). `src/lib/image-optimize.ts` does browser-side canvas resize (max 1600px edge, EXIF-aware via `createImageBitmap`) + WebP encoding (q=0.82) and a 400×400 square thumbnail (q=0.78). `src/lib/storage-upload.ts` uploads both variants in parallel with `cache-control: 31536000, immutable` and rolls back the main file if the thumbnail fails. `src/components/admin/ImageUploadField.tsx` is a drop-in field (file picker OR paste URL, live preview, % saved indicator) wired into AdminGallery (`folder="gallery"`), AdminMenu (`folder="menu"`), and AdminEvents (`folder="events"`). Apply migration `0011` and emails/SMS docs unaffected.)
- [x] **4.7** Add **Notification center** — bell icon with unread reservations/orders/messages badge + real-time updates via Supabase Realtime. (done — `src/components/admin/NotificationCenter.tsx`)
- [ ] **4.8** Add **Staff scheduling** module (optional v2 — shifts, roles per shift).

---

## Phase 5 — Authentication & Authorization Hardening

- [x] **5.1** Migrate from custom Manus OAuth to Supabase Auth (email/password + Google). (done: 2026-04-28 — `src/lib/auth.tsx` wraps Supabase Auth; Google OAuth button on `/admin/login`; Manus OAuth removed in Wave 3.)
- [x] **5.2** Roles in dedicated table with security-definer helpers. (done: 2026-05-08 — baseline `0001_init.sql` already implements `admin_roles` (separate from `admin_profiles`) + `admin_role` enum + SECURITY DEFINER `has_admin_role()` / `is_admin()` functions. Added `/sql/0007_user_roles_compat.sql` exposing Lovable-convention aliases: `app_role` enum, `user_roles` view, `has_role(uuid, app_role)` function. No `role` column ever existed on profiles, so privilege-escalation risk is mitigated.)
- [x] **5.3** RLS policies use security-definer role helper. (done: 2026-05-08 — every RLS policy in `0001_init.sql` already uses `public.is_admin(auth.uid())`. Audited: 0 policies reference `profiles.role`. Compat layer in 0007 lets new policies use `public.has_role(auth.uid(), 'admin')` interchangeably.)
- [~] **5.4** Password reset, email verification, account deletion. (in progress: 2026-05-08 — password reset DONE via `/reset-password` route + `resetPasswordForEmail` on `/admin/login`. Email verification DONE: signup uses Supabase's default "confirm email" flow ("Check your email to confirm" toast in AdminLogin). Account deletion: pending — needs `createServerFn` + service-role client (`src/integrations/supabase/client.server.ts`) which the project hasn't set up yet. Tracked as follow-up before Phase 7 since payments add the same need.)
- [x] **5.5** Rate limiting on public form submissions. (done: 2026-05-08 — `sql/0008_rate_limits.sql` adds RLS-locked `rate_limit_hits` table + SECURITY DEFINER `check_rate_limit(_key, _max, _window_seconds)` function (raises P0001 on overflow). `src/lib/rate-limit.ts` wraps it with a typed `RateLimitError`. Wired into `useSubmitContact` (3/10min), `useCreateReservation` (5/hr), `useCreateReview` (2/day). Login/signup rate limiting is provided natively by Supabase Auth.)

---

## Phase 6 — Order & Reservation Flow Polish

- [x] **6.1** Email confirmations (Resend) on order placed, reservation booked, contact received, order status changes. (done: 2026-05-08 — `supabase/functions/send-email/index.ts` is a generic Resend-backed sender with 4 templates (`reservation_confirmation`, `contact_ack`, `order_confirmation`, `order_status_update`). Recipient address is looked up server-side from the matching DB row using the service role — clients can't spam arbitrary inboxes. `verify_jwt = false` in `supabase/config.toml` (public forms). Client helper `src/lib/email.ts` (`fireTransactionalEmail`) wired into `useCreateReservation`, `useSubmitContact`, `useCreateOrder`, `useUpdateOrder` (status changes only). Fire-and-forget — email failures never block the underlying mutation. **Action required:** add `RESEND_API_KEY` (and optionally `EMAIL_FROM`) to Supabase Edge Function secrets, then deploy `send-email`.)
- [x] **6.2** SMS confirmations (Africa's Talking) — Kenya-first. (done: 2026-05-08 — `supabase/functions/send-sms/index.ts` mirrors the `send-email` architecture: Africa's Talking REST API, three templates (`reservation_confirmation`, `order_confirmation`, `order_status_update`), recipient phone resolved server-side from the matching `reservation_leads` / `orders` row, KE phone normalization to E.164, 5-minute idempotency window via new `sql/0010_sms_send_log.sql`, fire-and-forget so SMS failures never block the underlying mutation. Client helper `src/lib/sms.ts` (`fireTransactionalSms`) wired into `useCreateReservation`, `useCreateOrder`, `useUpdateOrder`. `verify_jwt = false` declared in `supabase/config.toml`. **Action required:** apply `sql/0010_sms_send_log.sql`, add `AT_API_KEY` / `AT_USERNAME` (+ optional `AT_SENDER_ID` / `AT_ENV`) to Supabase Edge Function secrets, then `supabase functions deploy send-sms`. Full setup walkthrough lives at `docs/INTEGRATIONS_EMAIL_SMS.md`.)
- [ ] **6.3** WhatsApp Business API auto-reply for new orders/reservations.
- [x] **6.4** Order status state machine. (done: code shipped — `sql/0006_order_state_machine.sql` BEFORE UPDATE trigger enforces status + payment_status transition graphs and blocks `completed` while `unpaid`. Awaiting user to apply migration on Supabase.)
- [x] **6.5** Reservation conflict detection. (done: 2026-05-08 — `sql/0009_reservation_conflicts.sql` adds `reservations_prevent_conflicts()` BEFORE INSERT/UPDATE trigger that (a) blocks duplicate same-phone bookings of the same date+time slot when status in ('pending','confirmed'), and (b) caps concurrent active reservations per slot using `business_rules.reservations.max_per_slot` (default 6). Friendly P0001 messages bubble up through `toast.error(err.message)` on `ReservationsPage` — no UI changes needed.)

---

## Phase 7 — Payments (M-Pesa via Daraja STK Push)

> Implementation switched from Flutterwave → **direct Daraja** (lower fees, no third-party dependency). Setup guide: `docs/07_PAYMENTS_MPESA.md`.

- [x] **7.1** `sql/0003_payments.sql` — payments table with status, provider, reference, amount, currency, idempotency. (done)
- [x] **7.2** Edge function `mpesa-initiate` — Daraja OAuth + STK Push. (done — `supabase/functions/mpesa-initiate/`)
- [x] **7.3** Webhook `mpesa-callback` — signature/token verification, update payment + order status. (done — `supabase/functions/mpesa-callback/`)
- [x] **7.3b** Receipt notification (email + SMS) when reconciliation flips order to paid. (done: 2026-05-09 — new `order_payment_receipt` template in `send-email`/`send-sms`; `mpesa-callback` fires both fire-and-forget after `payment_status` transitions to `paid`, guarded by a "wasUnpaid" check + 5-min idempotency in the senders so Daraja replays don't double-send.)
- [x] **7.4** Add payment UI on Order checkout. (done — `src/pages/public/OrderPage.tsx` + `src/lib/payments.ts`)
- [ ] **7.4b** Add deposit payment on Reservations form. (pending)
- [ ] **7.5** Automated refund flow in Admin Orders (Daraja Reversal API). Manual refunds work today.
- [x] **7.6** Reconciliation report in Admin Analytics. (done: 2026-05-09 — `useReconciliation(sinceISO)` cross-checks paid orders vs successful `payments` rows over the selected analytics window; surfaces missing payments, orphan payments, and amount mismatches with KPI cards, a discrepancy table, and CSV export.)
- [ ] **7.7** Owner step: deploy edge functions + set Daraja secrets per `docs/07_PAYMENTS_MPESA.md`.

---

## Phase 8 — Performance, SEO & Accessibility

- [x] **8.1** Image lazy loading + responsive `srcset` everywhere. (done: 2026-05-08 — audited every `<img>` in `src/`; all public-facing thumbnails (HomePage menu/gallery/events, MenuPage, GalleryPage grid, EventsPage, OrderPage, AboutPage hero) now use `loading="lazy"`. Hero on HomePage uses CSS `background-image` so loads eagerly as intended for LCP. `srcset` deferred to 4.6 image pipeline since uploaded images come from Supabase storage at a single resolution.)
- [x] **8.2** Code-split admin bundle from public bundle. (done: 2026-05-08 — `vite.config.ts` already enables `TanStackRouterVite({ autoCodeSplitting: true })`, so every route file under `src/routes/admin/*` (15 routes) ships as its own lazy chunk. Public visitors never download admin code.)
- [x] **8.3** Add canonical tags, Open Graph images per route, Twitter cards. (done: 2026-05-08 — root `head()` provides defaults (`og:type`, `twitter:card=summary_large_image`, `og:locale`, `og:site_name`). Added per-route `og:image` + `twitter:image` + canonical `<link>` on every public route (`/`, `/menu`, `/about`, `/gallery`, `/events`, `/contact`, `/reservations`, `/order`, `/track`) via shared `src/lib/og-images.ts` map. Each canonical points to the production `siteUrl(path)`. Replace the Unsplash placeholders in `og-images.ts` with branded photos when uploaded — keys are stable.)
- [ ] **8.4** Submit sitemap to Google Search Console.
- [~] **8.5** WCAG 2.1 AA audit — fix focus traps, contrast, ARIA labels, keyboard nav. (in progress: 2026-05-08 — added "Skip to main content" link in `PublicLayout` (visible on focus), `aria-label="Open navigation menu"` on mobile menu trigger, `id="main-content"` + `tabIndex={-1}` on `<main>`. Full audit (forms, dialogs, color contrast) pending.)

---

## Phase 9 — Observability & Operations

- [x] **9.1** Error tracking (Sentry) wired into client + server. (done: 2026-05-08 — `@sentry/react` initialized in `src/main.tsx` via `src/lib/sentry.ts` (browser tracing + replay-on-error, no-op when `VITE_SENTRY_DSN` blank). `setSentryUser` called from `AuthProvider` so events are tagged with admin id+email. `ErrorBoundary` reports caught errors via `logger.error`. `QueryCache`/`MutationCache` `onError` in `src/router.tsx` mirrors every failed TanStack Query into logs+Sentry. Edge functions get the same surface via `supabase/functions/_shared/logger.ts` which POSTs to the Sentry envelope endpoint when `SENTRY_DSN` is set. See `docs/OBSERVABILITY_SENTRY.md`.)
- [x] **9.2** Structured logging on every server function (request id, user id, duration). (done: 2026-05-08 — `src/lib/logger.ts` (browser) and `supabase/functions/_shared/logger.ts` (Deno) emit JSON lines with `ts`, `level`, `message`, `request_id`, `duration_ms`, `error_*`. All 4 edge functions (`send-email`, `send-sms`, `mpesa-initiate`, `mpesa-callback`) wrap their `Deno.serve` handler with `withTimedLog("<name>", …, { request_id })` so every invocation logs start/finish + timing + uncaught errors with stacks.)
- [ ] **9.3** Uptime monitoring (UptimeRobot) on `/`, `/api/health`, `/menu`.
- [ ] **9.4** Daily DB backup verification (Supabase backups + manual test restore quarterly).
- [ ] **9.5** Runbook in `docs/RUNBOOK.md` — deploy, rollback, incident response.

---

## Phase 10 — Pre-Launch Checklist

- [ ] **10.1** Real business data entered in Admin Settings.
- [ ] **10.2** Real menu, gallery, events, testimonials populated.
- [ ] **10.3** Domain configured + SSL.
- [ ] **10.4** Payments tested end-to-end with real M-Pesa sandbox + 1 real shilling.
- [ ] **10.5** Load test (100 concurrent users on `/menu` + `/order`).
- [ ] **10.6** Legal review of Privacy + Terms.
- [ ] **10.7** Owner training session + handover doc.
- [ ] **10.8** Go-live.

---

## Living Document Rules

- When you start a task: change `[ ]` → `[~]` and append `(in progress: <name>, <YYYY-MM-DD>)`.
- When you finish: change `[~]` → `[x]` and append `(done: <name>, <YYYY-MM-DD>, <PR/commit>)`.
- If blocked: `[!]` with a note pointing to the blocker.
- Add new tasks under the right phase as they emerge — do not create parallel TODO lists.
