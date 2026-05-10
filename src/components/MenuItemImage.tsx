import { useState, type ImgHTMLAttributes } from "react";
import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItemImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  src?: string | null;
  alt: string;
};

export function MenuItemImage({ src, alt, className, onError, ...props }: MenuItemImageProps) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        onError={(event) => {
          setFailed(true);
          onError?.(event);
        }}
        {...props}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${alt} image not set`}
      className={cn("flex items-center justify-center bg-muted text-muted-foreground/40", className)}
    >
      <UtensilsCrossed className="h-1/2 w-1/2 max-h-8 max-w-8" aria-hidden="true" />
    </div>
  );
}