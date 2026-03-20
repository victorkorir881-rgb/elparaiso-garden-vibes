# Elparaiso Garden Kisii — Chatbot Documentation

> **Version:** 2.0  
> **Last updated:** 2026-03  
> **Audience:** Developers, maintainers, and future engineers working on this project

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [End-to-End Flow](#3-end-to-end-flow)
4. [Knowledge Layer Design](#4-knowledge-layer-design)
5. [Service Layer Design](#5-service-layer-design)
6. [Supported Question Categories](#6-supported-question-categories)
7. [How to Add New FAQs](#7-how-to-add-new-faqs)
8. [How to Maintain Existing Answers](#8-how-to-maintain-existing-answers)
9. [Known Limitations](#9-known-limitations)
10. [Recommended Future Enhancements](#10-recommended-future-enhancements)
11. [Troubleshooting & Debugging](#11-troubleshooting--debugging)
12. [Implementation Principles](#12-implementation-principles)
13. [File Reference](#13-file-reference)

---

## 1. Overview

The Elparaiso Garden Kisii chatbot is a **floating digital concierge** embedded in the restaurant's homepage. It acts as a first-line assistant for prospective customers visiting the website.

### Business goal

Convert website visitors into:
- **Reservations** (reserve a table form, call, WhatsApp)
- **Calls** (direct phone dial)
- **WhatsApp conversations** (deeplink to restaurant WhatsApp)
- **Physical visits** (Google Maps directions)
- **Menu browsing** (scroll to menu section)

### Why frontend-only?

The chatbot is intentionally built as a **100% local, frontend-only system**:

- **Zero backend dependency at runtime** — no network requests, no database, no latency
- **Works offline / on low-quality connections** — important for Kisii's network conditions
- **No API keys exposed in browser** — no security risk
- **Instant responses** — sub-second matching via local TypeScript
- **Easy to maintain** — single config file drives all behaviour
- **Fully portable** — no vendor lock-in; backend can be added later without UI changes

The architecture is explicitly designed so a **secure AI backend can be plugged in later** by replacing a single function — without any changes to the UI layer.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (React / Vite)                                         │
│                                                                 │
│  ┌──────────────────────────────────┐                           │
│  │  UI Layer                        │                           │
│  │  ChatWidget.tsx                  │  ← Floating wrapper +     │
│  │  ChatLauncher.tsx                │    open/close state       │
│  │  ChatPanel.tsx                   │  ← Messages, input, UX    │
│  │  ChatMessage.tsx                 │  ← Individual bubbles     │
│  │  QuickActions.tsx                │  ← Starter chips          │
│  └──────────┬───────────────────────┘                           │
│             │  sendChatMessage() / getWelcomeMessage()          │
│             ▼                                                   │
│  ┌──────────────────────────────────┐                           │
│  │  Service Layer                   │                           │
│  │  chatbotService.ts               │  ← Orchestration          │
│  │  - normalise input               │                           │
│  │  - call knowledge layer          │                           │
│  │  - apply fallback safety nets    │                           │
│  │  - return ChatbotResponse        │                           │
│  └──────────┬───────────────────────┘                           │
│             │  findBestLocalFaq() / detectLocalIntent()         │
│             ▼                                                   │
│  ┌──────────────────────────────────┐                           │
│  │  Knowledge Layer                 │                           │
│  │  chatbotKnowledge.ts             │  ← Single source of truth │
│  │  - LOCAL_FAQS[]                  │                           │
│  │  - QUICK_ACTIONS[]               │                           │
│  │  - CHATBOT_ACTIONS               │                           │
│  │  - detectLocalIntent()           │                           │
│  │  - findBestLocalFaq()            │                           │
│  │  - normaliseForMatching()        │                           │
│  └──────────────────────────────────┘                           │
│                                                                 │
│  ┌──────────────────────────────────┐                           │
│  │  Types                           │                           │
│  │  src/types/chat.ts               │  ← Shared interfaces      │
│  └──────────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### File responsibilities

| File | Responsibility |
|------|----------------|
| `src/config/chatbotKnowledge.ts` | All business knowledge: intents, FAQs, keywords, actions, suggestions, scoring helpers |
| `src/services/chatbotService.ts` | Orchestration: normalise → match → format → return response |
| `src/components/chat/ChatWidget.tsx` | Top-level widget: renders launcher + panel, manages open/close/minimise state |
| `src/components/chat/ChatLauncher.tsx` | The circular floating button that opens the chat |
| `src/components/chat/ChatPanel.tsx` | Chat UI: message thread, input box, quick actions, typing indicator, localStorage persistence |
| `src/components/chat/ChatMessage.tsx` | Renders individual user/assistant message bubbles including inline CTA action buttons |
| `src/components/chat/QuickActions.tsx` | Renders quick-action chips at the top of the chat panel |
| `src/types/chat.ts` | Shared TypeScript interfaces: `ChatMessage`, `ChatAction`, `ChatRole`, `ChatIntent`, etc. |
| `src/config/chatbotConfig.ts` | Runtime configuration: bot name, delays, localStorage keys |

---

## 3. End-to-End Flow

### On first page load

1. `ChatWidget.tsx` renders the floating launcher button (bottom-right corner).
2. The widget manages `isOpen` state; chat panel is hidden by default.

### User opens the chat

1. User clicks the launcher.
2. `ChatPanel.tsx` mounts and checks `localStorage` for saved history.
3. If no history → `getWelcomeMessage()` from `chatbotService.ts` seeds the first message.
4. Quick action chips are rendered from `QUICK_ACTIONS` in `chatbotKnowledge.ts`.

### User sends a message (or taps a quick action chip)

```
User types "Do you have drinks?" → [Send]
         │
         ▼
ChatPanel.tsx: handleSend()
  → adds user bubble to messages
  → adds typing indicator
  → calls sendChatMessage("Do you have drinks?", history)
         │
         ▼
chatbotService.ts: sendChatMessage()
  → normaliseForMatching("Do you have drinks?")
     = "do you have drinks"              ← punctuation stripped, lowercased
  → simulateTypingDelay()                ← 600–1200ms natural pause
  → getAssistantReply("do you have drinks")
         │
         ▼
  Layer 1: findBestLocalFaq("do you have drinks")
    → detectLocalIntent() detects "drinks"
    → candidates = [drinks-bar FAQ]
    → keyword scoring: "drink" ✓, "drinks" ✓, "have drinks" ✓  → score = 5
    → returns drinks-bar FAQ ✓
         │
         ▼
  formatFaqResponse(drinks-bar FAQ)
    → content: "Yes — Elparaiso Garden has a full bar..."
    → actions: [View Menu, Call Now]
    → suggestions: ["What's on the menu?", "How do I reserve?"]
    → intent: "drinks"
         │
         ▼
ChatPanel.tsx: removes typing indicator, renders assistant bubble
  → message content with markdown rendering
  → inline CTA action buttons (View Menu, Call Now)
  → message is saved to localStorage
```

### Fallback path

If neither Layer 1 nor Layer 2 finds a strong match:
- The fallback FAQ is returned
- It explains what topics the chatbot can handle
- It includes example questions and direct CTAs (Call Now, WhatsApp)

---

## 4. Knowledge Layer Design

All business knowledge lives in `src/config/chatbotKnowledge.ts`. This is the **only file that needs editing** when:
- The restaurant changes details (address, phone, etc.)
- A new FAQ topic needs to be added
- Existing answers need improving
- New CTA actions are needed

### Intents

Each FAQ is assigned an `intent` label. Intents represent the customer's underlying goal, not their exact words:

```typescript
type ChatIntent =
  | "greeting"     // Hi, Hello, Good morning
  | "help"         // What can you help with?
  | "brand"        // What is Elparaiso Garden?
  | "hours"        // Are you open? Opening hours?
  | "late_night"   // Can I come at midnight?
  | "location"     // Where are you?
  | "directions"   // How do I get there?
  | "reservation"  // How do I book a table?
  | "walk_in"      // Do I need to reserve?
  | "menu"         // What food do you serve?
  | "drinks"       // Do you have beer/alcohol/cocktails?
  | "contact"      // What's your phone number?
  | "delivery"     // Do you deliver?
  | "parking"      // Is there parking?
  | "ambience"     // What's the vibe like?
  | "date_night"   // Is it good for a date?
  | "family"       // Is it family-friendly?
  | "group_booking"// Can you host groups?
  | "celebrations" // Birthday parties, events
  | "events"       // Live music, DJ, screenings
  | "payment"      // How can I pay?
  | "wifi"         // Do you have Wi-Fi?
  | "use_case"     // Is it a good place to visit?
  | "visit_planning"// I want to visit tonight
  | "fallback"     // Nothing matched
```

### FAQ structure

```typescript
interface ChatFaq {
  id: string;           // Unique identifier (kebab-case)
  intent: ChatIntent;   // Matched intent label
  question: string;     // Representative question (used in phrase scoring)
  answer: string;       // Markdown-safe response text
  keywords: string[];   // All terms that should match this FAQ
  suggestions?: string[];  // Follow-up chip labels shown under the reply
  actions?: ChatAction[];  // Inline CTA buttons rendered below the reply
  priority: number;     // Tie-breaker: higher number wins on equal scores
}
```

### Keywords

Keywords are the primary matching mechanism. Best practices:
- Include singular **and** plural (`drink`, `drinks`)
- Include common synonyms (`alcohol`, `alcoholic`, `beverage`)
- Include natural question fragments (`do you have drinks`, `just for drinks`)
- Include informal phrasing (`pub`, `booze`, `cold one`)
- Include Kenyan/regional phrasing (`tusker`, `pilsner`, `keg`)

### Scoring algorithm

The `scoreFaq()` function weights keywords by specificity:

| Match type | Score |
|-----------|-------|
| Multi-word phrase (e.g. `\"do you have drinks\"`) | +3 per match |
| Long single keyword (>5 chars) | +2 per match |
| Short single keyword (≤5 chars) | +1 per match |

When scores are tied, `priority` is used as the tie-breaker.

### CTA Actions

Reusable action buttons are defined in `CHATBOT_ACTIONS`:

```typescript
CHATBOT_ACTIONS.call        // → tel: link
CHATBOT_ACTIONS.whatsapp    // → wa.me deeplink
CHATBOT_ACTIONS.directions  // → Google Maps search
CHATBOT_ACTIONS.reserve     // → #reservation section
CHATBOT_ACTIONS.menu        // → #menu section
```

These are typed as `ChatAction` from `src/types/chat.ts`:

```typescript
interface ChatAction {
  label: string;
  type: "link" | "phone" | "whatsapp";
  value: string;
}
```

`ChatMessage.tsx` renders these as inline anchor buttons with appropriate icons.

---

## 5. Service Layer Design

`chatbotService.ts` contains three main exported functions:

### `getWelcomeMessage(): ChatbotResponse`

Returns the initial message shown when the chat opens. Always provides:
- Warm greeting
- List of supported topics
- Quick action suggestions
- Reserve + Call CTAs

### `sendChatMessage(input, history?): Promise<ChatbotResponse>`

The main entry point. Flow:

```
1. normaliseForMatching(input)          // strip punctuation, lowercase, trim
2. Guard: empty input → help response
3. simulateTypingDelay()                // 600–1200ms adaptive delay
4. getAssistantReply(normalised)        // core matching logic
```

### `getAssistantReply(normalised)` *(internal)*

This is the **future AI replacement point**. Current flow:

```
Layer 1: findBestLocalFaq(input)        // intent detection + keyword scoring
  → if non-fallback match: return it

Layer 2: findBestFaqGlobally(input)     // full keyword scan across all FAQs
  → if non-fallback match: return it

Layer 3: getFallbackFaq()               // always returns gracefully
```

#### Future AI integration

When integrating a real AI backend:

```typescript
// In chatbotService.ts → getAssistantReply()
// Replace the layer 1-3 logic with:

const aiReply = await callSecureAiBackend(normalised, _history);
if (aiReply) return aiReply;

// Keep layers 2-3 as fallback in case AI is unavailable
```

The `callSecureAiBackend()` function should:
- Call **your own API route** or a **Supabase Edge Function**
- Never be called from the frontend with a raw OpenAI key
- Return `ChatbotResponse | null` (null triggers local fallback)

---

## 6. Supported Question Categories

### ✅ Fully handled locally

| Category | Example questions |
|----------|------------------|
| Greetings | Hi, Hello, Good morning, Hey |
| Help | What can you help me with?, What can I ask? |
| Brand / About | What is Elparaiso Garden?, Is it a bar or restaurant? |
| Opening hours | Are you open now?, What time do you open?, 24 hours? |
| Late night | Can I come at midnight?, Open all night? |
| Location | Where are you located?, What is your address? |
| Directions | How do I get there?, Google Maps directions |
| Reservations | How do I book a table?, Can I reserve online? |
| Walk-ins | Do I need to book?, Can I just arrive? |
| Menu / Food | What food do you serve?, Do you have nyama choma? |
| Drinks / Bar | Do you have beer?, Do you serve cocktails?, Just for drinks? |
| Contact | What's your phone number?, Can I WhatsApp you? |
| Delivery | Do you deliver?, Do you do takeaway? |
| Parking | Is there parking?, Where can I park? |
| Ambience / Vibe | What's the atmosphere like?, Is it chill? |
| Date nights | Is it good for a date?, Romantic setting? |
| Family-friendly | Can I bring kids?, Is it family-friendly? |
| Group bookings | Can you host groups?, Book for 20 people? |
| Celebrations | Birthday party, Anniversary, Farewell dinner |
| Events / Music | Do you have live music?, DJ nights?, Football screenings? |
| Payment | Do you accept M-Pesa?, Can I pay by card? |
| Wi-Fi | Do you have Wi-Fi?, Can I work there? |
| Use-case planning | Is it good for evening drinks?, Best chill spot in Kisii? |
| Visit planning | I want to visit tonight, Coming this weekend |
| Fallback | Any unclear or unrecognised question |

---

## 7. How to Add New FAQs

### Step 1: Choose or create an intent

If the new question fits an existing intent (e.g. `drinks`), reuse it. If it represents a genuinely new topic, add the intent to the `ChatIntent` union type in `chatbotKnowledge.ts`.

### Step 2: Add a new FAQ entry to `LOCAL_FAQS`

```typescript
{
  id: "my-new-faq",           // unique kebab-case id
  intent: "drinks",           // must match ChatIntent
  question: "Do you serve cocktails?",
  answer:
    "Yes — we offer a great selection of cocktails! 🍹\n\n" +
    "For the current cocktail menu, feel free to call or WhatsApp us.",
  keywords: [
    "cocktail", "cocktails", "mocktail", "mocktails",
    "mixed drink", "long island", "mojito", "margarita",
  ],
  suggestions: [
    "What's on the menu?",
    "How do I reserve?",
  ],
  actions: [CHATBOT_ACTIONS.menu, CHATBOT_ACTIONS.call],
  priority: 8,
},
```

### Step 3: Update `detectLocalIntent()` if you added a new intent

In the intent detection function, add a check for the new intent's keywords:

```typescript
// Inside detectLocalIntent():
if (has("cocktail", "cocktails", "mocktail")) return "cocktails";
```

Place it **before** more generic checks to avoid being swallowed by a broader intent.

### Step 4: Optionally add default actions/suggestions for the new intent

In `chatbotService.ts`, update `defaultActionsFor()` and `defaultSuggestionsFor()` if the new intent needs its own defaults.

### Step 5: Optionally add a quick action chip

In `QUICK_ACTIONS`, add:

```typescript
{ label: "Do you have cocktails?" },
```

Keep `QUICK_ACTIONS` to 5–7 items max to avoid overflow on mobile.

---

## 8. How to Maintain Existing Answers

### Where to edit content

All answer text is in `LOCAL_FAQS[*].answer` in `chatbotKnowledge.ts`. Edit directly.

### Safe-wording policy

Do **not** state exact details that may vary over time or require real-time verification:

| Topic | Safe approach |
|-------|--------------|
| Menu prices | `"popular price range"` → direct to call/WhatsApp |
| Exact menu items | List categories, not exhaustive item names |
| Delivery radius/fees | `"contact us to confirm current options"` |
| Exact event schedule | `"check with team for latest happenings"` |
| Exact drink stock | `"great selection available — call to confirm"` |
| Wi-Fi availability | `"confirm with team before visiting"` |
| Parking capacity | `"available nearby — call ahead for peak times"` |
| Payment methods | `"commonly: cash, M-Pesa, card — confirm with team"` |

This approach prevents the chatbot from giving outdated or incorrect information while still being genuinely helpful.

### Updating business details

Constants are centralised at the top of `chatbotKnowledge.ts`:

```typescript
const PHONE_DISPLAY   = "0791 224513";
const PHONE_INTL      = "+254791224513";
const PHONE_TEL       = "tel:+254791224513";
const WHATSAPP_LINK   = "https://wa.me/254791224513";
const MAPS_LINK       = "https://www.google.com/maps/...";
```

Changing any of these constants automatically updates all FAQs and CTA actions that reference them.

---

## 9. Known Limitations

| Limitation | Description |
|-----------|-------------|
| No live inventory | The chatbot cannot tell the user if a specific dish is available today |
| No real-time event schedule | Events and music nights are described generally; not real-time |
| No live reservation backend | The chatbot guides users to reserve; it doesn't confirm availability |
| No dynamic pricing | Cannot quote prices for menu items |
| No live delivery tracking | Cannot track orders |
| Deterministic matching only | Cannot understand complex, multi-step, or ambiguous queries the way an LLM can |
| English-only | No Swahili or Sheng support currently |
| No memory across sessions | Each chat session is independent (though history is persisted locally) |

---

## 10. Recommended Future Enhancements

### Near-term

- **Analytics:** Log which intents are triggered most often to identify missing FAQ coverage
- **Lead capture:** When a user asks "Can I reserve?", capture their name/phone via a mini-form inside the chat
- **Multilingual support:** Add Swahili keyword coverage for common questions

### Medium-term

- **Supabase integration:** Move FAQ content to a `chatbot_faqs` table so it can be edited via admin UI without code changes
- **Admin knowledge editor:** Simple CRUD UI for restaurant staff to update answers
- **Conversation logging:** Store sessions in `chatbot_conversations` + `chatbot_messages` for analysis

### Long-term

- **AI-powered replies:** Plug in a secure backend (Supabase Edge Function calling OpenAI) via the prepared `getAssistantReply()` replacement point
- **Reservation intent → lead form:** When reservation intent is detected, open a mini inline form to capture name/date/party size
- **Proactive greeting:** Trigger the chat to open automatically after X seconds of inactivity on the page

---

## 11. Troubleshooting & Debugging

### Problem: A question about a supported topic returns the fallback response

**Likely cause:** The user's phrasing contains no keywords from the matching FAQ.

**Diagnosis steps:**

1. Identify which FAQ should have matched (e.g. `drinks-bar`)
2. Open `chatbotKnowledge.ts` and find the FAQ's `keywords` array
3. Call `normaliseForMatching(\"your test input\")` in the browser console to see what the input looks like after normalisation
4. Check if any normalised keyword exists in that normalised input
5. If not — add the missing phrasing to `keywords`

**Example fix:**

```
User typed: "Can I grab a cold one?"
Normalised: "can i grab a cold one"

drinks-bar keywords: [..., "beer", "beers", "cold beer", ...]
Missing: "cold one"

Fix: add "cold one" to drinks-bar keywords
```

---

### Problem: A new FAQ intent isn't being detected

**Likely cause:** `detectLocalIntent()` doesn't include the new intent's keywords, so it falls through to `"fallback"`.

**Fix:** Add a check to `detectLocalIntent()` in `chatbotKnowledge.ts`:

```typescript
if (has("your", "new", "keywords")) return "your_new_intent";
```

Place it **before** broader checks that might catch your keywords first.

---

### Problem: Wrong FAQ matches (a more generic FAQ wins over a specific one)

**Likely cause:** The wrong FAQ has a higher keyword overlap score.

**Diagnosis:** Add `console.log` to `scoreFaq()` temporarily to see scores for each candidate.

**Fix options:**
- Increase `priority` on the correct FAQ
- Add more specific multi-word keywords to the correct FAQ (they score +3 vs single words at +1)
- Remove overly generic keywords from the wrong FAQ

---

### Problem: CTA actions show wrong buttons

**Likely cause:** The FAQ entry has no `actions` array, so `defaultActionsFor(intent)` is used instead.

**Fix:** Either add an explicit `actions` array to the FAQ, or update `defaultActionsFor()` in `chatbotService.ts` to return better defaults for that intent.

---

### Problem: Build error after editing `chatbotKnowledge.ts`

**Common causes:**

1. **New intent not added to `ChatIntent` union** — ensure the intent string is listed in both the `ChatIntent` type and the `LOCAL_FAQS` entries.
2. **`CHATBOT_ACTIONS` key used in a FAQ but not defined** — check the `CHATBOT_ACTIONS` object.
3. **Missing `satisfies ChatAction`** — all CHATBOT_ACTIONS entries must match the `ChatAction` interface.

---

## 12. Implementation Principles

These principles guided all design decisions and should continue to guide future changes:

| Principle | Rationale |
|-----------|-----------|
| **Frontend-only first** | Zero latency, works offline, no API key exposure, simpler deployment |
| **Deterministic before AI complexity** | A well-structured keyword system covers 90% of restaurant questions reliably |
| **Knowledge as single source of truth** | All content in one file = easy to maintain, no duplication |
| **Conversion-focused responses** | Every reply should guide the user toward an action (call, reserve, visit) |
| **Safe wording over false precision** | Better to say "contact us to confirm" than state an incorrect fact |
| **Layered matching safety** | Multiple fallback layers prevent unnecessary fallback responses |
| **Compatible service API** | `sendChatMessage()` signature is stable so ChatPanel.tsx never needs updating |
| **Future AI adapter ready** | `getAssistantReply()` is clearly marked as the AI replacement point |

---

## 13. File Reference

```
src/
├── config/
│   ├── chatbotKnowledge.ts     ← PRIMARY: all FAQ/intent/keyword content
│   └── chatbotConfig.ts        ← Runtime config (bot name, delays, keys)
├── services/
│   └── chatbotService.ts       ← Orchestration + matching engine
├── components/
│   └── chat/
│       ├── ChatWidget.tsx       ← Floating wrapper, open/close state
│       ├── ChatLauncher.tsx     ← Circular launcher button
│       ├── ChatPanel.tsx        ← Full chat UI, message list, input
│       ├── ChatMessage.tsx      ← Individual message bubble + CTAs
│       └── QuickActions.tsx     ← Quick-start action chips
└── types/
    └── chat.ts                  ← Shared TypeScript interfaces

docs/
└── chatbot-documentation.md    ← This file
```

---

*This documentation reflects the actual implementation. Keep it updated when making significant changes to the chatbot system.*
