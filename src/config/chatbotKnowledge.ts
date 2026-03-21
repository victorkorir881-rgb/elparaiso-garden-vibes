/**
 * chatbotKnowledge.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business configuration and action definitions for the Elparaiso Garden Kisii
 * concierge chatbot.
 *
 * This file is the single source of truth for:
 *  - Business identity & contact info
 *  - Reusable CTA action objects
 *  - Quick action chips shown in the chat widget
 *  - Welcome message content
 *
 * NOTE: This file no longer contains keyword-scoring logic or FAQ matching.
 * That intelligence now lives in the AI edge function (supabase/functions/chat).
 * The local fallback in chatbotService.ts uses these definitions only.
 */

import type { ChatAction } from "@/types/chat";

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS CONSTANTS — update only here; everything downstream auto-updates
// ─────────────────────────────────────────────────────────────────────────────

export const BUSINESS_INFO = {
  name: "Elparaiso Garden Kisii",
  shortName: "Elparaiso Garden",
  phone: "0791 224513",
  phoneIntl: "+254791224513",
  location: "County Government Street, Kisii, Kenya",
  hours: "Open 24/7 — every day, all day",
  whatsappLink: "https://wa.me/254791224513",
  mapsLink: "https://www.google.com/maps/search/?api=1&query=Elparaiso+Garden+Kisii",
  reservationAnchor: "#reservation",
  menuAnchor: "#menu",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE CTA ACTIONS — compose into responses
// ─────────────────────────────────────────────────────────────────────────────

export const CHATBOT_ACTIONS = {
  call: {
    label: "Call Now",
    type: "phone" as const,
    value: BUSINESS_INFO.phoneIntl,
  } satisfies ChatAction,

  whatsapp: {
    label: "WhatsApp",
    type: "whatsapp" as const,
    value: BUSINESS_INFO.phoneIntl,
  } satisfies ChatAction,

  directions: {
    label: "Get Directions",
    type: "link" as const,
    value: BUSINESS_INFO.mapsLink,
  } satisfies ChatAction,

  reserve: {
    label: "Reserve a Table",
    type: "link" as const,
    value: BUSINESS_INFO.reservationAnchor,
  } satisfies ChatAction,

  menu: {
    label: "View Menu",
    type: "link" as const,
    value: BUSINESS_INFO.menuAnchor,
  } satisfies ChatAction,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// QUICK ACTIONS — chips shown before the user types
// ─────────────────────────────────────────────────────────────────────────────

export const QUICK_ACTIONS = [
  { label: "Are you open now?" },
  { label: "Where are you located?" },
  { label: "How do I reserve?" },
  { label: "What's on the menu?" },
  { label: "Do you serve drinks?" },
  { label: "Contact / WhatsApp" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// WELCOME MESSAGE — shown when the chat opens
// ─────────────────────────────────────────────────────────────────────────────

export const WELCOME_MESSAGE = {
  content:
    `Hi 👋 Welcome to **${BUSINESS_INFO.name}** — Kisii's ultimate chill spot.\n\n` +
    "I can help with reservations, opening hours, location, menu, drinks, and more.\n\n" +
    "What would you like to know? 😊",
  actions: [CHATBOT_ACTIONS.reserve, CHATBOT_ACTIONS.call],
  suggestions: QUICK_ACTIONS.map((a) => a.label),
  intent: "greeting" as const,
} as const;
