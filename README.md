# Elparaiso Garden Kisii — Premium Hospitality Website

A production-ready website + admin dashboard for **Elparaiso Garden Kisii**, a 24/7 bar, grill and restaurant in Kisii, Kenya. Dark-premium theme, mobile-first public site, secure admin panel, real-time orders & reservations, M-Pesa-ready checkout.

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) v1 (React 19 + Vite 7) with file-based routing in `src/routes/`
- **Styling:** Tailwind CSS, shadcn/ui components, semantic design tokens in `src/index.css`
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime) — all data access through `@supabase/supabase-js`
- **State / data:** TanStack Query
- **Forms / validation:** React Hook Form + Zod
- **Hosting:** Vercel (production) — see `docs/04_HOSTING.md`
- **Observability:** Sentry (`src/lib/sentry.ts`), structured logger (`src/lib/logger.ts`)
- **Tests:** Vitest

## Repo layout

```
src/
  routes/                     File-based routes (TanStack Router)
    __root.tsx                Root layout, global meta, scroll-restore
    index.tsx, menu.tsx, …    Public pages (each with own SEO head)
    admin.tsx, admin/*.tsx    Admin shell + per-section routes
  pages/
    public/*.tsx              Public page components
    admin/*.tsx               Admin page components (CRUD UIs)
  components/
    public/PublicLayout.tsx   Header, footer, WhatsApp CTA
    admin/AdminLayout.tsx     Sidebar, auth guard, NotificationCenter
    admin/ImageUploadField.tsx  Browser-side image optimise → Supabase Storage
    ui/*                      shadcn primitives
  lib/
    supabase-hooks.ts         All TanStack Query hooks against Supabase
    storage-upload.ts         Upload to `media` bucket (resize + WebP)
    image-optimize.ts         Browser image pipeline
    auth.tsx                  Auth context + admin role check
    email.ts, sms.ts          Send via Supabase Edge Functions
    payments.ts               M-Pesa / Flutterwave helpers (Phase 7)
    logger.ts, sentry.ts      Observability
  integrations/supabase/
    client.ts                 Browser client (publishable key)
    types.ts                  Generated DB types
sql/                          Numbered, idempotent SQL migrations (run in order)
supabase/functions/           Edge functions: send-email, send-sms, mpesa-*
docs/                         Project plan, business rules, integration & ops
public/                       Static assets, robots.txt, sitemap.xml, sw.js
```

## Getting started

### 1. Prerequisites
- Node 20+ and `bun` (or `npm`)
- A Supabase project (free tier is fine)

### 2. Configure environment
Copy `.env.example` → `.env` and fill in:

```
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon/publishable key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"
VITE_SITE_URL="https://elparaisogardens.vercel.app"
```

`VITE_SITE_URL` is the canonical production URL used for Supabase auth redirects and SEO canonicals.

### 3. Apply database migrations
Open Supabase → **SQL Editor** and run each file in `sql/` in numeric order (`0001` → `0011`). They are idempotent.

For storage (admin image uploads), see `docs/06_MENU_IMAGE_UPLOADS.md` — you need the `media` bucket + RLS policies (already covered by `sql/0011_media_storage.sql`).

### 4. Install + run

```bash
bun install
bun dev          # http://localhost:5173
bun run build    # production build
bun test         # vitest
```

### 5. Create the first admin
- Sign up via `/admin/login` (email + password).
- In Supabase SQL Editor, grant the role:
  ```sql
  insert into public.user_roles (user_id, role)
  values ((select id from auth.users where email = 'you@example.com'), 'admin');
  ```

## Documentation

All design + operational docs live in [`docs/`](./docs):

| File | What's in it |
|---|---|
| `00_PROJECT_PLAN.md` | Living project plan, phases, status |
| `01_DEVELOPER_RULES.md` | Coding conventions, file boundaries |
| `02_BUSINESS_RULES.md` | Hours, deposits, cancellation, capacity |
| `03_INTEGRATION.md` | Supabase, Edge Functions, third parties |
| `04_HOSTING.md` | Vercel deploy, env vars, domains |
| `05_ORDER_PAYMENTS_AND_ADMIN.md` | Order state machine, payment flow |
| `06_MENU_IMAGE_UPLOADS.md` | Storage bucket setup + admin upload flow |
| `INTEGRATIONS_EMAIL_SMS.md` | Email & SMS providers, templates |
| `OBSERVABILITY_SENTRY.md` | Sentry setup, log conventions |

## Public site map

`/`, `/menu`, `/order`, `/track`, `/reservations`, `/events`, `/gallery`, `/about`, `/contact`, `/privacy`, `/terms`

Each route owns its own `<title>`, meta description, canonical, OG + Twitter image — see `src/routes/*.tsx`.

## Admin panel

Mounted at `/admin/*`, gated by `AdminLayout`'s auth + role check. Sections:

`Dashboard · Menu · Reservations · Orders · Events · Gallery · Testimonials · Messages · Business Rules · Settings · SEO · Users · Analytics · Audit Log`

Real-time bell notifications (unread messages, pending reservations, new orders) via Supabase Realtime — see `src/components/admin/NotificationCenter.tsx`.

## Deployment

Push to the connected GitHub repo → Vercel auto-deploys. Set the same `VITE_*` env vars in Vercel for **Production**, **Preview** and **Development**. Full instructions in `docs/04_HOSTING.md`.

## License

Proprietary — © Elparaiso Garden Kisii.
