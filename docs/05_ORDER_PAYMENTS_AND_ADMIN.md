# Order Flow, M-Pesa Integration & Admin Session

This document explains how the customer order flow works end-to-end, how
M-Pesa STK Push is wired in, and how admin sessions / the installable
admin PWA behave.

---

## 1. Order Flow (customer side)

File: `src/pages/public/OrderPage.tsx`

1. Customer browses menu (`useMenuCategories`, `useMenuItems`) and adds items
   to the cart (`CartContext`).
2. Customer chooses:
   - **Order Type** — `dine-in`, `takeaway`, or `delivery`.
   - **Payment Method** — `mpesa` (pay now via STK Push) or `cash` (pay on
     delivery / pickup).
3. On **Place Order**, the client validates:
   - name, phone, non-empty cart
   - delivery address if `order_type = delivery`
   - Kenyan Safaricom phone format (`07XX…` / `2547XX…`) when paying by M-Pesa
4. The order is inserted via `useCreateOrder` into `public.orders` with
   `payment_status = 'pending'` and `payment_method` set to the chosen method.
5. Branch by payment method:
   - `cash` → success screen immediately. The admin will mark the order
     `paid` from the Orders panel after collection.
   - `mpesa` → invoke edge function `mpesa-initiate` (see §2). On success a
     modal opens and the client polls `payments` row every 3 s
     (`usePaymentStatus`).
6. Customer can track the order at `/track` using the order number.

Resilience:
- If `mpesa-initiate` fails (e.g. secrets missing, network error), the order
  is **still saved** — the success screen is shown so the customer can pay
  later by phone or in person. The admin sees the order with
  `payment_status = 'pending'`.

---

## 2. M-Pesa Daraja STK Push

### Edge functions

| Function | Path | JWT |
|---|---|---|
| `mpesa-initiate` | `supabase/functions/mpesa-initiate/index.ts` | disabled |
| `mpesa-callback` | `supabase/functions/mpesa-callback/index.ts` | disabled |

### Required server secrets (Supabase → Edge Functions → Secrets)

| Secret | Example | Notes |
|---|---|---|
| `MPESA_ENV` | `sandbox` or `production` | |
| `MPESA_CONSUMER_KEY` | from Daraja app | |
| `MPESA_CONSUMER_SECRET` | from Daraja app | |
| `MPESA_SHORTCODE` | `174379` (sandbox) | Paybill / Till |
| `MPESA_PASSKEY` | from Daraja Lipa Na M-Pesa Online | |
| `MPESA_CALLBACK_URL` | `https://<project>.supabase.co/functions/v1/mpesa-callback?token=…` | must be publicly reachable |
| `MPESA_CALLBACK_TOKEN` | random string | optional shared secret matched against `?token=` |

### Flow

```
Browser ──► mpesa-initiate ──► Daraja /stkpush
                │
                └─► insert payments row (status=pending)
                              ▲
Customer phone ──► STK PIN    │
                              │
Daraja ──► mpesa-callback ────┘
                │
                ├─► update payments row (success / failed / cancelled / timeout)
                └─► if success: orders.payment_status = 'paid'
```

### Key safety checks in `mpesa-initiate`

- Phone normalised to `2547XXXXXXXX`.
- Amount cast to integer ≥ 1 (Daraja requires whole KES).
- Verifies the order exists, is unpaid, and that the requested amount
  matches `orders.total_amount`.
- Uses the Service Role key, so RLS does not block the insert.
- Rejected STK pushes are still recorded in `payments` for debugging.

### Local testing

Use Daraja Sandbox + the test MSISDN `254708374149`. Trigger:

```bash
curl -X POST https://<project>.supabase.co/functions/v1/mpesa-initiate \
  -H 'content-type: application/json' \
  -d '{"orderId":"<uuid>","phone":"0708374149","amount":1}'
```

---

## 3. Admin Authentication & Session

File: `src/integrations/supabase/client.ts`

The Supabase client is configured to use **`sessionStorage`**, not
`localStorage`. Practical effects:

- Closing all tabs of the app **logs the admin out**.
- Opening a fresh browser session requires **re-entering email + password**
  (or using Google OAuth).
- Tokens still auto-refresh while at least one tab is open, so admins are
  not kicked out mid-session.

This satisfies the requirement that "every time the user logs in he should
key in required credentials".

### First admin

The `handle_first_admin` trigger (see `sql/0004_admin_auth_triggers.sql`)
grants `super_admin` to the very first signup. Subsequent users get the
default `user` role and must be promoted from `/admin/users` (or by SQL).

### Granting yourself super_admin manually

```sql
INSERT INTO public.admin_roles (user_id, role)
SELECT id, 'super_admin'::admin_role FROM auth.users
WHERE email = 'you@example.com'
ON CONFLICT DO NOTHING;
```

---

## 4. Installable Admin Panel (PWA)

Files:
- `public/manifest.webmanifest` — PWA manifest, scoped to `/`, start URL `/admin/login`.
- `public/sw.js` — minimal pass-through service worker (required for installability; no offline cache so admins always get fresh builds).
- `public/icon-192.png`, `public/icon-512.png` — app icons.
- `index.html` — registers the service worker and links the manifest.

### Installing on desktop (Chrome / Edge)

1. Visit `/admin/login`.
2. Click **Install Admin App** at the bottom of the login card, **or** use
   the browser's install icon in the URL bar.
3. The panel launches in its own window with no browser chrome.

### Installing on Android

1. Open `/admin/login` in Chrome.
2. Tap **Install Admin App** or use **Add to Home Screen** from the
   browser menu.

### Installing on iOS (Safari)

1. Open `/admin/login` in Safari.
2. Tap the share button → **Add to Home Screen**.

> The "Install Admin App" button on the login page only appears in browsers
> that fire `beforeinstallprompt` (Chromium-based). On Safari/iOS the same
> button surfaces a hint to use **Add to Home Screen**.

---

## 5. Database migrations relevant to this flow

| File | Purpose |
|---|---|
| `sql/0001_init.sql` | base tables incl. `orders` |
| `sql/0003_payments.sql` | `payments` table + RLS for STK Push attempts |
| `sql/0004_admin_auth_triggers.sql` | `admin_profiles`, `admin_roles`, triggers, `is_admin()` |

Apply via:

```bash
psql "$DATABASE_URL" -f sql/0003_payments.sql
psql "$DATABASE_URL" -f sql/0004_admin_auth_triggers.sql
```
