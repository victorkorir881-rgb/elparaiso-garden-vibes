# WhatsApp Integration Guide

This document explains how to enable transactional WhatsApp messages (reservation confirmations, order confirmations, status updates, payment receipts) using the **Meta WhatsApp Cloud API**.

The app already ships with:

- Edge function `supabase/functions/send-whatsapp/index.ts` (public, idempotent, audited).
- Audit table `whatsapp_send_log` (see `sql/0014_whatsapp_send_log.sql`).
- Helper `src/lib/whatsapp.ts` (`fireTransactionalWhatsapp`).
- Wired call sites: `useCreateReservation`, `useCreateOrder`, `useUpdateOrder`, and the M-Pesa receipt fan-out in `mpesa-callback`.

When the required secrets are missing, the function returns `not_configured` and the app silently skips sending — nothing breaks. Once you set the secrets and approve templates, messages start flowing automatically.

---

## 1. Prerequisites

You need:

1. A **Facebook (Meta) account**.
2. A **Meta Business Manager** account: <https://business.facebook.com>.
3. A **phone number** that is NOT already registered on a regular WhatsApp / WhatsApp Business app. (You can release it from the consumer apps if needed.)
4. A **verified business** in Business Manager for production volume. You can test with up to 5 recipient numbers without verification.

---

## 2. Create a Meta App with WhatsApp product

1. Go to <https://developers.facebook.com/apps> → **Create App**.
2. Choose use case **Other** → app type **Business** → name it (e.g. "Restaurant Notifications").
3. Link it to your Business Manager account.
4. On the app dashboard, click **Add Product** → **WhatsApp** → **Set up**.

You're now in the **WhatsApp → API Setup** screen. Keep this tab open — most values come from here.

---

## 3. Collect the values you need

You will end up with these secrets:

| Secret name | Where to find it |
|---|---|
| `WHATSAPP_TOKEN` | API Setup → **Temporary access token** (24h, for testing) OR a **System User permanent token** (recommended for production, see §6). |
| `WHATSAPP_PHONE_NUMBER_ID` | API Setup → **From** section → the numeric **Phone number ID** (NOT the phone number itself). |
| `WHATSAPP_TEMPLATE_RESERVATION` | The exact `name` of your approved reservation template (see §4). |
| `WHATSAPP_TEMPLATE_ORDER` | Approved order-confirmation template name. |
| `WHATSAPP_TEMPLATE_STATUS` | Approved order-status template name. |
| `WHATSAPP_TEMPLATE_PAYMENT` | Approved payment-receipt template name. |
| `WHATSAPP_TEMPLATE_LANG` | Optional. Template language code, default `en`. Use `en_US` if your template was approved under that locale. |

You may also note the **WhatsApp Business Account ID (WABA ID)** shown on the same page — needed for managing templates via API but not required by this app.

---

## 4. Create and submit the four message templates

In Business Manager → **WhatsApp Manager** → **Message Templates** → **Create Template**, create four templates with **Category = Utility** (transactional). Use **Body** only (no header/footer/buttons needed) and the exact positional variables below.

### 4.1 Reservation confirmation
- Name (suggested): `reservation_confirmation`
- Body:
  ```
  Hi {{1}}, your reservation for {{2}} at {{3}} (party of {{4}}) is confirmed. We look forward to seeing you!
  ```
- Variables: `{{1}}`=customer name, `{{2}}`=date, `{{3}}`=time, `{{4}}`=party size.

### 4.2 Order confirmation
- Name: `order_confirmation`
- Body:
  ```
  Hi {{1}}, we received your order #{{2}}. Total: KES {{3}}. We'll keep you posted.
  ```
- Variables: name, order number, total.

### 4.3 Order status update
- Name: `order_status_update`
- Body:
  ```
  Hi {{1}}, update on order #{{2}}: {{3}}.
  ```
- Variables: name, order number, status phrase (e.g. "is being prepared", "is out for delivery").

### 4.4 Payment receipt
- Name: `payment_receipt`
- Body:
  ```
  Hi {{1}}, payment received for order #{{2}}. Amount: KES {{3}}. Receipt: {{4}}. Thank you!
  ```
- Variables: name, order number, amount, M-Pesa receipt number.

Submit each for approval. Approval is usually 1–24 hours. Use the **exact approved name** when setting the secrets.

> **Important:** the variable order in the template must match the order this app sends. Don't reorder `{{1..n}}`.

---

## 5. Test with the API Setup screen

While waiting for templates, you can verify connectivity:

1. In **API Setup**, add up to 5 **recipient test numbers**. Each recipient must accept the verification prompt sent by Meta.
2. Use the temporary token + the curl snippet on the page to send the pre-approved `hello_world` template. If it arrives, your token + Phone Number ID are valid.

---

## 6. Generate a permanent token (production)

Temporary tokens expire after 24 hours. For production:

1. Business Manager → **Business Settings** → **Users → System Users** → **Add** → name it (e.g. "WhatsApp Sender"), role **Admin**.
2. On the system user, click **Add Assets** → **Apps** → select your app → grant **Full control**.
3. Click **Generate New Token** → select your app → expiration **Never** → scopes:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Copy the token immediately (shown only once). This is your `WHATSAPP_TOKEN`.

Also under Business Settings → **Accounts → WhatsApp Accounts**, make sure your WABA is assigned to the system user.

---

## 7. Register / verify your sending phone number

In **API Setup → Add phone number**:

1. Enter the business display name and the phone number.
2. Verify via SMS or voice code.
3. Once verified, copy its **Phone number ID** → this is `WHATSAPP_PHONE_NUMBER_ID`.

For production traffic above the free tier, complete **Business Verification** in Business Settings → Security Center.

---

## 8. Set the secrets in Lovable Cloud

In the Lovable project: **Cloud → Edge Functions → Secrets**, add:

- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TEMPLATE_RESERVATION`
- `WHATSAPP_TEMPLATE_ORDER`
- `WHATSAPP_TEMPLATE_STATUS`
- `WHATSAPP_TEMPLATE_PAYMENT`
- `WHATSAPP_TEMPLATE_LANG` (optional, default `en`)

No restart needed — edge functions read secrets per-invocation.

---

## 9. Apply the audit migration & deploy the function

```bash
# Apply the audit table (once)
psql "$SUPABASE_DB_URL" -f sql/0014_whatsapp_send_log.sql

# Deploy the function
supabase functions deploy send-whatsapp
```

`supabase/config.toml` already contains:

```toml
[functions.send-whatsapp]
verify_jwt = false
```

so callbacks and client fire-and-forget calls work without a session token. Security comes from server-side recipient lock-in (the function looks up the phone number from the DB row, never from the client payload).

---

## 10. Verify end-to-end

1. Create a reservation in the public site → check the customer's phone for the reservation template.
2. Place an order → expect the order template.
3. From admin, change order status → expect the status template.
4. Pay via M-Pesa Daraja sandbox → expect the receipt template.
5. In Cloud → Database, inspect `whatsapp_send_log`: each send is recorded with `template`, `phone_e164`, `wa_message_id`, and `status`.

---

## 11. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Function returns `not_configured` | `WHATSAPP_TOKEN` or `WHATSAPP_PHONE_NUMBER_ID` not set. |
| `131026 Receiver not in allowed list` | Number isn't in your test recipients (pre-verification) or hasn't accepted the test prompt. |
| `132001 Template name does not exist` | Template name secret doesn't match the approved name, or wrong language code. Check `WHATSAPP_TEMPLATE_LANG`. |
| `132000 Number of parameters does not match` | Template body was edited and now has a different `{{n}}` count. Re-submit or align the call site. |
| `190 Invalid OAuth access token` | Token expired (temp tokens last 24h) or system user lost access — regenerate per §6. |
| Delivery shows `sent` but never `delivered` | Recipient hasn't opened WhatsApp recently / number not on WhatsApp / blocked the business. |

Logs: **Cloud → Edge Functions → send-whatsapp → Logs**. Each invocation logs the template, recipient, and Meta response code.

---

## 12. Cost & limits (reference)

- Utility-category conversations are billed per 24h conversation window, priced per country. See <https://developers.facebook.com/docs/whatsapp/pricing>.
- Unverified businesses: 250 business-initiated conversations / 24h.
- After verification: tier 1 = 1k, scaling to unlimited based on quality rating.

---

## 13. Useful links

- Cloud API quickstart: <https://developers.facebook.com/docs/whatsapp/cloud-api/get-started>
- Message templates: <https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates>
- Error codes: <https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes>
- System users & permanent tokens: <https://developers.facebook.com/docs/whatsapp/business-management-api/get-started>
