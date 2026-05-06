import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface Props {
  count: number;
  onClear: () => void;
  children: ReactNode;
}

export function BulkActionBar({ count, onClear, children }: Props) {
  if (count === 0) return null;
  return (
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 backdrop-blur px-4 py-2 shadow-lg">
      <span className="text-sm font-medium text-foreground">{count} selected</span>
      <div className="ml-auto flex items-center gap-2">
        {children}
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={onClear}>
          <X className="w-4 h-4 mr-1" /> Clear
        </Button>
      </div>
    </div>
  );
}
