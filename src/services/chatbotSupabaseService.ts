/**
 * chatbotSupabaseService.ts — Data-access layer for the Elparaiso Garden chatbot.
 *
 * Responsibilities:
 *  - create or retrieve a conversation by session_id
 *  - fetch active FAQs from chatbot_faqs
 *  - persist user and assistant messages
 *  - insert reservation leads
 *
 * All functions fail silently when Supabase is unconfigured, so the chatbot
 * remains fully functional in local/fallback mode.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ChatRole, ChatIntent } from "@/types/chat";

// Local types — no longer exported from chat.ts
interface ChatConversation {
  id: string;
  session_id: string;
}

interface ChatFaq {
  id: string;
  intent: string;
  question: string;
  answer: string;
  keywords: string[];
  suggestions?: string[];
  actions?: unknown[];
  priority: number;
  is_active?: boolean;
}

interface ReservationLeadPayload {
  name: string;
  phone: string;
  date?: string;
  time?: string;
  party_size?: number;
  notes?: string;
  source?: string;
}

// ─── Conversations ───────────────────────────────────────────────────────────

/**
 * Creates a new conversation row and returns its id.
 * Returns null if Supabase is not configured or the insert fails.
 */
export async function createConversation(
  sessionId: string
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from("chatbot_conversations")
      .insert({
        session_id: sessionId,
        user_agent: navigator.userAgent.slice(0, 300),
        source: "website",
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[chatbotSupabaseService] createConversation error:", error.message);
      return null;
    }

    return (data as ChatConversation)?.id ?? null;
  } catch (err) {
    console.warn("[chatbotSupabaseService] createConversation threw:", err);
    return null;
  }
}

/**
 * Looks up an existing conversation by session_id.
 * Returns the conversation id if found, otherwise null.
 */
export async function findConversation(
  sessionId: string
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from("chatbot_conversations")
      .select("id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[chatbotSupabaseService] findConversation error:", error.message);
      return null;
    }

    return (data as Pick<ChatConversation, "id"> | null)?.id ?? null;
  } catch (err) {
    console.warn("[chatbotSupabaseService] findConversation threw:", err);
    return null;
  }
}

/**
 * Returns an existing conversation id for a session, creating one if necessary.
 */
export async function ensureConversation(
  sessionId: string
): Promise<string | null> {
  const existing = await findConversation(sessionId);
  if (existing) return existing;
  return createConversation(sessionId);
}

// ─── Messages ────────────────────────────────────────────────────────────────

/**
 * Persists a single chat message to chatbot_messages.
 */
export async function persistMessage(params: {
  conversationId: string;
  sessionId: string;
  role: ChatRole;
  message: string;
  intent?: ChatIntent;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    const { error } = await supabase.from("chatbot_messages").insert({
      conversation_id: params.conversationId,
      session_id: params.sessionId,
      role: params.role,
      message: params.message,
      intent: params.intent ?? null,
      metadata: params.metadata ?? null,
    });

    if (error) {
      console.warn("[chatbotSupabaseService] persistMessage error:", error.message);
    }
  } catch (err) {
    console.warn("[chatbotSupabaseService] persistMessage threw:", err);
  }
}

// ─── FAQs ────────────────────────────────────────────────────────────────────

/**
 * Fetches all active FAQs from Supabase, ordered by priority descending.
 * Returns an empty array on error or if Supabase is unconfigured.
 */
export async function fetchFaqs(): Promise<ChatFaq[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from("chatbot_faqs")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error) {
      console.warn("[chatbotSupabaseService] fetchFaqs error:", error.message);
      return [];
    }

    return (data as ChatFaq[]) ?? [];
  } catch (err) {
    console.warn("[chatbotSupabaseService] fetchFaqs threw:", err);
    return [];
  }
}

// ─── Reservation leads ────────────────────────────────────────────────────────

/**
 * Inserts a reservation lead captured via the chatbot flow.
 * Silent failure if Supabase unavailable.
 */
export async function insertReservationLead(
  payload: ReservationLeadPayload
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    const { error } = await supabase.from("reservation_leads").insert({
      ...payload,
      source: payload.source ?? "chatbot",
      status: "new",
    });

    if (error) {
      console.warn("[chatbotSupabaseService] insertReservationLead error:", error.message);
    }
  } catch (err) {
    console.warn("[chatbotSupabaseService] insertReservationLead threw:", err);
  }
}
