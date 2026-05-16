import { useState, type ImgHTMLAttributes } from "react";
import logoUrl from "@/assets/logo.png";

export type BrandLogoSize = "nav" | "header" | "sm" | "md" | "lg" | "xl";

type Props = {
  className?: string;
  alt?: string;
  src?: string;
  eager?: boolean;
  fallbackText?: string;
  style?: ImgHTMLAttributes<HTMLImageElement>["style"];
  /**
   * Responsive size preset. Sets width/height + padding tuned for crispness
   * across mobile and desktop. Omit and pass your own classes via `className`
   * if you need a fully custom size.
   *
   * - nav      → header/navbar (compact, scales sm→md→lg breakpoints)
   * - header   → in-page section header
   * - sm/md/lg → centered page logos (login, 404, etc.)
   * - xl       → hero / install page
   */
  size?: BrandLogoSize;
};

// Each preset bundles responsive width/height + padding + fallback text size.
// Intrinsic width/height attributes are set to the largest variant to keep
// the bitmap crisp on HiDPI displays without layout shift.
const SIZE_PRESETS: Record<BrandLogoSize, { className: string; intrinsic: number }> = {
  nav:    { className: "w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 p-0.5 sm:p-1 text-xs sm:text-sm",                    intrinsic: 96 },
  header: { className: "w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 p-1 text-sm sm:text-base",                           intrinsic: 128 },
  sm:     { className: "w-12 h-12 sm:w-14 sm:h-14 p-1 text-sm",                                                         intrinsic: 128 },
  md:     { className: "w-16 h-16 sm:w-20 sm:h-20 p-1 sm:p-1.5 text-base sm:text-lg",                                   intrinsic: 192 },
  lg:     { className: "w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 p-1.5 sm:p-2 text-lg sm:text-xl md:text-2xl",         intrinsic: 256 },
  xl:     { className: "w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 p-2 text-xl sm:text-2xl md:text-3xl", intrinsic: 320 },
};

const BASE_CLASSES = "rounded-full object-contain bg-white border border-primary/20 shadow-sm shrink-0";

/**
 * Brand logo with graceful fallback. Renders a circular text badge ("EG") if
 * the image is missing or fails to load.
 *
 * Recommended: pass `size` for responsive defaults. You can still override or
 * extend with `className`.
 */
export function BrandLogo({
  className = "",
  alt = "Elparaiso Garden Kisii logo",
  src,
  eager = false,
  fallbackText = "EG",
  style,
  size,
}: Props) {
  const [failed, setFailed] = useState(false);
  const finalSrc = src ?? logoUrl;

  const preset = size ? SIZE_PRESETS[size] : undefined;
  const composed = preset
    ? `${BASE_CLASSES} ${preset.className} ${className}`.trim()
    : className;

  if (failed || !finalSrc) {
    return (
      <span
        role="img"
        aria-label={alt}
        style={style}
        className={`inline-flex items-center justify-center bg-white text-primary font-display font-bold tracking-tight select-none ${composed}`}
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
      width={preset?.intrinsic}
      height={preset?.intrinsic}
      onError={() => setFailed(true)}
      style={style}
      className={composed}
    />
  );
}

export default BrandLogo;
