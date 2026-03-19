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
        "relative w-14 h-14 rounded-full flex items-center justify-center",
        "bg-gradient-fire shadow-amber",
        "transition-all duration-300 ease-out",
        "hover:scale-110 hover:shadow-[0_0_30px_hsl(var(--amber)/0.5)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isOpen && "rotate-180 scale-105"
      )}
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full bg-gradient-fire animate-ping opacity-30",
          isOpen && "hidden"
        )}
      />

      {isOpen ? (
        <X size={22} className="text-primary-foreground transition-transform duration-300" />
      ) : (
        <MessageCircle size={22} className="text-primary-foreground" />
      )}

      {/* Unread badge */}
      {hasUnread && !isOpen && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-garden rounded-full border-2 border-background flex items-center justify-center">
          <span className="text-[8px] text-white font-bold">1</span>
        </span>
      )}
    </button>
  );
}
