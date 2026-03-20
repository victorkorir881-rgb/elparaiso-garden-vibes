/**
 * chatbotKnowledge.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Production-ready local knowledge base for Elparaiso Garden Kisii chatbot.
 *
 * DESIGN PRINCIPLES
 * - 100% frontend-only, zero backend / Supabase dependency at runtime
 * - Deterministic: same input → same answer, every time
 * - Conversion-focused: every response guides the user toward a CTA
 * - Safe-wording policy: never state exact stock/prices/capacity/Wi-Fi facts
 *   that might change — instead, direct the user to call / WhatsApp to confirm
 * - Single source of truth: chatbotService.ts imports from here; no duplication
 */

import type { ChatAction } from "@/types/chat";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — update here only; everything downstream auto-updates
// ─────────────────────────────────────────────────────────────────────────────

const PHONE_DISPLAY   = "0791 224513";
const PHONE_INTL      = "+254791224513";
const PHONE_TEL       = "tel:+254791224513";
const WHATSAPP_LINK   = "https://wa.me/254791224513";
const MAPS_LINK       = "https://www.google.com/maps/search/?api=1&query=Elparaiso+Garden+Kisii";
const RESERVE_SECTION = "reservation";
const MENU_SECTION    = "menu";

// ─────────────────────────────────────────────────────────────────────────────
// QUICK ACTIONS — chips displayed before the user types
// ─────────────────────────────────────────────────────────────────────────────

export const QUICK_ACTIONS = [
  { label: "Are you open now?" },
  { label: "Where are you located?" },
  { label: "How do I reserve?" },
  { label: "What's on the menu?" },
  { label: "Do you serve drinks?" },
  { label: "Contact / WhatsApp" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE CTA ACTIONS — compose these into FAQ entries below
// ─────────────────────────────────────────────────────────────────────────────

export const CHATBOT_ACTIONS = {
  call: {
    label: "Call Now",
    type: "phone" as const,
    value: PHONE_INTL,
  } satisfies ChatAction,

  whatsapp: {
    label: "WhatsApp",
    type: "whatsapp" as const,
    value: PHONE_INTL,
  } satisfies ChatAction,

  directions: {
    label: "Get Directions",
    type: "link" as const,
    value: MAPS_LINK,
  } satisfies ChatAction,

  reserve: {
    label: "Reserve a Table",
    type: "link" as const,
    value: `#${RESERVE_SECTION}`,
  } satisfies ChatAction,

  menu: {
    label: "View Menu",
    type: "link" as const,
    value: `#${MENU_SECTION}`,
  } satisfies ChatAction,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All supported intent labels.
 * Keep in sync with:  LOCAL_FAQS entries  +  detectLocalIntent() checks.
 */
export type ChatIntent =
  | "greeting"
  | "help"
  | "brand"
  | "hours"
  | "late_night"
  | "location"
  | "directions"
  | "reservation"
  | "walk_in"
  | "menu"
  | "drinks"
  | "contact"
  | "delivery"
  | "parking"
  | "ambience"
  | "date_night"
  | "family"
  | "group_booking"
  | "celebrations"
  | "events"
  | "payment"
  | "wifi"
  | "use_case"
  | "visit_planning"
  | "fallback";

export interface ChatFaq {
  id: string;
  intent: ChatIntent;
  question: string;         // representative question (used in scoring)
  answer: string;           // markdown-safe response text
  keywords: string[];       // matched against normalised user input
  suggestions?: string[];   // follow-up chips shown under the reply
  actions?: ChatAction[];   // inline CTA buttons rendered below reply
  priority: number;         // tie-breaker: higher wins
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL FAQ KNOWLEDGE BASE
// ─────────────────────────────────────────────────────────────────────────────

export const LOCAL_FAQS: ChatFaq[] = [

  // ── GREETINGS ──────────────────────────────────────────────────────────────

  {
    id: "greeting",
    intent: "greeting",
    question: "Hello",
    answer:
      "Hey there! 👋 Welcome to **Elparaiso Garden Kisii** — Kisii's ultimate chill spot.\n\n" +
      "I can help you with:\n" +
      "• **Opening hours** — we're open 24/7!\n" +
      "• **Location & directions**\n" +
      "• **Reservations** & table bookings\n" +
      "• **Menu** highlights\n" +
      "• **Drinks & bar** info\n" +
      "• **Delivery / takeaway**\n" +
      "• **Events & vibes**\n\n" +
      "What would you like to know? 😊",
    keywords: [
      "hi", "hello", "hey", "hii", "helo", "heya",
      "good morning", "good afternoon", "good evening", "good night",
      "morning", "afternoon", "evening", "night",
      "howdy", "sup", "wassup", "yo",
    ],
    suggestions: ["Are you open now?", "Where are you located?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    priority: 15,
  },

  // ── HELP / WHAT CAN YOU DO ─────────────────────────────────────────────────

  {
    id: "help",
    intent: "help",
    question: "What can you help with?",
    answer:
      "I'm the **Elparaiso Concierge** 🌿 — here to make your visit easy!\n\n" +
      "Ask me about:\n" +
      "• **Opening hours** — are you open? Yes, 24/7!\n" +
      "• **Location** — where is Elparaiso?\n" +
      "• **Reservations** — how to book a table\n" +
      "• **Menu & food** — what's on offer\n" +
      "• **Drinks & bar** — beers, cocktails, spirits\n" +
      "• **Delivery / takeaway**\n" +
      "• **Parking** — is there parking?\n" +
      "• **Events** — music, vibes, screenings\n" +
      "• **Contact** — phone & WhatsApp\n" +
      "• **Group bookings** & celebrations\n\n" +
      "Go ahead — ask me anything! 😊",
    keywords: [
      "help", "what can you do", "what can you help",
      "what can i ask", "what do you know", "how can you help",
      "capabilities", "features", "support", "assist",
    ],
    suggestions: ["Are you open now?", "How do I reserve?", "What's on the menu?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    priority: 14,
  },

  // ── BRAND / ABOUT ─────────────────────────────────────────────────────────

  {
    id: "brand",
    intent: "brand",
    question: "What is Elparaiso Garden?",
    answer:
      "**Elparaiso Garden Kisii** is Kisii's go-to chill spot — a relaxed garden-style venue serving great food, quality drinks, and good vibes **24 hours a day, 7 days a week**. 🌿🔥\n\n" +
      "Whether you're coming for a solo lunch, a date night, a family outing, or a big celebration, Elparaiso has you covered.\n\n" +
      "🔥 Famous for nyama choma-style grills\n" +
      "🍹 Full bar with cocktails, beer & spirits\n" +
      "🎶 Great music and social atmosphere\n" +
      "🚗 On-site parking & car wash service\n\n" +
      "Come experience it yourself!",
    keywords: [
      "what is elparaiso", "about elparaiso", "about the restaurant",
      "tell me about", "what kind of place", "is it a bar", "is it a restaurant",
      "restaurant or bar", "what makes it special", "why should i visit",
      "what do you offer", "what is this place", "overview", "elparaiso garden",
      "describe", "the place", "the venue",
    ],
    suggestions: ["What's on the menu?", "Where are you located?", "Are you open now?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.directions],
    priority: 12,
  },

  // ── OPENING HOURS / 24/7 ──────────────────────────────────────────────────

  {
    id: "hours-24-7",
    intent: "hours",
    question: "What are your opening hours?",
    answer:
      "We are **open 24 hours a day, 7 days a week** — yes, that includes weekends, public holidays, and late nights! 🕐\n\n" +
      "Whether you're planning breakfast at dawn, a lazy lunch, dinner with friends, or a late-night visit, Elparaiso Garden is always open and ready for you.",
    keywords: [
      "open", "opening", "opening hours", "hours", "time", "times",
      "what time", "closing", "close", "closed", "schedule",
      "today", "now", "currently", "currently open", "are you open",
      "24", "24/7", "twenty four", "all day", "always open",
      "weekend", "weekends", "sunday", "saturday", "monday",
      "holiday", "public holiday", "christmas", "new year",
      "when do you open", "when do you close",
    ],
    suggestions: ["Where are you located?", "How do I reserve?", "What's on the menu?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    priority: 10,
  },

  {
    id: "late-night",
    intent: "late_night",
    question: "Can I come late at night?",
    answer:
      "Absolutely — **Elparaiso Garden is open 24/7**, so you're welcome any time of the day or night. 🌙\n\n" +
      "Late-night visits are popular here. Whether it's drinks, food, or just a good vibe, we're here for it.",
    keywords: [
      "late", "late night", "midnight", "night time", "night visit",
      "after midnight", "2am", "3am", "4am", "early morning",
      "can i come late", "open at night", "night hours", "all night",
    ],
    suggestions: ["What's on the menu?", "Do you serve drinks?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    priority: 9,
  },

  // ── LOCATION / ADDRESS ────────────────────────────────────────────────────

  {
    id: "location-kisii",
    intent: "location",
    question: "Where are you located?",
    answer:
      "We're at **County Government Street, Kisii, Kenya** — right in the heart of Kisii town. 📍\n\n" +
      "Easy to find and accessible by car or on foot. Tap below to get directions straight to us.",
    keywords: [
      "where", "where are you", "location", "located", "address", "place",
      "find you", "find the place", "where is it", "county government",
      "county government street", "kisii town", "in kisii", "kisii",
      "which street", "the venue", "pin", "send location",
    ],
    suggestions: ["Is there parking?", "How can I contact you?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.directions, CHATBOT_ACTIONS.call],
    priority: 10,
  },

  {
    id: "directions",
    intent: "directions",
    question: "How do I get there?",
    answer:
      "Getting to Elparaiso Garden is easy! 🗺️\n\n" +
      "📍 **Address:** County Government Street, Kisii\n\n" +
      "Tap **Get Directions** below and Google Maps will navigate you straight to us. If you prefer, call or WhatsApp us and we'll guide you in.",
    keywords: [
      "directions", "direction", "how to get", "how do i get",
      "how to reach", "navigate", "navigation", "google maps", "maps",
      "driving", "route", "show me the way", "map", "gps",
    ],
    suggestions: ["Is there parking?", "Are you open now?"],
    actions: [CHATBOT_ACTIONS.directions, CHATBOT_ACTIONS.whatsapp],
    priority: 9,
  },

  // ── RESERVATIONS / BOOKING ────────────────────────────────────────────────

  {
    id: "reservation-booking",
    intent: "reservation",
    question: "How do I make a reservation?",
    answer:
      "Reserving a table at Elparaiso Garden is simple! 🍽️\n\n" +
      "Choose any of these options:\n\n" +
      "• **Reserve online** — use the reservation form on this page\n" +
      "• **Call us** on **" + PHONE_DISPLAY + "**\n" +
      "• **WhatsApp us** for quick confirmation\n\n" +
      "We welcome couples, families, friends, and large groups. For big events or group bookings, we recommend reserving in advance.",
    keywords: [
      "reserve", "reservation", "book", "booking", "book a table",
      "table", "seat", "seating", "make a reservation", "make a booking",
      "i want to book", "i want to reserve", "can i book",
      "can i reserve", "need a table", "pre-book", "preorder",
      "how to reserve", "how to book", "online booking",
      "reserve tonight", "reserve for tonight", "reserve for tomorrow",
      "table for tonight", "book for two", "book for tonight",
    ],
    suggestions: ["Do you host group bookings?", "What's on the menu?", "Are you open now?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call],
    priority: 10,
  },

  {
    id: "walk-in",
    intent: "walk_in",
    question: "Can I walk in without a reservation?",
    answer:
      "Yes! **Walk-ins are welcome** at Elparaiso Garden — no booking required for casual visits. 🚶‍♂️\n\n" +
      "However, for **larger groups, special occasions, or peak times**, we recommend calling ahead or reserving online to ensure we have the perfect spot ready for you.",
    keywords: [
      "walk in", "walk-in", "do i need to book", "do i need to reserve",
      "without booking", "without reservation", "no reservation",
      "just arrive", "can i just come", "can i show up", "drop in",
    ],
    suggestions: ["How do I reserve?", "Are you open now?", "Where are you located?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    priority: 8,
  },

  // ── MENU / FOOD ───────────────────────────────────────────────────────────

  {
    id: "menu-food",
    intent: "menu",
    question: "What food do you serve?",
    answer:
      "Elparaiso Garden serves a great variety of food with something for everyone! 🍽️\n\n" +
      "🔥 **Grill favourites** — nyama choma-style grills, mutura, and more\n" +
      "🍖 **Hearty meals** — satisfying options for lunch and dinner\n" +
      "🥗 **Snacks & bites** — perfect for casual visits\n" +
      "🍹 **Full bar** — cocktails, beers, wines, spirits & soft drinks\n\n" +
      "For the full current menu, tap **View Menu** below or call us.",
    keywords: [
      "menu", "food", "eat", "eating", "serve", "serving", "dishes",
      "meal", "meals", "what food", "what do you serve", "what do you have",
      "what do you offer", "what can i eat", "popular dishes",
      "nyama", "choma", "nyama choma", "grill", "grilled", "mutura",
      "snacks", "lunch", "dinner", "breakfast", "something to eat",
    ],
    suggestions: ["Do you serve drinks?", "Do you do delivery?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.menu, CHATBOT_ACTIONS.reserve],
    priority: 9,
  },

  // ── DRINKS / BAR ──────────────────────────────────────────────────────────

  {
    id: "drinks-bar",
    intent: "drinks",
    question: "Do you serve drinks or alcohol?",
    answer:
      "Yes — Elparaiso Garden has a **full bar** offering a great drinks selection! 🍹🍺\n\n" +
      "• **Beer** — cold beers available\n" +
      "• **Cocktails** — refreshing cocktail options\n" +
      "• **Wine** — available for the occasion\n" +
      "• **Spirits & premium drinks** — a good selection\n" +
      "• **Soft drinks & juices** — for everyone\n\n" +
      "Whether you're coming just for drinks or pairing with food, the bar has you covered. For the current drinks menu, feel free to call or WhatsApp us.",
    keywords: [
      "drink", "drinks", "drinking", "bar", "alcohol", "alcoholic",
      "beer", "beers", "cold beer", "tusker", "pilsner", "lager",
      "wine", "wines", "cocktail", "cocktails", "spirits", "spirit",
      "whiskey", "whisky", "vodka", "gin", "rum", "brandy",
      "soft drink", "soft drinks", "juice", "juices", "soda", "water",
      "beverage", "beverages", "serve drinks", "do you have drinks",
      "do you have alcohol", "can i come for drinks", "just for drinks",
      "only drinks", "what drinks do you have", "do you sell beer",
    ],
    suggestions: ["What's on the menu?", "What's the vibe like?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.menu, CHATBOT_ACTIONS.call],
    priority: 9,
  },

  // ── CONTACT / PHONE / WHATSAPP ────────────────────────────────────────────

  {
    id: "contact-phone-whatsapp",
    intent: "contact",
    question: "How can I contact you?",
    answer:
      "You can reach us anytime! 📞\n\n" +
      `📞 **Phone:** ${PHONE_DISPLAY}\n` +
      `💬 **WhatsApp:** ${PHONE_INTL}\n` +
      `📍 **Visit us:** County Government Street, Kisii\n\n` +
      "Our team is happy to help with reservations, directions, orders, and any questions.",
    keywords: [
      "contact", "contacts", "how to contact", "call", "calling",
      "phone", "phone number", "number", "telephone",
      "whatsapp", "whatsapp number", "message", "messaging",
      "reach", "reach out", "get in touch", "customer care", "customer service",
      "can i call", "can i message", "how do i reach",
    ],
    suggestions: ["Where are you located?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.whatsapp],
    priority: 9,
  },

  // ── DELIVERY / TAKEAWAY ───────────────────────────────────────────────────

  {
    id: "delivery-takeaway",
    intent: "delivery",
    question: "Do you do delivery or takeaway?",
    answer:
      "For **delivery and takeaway options**, the best way to confirm current availability is to contact us directly — our team can let you know what's available right now.\n\n" +
      "📞 Give us a quick call or send a WhatsApp message and we'll sort you out! 🚗",
    keywords: [
      "delivery", "deliver", "delivers", "deliveries", "food delivery",
      "takeaway", "take away", "takeout", "take out", "to go",
      "pick up", "pickup", "collect", "collection",
      "order food", "order online", "order delivery",
      "package food", "pack", "carry out", "bring food",
      "drive through", "drive-through",
    ],
    suggestions: ["How can I contact you?", "What's on the menu?"],
    actions: [CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call],
    priority: 8,
  },

  // ── PARKING ───────────────────────────────────────────────────────────────

  {
    id: "parking-availability",
    intent: "parking",
    question: "Is there parking available?",
    answer:
      "Yes — **parking is available at and around the venue**! 🚗\n\n" +
      "Elparaiso Garden is located on County Government Street in Kisii town and is easy to access by car. For busy periods or large group visits, we recommend calling ahead so the team can guide you on the best parking option.",
    keywords: [
      "parking", "park", "parks", "car park", "parking lot", "parking available",
      "is there parking", "where to park", "car", "vehicle", "vehicles",
      "parking space", "spaces", "parking spot", "free parking",
      "access by car", "drive there",
    ],
    suggestions: ["Where are you located?", "How do I reserve?", "How can I contact you?"],
    actions: [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.directions],
    priority: 7,
  },

  // ── AMBIENCE / VIBE ───────────────────────────────────────────────────────

  {
    id: "ambience-garden-vibes",
    intent: "ambience",
    question: "What is the atmosphere like?",
    answer:
      "Elparaiso Garden has a **relaxed, social garden atmosphere** — think: comfortable seating, good music, warm lighting, and a welcoming vibe. 🌿✨\n\n" +
      "It's the perfect spot for:\n" +
      "• **Casual hangouts** with friends\n" +
      "• **Dates and couple evenings**\n" +
      "• **Family meals**\n" +
      "• **After-work drinks**\n" +
      "• **Birthday and group celebrations**\n\n" +
      "The setting is social and lively — but also laid-back enough to have a real conversation.",
    keywords: [
      "atmosphere", "ambience", "vibe", "vibes", "environment",
      "garden", "garden setting", "garden style", "outdoor",
      "nice", "pleasant", "setting", "feel", "feeling",
      "what is it like", "how does it feel",
      "relaxed", "chill", "chilled",
      "romantic", "relaxing",
    ],
    suggestions: ["Is it good for a date night?", "Do you host group bookings?", "What's on the menu?"],
    actions: [CHATBOT_ACTIONS.reserve],
    priority: 7,
  },

  {
    id: "date-night",
    intent: "date_night",
    question: "Is it good for a date night?",
    answer:
      "Absolutely — Elparaiso Garden is a **great date spot**! 💕\n\n" +
      "The relaxed garden vibe, good food, quality drinks, and warm atmosphere make it ideal for a special evening. Many couples enjoy a meal, drinks, and the social setting here.\n\n" +
      "We recommend **reserving a table in advance** to make your evening extra special.",
    keywords: [
      "date", "date night", "romantic", "romance", "couple",
      "couples", "evening date", "dinner date", "good for a date",
      "bring my partner", "bring my girlfriend", "bring my boyfriend",
      "girlfriend", "boyfriend", "anniversary",
    ],
    suggestions: ["How do I reserve?", "What's on the menu?", "What's the atmosphere like?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    priority: 8,
  },

  // ── FAMILY FRIENDLY ───────────────────────────────────────────────────────

  {
    id: "family-friendly",
    intent: "family",
    question: "Is it family-friendly?",
    answer:
      "Yes — Elparaiso Garden is suitable for **families, couples, and group visits** of all kinds. 👨‍👩‍👧‍👦\n\n" +
      "It's a relaxed garden setting where families can enjoy a meal comfortably together. If you're planning a family outing, we recommend **reserving a table in advance** so we can have the right seating ready for you.",
    keywords: [
      "family", "families", "family friendly", "family outing", "family visit",
      "kids", "children", "child", "baby", "babies", "toddler",
      "with kids", "bring kids", "safe for kids", "suitable for children",
      "family meal", "family dinner",
    ],
    suggestions: ["How do I reserve?", "What's the atmosphere like?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    priority: 6,
  },

  // ── GROUP BOOKINGS / CELEBRATIONS ─────────────────────────────────────────

  {
    id: "group-bookings",
    intent: "group_booking",
    question: "Can you host groups or celebrations?",
    answer:
      "Definitely! Elparaiso Garden is a **great venue for group dining, birthdays, celebrations, and corporate meetups**. 🎉\n\n" +
      "We can accommodate groups of various sizes. For a smooth experience, we strongly recommend **reserving in advance** — especially for larger groups — so the team can prepare the best setup for you.",
    keywords: [
      "group", "groups", "large group", "group booking", "group reservation",
      "birthday", "birthdays", "birthday party", "celebration", "celebrate",
      "party", "parties", "anniversary party",
      "corporate", "corporate event", "work event", "team lunch",
      "meeting", "gatherings", "gathering", "many people",
      "how many people", "large table",
    ],
    suggestions: ["How do I reserve?", "How can I contact you?", "What's on the menu?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call],
    priority: 8,
  },

  {
    id: "celebrations",
    intent: "celebrations",
    question: "Can I book for a birthday celebration?",
    answer:
      "Yes — Elparaiso Garden is a **popular choice for birthdays and celebrations**! 🎂🎉\n\n" +
      "Whether it's a small intimate birthday dinner or a big celebration with friends, we'd love to host you. Get in touch and the team will help make it memorable.",
    keywords: [
      "birthday celebration", "celebrate birthday", "birthday party here",
      "throw a party", "host birthday", "celebrate here",
      "farewell", "graduation", "engagement",
      "special occasion", "special event", "milestone",
    ],
    suggestions: ["How do I reserve?", "How can I contact you?"],
    actions: [CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    priority: 7,
  },

  // ── EVENTS / MUSIC / ENTERTAINMENT ───────────────────────────────────────

  {
    id: "events-music",
    intent: "events",
    question: "Do you host events, music, or screenings?",
    answer:
      "Elparaiso Garden regularly has a **great social vibe with music and entertainment**. 🎶\n\n" +
      "For the latest on specific events, live performances, screenings, or DJ nights, contact the team directly — they'll have the most up-to-date info.",
    keywords: [
      "event", "events", "music", "live music", "live entertainment",
      "dj", "disc jockey", "band", "performer",
      "screening", "screenings", "football", "football match",
      "watch football", "show", "shows",
      "entertainment", "weekend event", "weekend plan",
      "what's on", "what is on", "whats happening",
    ],
    suggestions: ["How can I contact you?", "How do I reserve?", "What's the vibe like?"],
    actions: [CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call],
    priority: 6,
  },

  // ── PAYMENT METHODS ───────────────────────────────────────────────────────

  {
    id: "payment-options",
    intent: "payment",
    question: "What payment methods do you accept?",
    answer:
      "For the most accurate current payment options, please confirm with the team directly.\n\n" +
      "💳 Common payment methods at similar venues include **cash, M-Pesa, and card** — but to avoid any surprises, give us a quick call or message before you visit.",
    keywords: [
      "payment", "payments", "pay", "paying",
      "cash", "money", "notes",
      "mpesa", "m-pesa", "mobile money", "mobile payment",
      "card", "debit card", "credit card", "visa", "mastercard",
      "nfc", "contactless", "tap to pay",
      "how do i pay", "how to pay", "what payment",
      "do you accept", "accept mpesa",
    ],
    suggestions: ["How can I contact you?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call],
    priority: 6,
  },

  // ── WI-FI / WORKSPACE ─────────────────────────────────────────────────────

  {
    id: "wifi-workspace",
    intent: "wifi",
    question: "Do you have Wi-Fi?",
    answer:
      "For the most accurate info about **Wi-Fi and workspace availability**, it's best to check with the team before visiting so they can advise based on current setup. 📶\n\n" +
      "Give us a call or WhatsApp us and we'll be happy to help!",
    keywords: [
      "wifi", "wi-fi", "wifi password", "internet", "connectivity",
      "network", "online", "work remotely", "work from there",
      "laptop", "laptop-friendly", "study", "study there",
      "remote work", "work friendly", "coworking",
    ],
    suggestions: ["How can I contact you?", "What are your opening hours?"],
    actions: [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.whatsapp],
    priority: 4,
  },

  // ── USE CASE / VISIT PLANNING ─────────────────────────────────────────────

  {
    id: "use-case-general",
    intent: "use_case",
    question: "Is it a good place to visit?",
    answer:
      "Yes — Elparaiso Garden is **one of Kisii's best chill spots** for a reason! 🌿\n\n" +
      "It works perfectly for:\n" +
      "• **Solo visits** — relax and enjoy a meal or drink\n" +
      "• **Dates** — relaxed, social, and romantic atmosphere\n" +
      "• **Family outings** — comfortable and welcoming\n" +
      "• **Group hangouts** — great food and social vibe\n" +
      "• **Birthday celebrations** — host your event here\n" +
      "• **Evening drinks** — full bar, open all night\n\n" +
      "Open **24/7**, so the timing is always perfect.",
    keywords: [
      "good place", "good for", "good spot", "best place",
      "should i visit", "worth visiting", "is it worth it",
      "recommend", "recommended", "popular", "famous",
      "evening drinks", "after-work drinks", "weekend plans",
      "hangout spot", "chill spot", "relax", "relaxation",
      "why should i come", "reasons to visit",
    ],
    suggestions: ["Are you open now?", "What's on the menu?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.directions],
    priority: 7,
  },

  {
    id: "visit-planning",
    intent: "visit_planning",
    question: "I want to visit tonight",
    answer:
      "Great — we'd love to have you! 🎉\n\n" +
      "Elparaiso Garden is open **24/7**, so tonight works perfectly. Here's how to get ready:\n\n" +
      "📍 We're at **County Government Street, Kisii**\n" +
      "📞 Call us on **" + PHONE_DISPLAY + "** for any questions\n" +
      "🍽️ Reserve a table to make sure your spot is ready\n\n" +
      "See you soon! 😊",
    keywords: [
      "want to visit", "i want to visit", "coming tonight", "visit tonight",
      "visiting tomorrow", "planning to come", "plan to visit",
      "i am coming", "coming this weekend", "coming soon",
      "on my way", "be there", "see you tonight",
    ],
    suggestions: ["How do I reserve?", "Where are you located?", "Do you have parking?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.directions, CHATBOT_ACTIONS.call],
    priority: 8,
  },

  // ── FALLBACK ──────────────────────────────────────────────────────────────

  {
    id: "fallback-general",
    intent: "fallback",
    question: "General fallback",
    answer:
      "I'm not sure about that one — but I can still help! 😊\n\n" +
      "Here's what I **can** answer:\n" +
      "• **Opening hours** — we're open 24/7!\n" +
      "• **Location & directions**\n" +
      "• **Reservations** & table booking\n" +
      "• **Menu & food**\n" +
      "• **Drinks & bar**\n" +
      "• **Delivery / takeaway**\n" +
      "• **Parking**\n" +
      "• **Events & music**\n" +
      "• **Contact / WhatsApp**\n\n" +
      "Or you can always reach the team directly for anything else:",
    keywords: [],
    suggestions: ["Are you open now?", "Where are you located?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.whatsapp],
    priority: 0,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// INTENT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fast, deterministic intent detection from normalised input.
 *
 * Rules:
 * - Checks run in order; first strong match wins
 * - Phrase-length keywords checked before single words to prevent false positives
 * - Returns "fallback" only when nothing matched
 */
export function detectLocalIntent(input: string): ChatIntent {
  const text = input.toLowerCase().trim();

  /** Helper: any of the provided tokens appears in text */
  const has = (...tokens: string[]) => tokens.some((t) => text.includes(t));

  // Greetings — check before generic "help" to avoid misclassifying "hello help"
  if (has("hi", "hey", "hello", "hii", "helo", "heya", "good morning", "good afternoon", "good evening", "good night", "howdy", "sup", "wassup", "yo")) {
    // "do you have" starts with nothing greeting-ish — safe to check length
    if (text.length < 20) return "greeting";
  }

  // Help / capabilities
  if (has("what can you do", "what can you help", "what can i ask", "how can you help", "capabilities", "what do you know")) return "help";

  // Brand / about
  if (has("what is elparaiso", "about elparaiso", "about the restaurant", "tell me about", "what kind of place", "is it a bar", "is it a restaurant", "restaurant or bar", "what makes it special", "why should i visit", "what is this place", "describe")) return "brand";

  // Late-night (before generic hours to be more specific)
  if (has("late night", "midnight", "after midnight", "night time", "2am", "3am", "4am", "all night", "open at night")) return "late_night";

  // Hours
  if (has("open", "hours", "closing", "close", "closed", "schedule", "24/7", "24 hours", "always open", "when do you", "are you open")) return "hours";

  // Directions (before general location to catch "how do i get there")
  if (has("directions", "direction", "how to get", "how do i get", "navigate", "navigation", "route", "google maps", "show me the way", "driving")) return "directions";

  // Location
  if (has("where", "location", "address", "find", "map", "county government", "kisii town", "pin", "send location")) return "location";

  // Walk-in (before reservation)
  if (has("walk in", "walk-in", "do i need to book", "do i need to reserve", "without booking", "without reservation", "can i just come", "drop in")) return "walk_in";

  // Reservation
  if (has("reserve", "reservation", "book", "booking", "table", "seat", "pre-book", "make a reservation", "make a booking")) return "reservation";

  // Visit planning
  if (has("want to visit", "coming tonight", "visit tonight", "visiting tomorrow", "planning to come", "plan to visit", "i am coming", "on my way")) return "visit_planning";

  // Drinks — CRITICAL: check before menu to avoid "drinks menu" falling through
  if (has("drink", "drinks", "drinking", "bar", "alcohol", "alcoholic", "beer", "beers", "wine", "wines", "cocktail", "cocktails", "spirits", "spirit", "whiskey", "whisky", "vodka", "gin", "rum", "brandy", "soft drink", "juice", "soda", "beverage", "just for drinks", "only drinks")) return "drinks";

  // Menu / food
  if (has("menu", "food", "eat", "serve", "dishes", "meal", "meals", "nyama", "choma", "grill", "grilled", "mutura", "snacks", "what do you have", "what do you serve", "something to eat")) return "menu";

  // Delivery
  if (has("delivery", "deliver", "takeaway", "take away", "takeout", "take out", "pick up", "pickup", "order food", "drive through")) return "delivery";

  // Date night (before ambience)
  if (has("date night", "date spot", "romantic", "romance", "couple", "bring my partner", "bring my girlfriend", "bring my boyfriend", "anniversary")) return "date_night";

  // Ambience
  if (has("atmosphere", "ambience", "vibe", "vibes", "environment", "garden setting", "relaxed", "chill", "what is it like")) return "ambience";

  // Parking
  if (has("parking", "park", "car park", "parking lot", "where to park", "vehicle", "parking space")) return "parking";

  // Family
  if (has("family", "kids", "children", "child", "baby", "babies", "toddler", "bring kids", "safe for kids")) return "family";

  // Celebrations (before group_booking)
  if (has("birthday celebration", "celebrate birthday", "throw a party", "farewell", "graduation", "engagement", "special occasion", "milestone")) return "celebrations";

  // Group bookings
  if (has("group", "birthday", "celebration", "party", "corporate", "team lunch", "many people", "large group", "gathering")) return "group_booking";

  // Events
  if (has("event", "events", "music", "live music", "dj", "screening", "football", "match", "show", "entertainment", "what's on", "whats happening")) return "events";

  // Payment
  if (has("payment", "pay", "cash", "mpesa", "m-pesa", "card", "visa", "mastercard", "mobile money", "nfc", "contactless")) return "payment";

  // Wi-Fi
  if (has("wifi", "wi-fi", "internet", "laptop", "study", "remote work", "work from there")) return "wifi";

  // Contact
  if (has("contact", "call", "phone", "number", "whatsapp", "reach", "customer care", "get in touch")) return "contact";

  // Use case / recommendation
  if (has("good place", "good for", "good spot", "best place", "should i visit", "worth visiting", "recommend", "popular", "evening drinks", "why should i come")) return "use_case";

  return "fallback";
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ BEST-MATCH RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds the single best matching FAQ for a given input using:
 *  1. Keyword overlap scoring (longer keywords = higher weight)
 *  2. FAQ priority as tie-breaker
 *
 * Returns the fallback FAQ if no keyword match is found.
 */
export function findBestLocalFaq(input: string): ChatFaq {
  const text = normaliseForMatching(input);
  const intent = detectLocalIntent(text);

  // ── Primary pass: candidates matching detected intent ──────────────────────
  const candidates = LOCAL_FAQS.filter((faq) => faq.intent === intent);

  if (candidates.length > 0) {
    const winner = pickBestCandidate(text, candidates);
    if (winner) return winner;
  }

  // ── Secondary pass: scan all non-fallback FAQs for keyword match ───────────
  const allCandidates = LOCAL_FAQS.filter((faq) => faq.intent !== "fallback");
  const softWinner = pickBestCandidate(text, allCandidates);
  if (softWinner) return softWinner;

  // ── Final fallback ─────────────────────────────────────────────────────────
  return LOCAL_FAQS.find((f) => f.intent === "fallback")!;
}

/**
 * Scores each candidate FAQ against the input and returns the highest scorer.
 * Returns null if no candidate scored > 0.
 */
function pickBestCandidate(text: string, candidates: ChatFaq[]): ChatFaq | null {
  const scored = candidates.map((faq) => ({
    faq,
    score: scoreFaq(text, faq),
  }));

  scored.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : b.faq.priority - a.faq.priority
  );

  const best = scored[0];
  return best && best.score > 0 ? best.faq : null;
}

/**
 * Scores a FAQ against normalised input.
 * - Exact multi-word keyword match → +3 per keyword (favours specific phrases)
 * - Single keyword match (len > 5) → +2
 * - Single keyword match (len ≤ 5) → +1
 */
function scoreFaq(text: string, faq: ChatFaq): number {
  let score = 0;

  for (const kw of faq.keywords) {
    const k = kw.toLowerCase();

    if (text.includes(k)) {
      const tokens = k.split(/\s+/).filter(Boolean);
      score += tokens.length > 1 ? 3 : k.length > 5 ? 2 : 1;
    }
  }

  return score;
}

/**
 * Normalise input for matching: lowercase, trim, collapse spaces,
 * strip non-alphanumeric punctuation (but keep spaces).
 */
export function normaliseForMatching(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
