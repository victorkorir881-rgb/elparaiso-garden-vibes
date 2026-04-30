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
- [ ] **0.25** Update `README.md` with new structure diagram + run instructions. (pending)

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
- [ ] **2.2** Add per-route `head()` metadata on every shareable route.
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
- [ ] **3.2** Add JSON-LD structured data: `Restaurant`, `Menu`, `Event`, `Review` schemas.
- [ ] **3.3** Add sitemap.xml + robots.txt route handlers.
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
- [ ] **4.2** Add **Admin Audit Log viewer** — surface `activity_log` table with filtering by user/action/date.
- [ ] **4.3** Add **Analytics dashboard** — orders/revenue per day, top menu items, reservation conversion rate, peak hours heatmap.
- [ ] **4.4** Add **Bulk actions** on Menu, Gallery, Messages (multi-select + delete/toggle).
- [ ] **4.5** Add **CSV export** on Reservations, Orders, Messages, Contact submissions.
- [ ] **4.6** Add **Image optimization pipeline** — auto-resize uploads, generate WebP, store thumbnail variant.
- [ ] **4.7** Add **Notification center** — bell icon with unread reservations/orders/messages badge + real-time updates via Supabase Realtime.
- [ ] **4.8** Add **Staff scheduling** module (optional v2 — shifts, roles per shift).

---

## Phase 5 — Authentication & Authorization Hardening

- [ ] **5.1** Migrate from custom Manus OAuth to Supabase Auth (email/password + Google) — keep backwards compat during transition.
- [ ] **5.2** Implement `user_roles` table per Lovable convention (separate from `profiles`, with `app_role` enum + `has_role()` security-definer function). Add migration `/sql/0005_user_roles.sql`.
- [ ] **5.3** Refactor every RLS policy that currently checks role on `profiles` to use `has_role(auth.uid(), 'admin')`.
- [ ] **5.4** Add password reset, email verification, account deletion flows.
- [ ] **5.5** Add rate limiting on login, signup, contact form, reservation form.

---

## Phase 6 — Order & Reservation Flow Polish

- [ ] **6.1** Email confirmations (Resend) on order placed, reservation booked, status changes.
- [ ] **6.2** SMS confirmations (Africa's Talking) — Kenya-first.
- [ ] **6.3** WhatsApp Business API auto-reply for new orders/reservations.
- [ ] **6.4** Order status state machine — enforce valid transitions in DB trigger (`/sql/0006_order_state_machine.sql`).
- [ ] **6.5** Reservation conflict detection (table double-booking prevention).

---

## Phase 7 — Payments (M-Pesa via Flutterwave)

- [ ] **7.1** `/sql/0004_payments.sql` — payments table with status, provider, reference, amount, currency, idempotency_key.
- [ ] **7.2** Server function `initiateMpesaPayment` — call Flutterwave STK Push.
- [ ] **7.3** Webhook route `src/routes/api/public/flutterwave-webhook.ts` — signature verification, update payment + order status.
- [ ] **7.4** Add payment UI on Order checkout + Reservations deposit.
- [ ] **7.5** Refund flow in Admin Orders manager.
- [ ] **7.6** Reconciliation report in Admin Analytics.

---

## Phase 8 — Performance, SEO & Accessibility

- [ ] **8.1** Image lazy loading + responsive `srcset` everywhere.
- [ ] **8.2** Code-split admin bundle from public bundle.
- [ ] **8.3** Add canonical tags, Open Graph images per route, Twitter cards.
- [ ] **8.4** Submit sitemap to Google Search Console.
- [ ] **8.5** WCAG 2.1 AA audit — fix focus traps, contrast, ARIA labels, keyboard nav.

---

## Phase 9 — Observability & Operations

- [ ] **9.1** Error tracking (Sentry) wired into client + server.
- [ ] **9.2** Structured logging on every server function (request id, user id, duration).
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
