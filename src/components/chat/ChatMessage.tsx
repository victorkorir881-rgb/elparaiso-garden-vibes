/**
 * ChatMessage.tsx — Renders a single chat message bubble.
 *
 * Supports:
 *  - User / assistant role styling
 *  - Markdown-lite rendering (bold, line breaks, bullet lists)
 *  - Typing indicator animation
 *  - Inline CTA action buttons
 */

import { ChatMessage as ChatMessageType, ChatAction } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Phone, MessageCircle, MapPin, CalendarCheck } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
}

// ─── Markdown-lite renderer ────────────────────────────────────────────────────

function renderContent(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Bold: **text**
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? (
        <strong key={j} className="font-semibold text-amber">
          {part}
        </strong>
      ) : (
        <span key={j}>{part}</span>
      )
    );

    const isListItem = line.trimStart().startsWith("•") || line.trimStart().startsWith("-");

    return (
      <span
        key={i}
        className={cn(
          "block",
          isListItem && "pl-1",
          i > 0 && !isListItem && line.trim() === "" && "mt-1.5",
          isListItem && "mt-0.5"
        )}
      >
        {rendered}
        {i < lines.length - 1 && line.trim() === "" && null}
      </span>
    );
  });
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionButton({ action }: { action: ChatAction }) {
  const iconMap: Record<string, React.ReactNode> = {
    "Call": <Phone size={12} />,
    "WhatsApp": <MessageCircle size={12} />,
    "Directions": <MapPin size={12} />,
    "Reserve": <CalendarCheck size={12} />,
    "Get Directions": <MapPin size={12} />,
  };

  const icon = Object.entries(iconMap).find(([key]) =>
    action.label.includes(key)
  )?.[1];

  const handleClick = () => {
    if (action.href) {
      window.open(action.href, action.href.startsWith("tel:") ? "_self" : "_blank", "noopener,noreferrer");
    } else if (action.scrollTo) {
      const el = document.getElementById(action.scrollTo);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-1",
        action.variant === "primary"
          ? "bg-gradient-fire text-primary-foreground shadow-amber hover:opacity-90"
          : "border border-amber/40 text-amber hover:bg-amber/10"
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {action.label}
    </button>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-amber/60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isTyping = message.isTyping;

  return (
    <div
      className={cn(
        "flex w-full animate-fade-in",
        isUser ? "justify-end" : "justify-start"
      )}
      role="listitem"
    >
      {/* Bot avatar */}
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-garden flex items-center justify-center text-sm mr-2 mt-0.5 shadow-sm">
          🌿
        </div>
      )}

      <div className={cn("max-w-[82%] flex flex-col gap-2", isUser && "items-end")}>
        {/* Bubble */}
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-gradient-fire text-primary-foreground rounded-br-sm shadow-amber"
              : "bg-charcoal/80 border border-border/60 text-foreground rounded-bl-sm backdrop-blur-sm"
          )}
        >
          {isTyping ? (
            <TypingIndicator />
          ) : (
            <div className="space-y-0.5">{renderContent(message.content)}</div>
          )}
        </div>

        {/* Inline CTA actions */}
        {!isUser && !isTyping && message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {message.actions.map((action, i) => (
              <ActionButton key={i} action={action} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        {!isTyping && (
          <span className="text-[10px] text-muted-foreground/60 px-1">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
