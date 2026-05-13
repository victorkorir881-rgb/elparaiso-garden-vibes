# Edge Functions — Deployment & Operations Guide

This document covers every Supabase Edge Function in `supabase/functions/`,
how to deploy them from a VS Code terminal, and the secrets / database
state each one needs to be fully functional.

Project ref: **`gnlvmszcysogydomahbk`** (see `supabase/config.toml`).

---

## 1. Prerequisites (one-time setup)

```bash
# 1. Install the Supabase CLI (macOS / Linux via Homebrew)
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or via npm (any OS)
npm i -g supabase

# 2. Verify
supabase --version

# 3. Log in (opens a browser)
supabase login

# 4. Link this repo to the cloud project
supabase link --project-ref gnlvmszcysogydomahbk

# 5. (Optional) Pull latest remote config
supabase db pull
```

> Run every command below from the **repo root** in the VS Code integrated
> terminal (`Ctrl+\``).

---

## 2. Function inventory

| Function | `verify_jwt` | Purpose |
|---|---|---|
| `admin-accept-invite` | **false** | Public endpoint that validates a one-time invite token and creates the invited admin user. |
| `admin-invite-user` | true | Authenticated admin endpoint — generates an invite token and emails it via Resend. |
| `admin-delete-user` | true | Authenticated admin endpoint — deletes a user via the Admin API. |
| `health` | true | Liveness/readiness probe (DB ping + version). |
| `mpesa-initiate` | **false** | Starts an STK Push from public checkout. |
| `mpesa-callback` | **false** | Daraja STK callback receiver (token-guarded). |
| `mpesa-reversal` | true | Admin-initiated M-Pesa reversal. |
| `mpesa-reversal-result` | **false** | Daraja reversal result receiver (token-guarded). |
| `send-email` | **false** | Transactional email sender (Resend) for public forms. |
| `send-sms` | **false** | Africa's Talking SMS sender for public forms. |
| `send-whatsapp` | **false** | WhatsApp Cloud API template sender for public forms. |

`_shared/` is a helper module imported by the functions — it is not deployed
on its own.

---

## 3. Deploying functions

### Deploy all functions at once
```bash
supabase functions deploy
```

### Deploy a single function
```bash
supabase functions deploy admin-invite-user
supabase functions deploy admin-accept-invite
supabase functions deploy admin-delete-user
supabase functions deploy health
supabase functions deploy mpesa-initiate
supabase functions deploy mpesa-callback
supabase functions deploy mpesa-reversal
supabase functions deploy mpesa-reversal-result
supabase functions deploy send-email
supabase functions deploy send-sms
supabase functions deploy send-whatsapp
```

The CLI reads `supabase/config.toml` so the `verify_jwt = false` flags are
applied automatically — no extra `--no-verify-jwt` flag required.

### Tail logs (live)
```bash
supabase functions logs admin-invite-user --tail
```

### List currently deployed functions
```bash
supabase functions list
```

### Delete a deployed function
```bash
supabase functions delete <name>
```

---

## 4. Secrets

Secrets are environment variables available inside every function via
`Deno.env.get("…")`.

### Set / update
```bash
# Single
supabase secrets set RESEND_API_KEY=re_xxx

# Multiple
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  EMAIL_FROM="El Paraiso <noreply@elparaisogardens.com>" \
  SITE_URL="https://elparaisogardens.com"

# From an env file
supabase secrets set --env-file ./supabase/.env.production
```

### List / unset
```bash
supabase secrets list
supabase secrets unset RESEND_API_KEY
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
> injected automatically by the platform — **do not** set them yourself.

### Per-function required secrets

| Function | Required secrets |
|---|---|
| `admin-accept-invite` | _(platform-injected only)_ |
| `admin-invite-user` | `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` |
| `admin-delete-user` | _(platform-injected only)_ |
| `health` | `APP_VERSION` (optional) |
| `mpesa-initiate` | `MPESA_ENV` (`sandbox`\|`production`), `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL` |
| `mpesa-callback` | `MPESA_CALLBACK_TOKEN` (shared secret in callback URL `?token=…`) |
| `mpesa-reversal` | `MPESA_ENV`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_INITIATOR_NAME`, `MPESA_SECURITY_CREDENTIAL`, `MPESA_REVERSAL_RESULT_URL`, `MPESA_REVERSAL_TIMEOUT_URL` |
| `mpesa-reversal-result` | `MPESA_REVERSAL_TOKEN` |
| `send-email` | `RESEND_API_KEY`, `EMAIL_FROM` |
| `send-sms` | `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`, `AT_ENV` (`sandbox`\|`production`) |
| `send-whatsapp` | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_TEMPLATE_RESERVATION`, `WHATSAPP_TEMPLATE_ORDER`, `WHATSAPP_TEMPLATE_PAYMENT`, `WHATSAPP_TEMPLATE_STATUS` |
| _All_ (optional) | `SENTRY_DSN`, `SENTRY_ENV`, `ENV` |

---

## 5. Database prerequisites

Apply every numbered migration in `sql/` (in order) before exercising the
functions. The most relevant ones:

| Migration | Required by |
|---|---|
| `0001_*` … `0014_*` | Core schema (users, orders, payments, reservations) |
| `0015_admin_invitations.sql` | `admin-invite-user`, `admin-accept-invite` |
| `0033_invitation_revocation.sql` | Adds `revoked_at` / `revoked_by` to invitations |
| `0034_invite_acceptance_no_expiry_limit.sql` | Drops the hard expiry blocker on accept |
| `0035_invite_acceptance_service_role_path.sql` | **Required.** Lets the edge function bypass the trigger's invite re-check so acceptance no longer fails with `Database error creating new user`. Pair with the latest `admin-accept-invite` deploy. |

### Apply migrations
```bash
# Validate locally first (spins up a throwaway Postgres)
bash sql/_check.sh

# Apply to the linked cloud DB
supabase db push
# or, if you keep raw .sql files:
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f sql/0015_admin_invitations.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f sql/0035_invite_acceptance_service_role_path.sql
```

### Invite acceptance contract (`admin-accept-invite`)

The edge function runs as the service role and is the single source of truth
for invitation state. On a successful POST it:

1. Looks up the invitation by `token_hash` + `email` (case-insensitive) and
   rejects `accepted_at` / `revoked_at` rows with a typed error code.
2. Calls `auth.admin.createUser` with `email_confirm: true` and metadata
   `{ full_name, phone, bypass_invite_check: true, invitation_token_hash }`.
3. The `handle_new_user` trigger sees `bypass_invite_check` and only creates
   the `admin_profiles` row — it does **not** re-validate the invite.
4. The function then writes `admin_roles` (invited role), stamps
   `admin_invitations.accepted_at` / `accepted_by`, persists `phone` on
   `admin_profiles`, and inserts an `invite_accepted` audit row.
5. If role assignment fails the half-created auth user is deleted so the
   invite can be retried.

Error codes returned to the client: `invalid`, `used`, `revoked`,
`weak_password`, `email_exists`, `role_failed`, `lookup_failed`,
`create_failed`. The client (`src/pages/admin/AcceptInvite.tsx`) surfaces
these as toast messages.


---

## 6. End-to-end readiness checklist

For every function follow these steps **in order**. If any step fails the
function will not work in production.

1. **CLI linked** — `supabase link --project-ref gnlvmszcysogydomahbk`.
2. **Migrations applied** — `supabase db push` (or `psql` per file).
3. **Secrets set** — `supabase secrets list` shows every var from §4.
4. **Function deployed** — `supabase functions deploy <name>` returns OK.
5. **`verify_jwt` matches §2** — confirm in `supabase/config.toml`.
6. **External callbacks registered** (where applicable):
   - **M-Pesa** — Daraja portal → set STK callback to
     `https://gnlvmszcysogydomahbk.supabase.co/functions/v1/mpesa-callback?token=$MPESA_CALLBACK_TOKEN`
     and reversal result URL to `…/mpesa-reversal-result?token=$MPESA_REVERSAL_TOKEN`.
   - **Resend** — verify your sender domain (the one used in `EMAIL_FROM`).
   - **WhatsApp** — approve the message templates referenced by
     `WHATSAPP_TEMPLATE_*` in Meta Business Manager.
   - **Africa's Talking** — register and approve the `AT_SENDER_ID`.
7. **Site URL** — In **Supabase dashboard → Authentication → URL Configuration**
   set the Site URL and add the redirect URL used by `admin-accept-invite`
   (`<SITE_URL>/admin/accept-invite`).
8. **Smoke test** — invoke each function:
   ```bash
   # Public function
   curl -i "https://gnlvmszcysogydomahbk.supabase.co/functions/v1/health"

   # Authenticated function (replace TOKEN with a logged-in user JWT)
   curl -i -X POST \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email":"new.admin@example.com","role":"admin"}' \
     "https://gnlvmszcysogydomahbk.supabase.co/functions/v1/admin-invite-user"
   ```
9. **Tail logs** during the smoke test:
   `supabase functions logs <name> --tail`.

---

## 7. Local development

```bash
# Serve all functions locally on http://localhost:54321/functions/v1/<name>
supabase functions serve --env-file ./supabase/.env.local

# Serve a single function with hot reload
supabase functions serve admin-invite-user --env-file ./supabase/.env.local --no-verify-jwt
```

Create `supabase/.env.local` (gitignored) with the same keys listed in §4.

---

## 8. Common pitfalls

- **401 from a public function** → `verify_jwt` got reset. Re-check
  `supabase/config.toml`, redeploy.
- **`Missing env: …`** → Secret not set. Run `supabase secrets list`.
- **M-Pesa callbacks return 200 but nothing updates** → wrong `?token=` in
  the registered callback URL.
- **Resend 403 "domain not verified"** → finish DNS verification in Resend
  before sending from `EMAIL_FROM`.
- **Invite link 404s** → Site URL / redirect URL not configured in Supabase
  Auth settings.
- **CLI says "Project not linked"** → re-run `supabase link --project-ref …`.
