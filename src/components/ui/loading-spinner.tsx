import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible loading indicator. Wraps a Lucide spinner inside a live region
 * so assistive tech announces the loading state and a screen-reader-only
 * label is always present.
 *
 * Phase 8.5 — replaces bare `<Loader2 className="animate-spin" />` usages
 * on public pages so loading is announced to screen readers.
 */
export function LoadingSpinner({
  label = "Loading",
  className,
  iconClassName,
}: {
  label?: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("inline-flex items-center justify-center", className)}
    >
      <Loader2
        aria-hidden="true"
        className={cn("w-5 h-5 animate-spin text-primary", iconClassName)}
      />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
