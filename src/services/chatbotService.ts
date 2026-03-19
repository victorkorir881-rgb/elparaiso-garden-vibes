/**
 * chatbotService.ts — UI-facing orchestration layer for the Elparaiso Garden chatbot.
 *
 * Exposes a single public function: sendChatMessage()
 *
 * Flow:
 *  1. Ensure / create a browser session id
 *  2. Ensure a Supabase conversation record (if configured)
 *  3. Persist the user message to Supabase (silent fallback)
 *  4. Determine the best reply via FAQ + keyword matching
 *  5. Persist the assistant reply to Supabase (silent fallback)
 *  6. Return a structured ChatResponse to the UI
 *
 * ─── FUTURE AI INTEGRATION ──────────────────────────────────────────────────
 * When you are ready to connect a real AI backend:
 *
 *   1. Replace the body of `getAssistantReply()` with an API call to your
 *      secure backend (your own server, or a Supabase Edge Function).
 *   2. The UI layer (ChatPanel) does NOT need to change at all.
 *   3. Never call OpenAI directly from the browser — always go via a backend
 *      endpoint that holds the secret API key server-side.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { v4 as uuidv4 } from "@/lib/uuid";
import {
  ChatMessage,
  ChatResponse,
  ChatIntent,
  ChatAction,
} from "@/types/chat";
import {
  ensureConversation,
  persistMessage,
  fetchFaqs,
} from "@/services/chatbotSupabaseService";
import {
  LOCAL_FAQS,
  INTENT_KEYWORDS,
  FALLBACK_MESSAGE,
} from "@/config/chatbotKnowledge";
import { CHATBOT_CONFIG } from "@/config/chatbotConfig";
import { SITE_CONFIG } from "@/config/siteConfig";
import { ChatFaq } from "@/types/chat";

// ─── Session management ───────────────────────────────────────────────────────

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(CHATBOT_CONFIG.sessionIdKey);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(CHATBOT_CONFIG.sessionIdKey, id);
  }
  return id;
}

// Conversation id is cached per page load (not persisted across tabs)
let _conversationId: string | null = null;

async function getConversationId(sessionId: string): Promise<string | null> {
  if (_conversationId) return _conversationId;
  _conversationId = await ensureConversation(sessionId);
  return _conversationId;
}

// ─── Intent detection ────────────────────────────────────────────────────────

function detectIntent(input: string): ChatIntent {
  const normalized = input.toLowerCase();

  let bestIntent: ChatIntent = "fallback";
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [
    ChatIntent,
    string[],
  ][]) {
    if (intent === "fallback") continue;
    const score = keywords.reduce(
      (acc, kw) => (normalized.includes(kw) ? acc + 1 : acc),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  return bestScore > 0 ? bestIntent : "fallback";
}

// ─── FAQ matching ────────────────────────────────────────────────────────────

function findBestFaq(
  input: string,
  intent: ChatIntent,
  faqs: ChatFaq[]
): ChatFaq | null {
  const normalized = input.toLowerCase();

  // First: match by exact intent + keyword overlap
  const intentMatches = faqs.filter((f) => f.intent === intent);
  if (intentMatches.length > 0) {
    // Score each by keyword overlap
    const scored = intentMatches.map((faq) => ({
      faq,
      score: faq.keywords.reduce(
        (acc, kw) => (normalized.includes(kw.toLowerCase()) ? acc + 1 : acc),
        0
      ),
    }));
    scored.sort((a, b) => b.faq.priority - a.faq.priority || b.score - a.score);
    return scored[0].faq;
  }

  return null;
}

// ─── Inline action builder ───────────────────────────────────────────────────

function actionsForIntent(intent: ChatIntent): ChatAction[] {
  switch (intent) {
    case "reservation":
      return [
        { label: "Reserve Now", scrollTo: "contact", variant: "primary" },
        {
          label: "WhatsApp",
          href: SITE_CONFIG.contact.whatsappHref,
          variant: "secondary",
        },
        {
          label: "Call Now",
          href: SITE_CONFIG.contact.phoneTelHref,
          variant: "secondary",
        },
      ];
    case "contact":
      return [
        {
          label: "Call 0791 224513",
          href: SITE_CONFIG.contact.phoneTelHref,
          variant: "primary",
        },
        {
          label: "WhatsApp",
          href: SITE_CONFIG.contact.whatsappHref,
          variant: "secondary",
        },
      ];
    case "location":
      return [
        { label: "Get Directions", scrollTo: "contact", variant: "primary" },
      ];
    case "menu":
      return [{ label: "View Menu", scrollTo: "menu", variant: "primary" }];
    case "delivery":
      return [
        {
          label: "Call to Order",
          href: SITE_CONFIG.contact.phoneTelHref,
          variant: "primary",
        },
        {
          label: "WhatsApp Order",
          href: SITE_CONFIG.contact.whatsappHref,
          variant: "secondary",
        },
      ];
    case "fallback":
      return [
        {
          label: "Call Us",
          href: SITE_CONFIG.contact.phoneTelHref,
          variant: "primary",
        },
        {
          label: "WhatsApp",
          href: SITE_CONFIG.contact.whatsappHref,
          variant: "secondary",
        },
      ];
    default:
      return [];
  }
}

// ─── Typing simulation ────────────────────────────────────────────────────────

function typingDelay(): Promise<void> {
  const delay =
    CHATBOT_CONFIG.typingDelayMin +
    Math.random() *
      (CHATBOT_CONFIG.typingDelayMax - CHATBOT_CONFIG.typingDelayMin);
  return new Promise((r) => setTimeout(r, delay));
}

// ─── Core reply engine ────────────────────────────────────────────────────────

/**
 * Determines the assistant reply for a given user message.
 *
 * ─── FUTURE AI INTEGRATION POINT ────────────────────────────────────────────
 * Replace this function body with a call to a secure backend endpoint:
 *
 *   const response = await fetch('/api/chat', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ message, history })
 *   });
 *   return response.json();
 *
 * That backend endpoint should:
 *   - Hold the OpenAI (or other LLM) API key server-side
 *   - Use the conversation history for context
 *   - Return a ChatResponse shape
 *
 * DO NOT put OpenAI API keys in the browser/frontend.
 * ────────────────────────────────────────────────────────────────────────────
 */
async function getAssistantReply(
  message: string,
  _history: ChatMessage[],
  supabaseFaqs: ChatFaq[]
): Promise<ChatResponse> {
  const intent = detectIntent(message);

  // Prefer Supabase FAQs, fall back to local knowledge
  const faqPool = supabaseFaqs.length > 0 ? supabaseFaqs : LOCAL_FAQS;
  const matched = findBestFaq(message, intent, faqPool);

  const content = matched?.answer ?? FALLBACK_MESSAGE;
  const suggestions = matched?.suggestions ?? undefined;
  const actions = actionsForIntent(intent);

  return { content, intent, actions, suggestions };
}

// ─── Supabase FAQ cache ───────────────────────────────────────────────────────

let _faqCache: ChatFaq[] | null = null;
let _faqCachedAt = 0;
const FAQ_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedFaqs(): Promise<ChatFaq[]> {
  const now = Date.now();
  if (_faqCache && now - _faqCachedAt < FAQ_CACHE_TTL_MS) {
    return _faqCache;
  }
  _faqCache = await fetchFaqs();
  _faqCachedAt = now;
  return _faqCache;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Primary function consumed by the ChatPanel component.
 * Handles the full send → reply cycle including persistence.
 */
export async function sendChatMessage(
  message: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> {
  const sessionId = getOrCreateSessionId();

  // Fire-and-forget Supabase tasks — don't block the UI on them
  const conversationPromise = getConversationId(sessionId);
  const faqsPromise = getCachedFaqs();

  // Simulate realistic typing delay
  const [conversationId, faqs] = await Promise.all([
    conversationPromise,
    faqsPromise,
    typingDelay(),
  ]);

  // Persist user message (non-blocking)
  if (conversationId) {
    persistMessage({
      conversationId,
      sessionId,
      role: "user",
      message,
    }).catch(() => {/* silent */});
  }

  // Generate reply
  const response = await getAssistantReply(message, history, faqs);

  // Persist assistant reply (non-blocking)
  if (conversationId) {
    persistMessage({
      conversationId,
      sessionId,
      role: "assistant",
      message: response.content,
      intent: response.intent,
    }).catch(() => {/* silent */});
  }

  return response;
}

export { getOrCreateSessionId };
