/**
 * chat.ts — Shared TypeScript types for the Elparaiso Garden chatbot system.
 * All components and services consume these types.
 */

// ─── Core enums / unions ────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant";

export type ChatIntent =
  | "hours"
  | "location"
  | "reservation"
  | "menu"
  | "delivery"
  | "parking"
  | "payment"
  | "contact"
  | "music"
  | "amenities"
  | "carwash"
  | "fallback";

// ─── Message model ───────────────────────────────────────────────────────────

export interface ChatAction {
  label: string;
  /** href for link actions */
  href?: string;
  /** anchor id to scroll to (e.g. "contact", "menu") */
  scrollTo?: string;
  variant?: "primary" | "secondary";
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  intent?: ChatIntent;
  /** Inline CTA buttons to render below assistant messages */
  actions?: ChatAction[];
  isTyping?: boolean;
}

// ─── Chatbot service response ────────────────────────────────────────────────

export interface ChatResponse {
  content: string;
  intent: ChatIntent;
  actions?: ChatAction[];
  suggestions?: string[];
}

// ─── Supabase data shapes ────────────────────────────────────────────────────

export interface ChatFaq {
  id: string;
  intent: ChatIntent;
  question: string;
  answer: string;
  keywords: string[];
  suggestions: string[] | null;
  is_active: boolean;
  priority: number;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  session_id: string;
  user_agent: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  session_id: string;
  role: ChatRole;
  message: string;
  intent: ChatIntent | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Reservation lead ────────────────────────────────────────────────────────

export interface ReservationLeadPayload {
  name: string;
  phone: string;
  date?: string;
  time?: string;
  party_size?: number;
  notes?: string;
  source?: string;
}

// ─── Widget state ────────────────────────────────────────────────────────────

export interface ChatWidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  hasUnread: boolean;
}
