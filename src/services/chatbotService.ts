/**
 * src/services/chatbotService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * UI-facing service for the Elparaiso Garden Kisii chatbot.
 *
 * Architecture:
 *  - Sends messages to the Supabase Edge Function (AI-powered, server-side)
 *  - Falls back gracefully to a friendly static response if the API is
 *    unavailable (network error, missing config, timeout)
 *  - Never calls OpenAI or any LLM directly from the browser
 *  - History is trimmed before sending to keep payloads small
 *
 * Public API:
 *  - getWelcomeMessage()         → initial assistant message
 *  - sendChatMessage(text, hist) → AI response or graceful fallback
 */

import type { ChatMessage } from "@/types/chat";
import {
  CHATBOT_ACTIONS,
  QUICK_ACTIONS,
  WELCOME_MESSAGE,
} from "@/config/chatbotKnowledge";

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE TYPE (mirrors src/types/chat.ts ChatbotResponse)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatbotResponse {
  content: string;
  actions?: import("@/types/chat").ChatAction[];
  suggestions?: string[];
  intent?: import("@/types/chat").ChatIntent | string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT
// Supabase project ref is embedded at build time via the env var injected
// by Lovable Cloud. We read it from VITE_SUPABASE_URL.
// ─────────────────────────────────────────────────────────────────────────────

function getChatEndpoint(): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return null;
  return `${base}/functions/v1/chat`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY TRIM (keep last 6 turns to minimise payload / cost)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 6;

function buildHistoryPayload(
  history: ChatMessage[]
): Array<{ role: "user" | "assistant"; content: string }> {
  return history
    .filter(
      (m) =>
        !m.isTyping &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.trim().slice(0, 500),
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE RESPONSE NORMALISER
// Ensures the shape from the edge function is always valid for the UI.
// ─────────────────────────────────────────────────────────────────────────────

function tryExtractFromJsonString(text: string): Record<string, unknown> | null {
  try {
    // Find the first { and last } to handle cases where AI prepends/appends text
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed === "object" && parsed !== null && typeof parsed.content === "string") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function normaliseResponse(raw: unknown): ChatbotResponse {
  if (!raw || typeof raw !== "object") return buildFallback();

  let r = raw as Record<string, unknown>;

  // Safety: if `content` itself is a JSON string containing the real response, unwrap it
  if (typeof r.content === "string") {
    const maybeNested = tryExtractFromJsonString(r.content);
    if (maybeNested) {
      r = maybeNested;
    }
  }

  if (typeof r.content !== "string" || !r.content.trim()) return buildFallback();

  return {
    content: r.content.trim(),
    intent: typeof r.intent === "string" ? r.intent : undefined,
    actions: Array.isArray(r.actions)
      ? (r.actions as import("@/types/chat").ChatAction[]).filter(
          (a) =>
            typeof a?.label === "string" &&
            typeof a?.type === "string" &&
            typeof a?.value === "string"
        )
      : undefined,
    suggestions: Array.isArray(r.suggestions)
      ? (r.suggestions as unknown[])
          .filter((s) => typeof s === "string")
          .map((s) => s as string)
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC FALLBACK
// Shown when the edge function is unreachable or fails.
// ─────────────────────────────────────────────────────────────────────────────

function buildFallback(): ChatbotResponse {
  return {
    content:
      "I'm having a little trouble answering right now, but I'd still love to help. " +
      "Please call us or send us a WhatsApp message for quick assistance. 😊",
    actions: [CHATBOT_ACTIONS.call, CHATBOT_ACTIONS.whatsapp],
    suggestions: ["Are you open now?", "Where are you located?", "How do I reserve?"],
    intent: "fallback",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: WELCOME MESSAGE
// ─────────────────────────────────────────────────────────────────────────────

export function getWelcomeMessage(): ChatbotResponse {
  return {
    content: WELCOME_MESSAGE.content,
    actions: [...WELCOME_MESSAGE.actions],
    suggestions: [...WELCOME_MESSAGE.suggestions],
    intent: WELCOME_MESSAGE.intent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: SEND MESSAGE
// ─────────────────────────────────────────────────────────────────────────────

export async function sendChatMessage(
  input: string,
  history: ChatMessage[] = []
): Promise<ChatbotResponse> {
  const text = input.trim();

  // Empty input — return a prompt
  if (!text) {
    return {
      content:
        "I didn't catch that — feel free to ask anything! 😊\n\n" +
        "Try: *Are you open now?* · *Where are you?* · *How do I reserve?*",
      actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
      suggestions: QUICK_ACTIONS.map((a) => a.label),
      intent: "fallback",
    };
  }

  const endpoint = getChatEndpoint();

  // No endpoint configured → local fallback immediately
  if (!endpoint) {
    console.warn("[chatbotService] VITE_SUPABASE_URL not set; using fallback");
    return buildFallback();
  }

  const historyPayload = buildHistoryPayload(history);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Supabase publishable key — safe to include in frontend
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string ?? "",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string ?? ""}`,
      },
      body: JSON.stringify({ message: text, history: historyPayload }),
      signal: AbortSignal.timeout(12_000), // 12s client-side timeout
    });

    if (!response.ok) {
      console.error("[chatbotService] Edge function returned", response.status);
      return buildFallback();
    }

    const data: unknown = await response.json();
    return normaliseResponse(data);
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    console.error("[chatbotService] Request failed:", isTimeout ? "timeout" : err);
    return buildFallback();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY EXPORTS (preserved for QuickActions compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export function getQuickActionLabels(): string[] {
  return QUICK_ACTIONS.map((a) => a.label);
}
