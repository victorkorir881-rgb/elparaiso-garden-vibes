import { useEffect, useRef, useState, type RefObject } from "react";

interface ScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: ScrollAnimationOptions = {}
): [RefObject<T>, boolean] {
  const { threshold = 0.15, rootMargin = "0px 0px -60px 0px", once = true } = options;
  const ref = useRef<T>(null!);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, isVisible];
}

/** Wrapper component for scroll-triggered animations */
import React from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  animation?: "fade-up" | "fade-down" | "fade-left" | "fade-right" | "scale" | "fade";
  delay?: number;
  duration?: number;
  once?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

export function ScrollReveal({
  children,
  className = "",
  animation = "fade-up",
  delay = 0,
  duration = 600,
  once = true,
  as: Tag = "div",
}: ScrollRevealProps) {
  const [ref, isVisible] = useScrollAnimation<HTMLDivElement>({ once });

  const baseStyle: React.CSSProperties = {
    transitionProperty: "opacity, transform",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    transitionDelay: `${delay}ms`,
  };

  const hiddenStyles: Record<string, React.CSSProperties> = {
    "fade-up": { opacity: 0, transform: "translateY(40px)" },
    "fade-down": { opacity: 0, transform: "translateY(-40px)" },
    "fade-left": { opacity: 0, transform: "translateX(-40px)" },
    "fade-right": { opacity: 0, transform: "translateX(40px)" },
    scale: { opacity: 0, transform: "scale(0.92)" },
    fade: { opacity: 0, transform: "none" },
  };

  const visibleStyle: React.CSSProperties = { opacity: 1, transform: "none" };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...baseStyle,
        ...(isVisible ? visibleStyle : hiddenStyles[animation]),
      }}
    >
      {children}
    </div>
  );
}
