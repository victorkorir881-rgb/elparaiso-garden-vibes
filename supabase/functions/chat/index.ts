/**
 * supabase/functions/chat/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Elparaiso Garden Kisii — AI Concierge Edge Function
 *
 * Architecture:
 *  - Receives: { message: string, history?: {role, content}[] }
 *  - Calls Lovable AI Gateway (OpenAI-compatible) server-side only
 *  - Returns: ChatbotResponse { content, actions?, suggestions?, intent? }
 *  - API key NEVER reaches the browser
 *
 * Cost / Latency optimisations:
 *  - Uses google/gemini-3-flash-preview (fast + cheap)
 *  - History trimmed to last 6 turns max before sending
 *  - System prompt is compact but complete
 *  - max_tokens capped at 300 (enough for concierge replies)
 *  - temperature 0.3 for reliable, low-variance responses
 *  - 8-second server-side timeout with graceful fallback
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES (mirrored from src/types/chat.ts — kept minimal for edge runtime)
// ─────────────────────────────────────────────────────────────────────────────

type ChatActionType = "link" | "phone" | "whatsapp";

interface ChatAction {
  label: string;
  type: ChatActionType;
  value: string;
}

interface ChatbotResponse {
  content: string;
  actions?: ChatAction[];
  suggestions?: string[];
  intent?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS KNOWLEDGE — single source of truth for the system prompt
// ─────────────────────────────────────────────────────────────────────────────

const BUSINESS = {
  name: "Elparaiso Garden Kisii",
  type: "bar, grill, restaurant, chill spot — 24-hour social venue",
  hours: "Open 24 hours a day, 7 days a week including weekends and public holidays",
  location: "County Government Street, Kisii, Kenya",
  phone: "0791 224513",
  phoneIntl: "+254791224513",
  whatsapp: "+254791224513",
  whatsappLink: "https://wa.me/254791224513",
  mapsLink: "https://www.google.com/maps/search/?api=1&query=Elparaiso+Garden+Kisii",
  reservationAnchor: "#reservation",
  menuAnchor: "#menu",

  // Verified facts only — never claim what is not confirmed
  confirmedFeatures: [
    "Open 24/7",
    "Full bar (beer, wine, cocktails, spirits, soft drinks)",
    "Nyama choma-style grills",
    "Mutura",
    "Dine-in, takeaway, drive-through",
    "Free parking on-site",
    "On-site car wash (Car Wash & Dine experience)",
    "Reservations accepted (phone, WhatsApp, online form)",
    "Walk-ins welcome",
    "Group bookings and celebrations catered for",
    "Wheelchair-accessible toilet",
    "NFC mobile payments and debit cards accepted",
    "Table service",
  ],

  // Uncertain — always say to confirm via phone/WhatsApp
  unconfirmedTopics: [
    "Wi-Fi availability",
    "Exact delivery coverage/radius",
    "Exact current menu pricing",
    "Exact event schedule or live music dates",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT (compact — optimised for cost)
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are the official concierge assistant for ${BUSINESS.name}, a ${BUSINESS.type} located at ${BUSINESS.location}.

HOURS: ${BUSINESS.hours}
PHONE: ${BUSINESS.phone} (${BUSINESS.phoneIntl})
WHATSAPP: ${BUSINESS.whatsapp}

CONFIRMED FEATURES:
${BUSINESS.confirmedFeatures.map((f) => `- ${f}`).join("\n")}

RULES:
1. Answer naturally, warmly, and concisely (2-4 sentences usually). Never robotic.
2. ONLY use facts listed above. Do NOT invent menu items, prices, or services.
3. For uncertain topics (Wi-Fi, exact delivery, pricing, event schedule), say to call or WhatsApp to confirm.
4. If asked multiple questions, answer all of them in one reply.
5. Handle typos, slang, informal wording gracefully.
6. When appropriate, nudge toward reservations, calls, or WhatsApp.
7. You MUST respond with valid JSON only — no prose outside JSON.

RESPONSE FORMAT (strict JSON):
{
  "content": "Your reply here",
  "intent": one of: hours|location|reservation|menu|contact|delivery|parking|ambience|group_booking|payment|family|drinks|events|wifi|fallback,
  "actions": [{"label":"...", "type":"phone|whatsapp|link", "value":"..."}],
  "suggestions": ["follow-up question 1", "follow-up question 2"]
}

AVAILABLE ACTIONS (use relevant ones only, 1-3 max):
- Call Now: {"label":"Call Now","type":"phone","value":"${BUSINESS.phoneIntl}"}
- WhatsApp: {"label":"WhatsApp","type":"whatsapp","value":"${BUSINESS.phoneIntl}"}
- Reserve: {"label":"Reserve a Table","type":"link","value":"${BUSINESS.reservationAnchor}"}
- Menu: {"label":"View Menu","type":"link","value":"${BUSINESS.menuAnchor}"}
- Directions: {"label":"Get Directions","type":"link","value":"${BUSINESS.mapsLink}"}

Keep responses friendly, premium, brief. No hallucinations.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

function buildFallback(reason?: string): ChatbotResponse {
  console.warn("[chat] Returning fallback:", reason ?? "unknown");
  return {
    content:
      "I'm having a little trouble answering right now, but I'd still love to help. Please call us or send us a WhatsApp message for quick assistance. 😊",
    actions: [
      { label: "Call Now", type: "phone", value: BUSINESS.phoneIntl },
      { label: "WhatsApp", type: "whatsapp", value: BUSINESS.phoneIntl },
    ],
    suggestions: ["Are you open now?", "Where are you located?", "How do I reserve?"],
    intent: "fallback",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE JSON PARSE
// ─────────────────────────────────────────────────────────────────────────────

function safeParseResponse(raw: string): ChatbotResponse | null {
  // Strip markdown code fences if model wraps output
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    if (typeof parsed?.content !== "string" || !parsed.content.trim()) {
      return null;
    }

    const result: ChatbotResponse = {
      content: parsed.content.trim(),
      intent: typeof parsed.intent === "string" ? parsed.intent : "fallback",
    };

    if (Array.isArray(parsed.actions)) {
      result.actions = parsed.actions.filter(
        (a: unknown) =>
          typeof (a as ChatAction)?.label === "string" &&
          typeof (a as ChatAction)?.type === "string" &&
          typeof (a as ChatAction)?.value === "string"
      );
    }

    if (Array.isArray(parsed.suggestions)) {
      result.suggestions = parsed.suggestions.filter(
        (s: unknown) => typeof s === "string"
      );
    }

    return result;
  } catch {
    // Model returned non-JSON prose — extract text and wrap safely
    if (cleaned.length > 0) {
      return {
        content: cleaned.slice(0, 600),
        intent: "fallback",
        actions: [
          { label: "Call Now", type: "phone", value: BUSINESS.phoneIntl },
          { label: "WhatsApp", type: "whatsapp", value: BUSINESS.phoneIntl },
        ],
        suggestions: ["Are you open now?", "Where are you located?"],
      };
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIM HISTORY (cost / latency optimisation)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY_TURNS = 6; // 3 user + 3 assistant

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

function trimHistory(history: HistoryMessage[]): HistoryMessage[] {
  if (!Array.isArray(history)) return [];

  // Only keep user/assistant messages, strip typing indicators, cap length
  const clean = history
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_TURNS);

  return clean.map((m) => ({
    role: m.role,
    content: m.content.trim().slice(0, 500), // cap per-message length
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse & validate body
  let message: string;
  let rawHistory: HistoryMessage[] = [];

  try {
    const body = await req.json();

    if (typeof body?.message !== "string" || !body.message.trim()) {
      return new Response(
        JSON.stringify(buildFallback("empty message")),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    message = body.message.trim().slice(0, 800); // input cap
    rawHistory = Array.isArray(body.history) ? body.history : [];
  } catch {
    return new Response(
      JSON.stringify(buildFallback("invalid JSON body")),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get API key
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("[chat] LOVABLE_API_KEY not set");
    return new Response(
      JSON.stringify(buildFallback("config error")),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Build messages array
  const history = trimHistory(rawHistory);
  const messages = [
    { role: "system", content: buildSystemPrompt() },
    ...history,
    { role: "user", content: message },
  ];

  // Call Lovable AI Gateway with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    clearTimeout(timeout);

    if (response.status === 429) {
      console.warn("[chat] Rate limited");
      return new Response(
        JSON.stringify(buildFallback("rate limited")),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (response.status === 402) {
      console.warn("[chat] Payment required");
      return new Response(
        JSON.stringify(buildFallback("credits exhausted")),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[chat] AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify(buildFallback(`gateway ${response.status}`)),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawContent: string = data?.choices?.[0]?.message?.content ?? "";

    if (!rawContent.trim()) {
      return new Response(
        JSON.stringify(buildFallback("empty model response")),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = safeParseResponse(rawContent);

    if (!parsed) {
      return new Response(
        JSON.stringify(buildFallback("parse failure")),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    clearTimeout(timeout);

    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.error("[chat] Request failed:", isTimeout ? "timeout" : err);

    return new Response(
      JSON.stringify(buildFallback(isTimeout ? "timeout" : "network error")),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
