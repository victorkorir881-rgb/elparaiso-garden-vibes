import { useState, type ImgHTMLAttributes } from "react";
import logoUrl from "@/assets/logo.png";

type Props = {
  className?: string;
  alt?: string;
  src?: string;
  eager?: boolean;
  fallbackText?: string;
  style?: ImgHTMLAttributes<HTMLImageElement>["style"];
};

/**
 * Brand logo with graceful fallback. Renders a circular text badge ("EG") if the
 * image is missing or fails to load. Pass sizing/shape via `className` exactly as
 * you would on a normal <img> (e.g. "w-20 h-20 rounded-full object-contain ...").
 */
export function BrandLogo({
  className = "",
  alt = "Elparaiso Garden Kisii logo",
  src,
  eager = false,
  fallbackText = "EG",
  style,
}: Props) {
  const [failed, setFailed] = useState(false);
  const finalSrc = src ?? logoUrl;

  if (failed || !finalSrc) {
    return (
      <span
        role="img"
        aria-label={alt}
        style={style}
        className={`inline-flex items-center justify-center bg-white text-primary font-display font-bold tracking-tight select-none ${className}`}
      >
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      src={finalSrc}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      style={style}
      className={className}
    />
  );
}

export default BrandLogo;
