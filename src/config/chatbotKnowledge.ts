/**
 * chatbotKnowledge.ts — Local fallback restaurant knowledge for Elparaiso Garden Kisii.
 *
 * Used when Supabase is unavailable or FAQs haven't been seeded yet.
 * This is the single source of truth for all inline bot responses and intent matching.
 */

import { ChatIntent, ChatFaq } from "@/types/chat";

// ─── Intent → keyword map ────────────────────────────────────────────────────

export const INTENT_KEYWORDS: Record<ChatIntent, string[]> = {
  hours: ["open", "hours", "closing", "time", "when", "24", "always", "late", "night", "schedule"],
  location: ["where", "location", "address", "find", "directions", "map", "how to get", "kisii", "county", "place"],
  reservation: ["reserve", "reservation", "book", "booking", "table", "seat", "party", "group"],
  menu: ["menu", "food", "eat", "dish", "choma", "mutura", "nyama", "grill", "snack", "meal", "what do you serve", "price"],
  delivery: ["delivery", "deliver", "takeaway", "take away", "order", "drive through", "drive-through", "bring"],
  parking: ["parking", "park", "car", "vehicle", "space", "lot", "secure"],
  payment: ["pay", "payment", "cash", "card", "mpesa", "nfc", "mobile money", "debit", "credit", "accepted"],
  contact: ["contact", "call", "phone", "number", "reach", "talk"],
  music: ["music", "dj", "live", "band", "vibe", "vibes", "entertainment", "dance", "party"],
  amenities: ["amenity", "amenities", "features", "facilities", "wheelchair", "accessible", "toilet", "service"],
  carwash: ["car wash", "carwash", "wash", "clean car", "vehicle clean"],
  fallback: [],
};

// ─── Local fallback FAQ data ──────────────────────────────────────────────────

export const LOCAL_FAQS: ChatFaq[] = [
  {
    id: "local-hours",
    intent: "hours",
    question: "What are your opening hours?",
    answer:
      "Elparaiso Garden Kisii is open **24 hours a day, 7 days a week** — including public holidays! Whether you want a late-night choma or an early morning coffee, we've got you covered. 🕐",
    keywords: ["open", "hours", "time", "24", "night", "closing", "schedule"],
    suggestions: ["Where are you located?", "Do you take reservations?"],
    is_active: true,
    priority: 10,
    created_at: "",
  },
  {
    id: "local-location",
    intent: "location",
    question: "Where are you located?",
    answer:
      "We're located at **County Government Street, Kisii** (Plus Code: 8QCF+4R Kisii, Kenya). We're easy to find in the heart of Kisii town. You can also get directions via Google Maps. 📍",
    keywords: ["where", "location", "address", "find", "directions", "map", "kisii"],
    suggestions: ["What time do you open?", "Is there parking available?"],
    is_active: true,
    priority: 9,
    created_at: "",
  },
  {
    id: "local-reservation",
    intent: "reservation",
    question: "How do I make a reservation?",
    answer:
      "We'd love to have you! You can make a reservation by:\n\n• Using the **Reserve a Table** form on this page\n• Calling us on **0791 224513**\n• Messaging us on **WhatsApp**\n\nWe're open 24/7 and welcome groups, families, and solo guests alike! 🍽️",
    keywords: ["reserve", "booking", "table", "book", "seat"],
    suggestions: ["What's on the menu?", "Call Now"],
    is_active: true,
    priority: 9,
    created_at: "",
  },
  {
    id: "local-menu",
    intent: "menu",
    question: "What food do you serve?",
    answer:
      "Our menu is all about **great Kenyan grills and flavour**:\n\n🔥 **The Grill** — Famous Nyama Choma & delicious Mutura (avg KES 500–1,000)\n🍹 **The Bar** — Craft cocktails, cold beer, premium spirits, wine\n🥗 **Snacks & Bites** — Light bites for any time of day\n\nPlenty of options for everyone!",
    keywords: ["menu", "food", "eat", "choma", "mutura", "nyama", "grill", "price", "dish"],
    suggestions: ["Do you do delivery?", "How do I reserve?"],
    is_active: true,
    priority: 8,
    created_at: "",
  },
  {
    id: "local-delivery",
    intent: "delivery",
    question: "Do you offer delivery or takeaway?",
    answer:
      "Yes! We offer multiple service options:\n\n🚗 **Drive-Through** — Quick pick-up at the venue\n🛍️ **Takeaway** — Order and collect\n🚚 **Delivery** — We can arrange delivery for you\n🍽️ **Dine-In** — Enjoy the full garden experience\n\nCall **0791 224513** or WhatsApp us to arrange your order!",
    keywords: ["delivery", "takeaway", "take away", "drive through", "order"],
    suggestions: ["What's on the menu?", "Contact / WhatsApp"],
    is_active: true,
    priority: 7,
    created_at: "",
  },
  {
    id: "local-parking",
    intent: "parking",
    question: "Is there parking available?",
    answer:
      "Yes! We have **free, ample, and secure parking** on site. We can accommodate many vehicles comfortably. You can also take advantage of our unique **Car Wash & Dine** experience — get your car cleaned while you enjoy a meal! 🚗✨",
    keywords: ["parking", "park", "car", "vehicle", "space"],
    suggestions: ["Where are you located?", "What's the car wash experience?"],
    is_active: true,
    priority: 7,
    created_at: "",
  },
  {
    id: "local-payment",
    intent: "payment",
    question: "What payment methods do you accept?",
    answer:
      "We accept a wide range of payment methods:\n\n💳 **Debit & Credit Cards**\n📱 **NFC Contactless Payments**\n📲 **M-Pesa / Mobile Money**\n💵 **Cash**\n\nNo need to worry about having the right method — we've got you covered!",
    keywords: ["pay", "payment", "cash", "card", "mpesa", "nfc", "mobile money"],
    suggestions: ["How do I make a reservation?", "Where are you located?"],
    is_active: true,
    priority: 6,
    created_at: "",
  },
  {
    id: "local-contact",
    intent: "contact",
    question: "How do I contact you?",
    answer:
      "You can reach us through:\n\n📞 **Phone:** 0791 224513\n💬 **WhatsApp:** +254 791 224513\n📍 **Visit:** County Government Street, Kisii\n\nOur team is available 24/7 to assist you!",
    keywords: ["contact", "call", "phone", "number", "whatsapp", "reach"],
    suggestions: ["Where are you located?", "How do I reserve?"],
    is_active: true,
    priority: 8,
    created_at: "",
  },
  {
    id: "local-music",
    intent: "music",
    question: "Do you have live music or entertainment?",
    answer:
      "Absolutely! Elparaiso Garden is famous for its **great vibes and entertainment**:\n\n🎵 **Live Music & DJ sets**\n🌿 **Garden atmosphere** perfect for chilling\n🎊 **Weekend parties and events**\n\nThe vibe here is unmatched in Kisii — come experience it yourself! 🔥",
    keywords: ["music", "dj", "live", "band", "vibe", "entertainment", "dance"],
    suggestions: ["What's on the menu?", "How do I reserve?"],
    is_active: true,
    priority: 6,
    created_at: "",
  },
  {
    id: "local-amenities",
    intent: "amenities",
    question: "What amenities do you offer?",
    answer:
      "Elparaiso Garden has everything you need:\n\n♿ **Wheelchair-accessible toilet**\n🚗 **Free, ample & secure parking**\n💳 **NFC & card payments**\n📅 **Table service & reservations accepted**\n🎵 **Live music & DJ vibes**\n🚿 **On-site car wash**\n🕐 **Open 24/7**",
    keywords: ["amenity", "amenities", "features", "facilities", "wheelchair"],
    suggestions: ["Is there parking?", "What are your hours?"],
    is_active: true,
    priority: 5,
    created_at: "",
  },
  {
    id: "local-carwash",
    intent: "carwash",
    question: "Tell me about the car wash experience.",
    answer:
      "Our **Car Wash & Dine** experience is one of a kind in Kisii! 🚗✨\n\nDrop off your car for a thorough wash, then sit back and enjoy:\n• Famous **Nyama Choma** or light snacks\n• Ice-cold drinks from the bar\n• Great garden atmosphere\n\nBy the time you've finished eating, your car will be gleaming! Plenty of free secure parking too.",
    keywords: ["car wash", "carwash", "wash", "clean car"],
    suggestions: ["Is there parking?", "What's on the menu?"],
    is_active: true,
    priority: 6,
    created_at: "",
  },
];

// ─── Quick action chip definitions ──────────────────────────────────────────

export const QUICK_ACTIONS = [
  { label: "Are you open now?", intent: "hours" as ChatIntent },
  { label: "Where are you located?", intent: "location" as ChatIntent },
  { label: "How do I reserve?", intent: "reservation" as ChatIntent },
  { label: "What's on the menu?", intent: "menu" as ChatIntent },
  { label: "Do you offer delivery?", intent: "delivery" as ChatIntent },
  { label: "Contact / WhatsApp", intent: "contact" as ChatIntent },
];

// ─── Welcome message ──────────────────────────────────────────────────────────

export const WELCOME_MESSAGE =
  "Hi 👋 Welcome to Elparaiso Garden Kisii. I can help with reservations, directions, opening hours, menu highlights, amenities, and contact info. What would you like to know?";

// ─── Fallback message ─────────────────────────────────────────────────────────

export const FALLBACK_MESSAGE =
  "I'm not fully sure about that yet. Please call **0791 224513** or message us on WhatsApp so our team can confirm for you.";
