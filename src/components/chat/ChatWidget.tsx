/**
 * ChatWidget.tsx — Root orchestrator for the floating chatbot widget.
 *
 * Manages open/closed/minimized state and positions the launcher + panel
 * without disrupting any existing page layout.
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import ChatLauncher from "./ChatLauncher";
import ChatPanel from "./ChatPanel";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  // Show unread badge for 8 s on first load to invite engagement
  useEffect(() => {
    const t = setTimeout(() => setHasUnread(false), 8000);
    return () => clearTimeout(t);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setHasUnread(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    setIsOpen(false);
  };

  const handleLauncherClick = () => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  };

  return (
    <>
      {/* ── Chat Panel ── */}
      <div
        aria-hidden={!isOpen}
        className={cn(
          // Fixed position, above everything
          "fixed z-[9998]",
          // Desktop: bottom-right anchored panel
          "bottom-24 right-4 sm:right-6",
          // Sizing
          "w-[calc(100vw-2rem)] max-w-[400px]",
          // Height: taller on desktop, constrained on mobile
          "h-[min(600px,calc(100vh-8rem))]",
          // Transition
          "transition-all duration-300 ease-out origin-bottom-right",
          isOpen && !isMinimized
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        <ChatPanel
          onClose={handleClose}
          onMinimize={handleMinimize}
          isVisible={isOpen && !isMinimized}
        />
      </div>

      {/* ── Launcher ── */}
      <div
        className={cn(
          "fixed z-[9999]",
          "bottom-5 right-4 sm:right-5"
        )}
      >
        <ChatLauncher
          isOpen={isOpen}
          hasUnread={hasUnread}
          onClick={handleLauncherClick}
        />
      </div>
    </>
  );
}
