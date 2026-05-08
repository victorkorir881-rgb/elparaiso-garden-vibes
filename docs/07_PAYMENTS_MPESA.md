# M-Pesa Payments Setup (Daraja STK Push)

The order checkout already supports M-Pesa STK Push end-to-end. The customer types their phone, taps **Pay**, gets the Safaricom prompt on their phone, enters their PIN, and the order is auto-marked **paid** when Daraja calls our webhook.

This doc covers the **one-time setup** you need to do in your Supabase project + Safaricom Daraja portal. The code is already in place — see the "Code reference" section at the bottom.

---

## 1. Apply the SQL migration

In Supabase → **SQL Editor**, run the file `sql/0003_payments.sql`. It creates:

- `public.payments` table (one row per STK Push attempt)
- RLS policies — only admins can list/update; the `service_role` (used by the edge functions) bypasses RLS
- Indexes on `order_id`, `checkout_request_id`, `status`

---

## 2. Get Daraja credentials

1. Go to <https://developer.safaricom.co.ke/> and sign in (or sign up).
2. **Apps → Create New App**, tick **Lipa Na M-Pesa Online**. You'll get:
   - **Consumer Key**
   - **Consumer Secret**
3. **Lipa Na M-Pesa Online → Configure** for your shortcode. You'll get/need:
   - **Shortcode** (Paybill or Till; for sandbox use `174379`)
   - **Passkey** (the long base64-looking string)
4. Note the environment you're starting with — start with **sandbox** before going live.

---

## 3. Deploy the edge functions

Install the Supabase CLI once: <https://supabase.com/docs/guides/cli>.

```bash
supabase login
supabase link --project-ref <your-project-ref>

# Deploy both functions (config.toml already disables JWT verification)
supabase functions deploy mpesa-initiate
supabase functions deploy mpesa-callback
```

The callback URL will be:

```
https://<your-project-ref>.supabase.co/functions/v1/mpesa-callback
```

You'll need this URL in the next step.

---

## 4. Set the function secrets

Supabase Dashboard → **Edge Functions → Manage secrets** (or `supabase secrets set` via CLI). Add:

| Secret | Value | Notes |
|---|---|---|
| `MPESA_ENV` | `sandbox` or `production` | Start with `sandbox` |
| `MPESA_CONSUMER_KEY` | from Daraja app | |
| `MPESA_CONSUMER_SECRET` | from Daraja app | |
| `MPESA_SHORTCODE` | `174379` (sandbox) or your Paybill/Till | |
| `MPESA_PASSKEY` | Lipa Na M-Pesa Online passkey | |
| `MPESA_CALLBACK_URL` | `https://<ref>.supabase.co/functions/v1/mpesa-callback` | from step 3 |
| `MPESA_CALLBACK_TOKEN` | any random string (e.g. `openssl rand -hex 24`) | optional shared secret appended as `?token=…` to the callback URL — extra protection since Daraja doesn't sign callbacks |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — don't add them yourself.

If you set `MPESA_CALLBACK_TOKEN`, the actual `MPESA_CALLBACK_URL` value should already include it as a query param:

```
https://<ref>.supabase.co/functions/v1/mpesa-callback?token=<MPESA_CALLBACK_TOKEN>
```

---

## 5. Sandbox test

1. Visit `/order` on your published or local site.
2. Add an item, fill in name + a Safaricom test phone (`254708374149` works in sandbox), tap **Pay with M-Pesa**.
3. In sandbox, no real prompt appears — Daraja auto-completes and POSTs to your callback in ~10 seconds.
4. Refresh `/admin/orders` → the order should be `paid`.
5. Check `/admin/audit-log` and Supabase logs (`Edge Functions → mpesa-initiate → Logs` / `mpesa-callback → Logs`) if anything fails.

### Common sandbox issues

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid Access Token` | Wrong consumer key/secret or wrong env | Re-copy from Daraja, confirm `MPESA_ENV` matches the app |
| `BadRequest - Invalid CallBackURL` | URL not HTTPS or has spaces | Must be the full https Supabase function URL |
| Status stays `pending` forever | Callback never reached your function | Check `mpesa-callback` logs; ensure `MPESA_CALLBACK_URL` is correct and the function is deployed |
| `errorCode: 500.001.1001` | Phone number not in 2547XXXXXXXX format | The function normalises common formats; double-check the input |

---

## 6. Going live

1. In Daraja, **Go Live** with your real shortcode (Paybill/Till) — Safaricom reviews and approves.
2. Once approved, Daraja gives you **production** consumer key, secret, passkey.
3. Update the secrets:
   - `MPESA_ENV=production`
   - new `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`
   - `MPESA_SHORTCODE` = your real Paybill/Till
4. Re-deploy is **not** required — secret changes take effect on the next invocation.
5. Test with **1 KES** to your real shortcode, refund yourself, then enable for customers.

---

## Code reference

| Layer | File | Purpose |
|---|---|---|
| DB schema | `sql/0003_payments.sql` | `payments` table + RLS |
| Edge fn (initiate) | `supabase/functions/mpesa-initiate/index.ts` | Daraja OAuth + STK Push, inserts a `payments` row |
| Edge fn (callback) | `supabase/functions/mpesa-callback/index.ts` | Verifies, updates `payments.status`, marks order `paid` |
| Client hooks | `src/lib/payments.ts` | `useInitiateMpesaPayment()`, `usePaymentStatus(paymentId)` |
| Checkout UI | `src/pages/public/OrderPage.tsx` | Pay button, pending/success/failed states |
| Admin view | `src/pages/admin/AdminOrders.tsx` | Sees `paid` orders, can refund manually |
| Function config | `supabase/config.toml` | `verify_jwt = false` for both functions |

---

## Refunds & reconciliation

Refunds are still **manual** in v1 — process them on the M-Pesa Business portal, then mark the order `refunded` in `/admin/orders`. Automated refunds (Daraja Reversal API) are tracked as Phase 7.5 and not yet implemented.

A daily reconciliation report between `payments` rows and the M-Pesa statement is on the backlog (`docs/00_PROJECT_PLAN.md` task 7.6).
