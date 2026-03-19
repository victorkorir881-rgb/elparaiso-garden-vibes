/**
 * QuickActions.tsx — Horizontal scrolling quick-action chips.
 */

import { QUICK_ACTIONS } from "@/config/chatbotKnowledge";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  onSelect: (label: string) => void;
  disabled?: boolean;
}

export default function QuickActions({ onSelect, disabled }: QuickActionsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      role="group"
      aria-label="Quick questions"
    >
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          onClick={() => onSelect(action.label)}
          disabled={disabled}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
            "border-amber/30 text-amber/90 bg-amber/5 hover:bg-amber/15 hover:border-amber/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-1",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
