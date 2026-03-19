/**
 * chatbotConfig.ts — Runtime configuration for the Elparaiso Garden chatbot.
 */

export const CHATBOT_CONFIG = {
  botName: "Elparaiso Concierge",
  botAvatar: "🌿",

  /** Simulated typing delay range (ms) */
  typingDelayMin: 800,
  typingDelayMax: 1600,

  /** localStorage keys */
  sessionIdKey: "elparaiso_chat_session_id",
  messageHistoryKey: "elparaiso_chat_history",

  /** Max messages to persist in localStorage */
  maxPersistedMessages: 50,

  /** Supabase source label for analytics */
  conversationSource: "website",
} as const;
