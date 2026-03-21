# Elparaiso Garden Kisii — Chatbot Documentation

**Last updated:** 2026-03-21  
**Version:** 2.0 (AI-powered via Lovable Cloud Edge Function)

---

## 1. Overview

The chatbot is a **premium floating concierge** powered by Google Gemini Flash via a Supabase Edge Function. Customer questions are answered by a real LLM with a business-specific system prompt — not keyword matching.

**Business goal:** Convert visitors into reservations, calls, WhatsApp messages, and visits.

---

## 2. Architecture

```
Browser (React/Vite/Netlify)
    ↓  POST { message, history[6] }
Supabase Edge Function  /functions/v1/chat
    ↓  (server-side only — API key never in browser)
Lovable AI Gateway → google/gemini-3-flash-preview
    ↓  structured JSON → ChatbotResponse
ChatPanel.tsx renders reply + action buttons
```

**Key security property:** `LOVABLE_API_KEY` lives only in Supabase secrets. It never reaches the browser.

This is a **Netlify Vite SPA** — not Next.js, not Vercel. The correct backend is a Supabase Edge Function.

---

## 3. File Map

| File | Role |
|------|------|
| `supabase/functions/chat/index.ts` | AI edge function |
| `src/config/chatbotKnowledge.ts` | Business config: actions, chips, welcome |
| `src/services/chatbotService.ts` | Calls edge function; graceful fallback |
| `src/lib/supabase.ts` | Supabase client init |
| `src/types/chat.ts` | Shared TS types |
| `src/components/chat/` | All UI components |

---

## 4. Edge Function — `supabase/functions/chat/index.ts`

**Model:** `google/gemini-3-flash-preview`  
**Temperature:** `0.3`  
**Max tokens:** `300`  
**Server timeout:** 8 seconds

### Cost/Latency Optimisations

- Compact system prompt (no verbose prose)
- History capped at 6 turns × 500 chars each (done client-side before the request)
- Single model call per message
- Fast/cheap model chosen over premium

### Response Contract (always HTTP 200)

```typescript
interface ChatbotResponse {
  content: string;
  intent?: string;        // hours | location | reservation | ... | fallback
  actions?: ChatAction[]; // 1-3 CTA buttons
  suggestions?: string[]; // 2-3 follow-up chips
}
```

Errors never propagate as non-200 — they become a graceful fallback with Call Now + WhatsApp.

---

## 5. Frontend Service — `src/services/chatbotService.ts`

- Reads endpoint from `VITE_SUPABASE_URL` (auto-injected by Lovable Cloud)
- Trims history to last 6 turns before sending
- Normalises response shape defensively
- Returns static fallback if fetch fails or times out (12s client-side timeout)

---

## 6. Business Config — `src/config/chatbotKnowledge.ts`

Pure config file — no scoring logic.

| Export | Contents |
|--------|---------|
| `BUSINESS_INFO` | Phone, WhatsApp, location, anchors |
| `CHATBOT_ACTIONS` | Reusable CTA objects (call, whatsapp, reserve, menu, directions) |
| `QUICK_ACTIONS` | Pre-type chips |
| `WELCOME_MESSAGE` | Opening message |

**To update a business fact:** edit `BUSINESS_INFO` here AND the `BUSINESS` constant in the edge function, then redeploy.

---

## 7. Supported Intents

hours · location · reservation · menu · drinks · contact · delivery · parking · ambience · group_booking · family · events · payment · wifi · fallback

The AI handles these naturally — no explicit keyword mapping required.

---

## 8. Environment Variables

| Variable | Where | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | Browser (build) | Auto-injected by Lovable Cloud |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser (build) | Auto-injected; safe for frontend |
| `LOVABLE_API_KEY` | Edge function (secret) | Auto-provisioned; server-side only |

---

## 9. Deployment

- **Frontend:** Netlify (`netlify.toml` → `dist/`)
- **Backend:** Supabase Edge Function — deploy via Lovable Cloud or `supabase functions deploy chat`
- No Vercel, no Next.js, no `/api` folder

---

## 10. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Every reply is fallback | `VITE_SUPABASE_URL` missing or edge fn unreachable | Check Lovable Cloud connection |
| Still falling back after Cloud connected | `LOVABLE_API_KEY` not provisioned | Verify in Lovable Cloud → Secrets |
| Old keyword responses showing | Stale localStorage | Clear `elparaiso-chat-history` in DevTools |
| Build error about `ChatFaq` | Old import from `chat.ts` | `ChatFaq` is now a local type in `chatbotSupabaseService.ts` only |

---

## 11. Known Limitations

- No real-time menu/inventory — chatbot says to call to confirm
- No live event schedule — advises to contact directly  
- History window is 6 turns (cost/latency trade-off)
- Wi-Fi and exact payment methods: always defers to direct contact

---

## 12. Future Enhancements

| Enhancement | Effort |
|------------|--------|
| Conversation logging to Supabase DB | Low |
| Reservation lead capture via chat | Medium |
| Streaming responses (token-by-token) | Medium |
| CTA click analytics | Low |
| Swahili language support | Medium |
