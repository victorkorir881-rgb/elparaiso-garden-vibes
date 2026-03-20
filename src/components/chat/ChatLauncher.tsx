/**
 * ChatLauncher.tsx — The floating launch button for the chatbot widget.
 */

import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatLauncherProps {
  isOpen: boolean;
  hasUnread: boolean;
  onClick: () => void;
}

export default function ChatLauncher({ isOpen, hasUnread, onClick }: ChatLauncherProps) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? "Close Elparaiso Concierge" : "Open Elparaiso Concierge"}
      aria-expanded={isOpen}
      className={cn(
        // Smaller: 52×52px (w-13 h-13 not in Tailwind, use explicit size)
        "relative w-[52px] h-[52px] rounded-full flex items-center justify-center",
        "bg-gradient-fire shadow-amber",
        // Calm transitions — no looping animation
        "transition-all duration-300 ease-out",
        "hover:scale-105 hover:shadow-[0_0_20px_hsl(var(--fire-amber)/0.4)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isOpen && "rotate-90"
      )}
    >
      {/* No looping ping/pulse — removed animate-ping span entirely */}

      {isOpen ? (
        <X size={19} className="text-primary-foreground transition-transform duration-300" />
      ) : (
        <MessageCircle size={19} className="text-primary-foreground" />
      )}

      {/* Unread badge */}
      {hasUnread && !isOpen && (
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-garden rounded-full border-2 border-background flex items-center justify-center">
          <span className="text-[7px] text-white font-bold">1</span>
        </span>
      )}
    </button>
  );
}
