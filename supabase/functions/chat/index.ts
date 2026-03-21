/**
 * elparaiso ai concierge main file
 * uses gemini gemini-1.5-flash because it is cheaper and has high message ratings
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

// allow frontend to talk to this function without cors issues
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// simple types so typescript doesn't break
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

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

// all elparaiso information, acts as the brain of the bot
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

// set ai personality and ensure it outputs json
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
3. You MUST respond with valid JSON only.

RESPONSE FORMAT:
{
  "content": "Your reply",
  "intent": "hours|location|reservation|menu|contact|delivery|parking|payment|drinks|fallback",
  "actions": [{"label":"...", "type":"phone|whatsapp|link", "value":"..."}],
  "suggestions": ["question 1", "question 2"]
}

AVAILABLE ACTIONS:
- Call Now: {"label":"Call Now","type":"phone","value":"${BUSINESS.phoneIntl}"}
- WhatsApp: {"label":"WhatsApp","type":"whatsapp","value":"${BUSINESS.phoneIntl}"}
- Reserve: {"label":"Reserve a Table","type":"link","value":"${BUSINESS.reservationAnchor}"}
- Directions: {"label":"Get Directions","type":"link","value":"${BUSINESS.mapsLink}"}`;
}

// if the ai crashes or times out, show this so the user isnt stuck
function buildFallback(reason?: string): ChatbotResponse {
  console.warn("returning fallback because:", reason ?? "unknown error");
  return {
    content: "I'm having a little trouble answering right now, but I'd still love to help. Please call us or send us a WhatsApp message for quick assistance. 😊",
    actions: [
      { label: "Call Now", type: "phone", value: BUSINESS.phoneIntl },
      { label: "WhatsApp", type: "whatsapp", value: BUSINESS.phoneIntl },
    ],
    suggestions: ["Are you open now?", "Where are you located?"],
    intent: "fallback",
  };
}

// prevent gemini from adding markdowns(.md)
function safeParseResponse(raw: string): ChatbotResponse | null {
  try {
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("failed to parse ai response:", e);
    return null;
  }
}

// main entry point for the edge function
serve(async (req: Request) => {
  // handle preflight requests
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { message, history: rawHistory } = await req.json();
    
    // make sure the key is available
    const apiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    if (!apiKey) throw new Error("env key is missing");

    // setup the gemini client
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: buildSystemPrompt(),
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
      }
    });

    // grab the last 6 messages and swap 'assistant' to 'model' for gemini compatibility
    const history = (rawHistory || [])
      .filter((m: HistoryMessage) => m.content && m.role)
      .slice(-6)
      .map((m: HistoryMessage) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    // send the message to google
    const chat = model.startChat({ history });
    
    // dont let the request hang longer than 8 seconds
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const result = await chat.sendMessage(message);
    clearTimeout(timeout);

    const responseText = result.response.text();
    const parsed = safeParseResponse(responseText);

    if (!parsed) throw new Error("ai didn't return valid json");

    // ship it back to the website
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("something went wrong in the chat flow:", err.message);
    return new Response(
      JSON.stringify(buildFallback(err.message)),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
