```ts
/**
 * chatbotKnowledge.ts
 * ------------------------------------------------------------
 * Local knowledge base for Elparaiso Garden Kisii chatbot.
 *
 * PURPOSE:
 * - Makes the chatbot fully functional WITHOUT Supabase/backend
 * - Powers quick actions + FAQ responses + CTA buttons
 * - Can be used as the primary local knowledge source
 *
 * NOTES:
 * - This file assumes your chatbot service imports:
 *    - QUICK_ACTIONS
 *    - LOCAL_FAQS
 * - If your current types differ slightly, only adjust field names.
 */

import type { ChatAction } from "@/types/chat";

// -----------------------------------------------------------------------------
// QUICK ACTIONS (used by QuickActions.tsx)
// -----------------------------------------------------------------------------

export const QUICK_ACTIONS = [
  { label: "Are you open now?" },
  { label: "Where are you located?" },
  { label: "How do I reserve?" },
  { label: "What’s on the menu?" },
  { label: "Do you do delivery?" },
  { label: "How can I contact you?" },
];

// -----------------------------------------------------------------------------
// CTA ACTIONS (reusable buttons shown below assistant messages)
// -----------------------------------------------------------------------------

const PHONE_NUMBER_DISPLAY = "0791 224513";
const PHONE_NUMBER_INTL = "+254791224513";
const PHONE_NUMBER_TEL = "tel:+254791224513";
const WHATSAPP_LINK = `https://wa.me/254791224513`;
const GOOGLE_MAPS_LINK =
  "https://www.google.com/maps/search/?api=1&query=Elparaiso+Garden+Kisii";
const RESERVE_SCROLL_ID = "reservation";
const MENU_SCROLL_ID = "menu";

export const CHATBOT_ACTIONS = {
  call: {
    label: "Call Now",
    href: PHONE_NUMBER_TEL,
    variant: "primary" as const,
  },
  whatsapp: {
    label: "WhatsApp",
    href: WHATSAPP_LINK,
    variant: "secondary" as const,
  },
  directions: {
    label: "Get Directions",
    href: GOOGLE_MAPS_LINK,
    variant: "secondary" as const,
  },
  reserve: {
    label: "Reserve a Table",
    scrollTo: RESERVE_SCROLL_ID,
    variant: "primary" as const,
  },
  menu: {
    label: "View Menu",
    scrollTo: MENU_SCROLL_ID,
    variant: "secondary" as const,
  },
};

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------
// If your app already defines ChatFaq elsewhere, you can replace this local type
// with: import type { ChatFaq } from "@/types/chat";

export type ChatIntent =
  | "hours"
  | "location"
  | "reservation"
  | "menu"
  | "contact"
  | "delivery"
  | "parking"
  | "ambience"
  | "group_booking"
  | "payment"
  | "family"
  | "drinks"
  | "events"
  | "wifi"
  | "fallback";

export interface ChatFaq {
  id: string;
  intent: ChatIntent;
  question: string;
  answer: string;
  keywords: string[];
  suggestions?: string[];
  actions?: ChatAction[];
  priority: number;
}

// -----------------------------------------------------------------------------
// LOCAL FAQ KNOWLEDGE BASE
// -----------------------------------------------------------------------------
// The chatbot service can use:
// - intent detection
// - keyword overlap
// - priority
//
// Add as many as you want over time.

export const LOCAL_FAQS: ChatFaq[] = [
  {
    id: "hours-24-7",
    intent: "hours",
    question: "What are your opening hours?",
    answer:
      "Elparaiso Garden Kisii is open **24 hours a day, 7 days a week** — including weekends and public holidays. Whether you're planning breakfast, lunch, dinner, or a late-night visit, we're here for you. 🕐",
    keywords: [
      "open",
      "opening",
      "hours",
      "time",
      "closing",
      "close",
      "schedule",
      "today",
      "now",
      "late",
      "night",
      "24",
      "24/7",
      "weekend",
    ],
    suggestions: ["Where are you located?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    priority: 10,
  },

  {
    id: "location-kisii",
    intent: "location",
    question: "Where are you located?",
    answer:
      "We’re located at **County Government Street, Kisii, Kenya** — right in the heart of town and easy to access. 📍 If you'd like, I can help you get directions instantly.",
    keywords: [
      "where",
      "location",
      "located",
      "address",
      "find",
      "map",
      "direction",
      "directions",
      "kisii",
      "county government street",
      "place",
    ],
    suggestions: ["Do you have parking?", "How can I contact you?"],
    actions: [CHATBOT_ACTIONS.directions, CHATBOT_ACTIONS.call],
    priority: 10,
  },

  {
    id: "reservation-booking",
    intent: "reservation",
    question: "How do I make a reservation?",
    answer:
      "You can reserve a table in any of these easy ways:\n\n• Use the **Reserve a Table** section on this page\n• Call us directly on **0791 224513**\n• Message us on **WhatsApp**\n\nWe welcome couples, families, friends, and group bookings. 🍽️",
    keywords: [
      "reserve",
      "reservation",
      "book",
      "booking",
      "table",
      "seat",
      "book a table",
      "make a reservation",
      "preorder",
    ],
    suggestions: ["Do you host group bookings?", "What’s on the menu?"],
    actions: [
      CHATBOT_ACTIONS.reserve,
      CHATBOT_ACTIONS.whatsapp,
      CHATBOT_ACTIONS.call,
    ],
    priority: 10,
  },

  {
    id: "menu-food",
    intent: "menu",
    question: "What food do you serve?",
    answer:
      "Our menu focuses on **great food, grills, and a relaxing garden experience**.\n\n🔥 **Grill favourites** — including delicious nyama choma-style options\n🍹 **Bar & drinks** — cocktails, beer, spirits, wine, and soft drinks\n🍽️ **Meals & bites** — perfect for casual dining, dates, and groups\n\nIf you want, you can also view the menu section on the page.",
    keywords: [
      "menu",
      "food",
      "eat",
      "serve",
      "dishes",
      "meal",
      "nyama",
      "choma",
      "grill",
      "restaurant",
      "what do you have",
      "what do you serve",
      "snacks",
    ],
    suggestions: ["Do you serve drinks?", "Do you do delivery?"],
    actions: [CHATBOT_ACTIONS.menu, CHATBOT_ACTIONS.reserve],
    priority: 9,
  },

  {
    id: "contact-phone-whatsapp",
    intent: "contact",
    question: "How can I contact you?",
    answer:
      `You can reach Elparaiso Garden anytime:\n\n` +
      `📞 **Phone:** ${PHONE_NUMBER_DISPLAY}\n` +
      `💬 **WhatsApp:** ${PHONE_NUMBER_INTL}\n` +
      `📍 **Visit us:** County Government Street, Kisii\n\n` +
      `We're happy to help with reservations, directions, and inquiries.`,
    keywords: [
      "contact",
      "call",
      "phone",
      "number",
      "telephone",
      "whatsapp",
      "reach",
      "talk",
      "customer care",
    ],
    suggestions: ["Where are you located?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.whatsapp],
    priority: 9,
  },

  {
    id: "delivery-takeaway",
    intent: "delivery",
    question: "Do you do delivery or takeaway?",
    answer:
      "For **delivery or takeaway availability**, the fastest way is to contact us directly so the team can confirm what’s available right now.\n\n• Call us for immediate help\n• WhatsApp us for quick coordination\n\nThis is the best way to confirm current service options. 🚗",
    keywords: [
      "delivery",
      "deliver",
      "takeaway",
      "take away",
      "pickup",
      "pick up",
      "order",
      "carry out",
      "pack",
      "parcel",
    ],
    suggestions: ["How can I contact you?", "What’s on the menu?"],
    actions: [CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call],
    priority: 8,
  },

  {
    id: "parking-availability",
    intent: "parking",
    question: "Is there parking available?",
    answer:
      "Yes — **parking support is available nearby / around the venue**, but if you're planning a busy-time visit or group event, it's best to call ahead so the team can guide you on the most convenient parking option. 🚗",
    keywords: [
      "parking",
      "park",
      "car",
      "vehicle",
      "space",
      "parking available",
      "is there parking",
    ],
    suggestions: ["Where are you located?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.directions],
    priority: 7,
  },

  {
    id: "ambience-garden-vibes",
    intent: "ambience",
    question: "What is the atmosphere like?",
    answer:
      "Elparaiso Garden offers a **relaxed garden-style atmosphere** — great for casual meals, catch-ups, dates, family time, and evening hangouts. 🌿\n\nThink: comfortable seating, a social vibe, good food, and a welcoming setting.",
    keywords: [
      "ambience",
      "atmosphere",
      "vibe",
      "environment",
      "garden",
      "nice place",
      "romantic",
      "date",
      "hangout",
      "experience",
    ],
    suggestions: ["Do you host group bookings?", "What’s on the menu?"],
    actions: [CHATBOT_ACTIONS.reserve],
    priority: 7,
  },

  {
    id: "group-bookings-events",
    intent: "group_booking",
    question: "Can you host groups or celebrations?",
    answer:
      "Absolutely — Elparaiso Garden is a great spot for **group dining, birthdays, meetups, and celebrations**. 🎉\n\nFor larger groups, we strongly recommend reserving in advance so the team can prepare the best seating arrangement for you.",
    keywords: [
      "group",
      "groups",
      "birthday",
      "celebration",
      "party",
      "event",
      "meeting",
      "corporate",
      "many people",
      "large booking",
      "family gathering",
    ],
    suggestions: ["How do I reserve?", "How can I contact you?"],
    actions: [
      CHATBOT_ACTIONS.reserve,
      CHATBOT_ACTIONS.whatsapp,
      CHATBOT_ACTIONS.call,
    ],
    priority: 8,
  },

  {
    id: "payment-options",
    intent: "payment",
    question: "What payment methods do you accept?",
    answer:
      "For the most accurate **current payment options**, please confirm directly with the team. In most restaurant settings, guests commonly use cash and mobile payment options, but the quickest way to verify what's available right now is to call or WhatsApp us. 💳",
    keywords: [
      "payment",
      "pay",
      "cash",
      "mpesa",
      "m-pesa",
      "card",
      "visa",
      "mastercard",
      "how do i pay",
    ],
    suggestions: ["How can I contact you?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call],
    priority: 6,
  },

  {
    id: "family-friendly",
    intent: "family",
    question: "Is it family-friendly?",
    answer:
      "Yes — Elparaiso Garden is suitable for **families, couples, friends, and casual group visits**. 👨‍👩‍👧‍👦\n\nIf you're planning a family outing or need help with seating, reserving ahead is always a good idea.",
    keywords: [
      "family",
      "kids",
      "children",
      "child",
      "baby",
      "family friendly",
      "safe for family",
    ],
    suggestions: ["How do I reserve?", "What’s the atmosphere like?"],
    actions: [CHATBOT_ACTIONS.reserve],
    priority: 6,
  },

  {
    id: "drinks-bar",
    intent: "drinks",
    question: "Do you serve drinks or alcohol?",
    answer:
      "Yes — Elparaiso Garden offers a **bar experience with drinks and refreshments**, including options for social hangouts and relaxed evenings. 🍹\n\nIf you'd like to know what's currently available, feel free to contact the team directly.",
    keywords: [
      "drinks",
      "bar",
      "alcohol",
      "beer",
      "wine",
      "cocktail",
      "spirits",
      "juice",
      "soda",
      "soft drinks",
    ],
    suggestions: ["What’s on the menu?", "How can I contact you?"],
    actions: [CHATBOT_ACTIONS.menu, CHATBOT_ACTIONS.call],
    priority: 7,
  },

  {
    id: "events-screening-music",
    intent: "events",
    question: "Do you host events, music, or screenings?",
    answer:
      "Special experiences like **live entertainment, event nights, screenings, or themed gatherings** may vary depending on the day or season. 🎶\n\nThe fastest way to confirm current happenings is to contact the team directly.",
    keywords: [
      "event",
      "events",
      "music",
      "live music",
      "dj",
      "screening",
      "football",
      "match",
      "show",
      "weekend plan",
    ],
    suggestions: ["How can I contact you?", "How do I reserve?"],
    actions: [CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call],
    priority: 5,
  },

  {
    id: "wifi-workspace",
    intent: "wifi",
    question: "Do you have Wi-Fi?",
    answer:
      "If you need **Wi-Fi or a work-friendly setup**, it's best to confirm with the team before visiting so they can advise you based on current availability and seating. 📶",
    keywords: [
      "wifi",
      "wi-fi",
      "internet",
      "network",
      "work from there",
      "laptop",
      "study",
    ],
    suggestions: ["How can I contact you?", "What are your opening hours?"],
    actions: [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.whatsapp],
    priority: 4,
  },

  {
    id: "fallback-general",
    intent: "fallback",
    question: "General fallback",
    answer:
      "I can help with:\n\n• **Opening hours**\n• **Location & directions**\n• **Reservations**\n• **Menu & food**\n• **Contact details**\n• **Delivery / takeaway**\n• **Parking & group visits**\n\nTry asking something like:\n• *Are you open now?*\n• *Where are you located?*\n• *How do I reserve a table?*",
    keywords: [
      "help",
      "hi",
      "hello",
      "hey",
      "good morning",
      "good evening",
      "info",
      "information",
    ],
    suggestions: ["Are you open now?", "Where are you located?"],
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    priority: 1,
  },
];

// -----------------------------------------------------------------------------
// OPTIONAL HELPERS (useful if you want your chatbotService.ts to import them)
// -----------------------------------------------------------------------------

/**
 * Very lightweight keyword-based intent detector.
 * If your current chatbotService.ts already has detectIntent(), you can ignore this.
 */
export function detectLocalIntent(input: string): ChatIntent {
  const text = input.toLowerCase().trim();

  const checks: Array<{ intent: ChatIntent; words: string[] }> = [
    {
      intent: "hours",
      words: ["open", "hours", "closing", "close", "time", "today", "late", "night"],
    },
    {
      intent: "location",
      words: ["where", "location", "address", "map", "direction", "find", "kisii"],
    },
    {
      intent: "reservation",
      words: ["reserve", "reservation", "book", "booking", "table", "seat"],
    },
    {
      intent: "menu",
      words: ["menu", "food", "eat", "meal", "serve", "nyama", "choma", "grill"],
    },
    {
      intent: "contact",
      words: ["contact", "call", "phone", "number", "whatsapp", "reach"],
    },
    {
      intent: "delivery",
      words: ["delivery", "takeaway", "pickup", "pick up", "order", "parcel"],
    },
    {
      intent: "parking",
      words: ["parking", "park", "car", "vehicle"],
    },
    {
      intent: "ambience",
      words: ["ambience", "atmosphere", "vibe", "romantic", "date", "hangout"],
    },
    {
      intent: "group_booking",
      words: ["group", "birthday", "celebration", "party", "event", "corporate"],
    },
    {
      intent: "payment",
      words: ["payment", "pay", "cash", "mpesa", "m-pesa", "card"],
    },
    {
      intent: "family",
      words: ["family", "kids", "children", "baby"],
    },
    {
      intent: "drinks",
      words: ["drink", "drinks", "bar", "beer", "wine", "cocktail", "alcohol"],
    },
    {
      intent: "events",
      words: ["music", "live music", "screening", "football", "match", "show"],
    },
    {
      intent: "wifi",
      words: ["wifi", "wi-fi", "internet", "laptop", "study"],
    },
  ];

  for (const group of checks) {
    if (group.words.some((word) => text.includes(word))) {
      return group.intent;
    }
  }

  return "fallback";
}

/**
 * Finds the best local FAQ by:
 * 1. detecting intent
 * 2. scoring keyword overlap
 * 3. falling back gracefully
 *
 * If your chatbotService.ts already has findBestFaq(), you can ignore this helper.
 */
export function findBestLocalFaq(input: string): ChatFaq {
  const text = input.toLowerCase().trim();
  const intent = detectLocalIntent(text);

  const candidates = LOCAL_FAQS.filter((faq) => faq.intent === intent);

  if (candidates.length === 0) {
    return LOCAL_FAQS.find((f) => f.intent === "fallback")!;
  }

  const scored = candidates.map((faq) => {
    const score = faq.keywords.reduce((acc, keyword) => {
      return text.includes(keyword.toLowerCase()) ? acc + 1 : acc;
    }, 0);

    return { faq, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.faq.priority - a.faq.priority;
  });

  const best = scored[0];

  if (best.score === 0) {
    return LOCAL_FAQS.find((f) => f.intent === "fallback")!;
  }

  return best.faq;
}
```
