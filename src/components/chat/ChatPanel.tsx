```tsx id="9k2tpf"
/**
 * ChatPanel.tsx
 * ------------------------------------------------------------------
 * Production-ready floating chatbot panel for Elparaiso Garden Kisii
 *
 * FEATURES:
 * - Welcome message on first load
 * - LocalStorage persistence (no backend required)
 * - Quick action chips
 * - Typing indicator support
 * - Prevents stale history bug when sending messages
 * - Clean scroll-to-bottom behavior
 * - Works with upgraded chatbotService.ts
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Minus, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import ChatMessage from "./ChatMessage";
import QuickActions from "./QuickActions";
import { sendChatMessage, getWelcomeMessage } from "@/services/chatbotService";
import type { ChatMessage as ChatMessageType } from "@/types/chat";
import { v4 as uuidv4 } from "@/lib/uuid";

interface ChatPanelProps {
  onClose: () => void;
  onMinimize: () => void;
  isVisible: boolean;
}

const STORAGE_KEY = "elparaiso-chat-history";

export default function ChatPanel({
  onClose,
  onMinimize,
  isVisible,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasInitializedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------------------------------
  // Load from localStorage if available; otherwise seed welcome message once.

  useEffect(() => {
    if (hasInitializedRef.current) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessageType[];

        if (Array.isArray(parsed) && parsed.length > 0) {
          const hydrated = parsed.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));

          setMessages(hydrated);
          hasInitializedRef.current = true;
          return;
        }
      }
    } catch (error) {
      console.warn("Failed to load chat history:", error);
    }

    // No saved history -> show welcome message
    const welcome = getWelcomeMessage();

    const welcomeMessage: ChatMessageType = {
      id: uuidv4(),
      role: "assistant",
      content: welcome.content,
      timestamp: new Date(),
      actions: welcome.actions ?? [],
    };

    setMessages([welcomeMessage]);
    hasInitializedRef.current = true;
  }, []);

  // ---------------------------------------------------------------------------
  // PERSIST TO LOCAL STORAGE
  // ---------------------------------------------------------------------------
  // Do not store temporary typing indicators.

  const persistableMessages = useMemo(
    () => messages.filter((m) => !m.isTyping),
    [messages]
  );

  useEffect(() => {
    if (!hasInitializedRef.current) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistableMessages));
    } catch (error) {
      console.warn("Failed to save chat history:", error);
    }
  }, [persistableMessages]);

  // ---------------------------------------------------------------------------
  // AUTO SCROLL
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isVisible) return;

    const id = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });

    return () => cancelAnimationFrame(id);
  }, [messages, isVisible]);

  // ---------------------------------------------------------------------------
  // FOCUS INPUT WHEN OPEN
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isVisible) return;

    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 180);

    return () => clearTimeout(t);
  }, [isVisible]);

  // ---------------------------------------------------------------------------
  // SEND MESSAGE
  // ---------------------------------------------------------------------------

  async function handleSend(rawText?: string) {
    const text = (rawText ?? input).trim();

    if (!text || isThinking) return;

    const userMsg: ChatMessageType = {
      id: uuidv4(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const typingMsg: ChatMessageType = {
      id: "typing",
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isTyping: true,
    };

    // IMPORTANT:
    // Build request history BEFORE setState to avoid stale React state issues.
    const historyForRequest = [...messages.filter((m) => !m.isTyping), userMsg];

    setMessages((prev) => [...prev.filter((m) => !m.isTyping), userMsg, typingMsg]);
    setInput("");
    setIsThinking(true);

    try {
      const response = await sendChatMessage(text, historyForRequest);

      const assistantMsg: ChatMessageType = {
        id: uuidv4(),
        role: "assistant",
        content: response.content,
        timestamp: new Date(),
        actions: response.actions ?? [],
      };

      setMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        assistantMsg,
      ]);
    } catch (error) {
      console.error("Chat send failed:", error);

      const errorMsg: ChatMessageType = {
        id: uuidv4(),
        role: "assistant",
        content:
          "Sorry — I’m having a little trouble right now. Please try again, or contact us directly for immediate help. 😊",
        timestamp: new Date(),
        actions: [],
      };

      setMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        errorMsg,
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  // ---------------------------------------------------------------------------
  // QUICK ACTION HANDLER
  // ---------------------------------------------------------------------------

  function handleQuickAction(label: string) {
    if (isThinking) return;
    void handleSend(label);
  }

  // ---------------------------------------------------------------------------
  // ENTER TO SEND
  // ---------------------------------------------------------------------------
  // Enter = send
  // Shift+Enter = newline

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  // ---------------------------------------------------------------------------
  // OPTIONAL: CLEAR CHAT (not shown in UI currently, but useful later)
  // ---------------------------------------------------------------------------

  function resetChat() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to clear chat history:", error);
    }

    const welcome = getWelcomeMessage();

    const welcomeMessage: ChatMessageType = {
      id: uuidv4(),
      role: "assistant",
      content: welcome.content,
      timestamp: new Date(),
      actions: welcome.actions ?? [],
    };

    setMessages([welcomeMessage]);
    setInput("");
    setIsThinking(false);
  }

  // Silence unused warning if you don't expose reset yet
  void resetChat;

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div
      className={cn(
        "h-full w-full rounded-3xl border border-border/70 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden",
        "flex flex-col"
      )}
      role="dialog"
      aria-label="Elparaiso Garden chat assistant"
      aria-modal="false"
    >
      {/* HEADER */}
      <div className="shrink-0 px-4 py-3 border-b border-border/60 bg-charcoal/70 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-garden flex items-center justify-center shadow-sm shrink-0">
              <span className="text-base">🌿</span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  Elparaiso Assistant
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Online
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Ask about hours, reservations, location & more
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onMinimize}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
              aria-label="Minimize chat"
              type="button"
            >
              <Minus size={16} />
            </button>

            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
              aria-label="Close chat"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-border/40 bg-background/60">
        <QuickActions onSelect={handleQuickAction} disabled={isThinking} />
      </div>

      {/* MESSAGES */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
        role="list"
        aria-label="Chat messages"
      >
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="shrink-0 border-t border-border/60 bg-background/80 backdrop-blur-md p-3">
        <div className="rounded-2xl border border-border/60 bg-charcoal/60 p-2">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={500}
              placeholder="Ask about reservations, location, hours..."
              className={cn(
                "flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground/70",
                "focus:outline-none max-h-28 overflow-y-auto"
              )}
              aria-label="Type your message"
              disabled={isThinking}
            />

            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isThinking}
              className={cn(
                "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-1",
                input.trim() && !isThinking
                  ? "bg-gradient-fire text-primary-foreground shadow-amber hover:opacity-90"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-70"
              )}
              aria-label="Send message"
              type="button"
            >
              {isThinking ? <Sparkles size={16} className="animate-pulse" /> : <Send size={16} />}
            </button>
          </div>
        </div>

        <p className="mt-2 px-1 text-[10px] text-muted-foreground/70">
          For urgent help, call or WhatsApp the restaurant directly.
        </p>
      </div>
    </div>
  );
}
```
