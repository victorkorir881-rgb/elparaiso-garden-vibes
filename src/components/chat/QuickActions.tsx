```tsx id="qa7m2x"
/**
 * QuickActions.tsx
 * ------------------------------------------------------------------
 * Production-ready quick action chips for the Elparaiso Garden Kisii chatbot
 *
 * FEATURES:
 * - Renders top-level suggestion chips from chatbotKnowledge.ts
 * - Horizontal scroll on smaller screens
 * - Disabled state while assistant is responding
 * - Clean fallback labels if QUICK_ACTIONS is unavailable
 */

import { cn } from "@/lib/utils";
import { QUICK_ACTIONS } from "@/config/chatbotKnowledge";

interface QuickActionsProps {
  onSelect: (label: string) => void;
  disabled?: boolean;
}

const FALLBACK_ACTIONS = [
  "Opening hours",
  "Location",
  "Reserve a table",
  "View menu",
  "Contact us",
];

export default function QuickActions({
  onSelect,
  disabled = false,
}: QuickActionsProps) {
  const actions =
    Array.isArray(QUICK_ACTIONS) && QUICK_ACTIONS.length > 0
      ? QUICK_ACTIONS
      : FALLBACK_ACTIONS.map((label) => ({ label }));

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      role="group"
      aria-label="Quick actions"
    >
      {actions.map((action, index) => {
        const label = action.label;

        return (
          <button
            key={`${label}-${index}`}
            type="button"
            onClick={() => onSelect(label)}
            disabled={disabled}
            className={cn(
              "shrink-0 rounded-full px-3 py-2 text-xs font-medium transition-all duration-200",
              "border border-border/50 backdrop-blur-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-1",
              disabled
                ? "bg-muted/60 text-muted-foreground cursor-not-allowed opacity-70"
                : "bg-background/80 text-foreground hover:bg-muted hover:border-border"
            )}
            aria-label={label}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```
