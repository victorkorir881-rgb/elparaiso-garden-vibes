```tsx id="c4m9tx"
/**
 * ChatMessage.tsx
 * ------------------------------------------------------------------
 * Production-ready message renderer for the Elparaiso Garden Kisii chatbot
 *
 * FEATURES:
 * - User / assistant bubble styling
 * - Typing indicator animation
 * - Action buttons under assistant messages
 * - Safe external link handling
 * - Time display
 */

import type { ChatMessage as ChatMessageType, ChatAction } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Phone, MessageCircle, ExternalLink } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const timeLabel = formatTime(message.timestamp);

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
      role="listitem"
    >
      <div
        className={cn(
          "max-w-[88%] sm:max-w-[82%] rounded-3xl px-4 py-3 shadow-sm",
          "transition-all duration-200",
          isUser
            ? "bg-gradient-fire text-primary-foreground rounded-br-lg"
            : "bg-muted/70 text-foreground rounded-bl-lg border border-border/40"
        )}
      >
        {/* Message content / typing */}
        {message.isTyping ? (
          <TypingIndicator />
        ) : (
          <div className="space-y-3">
            <div
              className={cn(
                "text-sm leading-relaxed whitespace-pre-wrap break-words",
                isUser ? "text-primary-foreground" : "text-foreground"
              )}
            >
              {message.content}
            </div>

            {/* Assistant actions */}
            {!isUser && message.actions && message.actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {message.actions.map((action, index) => (
                  <ActionButton
                    key={`${action.label}-${index}`}
                    action={action}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        {!message.isTyping && (
          <div
            className={cn(
              "mt-2 text-[10px]",
              isUser
                ? "text-primary-foreground/80"
                : "text-muted-foreground"
            )}
          >
            {timeLabel}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ACTION BUTTON
// -----------------------------------------------------------------------------

function ActionButton({ action }: { action: ChatAction }) {
  const href = getActionHref(action);
  const Icon = getActionIcon(action.type);

  return (
    <a
      href={href}
      target={action.type === "link" ? "_blank" : undefined}
      rel={action.type === "link" ? "noopener noreferrer" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium",
        "border border-border/50 bg-background/80 text-foreground",
        "hover:bg-background transition-colors"
      )}
      aria-label={action.label}
    >
      <Icon size={14} />
      <span>{action.label}</span>
    </a>
  );
}

function getActionHref(action: ChatAction): string {
  switch (action.type) {
    case "phone":
      return `tel:${sanitizePhone(action.value)}`;

    case "whatsapp":
      return `https://wa.me/${sanitizePhone(action.value)}`;

    case "link":
    default:
      return action.value;
  }
}

function getActionIcon(type: ChatAction["type"]) {
  switch (type) {
    case "phone":
      return Phone;
    case "whatsapp":
      return MessageCircle;
    case "link":
    default:
      return ExternalLink;
  }
}

function sanitizePhone(value: string): string {
  // Keeps digits only, removes spaces, dashes, plus signs, etc.
  // Example: "+254 712 345 678" -> "254712345678"
  return value.replace(/[^\d]/g, "");
}

// -----------------------------------------------------------------------------
// TYPING INDICATOR
// -----------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
      <span className="sr-only">Assistant is typing</span>

      <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// TIME FORMAT
// -----------------------------------------------------------------------------

function formatTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
```
