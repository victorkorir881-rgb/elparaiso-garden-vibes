/**
 * chatbotService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * UI-facing orchestration layer for the Elparaiso Garden Kisii chatbot.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * 1. chatbotKnowledge.ts is the SINGLE source of truth for intent/FAQ logic.
 *    This file coordinates; it does NOT duplicate detection or keyword lists.
 *
 * 2. Layered matching safety:
 *    Layer 1 → findBestLocalFaq() (uses detectLocalIntent + keyword scoring)
 *    Layer 2 → Secondary full-scan across all non-fallback FAQs
 *    Layer 3 → Strong fallback with help prompts + CTAs
 *
 * 3. Greeting / help / brand questions receive polished dedicated responses.
 *
 * 4. Input is normalised before matching to prevent punctuation/casing misses
 *    e.g. "Do you have drinks??" → "do you have drinks" → drinks FAQ ✓
 *
 * 5. 100% frontend-only — no Supabase, no API, no network calls at runtime.
 *
 * FUTURE AI INTEGRATION
 * ─────────────────────
 * When a secure backend AI is ready:
 *  - Replace the body of getAssistantReply() with an async fetch to your
 *    own API route or Supabase Edge Function.
 *  - Keep the function signature identical so ChatPanel.tsx needs no changes.
 *  - Add AI_ENABLED flag in chatbotConfig.ts to toggle gradually.
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

/**
 * Returns the initial assistant message shown when the chat widget opens.
 * ChatPanel.tsx calls this once on first load.
 */
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

/**
 * Processes a user message and returns a structured assistant response.
 * Called by ChatPanel.tsx for every user message.
 *
 * @param input   - Raw user input (untrimmed, any case)
 * @param _history - Message history (reserved for future AI context passing)
 */
export async function sendChatMessage(
  input: string,
  _history: ChatMessage[] = []
): Promise<ChatbotResponse> {
  const normalised = normaliseForMatching(input);

  // Guard: empty / whitespace-only input
  if (!normalised) {
    return buildEmptyInputResponse();
  }

  // Simulate realistic typing delay (keeps the UX natural)
  await simulateTypingDelay(normalised);

  // ── THIS IS WHERE THE SECURE AI BACKEND CALL WILL GO LATER ───────────────
  //
  // Future integration point:
  //   const aiReply = await callSecureAiBackend(normalised, _history);
  //   if (aiReply) return aiReply;
  //
  // For now, all replies come from the local knowledge layer.
  // ─────────────────────────────────────────────────────────────────────────

  return getAssistantReply(normalised);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE REPLY LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the best local response for normalised input.
 *
 * NOTE: This is the function to replace when integrating a real AI backend.
 * Keep the return type (ChatbotResponse) unchanged so ChatPanel.tsx is unaffected.
 */
function getAssistantReply(normalised: string): ChatbotResponse {
  // ── Layer 1: primary best-match via intent detection + keyword scoring ─────
  const primaryFaq = findBestLocalFaq(normalised);

  if (primaryFaq.intent !== "fallback") {
    return formatFaqResponse(primaryFaq);
  }

  // ── Layer 2: secondary full-scan in case intent detection missed ───────────
  // This catches cases like "do you have drinks?" where a short, common word
  // (drinks) may be missed if the input normalisation altered detection order.
  const secondaryFaq = findBestFaqGlobally(normalised);

  if (secondaryFaq && secondaryFaq.intent !== "fallback") {
    return formatFaqResponse(secondaryFaq);
  }

  // ── Layer 3: strong fallback with help prompts ─────────────────────────────
  return formatFaqResponse(getFallbackFaq());
}

// ─────────────────────────────────────────────────────────────────────────────
// SECONDARY GLOBAL SCAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans ALL non-fallback FAQs by keyword overlap.
 * This is the safety net when primary intent detection returns "fallback"
 * despite the message clearly matching a topic (e.g. "drinks", "bar").
 */
function findBestFaqGlobally(text: string): ChatFaq | null {
  const candidates = LOCAL_FAQS.filter((f) => f.intent !== "fallback");

  let bestFaq: ChatFaq | null = null;
  let bestScore = 0;

  for (const faq of candidates) {
    const score = scoreKeywordOverlap(text, faq.keywords) + faq.priority * 0.1;

    if (score > bestScore) {
      bestScore = score;
      bestFaq = faq;
    }
  }

  return bestScore > 0 ? bestFaq : null;
}

/**
 * Keyword overlap scoring with length-aware weighting.
 * Longer / multi-word keywords score higher to prefer specific matches.
 */
function scoreKeywordOverlap(text: string, keywords: string[]): number {
  let score = 0;

  for (const kw of keywords) {
    const k = kw.toLowerCase();

    if (text.includes(k)) {
      const tokens = k.split(/\s+/).filter(Boolean);
      // Multi-word phrase → +3,  long single word (>5 chars) → +2,  short word → +1
      score += tokens.length > 1 ? 3 : k.length > 5 ? 2 : 1;
    }
  }

  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE FORMATTER
// ─────────────────────────────────────────────────────────────────────────────

function formatFaqResponse(faq: ChatFaq): ChatbotResponse {
  return {
    content:     faq.answer,
    actions:     faq.actions     ?? defaultActionsFor(faq.intent),
    suggestions: faq.suggestions ?? defaultSuggestionsFor(faq.intent),
    intent:      faq.intent,
  };
}

/**
 * Default CTA actions when a FAQ doesn't explicitly specify any.
 */
function defaultActionsFor(intent: ChatIntent): ChatAction[] {
  switch (intent) {
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

    case "ambience":
    case "date_night":
    case "family":
    case "use_case":
      return [CHATBOT_ACTIONS.reserve];

    default:
      return [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.whatsapp];
  }
}

/**
 * Default follow-up suggestions when a FAQ doesn't specify any.
 */
function defaultSuggestionsFor(intent: ChatIntent): string[] {
  const defaults: Partial<Record<ChatIntent, string[]>> = {
    greeting:      ["Are you open now?", "Where are you located?", "How do I reserve?"],
    help:          ["Are you open now?", "How do I reserve?", "What's on the menu?"],
    hours:         ["Where are you located?", "How do I reserve?"],
    late_night:    ["What's on the menu?", "Do you serve drinks?"],
    location:      ["Is there parking?", "How can I contact you?"],
    directions:    ["Is there parking?", "Are you open now?"],
    reservation:   ["Do you host group bookings?", "What's on the menu?"],
    walk_in:       ["How do I reserve?", "Are you open now?"],
    menu:          ["Do you serve drinks?", "Do you do delivery?"],
    drinks:        ["What's on the menu?", "How do I reserve?"],
    contact:       ["Where are you located?", "How do I reserve?"],
    delivery:      ["How can I contact you?", "What's on the menu?"],
    parking:       ["Where are you located?", "How do I reserve?"],
    ambience:      ["Do you host group bookings?", "What's on the menu?"],
    date_night:    ["How do I reserve?", "What's on the menu?"],
    family:        ["How do I reserve?", "What's the atmosphere like?"],
    group_booking: ["How do I reserve?", "How can I contact you?"],
    celebrations:  ["How do I reserve?", "How can I contact you?"],
    events:        ["How can I contact you?", "How do I reserve?"],
    payment:       ["How can I contact you?", "How do I reserve?"],
    wifi:          ["How can I contact you?", "What are your opening hours?"],
    use_case:      ["Are you open now?", "How do I reserve?"],
    visit_planning:["How do I reserve?", "Where are you located?"],
    brand:         ["What's on the menu?", "Are you open now?"],
    fallback:      ["Are you open now?", "Where are you located?", "How do I reserve?"],
  };

  return defaults[intent] ?? ["Are you open now?", "How do I reserve?"];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getFallbackFaq(): ChatFaq {
  return (
    LOCAL_FAQS.find((faq) => faq.intent === "fallback") ?? LOCAL_FAQS[0]
  );
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
    actions:     [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
    suggestions: QUICK_ACTIONS.map((a) => a.label),
    intent:      "fallback",
  };
}

/**
 * Adaptive typing delay that scales with message length for a natural feel.
 * Short inputs → faster reply. Longer inputs → slightly longer pause.
 */
function simulateTypingDelay(text: string): Promise<void> {
  const base  = 600;
  const extra = Math.min(text.length * 4, 600); // cap extra at 600 ms
  const total = base + extra;
  return new Promise((resolve) => setTimeout(resolve, total));
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the quick action chip labels for use in QuickActions.tsx */
export function getQuickActionLabels(): string[] {
  return QUICK_ACTIONS.map((a) => a.label);
}
