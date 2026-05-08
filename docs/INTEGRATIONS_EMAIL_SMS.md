# Email & SMS Integrations

This document explains how to enable the two transactional messaging channels
the customer-facing site uses for confirmations and status updates:

- **Email** via [Resend](https://resend.com) — `supabase/functions/send-email`
- **SMS** via [Africa's Talking](https://africastalking.com) — `supabase/functions/send-sms`

Both run as Supabase Edge Functions and are invoked by the React app through
fire-and-forget client helpers (`src/lib/email.ts`, `src/lib/sms.ts`). They
share an architecture:

| Concern | How we handle it |
| --- | --- |
| **Recipient trust** | The browser only sends `{ template, recordId }`. The Edge Function looks the recipient up server-side from the matching DB row (using the service role key). Visitors cannot spam arbitrary inboxes / phone numbers through us. |
| **Allowed templates** | A hard-coded enum (`reservation_confirmation`, `order_confirmation`, …). Anything else returns 400. |
| **Idempotency** | A 5-minute window keyed on `template:recordId:status` written to `email_send_log` / `sms_send_log`. Re-clicks and edge-function retries do not double-send. |
| **Failure mode** | Fire-and-forget on the client: a missing API key or a provider 4xx never blocks the underlying mutation (reservation booked, order placed). Failures are recorded in the `*_send_log` tables for ops. |
| **Rate limiting** | Provided by the underlying Phase 5.5 `enforceRateLimit` on the public mutation hooks (`useCreateReservation`, `useCreateOrder`, `useSubmitContact`). |

---

## Triggers wired today

| User action | Email template | SMS template |
| --- | --- | --- |
| Reservation booked | `reservation_confirmation` | `reservation_confirmation` |
| Contact form submitted | `contact_ack` | _(no SMS — adds noise for general inquiries)_ |
| Order placed | `order_confirmation` | `order_confirmation` |
| Order status changed by admin (`confirmed` / `preparing` / `ready` / `completed` / `cancelled`) | `order_status_update` | `order_status_update` |

All triggers live in `src/lib/supabase-hooks.ts`. Adding a new trigger is two
lines: `fireTransactionalEmail({ template, recordId })` and/or
`fireTransactionalSms({ template, recordId })` after the relevant `insert/update`.

---

## 1. Email — Resend

### 1.1 Get a Resend API key

1. Sign up at <https://resend.com> (free tier covers 3,000 emails/month).
2. **Domains → Add domain** → enter `elparaisogardens.com` (or whatever
   production domain is in use).
3. Add the SPF / DKIM / DMARC TXT records Resend shows you to your DNS
   provider. Verification usually completes in under 5 minutes.
4. **API Keys → Create API Key** → name it `elparaiso-prod`, give it
   `Full access` on the verified domain. Copy the value once — you cannot
   view it again.

### 1.2 Configure the Supabase secrets

In the Supabase dashboard for project `gnlvmszcysogydomahbk`:

**Project Settings → Edge Functions → Secrets** (or via CLI):

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set EMAIL_FROM="Elparaiso Garden <noreply@elparaisogardens.com>"
```

| Secret | Required | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | ✅ | From Resend dashboard. |
| `EMAIL_FROM` | optional | Defaults to `Elparaiso Garden <onboarding@resend.dev>` (Resend's shared sandbox sender) so the function works before the domain is verified. **Replace before launch** — sandbox sends are flagged by Gmail. |

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
> into every Edge Function — you do not need to set them.

### 1.3 Deploy the function

```bash
supabase functions deploy send-email
```

`supabase/config.toml` already declares `verify_jwt = false` for this function
(public forms call it without an authenticated session).

### 1.4 Smoke test

After deployment, with a known `reservation_leads.id`:

```bash
curl -X POST "https://gnlvmszcysogydomahbk.supabase.co/functions/v1/send-email" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -d '{"template":"reservation_confirmation","recordId":"<uuid>"}'
```

Expected: `{ "ok": true, "to": "customer@example.com" }`. Then check
`email_send_log` in Supabase — there should be a row with `status = 'sent'`.

### 1.5 Files

| Path | Role |
| --- | --- |
| `supabase/functions/send-email/index.ts` | Edge Function (Deno, Resend HTTP API). |
| `src/lib/email.ts` | Browser helper (`fireTransactionalEmail`). |
| `sql/0005_email_send_log.sql` | `email_send_log` table + RLS. |

---

## 2. SMS — Africa's Talking

Africa's Talking (AT) is the de-facto SMS gateway for Kenya. It supports
alphanumeric sender IDs (e.g. `ELPARAISO`), short codes, and bulk delivery,
and it bills in KES — no FX surprises.

### 2.1 Get AT credentials

1. Sign up at <https://account.africastalking.com/auth/register>.
2. Use the **Sandbox app** for development. Username: `sandbox`. The
   sandbox can only send to phone numbers you have registered as a
   simulator at <https://simulator.africastalking.com>.
3. **Settings → API Key → Generate** — copy the Sandbox API key.
4. For production:
   - Top up airtime on the Live app (Sandbox is free but only reaches the
     simulator).
   - **Apps → Live → SMS → Sender IDs** → request `ELPARAISO` (alphanumeric
     IDs require a one-time approval, takes ~1 business day in Kenya).
   - Generate a Live API key. Username will be your AT account username,
     not `sandbox`.

### 2.2 Apply the SQL

Run once on the Supabase project (idempotent):

```bash
psql "$DATABASE_URL" -f sql/0010_sms_send_log.sql
```

This creates `public.sms_send_log` (append-only audit table) with admin-read
RLS. The Edge Function bypasses RLS via the service role.

### 2.3 Configure Supabase secrets

```bash
# Sandbox
supabase secrets set AT_USERNAME=sandbox
supabase secrets set AT_API_KEY=atsk_<sandbox_key>
supabase secrets set AT_ENV=sandbox

# Production (when ready)
supabase secrets set AT_USERNAME=elparaiso        # your live AT username
supabase secrets set AT_API_KEY=atsk_<live_key>
supabase secrets set AT_ENV=production
supabase secrets set AT_SENDER_ID=ELPARAISO       # alphanumeric ID, optional
```

| Secret | Required | Notes |
| --- | --- | --- |
| `AT_API_KEY` | ✅ | From AT dashboard. |
| `AT_USERNAME` | ✅ | `sandbox` for testing, your AT username in production. |
| `AT_SENDER_ID` | optional | Alphanumeric ID or short code. **Omit on sandbox.** Required for production billing transparency. |
| `AT_ENV` | optional | `sandbox` (default) or `production`. Switches the API endpoint. |

### 2.4 Deploy the function

```bash
supabase functions deploy send-sms
```

`supabase/config.toml` declares `verify_jwt = false` (public-form callers
have no Supabase session).

### 2.5 Smoke test

Register your phone in the AT simulator first (sandbox only):
<https://simulator.africastalking.com> → enter `+254712345678` → keep the
tab open, you'll see the SMS arrive there.

```bash
curl -X POST "https://gnlvmszcysogydomahbk.supabase.co/functions/v1/send-sms" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -d '{"template":"reservation_confirmation","recordId":"<uuid>"}'
```

Expected responses:

| Response | Meaning |
| --- | --- |
| `{ "ok": true, "to": "+254712345678" }` | Sent. AT returned `Success` for the recipient. |
| `{ "skipped": "no_phone" }` | Customer didn't supply a phone (or it was unparseable). Not an error. |
| `{ "skipped": "duplicate" }` | Same template+record sent within the last 5 minutes. |
| `{ "error": "sms_not_configured" }` | `AT_API_KEY` or `AT_USERNAME` missing. Function returns 503. |
| `{ "error": "provider_error", "details": {...} }` | AT rejected — usually invalid phone, no balance, or unapproved sender ID. Inspect `details`. |

After a real send, check `sms_send_log` in Supabase: each attempt is logged
with `status` (`sent` / `failed`), the normalized phone, and the full
provider response JSON.

### 2.6 Phone number normalization

The function normalizes Kenyan numbers to E.164 (`+2547xxxxxxxx`). Accepted
input formats on the matching DB row:

- `0712345678` (local 0-prefixed)
- `254712345678`
- `+254712345678`
- `712345678` (bare 9 digits)
- Any other E.164 (e.g. `+15551234567`) passes through unchanged.

Anything else is treated as "no phone" and the send is skipped silently.

### 2.7 Cost & rate limits

- **Sandbox**: free, simulator-only.
- **Production (Kenya)**: ~KSh 0.80 per SMS to Safaricom, ~KSh 1.50 to other
  networks (subject to AT pricing changes). Each SMS is 160 GSM-7 chars; the
  current templates fit in one segment.
- AT does not rate-limit individual API calls aggressively, but our
  `enforceRateLimit` (Phase 5.5) caps reservation submissions at 5/hr per
  phone, so abusive bursts are blocked before they reach AT.

### 2.8 Files

| Path | Role |
| --- | --- |
| `supabase/functions/send-sms/index.ts` | Edge Function (Deno, AT REST API). |
| `src/lib/sms.ts` | Browser helper (`fireTransactionalSms`). |
| `sql/0010_sms_send_log.sql` | `sms_send_log` table + RLS. |

---

## 3. Adding a new template

1. **Edge Function** — add a `case` to the relevant function:
   - `send-email`: add to the `TemplateName` union, add a `render*()` returning `{ subject, body }`, add a branch in the `switch`.
   - `send-sms`: add to the `TemplateName` union, add a `render*(): string`, add a branch in the lookup that fetches the matching DB row and returns `phone + message`.
2. **Client helper** — add the new template name to the `EmailTemplate` /
   `SmsTemplate` union in `src/lib/email.ts` / `src/lib/sms.ts`.
3. **Trigger site** — call `fireTransactionalEmail({ template, recordId })` /
   `fireTransactionalSms({ template, recordId })` in the relevant React Query
   hook in `src/lib/supabase-hooks.ts`.
4. **Redeploy**: `supabase functions deploy send-email send-sms`.

Keep the recipient lookup server-side. Never accept a phone or email from
the client request body — it must always be derived from the row identified
by `recordId`.

---

## 4. Operational checklist before launch

- [ ] Resend domain `elparaisogardens.com` verified (SPF + DKIM + DMARC green).
- [ ] `EMAIL_FROM` switched off the `onboarding@resend.dev` sandbox sender.
- [ ] AT Live app funded with at least KSh 1,000 of airtime.
- [ ] `ELPARAISO` sender ID approved on the AT Live app.
- [ ] `AT_ENV=production`, `AT_USERNAME=<live username>`, `AT_API_KEY=<live key>`,
      `AT_SENDER_ID=ELPARAISO` set in Supabase secrets.
- [ ] `sql/0010_sms_send_log.sql` applied.
- [ ] `supabase functions deploy send-email send-sms` ran cleanly.
- [ ] Manually placed one real reservation and one real order from a phone
      that's NOT in the simulator and confirmed both email + SMS arrived.
- [ ] Inspected `email_send_log` and `sms_send_log` for any `status = 'failed'`
      rows from the smoke tests.
