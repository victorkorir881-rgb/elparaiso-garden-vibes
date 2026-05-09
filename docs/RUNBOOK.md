# RUNBOOK — Elparaiso Garden Kisii

> **Audience:** on-call engineer / site owner.
> **Goal:** ship safely, recover from incidents, restore service fast.
>
> Keep this file short and operational. Architecture lives in `03_INTEGRATION.md`,
> business rules in `02_BUSINESS_RULES.md`, payment setup in `07_PAYMENTS_MPESA.md`.

---

## 1. Environments & URLs

| Env | URL | Branch | Supabase project |
|---|---|---|---|
| Production | `https://elparaisogardens.vercel.app` (or custom domain) | `main` | `gnlvmszcysogydomahbk` |
| Preview    | per-PR `*.vercel.app` | any PR | same project (shared DB) |
| Local      | `http://localhost:5173` | local | same project (shared DB) |

> ⚠️ All envs currently point at the **same** Supabase project. Treat the DB
> as production at all times. Before destructive SQL, snapshot via
> Supabase → Database → Backups.

Runtime stack: Vercel (Vite SSR via TanStack Start) + Supabase (Postgres,
Auth, Storage, Edge Functions) + Sentry (errors).

---

## 2. Deploy

### 2.1 Frontend (Vercel)

Push to `main` → Vercel auto-builds and deploys. CI runs `bun run build` and
`bun test`. A red build does **not** roll the previous deploy back — old
deploy keeps serving traffic until a new one succeeds.

```bash
# Local sanity check before pushing
bun install
bun run build
bun test
```

Required Vercel env vars (Production + Preview + Development):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
VITE_SITE_URL
VITE_SENTRY_DSN              # optional, omit → Sentry no-op
```

### 2.2 Database migrations

Append-only files in `sql/`, numeric prefix (`0001`, `0002`, …). All are
idempotent. Apply in numeric order on the live DB:

```
Supabase Dashboard → SQL Editor → paste file contents → Run
```

After applying, regenerate types if any new tables/columns affect the client:

```bash
# from a machine with supabase CLI + project access
supabase gen types typescript --project-id gnlvmszcysogydomahbk \
  --schema public > src/integrations/supabase/types.ts
```

### 2.3 Edge functions

```bash
# one function
supabase functions deploy send-email --project-ref gnlvmszcysogydomahbk

# all four
supabase functions deploy send-email send-sms mpesa-initiate mpesa-callback \
  --project-ref gnlvmszcysogydomahbk
```

Secrets live in **Supabase Dashboard → Edge Functions → Secrets**:

- `RESEND_API_KEY`, `EMAIL_FROM`
- `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID`, `AT_ENV`
- `MPESA_ENV`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`,
  `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL`,
  `MPESA_CALLBACK_TOKEN`
- `SENTRY_DSN` (optional, edge-function errors)

Verify a redeploy with the function logs:

```
Supabase Dashboard → Edge Functions → <name> → Logs
```

---

## 3. Rollback

### 3.1 Frontend

Vercel keeps every deployment. To roll back:

1. Vercel Dashboard → Project → **Deployments**.
2. Find the last known-good deployment.
3. **⋯** → **Promote to Production**.

Takes ~30 s; no code changes needed. After, open a revert PR so `main`
matches what's serving.

### 3.2 Database migration

Migrations are designed to be **forward-only**. If a migration broke the app:

1. Identify the offending change in the latest `sql/00XX_*.sql`.
2. Write a **new** numbered file `sql/00YY_revert_<thing>.sql` that reverses
   the change (drop column, drop trigger, etc.) — never edit the original.
3. Apply the new file via Supabase SQL Editor.
4. If a column drop is unsafe (data already written), prefer disabling the
   feature in code and leaving the column.

### 3.3 Edge function

Redeploy the previous version from git:

```bash
git checkout <previous-good-sha> -- supabase/functions/<name>
supabase functions deploy <name> --project-ref gnlvmszcysogydomahbk
git checkout HEAD -- supabase/functions/<name>   # restore working tree
```

---

## 4. Incident response

### 4.1 Triage (first 5 min)

1. **Confirm impact** — load `/`, `/menu`, `/order`, `/admin/login`. Note
   what's broken and on which device.
2. **Check Sentry** — `Issues` tab, filter `Last hour`. New issue spike →
   probably the just-shipped deploy.
3. **Check Vercel** — `Deployments` for failed builds, `Functions` for SSR
   errors / timeouts.
4. **Check Supabase** — `Database → Health`, `Edge Functions → Logs`,
   `Auth → Logs`.

If symptom started right after a deploy → **roll back first**, debug after.

### 4.2 Common symptoms → fix

| Symptom | Likely cause | Fix |
|---|---|---|
| Site loads but empty data everywhere | Supabase down or wrong env vars | Status page; verify Vercel env vars |
| `/admin/*` redirects to `/admin/login` for known admin | Session expired (sessionStorage) or `admin_roles` row missing | Re-login; check `select * from admin_roles where user_id = ...` |
| Reservations / orders submit but nothing in admin | RLS policy regression OR notification fail (admin only sees `paid` orders) | Run sample insert as `anon`; verify `payment_status='paid'` for orders |
| M-Pesa STK never arrives | Wrong `MPESA_SHORTCODE` / `MPESA_PASSKEY` / `MPESA_ENV` | Check `mpesa-initiate` logs; re-test from Daraja sandbox |
| M-Pesa STK arrives but order stays unpaid | Callback URL wrong, `MPESA_CALLBACK_TOKEN` mismatch, or webhook 5xx | Check `mpesa-callback` logs; re-confirm public URL + token in Daraja portal |
| Email/SMS not sending | Resend / Africa's Talking key invalid or balance empty | Logs in `send-email` / `send-sms`; re-key in Supabase secrets |
| Image upload fails | `media` bucket missing or RLS regression | Re-apply `sql/0011_media_storage.sql` |

### 4.3 Comms

- Update the WhatsApp business profile status if storefront is down.
- For payment outage: pin a "M-Pesa temporarily unavailable — please pay
  on arrival" notice via Admin → Settings → Hero callout.

---

## 5. Backups & restore

### 5.1 Backups

Supabase runs daily PITR snapshots automatically (paid plan) or daily logical
backups (free plan). Verify availability monthly:

```
Supabase Dashboard → Database → Backups
```

### 5.2 Manual snapshot before risky migration

```bash
# Local pg_dump using the Supabase connection string
pg_dump "$DATABASE_URL" --schema=public --format=custom \
  --file="backup-$(date +%F).dump"
```

Store off-site (Google Drive / Dropbox).

### 5.3 Restore (smoke-test quarterly)

1. Spin up a throwaway Supabase project (`elparaiso-restore-test`).
2. Restore the most recent backup into it.
3. Apply every `sql/00XX_*.sql` in order against the restored DB to confirm
   migrations still run idempotently on production data.
4. Tear down the throwaway project.

---

## 6. Routine ops

| Cadence | Task |
|---|---|
| Daily   | Skim Sentry (target: 0 unresolved errors of severity ≥ Error) |
| Weekly  | Review Admin → Audit Log for unexpected changes |
| Weekly  | Reconcile payments via Admin → Analytics → Reconciliation report |
| Monthly | Verify Supabase backup retention; rotate Daraja secrets if leaked |
| Monthly | Run Lighthouse on `/`, `/menu`, `/order` (target ≥ 90) |
| Quarterly | Restore drill (§5.3) and dependency `bun audit` review |
| Quarterly | Owner walkthrough of new admin features |

---

## 7. Useful commands

```bash
# Frontend
bun install
bun dev
bun run build
bun test

# Edge functions
supabase functions deploy <name> --project-ref gnlvmszcysogydomahbk
supabase functions logs <name> --project-ref gnlvmszcysogydomahbk --tail

# DB shell
psql "$DATABASE_URL"

# Regenerate Supabase types
supabase gen types typescript --project-id gnlvmszcysogydomahbk \
  --schema public > src/integrations/supabase/types.ts
```

---

## 8. Escalation

1. Owner / on-call engineer (primary).
2. Supabase support — for DB / auth / storage incidents.
3. Vercel support — for build / SSR / DNS incidents.
4. Safaricom Daraja support — for M-Pesa outages (`apisupport@safaricom.co.ke`).
5. Resend / Africa's Talking support — for email / SMS delivery issues.

Keep contact details in a separate, access-controlled doc — never in this
repo.
