import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReviews } from "@/lib/supabase-hooks";

export default function TestimonialsCarousel() {
  const { data: testimonials = [] } = useReviews(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!autoPlay || testimonials.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPlay, testimonials.length]);

  if (testimonials.length === 0) return null;

  const current = testimonials[currentIndex] as {
    author_name?: string | null;
    comment?: string | null;
    rating?: number | null;
    source?: string | null;
  };

  const goToPrevious = () => {
    setAutoPlay(false);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    setTimeout(() => setAutoPlay(true), 8000);
  };

  const goToNext = () => {
    setAutoPlay(false);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    setTimeout(() => setAutoPlay(true), 8000);
  };

  return (
    <section className="py-16 md:py-24 bg-card border-t border-b border-border">
      <div className="container">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
              What Our Guests Say
            </h2>
            <p className="text-muted-foreground">
              Real reviews from real customers who love Elparaiso Garden
            </p>
          </div>

          <div className="relative bg-background rounded-lg border border-border p-8 md:p-12">
            <div className="mb-8">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: current.rating ?? 5 }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                ))}
              </div>

              <blockquote className="text-lg md:text-xl text-foreground mb-6 italic">
                &quot;{current.comment ?? ""}&quot;
              </blockquote>

              <div>
                <p className="font-semibold text-foreground">{current.author_name ?? "Guest"}</p>
                <p className="text-sm text-muted-foreground">{current.source || "Google"}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={goToPrevious} className="rounded-full">
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex gap-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setAutoPlay(false);
                      setCurrentIndex(i);
                      setTimeout(() => setAutoPlay(true), 8000);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentIndex ? "bg-primary w-6" : "bg-border"
                    }`}
                    aria-label={`Go to testimonial ${i + 1}`}
                  />
                ))}
              </div>

              <Button variant="outline" size="icon" onClick={goToNext} className="rounded-full">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-4">
              {currentIndex + 1} / {testimonials.length}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
