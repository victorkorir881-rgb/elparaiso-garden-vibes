/**
 * Elparaiso Garden Kisii — AI Concierge Edge Function
 * Uses Lovable AI Gateway (OpenAI-compatible) with LOVABLE_API_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Business info for the system prompt
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
};

function buildSystemPrompt(): string {
  return `You are the official concierge assistant for ${BUSINESS.name}.
LOCATION: ${BUSINESS.location}
HOURS: ${BUSINESS.hours}
CONTACT: ${BUSINESS.phone} / ${BUSINESS.whatsapp}

CONFIRMED FEATURES:
${BUSINESS.confirmedFeatures.map((f) => `- ${f}`).join("\n")}

RULES:
1. Answer naturally, warmly, and concisely (2-3 sentences).
2. ONLY use facts listed above. For prices/delivery, ask them to Call/WhatsApp.
3. You MUST respond with valid JSON only. No markdown wrapping.

RESPONSE FORMAT (strict JSON):
{
  "content": "Your reply text here",
  "intent": "hours|location|reservation|menu|contact|delivery|parking|payment|drinks|fallback",
  "actions": [{"label":"...", "type":"phone|whatsapp|link", "value":"..."}],
  "suggestions": ["follow-up question 1", "follow-up question 2"]
}

AVAILABLE ACTIONS (use these exact values):
- Call Now: {"label":"Call Now","type":"phone","value":"${BUSINESS.phoneIntl}"}
- WhatsApp: {"label":"WhatsApp","type":"whatsapp","value":"${BUSINESS.phoneIntl}"}
- Reserve: {"label":"Reserve a Table","type":"link","value":"${BUSINESS.reservationAnchor}"}
- Directions: {"label":"Get Directions","type":"link","value":"${BUSINESS.mapsLink}"}

Always include at least one action and two suggestions in your response.`;
}

interface ChatbotResponse {
  content: string;
  actions?: { label: string; type: string; value: string }[];
  suggestions?: string[];
  intent?: string;
}

function buildFallback(reason?: string): ChatbotResponse {
  console.warn("fallback triggered:", reason ?? "unknown");
  return {
    content:
      "I'm having a little trouble answering right now, but I'd still love to help. Please call us or send us a WhatsApp message for quick assistance. 😊",
    actions: [
      { label: "Call Now", type: "phone", value: BUSINESS.phoneIntl },
      { label: "WhatsApp", type: "whatsapp", value: BUSINESS.phoneIntl },
    ],
    suggestions: ["Are you open now?", "Where are you located?"],
    intent: "fallback",
  };
}

function safeParseResponse(raw: string): ChatbotResponse | null {
  try {
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.content === "string" && parsed.content.trim()) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, history: rawHistory } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build messages array for OpenAI-compatible API
    const messages: { role: string; content: string }[] = [
      { role: "system", content: buildSystemPrompt() },
    ];

    // Add trimmed history (last 6 turns)
    if (Array.isArray(rawHistory)) {
      const trimmed = rawHistory
        .filter(
          (m: { role?: string; content?: string }) =>
            m.content && (m.role === "user" || m.role === "assistant")
        )
        .slice(-6);

      for (const m of trimmed) {
        messages.push({ role: m.role, content: m.content });
      }
    }

    // Add the current user message
    messages.push({ role: "user", content: message });

    // Call Lovable AI Gateway
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          temperature: 0.3,
          max_tokens: 400,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify(buildFallback("rate limited")),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify(buildFallback("credits exhausted")),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("No content in AI response");
    }

    const parsed = safeParseResponse(rawContent);

    if (!parsed) {
      // If JSON parsing fails, still return the raw text as content
      return new Response(
        JSON.stringify({
          content: rawContent.trim(),
          actions: [
            { label: "Call Now", type: "phone", value: BUSINESS.phoneIntl },
            { label: "WhatsApp", type: "whatsapp", value: BUSINESS.phoneIntl },
          ],
          suggestions: ["Are you open now?", "Where are you located?"],
          intent: "fallback",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("chat error:", err.message);
    return new Response(JSON.stringify(buildFallback(err.message)), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
