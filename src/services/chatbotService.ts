/**
 * src/services/chatbotService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * UI-facing orchestration layer for the Elparaiso Garden Kisii chatbot.
 *
 * FINAL FIXED VERSION
 * - Uses chatbotKnowledge.ts as the single source of truth
 * - Stronger layered matching
 * - Better short-query handling ("drinks", "menu", "parking", etc.)
 * - Handles greetings / help / thanks / yes-no naturally
 * - Safer fallback logic
 * - 100% frontend-only (no API calls)
 */

import type { ChatMessage, ChatAction } from "@/types/chat";
import {
  LOCAL_FAQS,
  QUICK_ACTIONS,
  CHATBOT_ACTIONS,
  findBestLocalFaq,
  normaliseForMatching,
  type ChatFaq,
  type ChatIntent,
} from "@/config/chatbotKnowledge";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC RESPONSE TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatbotResponse {
  content: string;
  actions?: ChatAction[];
  suggestions?: string[];
  intent?: ChatIntent;
}

// ─────────────────────────────────────────────────────────────────────────────
// WELCOME MESSAGE
// ─────────────────────────────────────────────────────────────────────────────

export function getWelcomeMessage(): ChatbotResponse {
  return {
    content:
      "Hi 👋 Welcome to **Elparaiso Garden Kisii**.\n\n" +
      "I can help with:\n" +
      "• Opening hours & availability\n" +
      "• Location & directions\n" +
      "• Reservations & table booking\n" +
      "• Menu & food highlights\n" +
      "• Drinks & bar\n" +
      "• Delivery & takeaway\n" +
      "• Contact & WhatsApp\n\n" +
      "What would you like to know? 😊",
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    suggestions: QUICK_ACTIONS.map((a) => a.label),
    intent: "greeting",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

export async function sendChatMessage(
  input: string,
  _history: ChatMessage[] = []
): Promise<ChatbotResponse> {
  const normalised = normaliseForMatching(input);

  if (!normalised) {
    return buildEmptyInputResponse();
  }

  await simulateTypingDelay(normalised);

  return getAssistantReply(normalised, _history);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE REPLY LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function getAssistantReply(
  normalised: string,
  _history: ChatMessage[] = []
): ChatbotResponse {
  // 0) Very common conversational cases first
  const conversational = handleConversationalCases(normalised);
  if (conversational) return conversational;

  // 1) Primary best-match via chatbotKnowledge.ts
  const primaryFaq = findBestLocalFaq(normalised);

  if (primaryFaq.intent !== "fallback") {
    return formatFaqResponse(primaryFaq);
  }

  // 2) Secondary strong global scan (all FAQs, weighted)
  const secondaryFaq = findBestFaqGlobally(normalised);
  if (secondaryFaq && secondaryFaq.intent !== "fallback") {
    return formatFaqResponse(secondaryFaq);
  }

  // 3) Extra short-query rescue layer
  const rescueFaq = findBestShortQueryRescue(normalised);
  if (rescueFaq) {
    return formatFaqResponse(rescueFaq);
  }

  // 4) Strong fallback
  return formatFaqResponse(getFallbackFaq());
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATIONAL HANDLING
// ─────────────────────────────────────────────────────────────────────────────

function handleConversationalCases(normalised: string): ChatbotResponse | null {
  // Greeting
  if (isExactOrNear(normalised, [
    "hi",
    "hello",
    "hey",
    "yo",
    "good morning",
    "good afternoon",
    "good evening",
  ])) {
    const greetingFaq = findFaqByIntent("greeting");
    return greetingFaq ? formatFaqResponse(greetingFaq) : getWelcomeMessage();
  }

  // Help
  if (
    isExactOrNear(normalised, ["help", "what can you do", "what do you do"]) ||
    normalised.includes("can you help")
  ) {
    const helpFaq = findFaqByIntent("help");
    if (helpFaq) return formatFaqResponse(helpFaq);

    return {
      content:
        "I can help with reservations, hours, location, menu, drinks, delivery, parking and more 😊",
      actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
      suggestions: QUICK_ACTIONS.map((a) => a.label),
      intent: "help",
    };
  }

  // Brand / who are you
  if (
    normalised.includes("who are you") ||
    normalised.includes("what is elparaiso") ||
    normalised.includes("tell me about elparaiso") ||
    normalised === "elparaiso" ||
    normalised === "elparaiso garden"
  ) {
    const brandFaq = findFaqByIntent("brand");
    if (brandFaq) return formatFaqResponse(brandFaq);
  }

  // Thanks
  if (
    isExactOrNear(normalised, [
      "thanks",
      "thank you",
      "thankyou",
      "thx",
      "nice",
      "great",
      "awesome",
    ])
  ) {
    return {
      content:
        "You’re welcome 😊\n\nIf you'd like, I can also help with reservations, directions, menu options, or opening hours.",
      actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
      suggestions: ["How do I reserve?", "Where are you located?", "Are you open now?"],
      intent: "help",
    };
  }

  // Simple yes/no after a previous assistant response — safe generic handling
  if (normalised === "yes" || normalised === "yeah" || normalised === "yep") {
    return {
      content:
        "Great 😊 What would you like help with next?\n\nI can assist with reservations, directions, menu, drinks, or opening hours.",
      actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
      suggestions: QUICK_ACTIONS.map((a) => a.label),
      intent: "help",
    };
  }

  if (normalised === "no" || normalised === "nope" || normalised === "not really") {
    return {
      content:
        "No problem 😊 If you need anything later, you can ask me about reservations, location, menu, drinks, or opening hours.",
      actions: [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.whatsapp],
      suggestions: QUICK_ACTIONS.map((a) => a.label),
      intent: "help",
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECONDARY GLOBAL SCAN
// ─────────────────────────────────────────────────────────────────────────────

function findBestFaqGlobally(text: string): ChatFaq | null {
  const candidates = LOCAL_FAQS.filter((f) => f.intent !== "fallback");

  let bestFaq: ChatFaq | null = null;
  let bestScore = 0;

  for (const faq of candidates) {
    let score = 0;

    // Keyword scoring
    score += scoreKeywordOverlap(text, faq.keywords);

    // Intent priority slight bias
    score += faq.priority * 0.12;

    // Exact phrase bonus
    for (const kw of faq.keywords) {
      const k = kw.toLowerCase().trim();
      if (!k) continue;

      if (text === k) {
        score += 6;
      } else if (text.startsWith(k) || text.endsWith(k)) {
        score += 2;
      }
    }

    // Short query boost
    if (text.length <= 20 && faq.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestFaq = faq;
    }
  }

  // Slight threshold to avoid random weak matches
  return bestScore >= 1.5 ? bestFaq : null;
}

function scoreKeywordOverlap(text: string, keywords: string[]): number {
  let score = 0;

  for (const kw of keywords) {
    const k = kw.toLowerCase().trim();
    if (!k) continue;

    if (text.includes(k)) {
      const tokens = k.split(/\s+/).filter(Boolean);

      // Exact full query = strongest
      if (text === k) {
        score += 6;
        continue;
      }

      // Multi-word phrases should dominate
      if (tokens.length >= 3) {
        score += 5;
      } else if (tokens.length === 2) {
        score += 4;
      } else {
        // Single word weighting
        if (k.length >= 8) score += 3;
        else if (k.length >= 5) score += 2;
        else score += 1.25;
      }
    }
  }

  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHORT QUERY RESCUE
// ─────────────────────────────────────────────────────────────────────────────

function findBestShortQueryRescue(text: string): ChatFaq | null {
  const q = text.trim();

  const intentMap: Array<{ match: string[]; intent: ChatIntent }> = [
    { match: ["hours", "open", "opening", "time", "close"], intent: "hours" },
    { match: ["late night", "open late", "24/7", "24 7"], intent: "late_night" },
    { match: ["location", "where", "address", "place"], intent: "location" },
    { match: ["direction", "directions", "map"], intent: "directions" },
    { match: ["reserve", "reservation", "book", "booking", "table"], intent: "reservation" },
    { match: ["walk in", "walkin"], intent: "walk_in" },
    { match: ["menu", "food", "eat"], intent: "menu" },
    { match: ["drink", "drinks", "bar", "cocktail", "beer"], intent: "drinks" },
    { match: ["contact", "phone", "call", "whatsapp"], intent: "contact" },
    { match: ["delivery", "takeaway", "take out", "pickup"], intent: "delivery" },
    { match: ["parking", "car"], intent: "parking" },
    { match: ["ambience", "atmosphere", "vibe"], intent: "ambience" },
    { match: ["date", "romantic"], intent: "date_night" },
    { match: ["family", "kids", "children"], intent: "family" },
    { match: ["group", "groups"], intent: "group_booking" },
    { match: ["birthday", "celebration", "party"], intent: "celebrations" },
    { match: ["event", "events", "live music"], intent: "events" },
    { match: ["payment", "mpesa", "cash", "card"], intent: "payment" },
    { match: ["wifi", "internet"], intent: "wifi" },
  ];

  for (const entry of intentMap) {
    if (entry.match.some((m) => q === m || q.includes(m))) {
      const faq = findFaqByIntent(entry.intent);
      if (faq) return faq;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE FORMATTER
// ─────────────────────────────────────────────────────────────────────────────

function formatFaqResponse(faq: ChatFaq): ChatbotResponse {
  return {
    content: faq.answer,
    actions: faq.actions ?? defaultActionsFor(faq.intent),
    suggestions: faq.suggestions ?? defaultSuggestionsFor(faq.intent),
    intent: faq.intent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

function defaultActionsFor(intent: ChatIntent): ChatAction[] {
  switch (intent) {
    case "greeting":
    case "help":
    case "brand":
      return [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call];

    case "hours":
    case "late_night":
      return [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call];

    case "location":
    case "directions":
      return [CHATBOT_ACTIONS.directions, CHATBOT_ACTIONS.call];

    case "reservation":
    case "walk_in":
    case "visit_planning":
      return [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call];

    case "menu":
      return [CHATBOT_ACTIONS.menu, CHATBOT_ACTIONS.reserve];

    case "drinks":
      return [CHATBOT_ACTIONS.menu, CHATBOT_ACTIONS.call];

    case "contact":
      return [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.whatsapp];

    case "delivery":
      return [CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call];

    case "group_booking":
    case "celebrations":
      return [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call];

    case "events":
      return [CHATBOT_ACTIONS.whatsapp, CHATBOT_ACTIONS.call];

    case "payment":
    case "wifi":
    case "parking":
      return [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.whatsapp];

    case "ambience":
    case "date_night":
    case "family":
    case "use_case":
      return [CHATBOT_ACTIONS.reserve];

    case "fallback":
    default:
      return [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.whatsapp];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT SUGGESTIONS
// ─────────────────────────────────────────────────────────────────────────────

function defaultSuggestionsFor(intent: ChatIntent): string[] {
  const defaults: Partial<Record<ChatIntent, string[]>> = {
    greeting: ["Are you open now?", "Where are you located?", "How do I reserve?"],
    help: ["Are you open now?", "How do I reserve?", "What's on the menu?"],
    brand: ["What's on the menu?", "Are you open now?", "How do I reserve?"],

    hours: ["Where are you located?", "How do I reserve?"],
    late_night: ["What's on the menu?", "Do you serve drinks?"],

    location: ["Is there parking?", "How can I contact you?"],
    directions: ["Is there parking?", "Are you open now?"],

    reservation: ["Do you host group bookings?", "What's on the menu?"],
    walk_in: ["How do I reserve?", "Are you open now?"],

    menu: ["Do you serve drinks?", "Do you do delivery?"],
    drinks: ["What's on the menu?", "How do I reserve?"],

    contact: ["Where are you located?", "How do I reserve?"],
    delivery: ["How can I contact you?", "What's on the menu?"],
    parking: ["Where are you located?", "How do I reserve?"],

    ambience: ["Do you host group bookings?", "What's on the menu?"],
    date_night: ["How do I reserve?", "What's on the menu?"],
    family: ["How do I reserve?", "What's the atmosphere like?"],

    group_booking: ["How do I reserve?", "How can I contact you?"],
    celebrations: ["How do I reserve?", "How can I contact you?"],
    events: ["How can I contact you?", "How do I reserve?"],
    payment: ["How can I contact you?", "How do I reserve?"],
    wifi: ["How can I contact you?", "What are your opening hours?"],
    use_case: ["Are you open now?", "How do I reserve?"],
    visit_planning: ["How do I reserve?", "Where are you located?"],

    fallback: ["Are you open now?", "Where are you located?", "How do I reserve?"],
  };

  return defaults[intent] ?? ["Are you open now?", "How do I reserve?"];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function findFaqByIntent(intent: ChatIntent): ChatFaq | null {
  return LOCAL_FAQS.find((faq) => faq.intent === intent) ?? null;
}

function getFallbackFaq(): ChatFaq {
  return LOCAL_FAQS.find((faq) => faq.intent === "fallback") ?? LOCAL_FAQS[0];
}

function isExactOrNear(input: string, values: string[]): boolean {
  return values.some((v) => input === v || input.startsWith(v) || input.includes(v));
}

function buildEmptyInputResponse(): ChatbotResponse {
  return {
    content:
      "I didn't quite catch that — feel free to ask anything! 😊\n\n" +
      "Try:\n" +
      "• *Are you open now?*\n" +
      "• *Where are you located?*\n" +
      "• *How do I reserve a table?*\n" +
      "• *What's on the menu?*",
    actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    suggestions: QUICK_ACTIONS.map((a) => a.label),
    intent: "fallback",
  };
}

function simulateTypingDelay(text: string): Promise<void> {
  const base = 450;
  const extra = Math.min(text.length * 4, 500);
  const total = base + extra;
  return new Promise((resolve) => setTimeout(resolve, total));
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export function getQuickActionLabels(): string[] {
  return QUICK_ACTIONS.map((a) => a.label);
}
