```ts id="m8qk5y"
/**
 * chatbotService.ts
 * ------------------------------------------------------------------
 * Local-first chatbot service for Elparaiso Garden Kisii
 *
 * PURPOSE:
 * - Fully functional WITHOUT Supabase / backend
 * - Uses chatbotKnowledge.ts as the single source of truth
 * - Supports:
 *    - intent detection
 *    - FAQ matching
 *    - smart fallback
 *    - CTA actions
 *    - typing-compatible assistant response shape
 *
 * FUTURE:
 * - Later, you can replace getAssistantReply() with a backend/API call
 *   without changing the UI components.
 */

import type { ChatMessage, ChatAction } from "@/types/chat";
import {
  LOCAL_FAQS,
  QUICK_ACTIONS,
  detectLocalIntent,
  findBestLocalFaq,
  type ChatFaq,
  type ChatIntent,
} from "@/config/chatbotKnowledge";

// -----------------------------------------------------------------------------
// RESPONSE TYPE
// -----------------------------------------------------------------------------
// This is the object your ChatPanel.tsx expects from sendChatMessage().

export interface ChatbotResponse {
  content: string;
  actions?: ChatAction[];
  suggestions?: string[];
  intent?: ChatIntent;
}

// -----------------------------------------------------------------------------
// WELCOME MESSAGE
// -----------------------------------------------------------------------------
// Optional helper you can use inside ChatPanel if needed.

export function getWelcomeMessage(): ChatbotResponse {
  const fallback = LOCAL_FAQS.find((f) => f.intent === "fallback");

  return {
    content:
      "Hi 👋 Welcome to **Elparaiso Garden Kisii**.\n\n" +
      "I can help with:\n" +
      "• Opening hours\n" +
      "• Location & directions\n" +
      "• Reservations\n" +
      "• Menu & food\n" +
      "• Contact details\n" +
      "• Delivery / takeaway\n\n" +
      "Try asking me anything 😊",
    actions: fallback?.actions ?? [],
    suggestions: QUICK_ACTIONS.map((a) => a.label),
    intent: "fallback",
  };
}

// -----------------------------------------------------------------------------
// MAIN ENTRY POINT
// -----------------------------------------------------------------------------
// This is what ChatPanel.tsx should call.
//
// Example:
// const response = await sendChatMessage(trimmed, historyForRequest);

export async function sendChatMessage(
  input: string,
  _history: ChatMessage[] = []
): Promise<ChatbotResponse> {
  const normalized = normalizeInput(input);

  // Safety fallback for empty input
  if (!normalized) {
    const fallback = getFallbackFaq();
    return formatFaqResponse(fallback, "fallback");
  }

  // Simulate a tiny natural delay so the typing indicator feels realistic
  await delay(500);

  // Get best local response
  const reply = getAssistantReply(normalized);

  return reply;
}

// -----------------------------------------------------------------------------
// CORE REPLY LOGIC
// -----------------------------------------------------------------------------

function getAssistantReply(input: string): ChatbotResponse {
  const intent = detectIntent(input);

  // First try best FAQ using smart scoring
  const faq = findBestFaq(input, intent);

  if (faq) {
    return formatFaqResponse(faq, intent);
  }

  // If no direct FAQ match, try soft fallback by scanning all FAQs
  const softMatch = findSoftBestFaq(input);

  if (softMatch) {
    return formatFaqResponse(softMatch, softMatch.intent);
  }

  // Final fallback
  return formatFaqResponse(getFallbackFaq(), "fallback");
}

// -----------------------------------------------------------------------------
// INTENT DETECTION
// -----------------------------------------------------------------------------
// Uses helper from chatbotKnowledge.ts if available.
// Falls back to local logic if ever needed.

function detectIntent(input: string): ChatIntent {
  try {
    return detectLocalIntent(input);
  } catch {
    return detectIntentFallback(input);
  }
}

function detectIntentFallback(input: string): ChatIntent {
  const text = input.toLowerCase();

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
      words: ["group", "birthday", "celebration", "party", "corporate"],
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
      words: ["event", "music", "live music", "screening", "football", "match", "show"],
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

// -----------------------------------------------------------------------------
// FAQ MATCHING
// -----------------------------------------------------------------------------

function findBestFaq(input: string, intent: ChatIntent): ChatFaq | null {
  // Prefer the helper from chatbotKnowledge.ts if present
  try {
    const best = findBestLocalFaq(input);

    // If helper returns fallback while we have a stronger intent,
    // we still allow intent-based matching below.
    if (best.intent !== "fallback") {
      return best;
    }
  } catch {
    // ignore and use internal matching below
  }

  const normalized = input.toLowerCase();

  const intentMatches = LOCAL_FAQS.filter((faq) => faq.intent === intent);

  if (intentMatches.length === 0) {
    return null;
  }

  const scored = intentMatches.map((faq) => {
    const keywordScore = scoreKeywordOverlap(normalized, faq.keywords);
    const phraseBoost = scorePhraseBoost(normalized, faq.question);
    const totalScore = keywordScore + phraseBoost;

    return {
      faq,
      score: totalScore,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.faq.priority - a.faq.priority;
  });

  const best = scored[0];

  // Important: only accept if it actually matched something
  if (!best || best.score <= 0) {
    return null;
  }

  return best.faq;
}

// Soft global scan across all FAQs if direct intent path fails
function findSoftBestFaq(input: string): ChatFaq | null {
  const normalized = input.toLowerCase();

  const scored = LOCAL_FAQS
    .filter((faq) => faq.intent !== "fallback")
    .map((faq) => {
      const keywordScore = scoreKeywordOverlap(normalized, faq.keywords);
      const phraseBoost = scorePhraseBoost(normalized, faq.question);
      const totalScore = keywordScore + phraseBoost;

      return {
        faq,
        score: totalScore,
      };
    });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.faq.priority - a.faq.priority;
  });

  const best = scored[0];

  if (!best || best.score <= 0) {
    return null;
  }

  return best.faq;
}

// -----------------------------------------------------------------------------
// RESPONSE FORMATTER
// -----------------------------------------------------------------------------

function formatFaqResponse(faq: ChatFaq, intent: ChatIntent): ChatbotResponse {
  return {
    content: faq.answer,
    actions: faq.actions ?? [],
    suggestions: faq.suggestions ?? [],
    intent,
  };
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function getFallbackFaq(): ChatFaq {
  return (
    LOCAL_FAQS.find((faq) => faq.intent === "fallback") ??
    LOCAL_FAQS[0]
  );
}

function normalizeInput(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function scoreKeywordOverlap(text: string, keywords: string[]): number {
  let score = 0;

  for (const keyword of keywords) {
    const kw = keyword.toLowerCase();

    // Exact includes
    if (text.includes(kw)) {
      score += kw.length > 6 ? 3 : 2;
    }

    // Token-based partial matching for multi-word inputs
    const tokens = kw.split(" ").filter(Boolean);
    if (tokens.length > 1) {
      const matchedTokens = tokens.filter((t) => text.includes(t)).length;
      if (matchedTokens === tokens.length) {
        score += 2;
      } else if (matchedTokens > 0) {
        score += 1;
      }
    }
  }

  return score;
}

function scorePhraseBoost(text: string, question: string): number {
  const normalizedQuestion = question.toLowerCase();

  // Small relevance boost if user wording resembles FAQ wording
  let score = 0;

  const significantWords = normalizedQuestion
    .replace(/[^\w\s]/g, "")
    .split(" ")
    .filter((word) => word.length >= 4);

  const matches = significantWords.filter((word) => text.includes(word)).length;

  if (matches >= 3) score += 3;
  else if (matches === 2) score += 2;
  else if (matches === 1) score += 1;

  return score;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -----------------------------------------------------------------------------
// OPTIONAL UTILITIES
// -----------------------------------------------------------------------------
// If your ChatPanel wants to show suggestion chips after a response,
// you can use response.suggestions directly.
//
// If you later integrate backend AI:
// - keep sendChatMessage()
// - replace getAssistantReply() with an API call
// - keep the same return shape

export function getQuickActionLabels(): string[] {
  return QUICK_ACTIONS.map((a) => a.label);
}
```
