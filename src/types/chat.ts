/**
 * types/chat.ts
 * ------------------------------------------------------------------
 * Shared chat types for the Elparaiso Garden Kisii chatbot
 *
 * Fully aligned with:
 * - chatbotKnowledge.ts
 * - chatbotService.ts
 * - ChatPanel.tsx
 * - ChatMessage.tsx
 */

// -----------------------------------------------------------------------------
// ACTIONS
// -----------------------------------------------------------------------------
// Action buttons shown under assistant messages.
// Example: Call, WhatsApp, Directions, Reserve Table, View Menu

export type ChatActionType = "link" | "phone" | "whatsapp";

export interface ChatAction {
  label: string;
  type: ChatActionType;
  value: string;
}

// -----------------------------------------------------------------------------
// MESSAGE
// -----------------------------------------------------------------------------
// Core message shape used in the chat UI.

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
  isTyping?: boolean;
}

// -----------------------------------------------------------------------------
// INTENTS
// -----------------------------------------------------------------------------
// Must stay aligned with chatbotKnowledge.ts / chatbotService.ts

export type ChatIntent =
  | "greeting"
  | "help"
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
  | "brand"
  | "fallback";

// -----------------------------------------------------------------------------
// SERVICE RESPONSE
// -----------------------------------------------------------------------------
// Response returned by sendChatMessage() from chatbotService.ts

export interface ChatbotResponse {
  content: string;
  actions?: ChatAction[];
  suggestions?: string[];
  intent?: ChatIntent;
}
