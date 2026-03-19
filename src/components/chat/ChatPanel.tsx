/**
 * ChatPanel.tsx — The main expandable chat interface.
 *
 * Manages:
 *  - Message state and history
 *  - localStorage persistence
 *  - Sending messages via chatbotService
 *  - Typing indicator lifecycle
 *  - Auto-scroll to latest message
 *  - Keyboard accessibility (ESC to close, Enter to send)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Minimize2, Send, Sparkles } from "lucide-react";
import { ChatMessage as ChatMessageType } from "@/types/chat";
import { sendChatMessage } from "@/services/chatbotService";
import { CHATBOT_CONFIG } from "@/config/chatbotConfig";
import { WELCOME_MESSAGE } from "@/config/chatbotKnowledge";
import { v4 as uuidv4 } from "@/lib/uuid";
import { cn } from "@/lib/utils";
import ChatMessageBubble from "./ChatMessage";
import QuickActions from "./QuickActions";

interface ChatPanelProps {
  onClose: () => void;
  onMinimize: () => void;
  isVisible: boolean;
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadPersistedMessages(): ChatMessageType[] {
  try {
    const raw = localStorage.getItem(CHATBOT_CONFIG.messageHistoryKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<
      Omit<ChatMessageType, "timestamp"> & { timestamp: string }
    >;
    return parsed
      .slice(-CHATBOT_CONFIG.maxPersistedMessages)
      .map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function persistMessages(messages: ChatMessageType[]) {
  try {
    localStorage.setItem(
      CHATBOT_CONFIG.messageHistoryKey,
      JSON.stringify(messages.slice(-CHATBOT_CONFIG.maxPersistedMessages))
    );
  } catch {
    /* silent */
  }
}

function buildWelcome(): ChatMessageType {
  return {
    id: "welcome",
    role: "assistant",
    content: WELCOME_MESSAGE,
    timestamp: new Date(),
    actions: [],
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatPanel({ onClose, onMinimize, isVisible }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>(() => {
    const persisted = loadPersistedMessages();
    return persisted.length > 0 ? persisted : [buildWelcome()];
  });
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(() => {
    return loadPersistedMessages().length === 0;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist messages on change
  useEffect(() => {
    const toSave = messages.filter((m) => !m.isTyping);
    persistMessages(toSave);
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isVisible) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isVisible]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVisible) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isVisible, onClose]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      setShowQuickActions(false);
      setInput("");

      // Add user message
      const userMsg: ChatMessageType = {
        id: uuidv4(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      // Add typing indicator
      const typingMsg: ChatMessageType = {
        id: "typing",
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isTyping: true,
      };

      setMessages((prev) => [...prev, userMsg, typingMsg]);
      setIsThinking(true);

      try {
        const response = await sendChatMessage(trimmed, messages);

        const botMsg: ChatMessageType = {
          id: uuidv4(),
          role: "assistant",
          content: response.content,
          timestamp: new Date(),
          intent: response.intent,
          actions: response.actions,
        };

        setMessages((prev) =>
          prev.filter((m) => m.id !== "typing").concat(botMsg)
        );
      } catch {
        const errorMsg: ChatMessageType = {
          id: uuidv4(),
          role: "assistant",
          content:
            "Sorry, something went wrong. Please call us on **0791 224513** or message on WhatsApp.",
          timestamp: new Date(),
          actions: [
            { label: "Call Now", href: "tel:0791224513", variant: "primary" },
            {
              label: "WhatsApp",
              href: "https://wa.me/254791224513",
              variant: "secondary",
            },
          ],
        };
        setMessages((prev) =>
          prev.filter((m) => m.id !== "typing").concat(errorMsg)
        );
      } finally {
        setIsThinking(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [isThinking, messages]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Elparaiso Concierge chat"
      aria-modal="true"
      className={cn(
        "flex flex-col w-full h-full",
        "bg-background/95 backdrop-blur-xl",
        "rounded-2xl border border-border/60",
        "shadow-[0_8px_60px_-10px_rgba(0,0,0,0.7)]",
        "overflow-hidden"
      )}
    >
      {/* ── Header ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-charcoal/90 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-full bg-gradient-garden flex items-center justify-center shadow-sm shrink-0">
            <span className="text-lg">🌿</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-garden rounded-full border-2 border-charcoal" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-foreground tracking-wide leading-tight">
              Elparaiso Concierge
            </p>
            <p className="text-[10px] text-garden-light/80 leading-tight flex items-center gap-1">
              <Sparkles size={9} className="text-amber" />
              Always open · 24/7
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            aria-label="Minimize chat"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber"
          >
            <Minimize2 size={15} />
          </button>
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-border/50"
        role="list"
        aria-label="Chat messages"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Actions ── */}
      {showQuickActions && (
        <div className="shrink-0 px-4 py-2 border-t border-border/40 bg-charcoal/30">
          <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">
            Quick questions
          </p>
          <QuickActions
            onSelect={handleSend}
            disabled={isThinking}
          />
        </div>
      )}

      {/* ── Input ── */}
      <div className="shrink-0 px-3 py-3 bg-charcoal/50 border-t border-border/50">
        <div className="flex items-center gap-2 bg-background/60 border border-border/60 rounded-xl px-3 py-2 focus-within:border-amber/60 focus-within:shadow-[0_0_0_1px_hsl(var(--amber)/0.2)] transition-all">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isThinking}
            placeholder={isThinking ? "Elparaiso is typing..." : "Ask me anything…"}
            aria-label="Type your message"
            className={cn(
              "flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isThinking}
            aria-label="Send message"
            className={cn(
              "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-1",
              input.trim() && !isThinking
                ? "bg-gradient-fire text-primary-foreground shadow-amber hover:opacity-90"
                : "bg-border/40 text-muted-foreground cursor-not-allowed"
            )}
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/40 text-center mt-1.5">
          Elparaiso Garden Kisii · 24/7 Support
        </p>
      </div>
    </div>
  );
}
