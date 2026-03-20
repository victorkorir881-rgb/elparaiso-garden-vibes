```ts id="k7n2vx"
/**
 * types/chat.ts
 * ------------------------------------------------------------------
 * Shared chat types for the Elparaiso Garden Kisii chatbot
 *
 * Compatible with:
 * - chatbotKnowledge.ts
 * - chatbotService.ts
 * - ChatPanel.tsx
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
// SERVICE RESPONSE
// -----------------------------------------------------------------------------
// Response returned by sendChatMessage() from chatbotService.ts

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

export interface ChatbotResponse {
  content: string;
  actions?: ChatAction[];
  suggestions?: string[];
  intent?: ChatIntent;
}
```
