import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function TestimonialsCarousel() {
  const { data: testimonials = [] } = trpc.testimonials.list.useQuery({ featuredOnly: true });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  // Auto-rotate testimonials every 5 seconds
  useEffect(() => {
    if (!autoPlay || testimonials.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPlay, testimonials.length]);

  if (testimonials.length === 0) {
    return null;
  }

  const current = testimonials[currentIndex];

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
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
              What Our Guests Say
            </h2>
            <p className="text-muted-foreground">
              Real reviews from real customers who love Elparaiso Garden
            </p>
          </div>

          {/* Carousel */}
          <div className="relative bg-background rounded-lg border border-border p-8 md:p-12">
            {/* Testimonial Content */}
            <div className="mb-8">
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: current.rating }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                ))}
              </div>

              {/* Review Text */}
              <blockquote className="text-lg md:text-xl text-foreground mb-6 italic">
                &quot;{current.reviewText}&quot;
              </blockquote>

              {/* Reviewer Info */}
              <div>
                <p className="font-semibold text-foreground">{current.reviewerName}</p>
                <p className="text-sm text-muted-foreground">{current.sourceLabel || "Google"}</p>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPrevious}
                className="rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {/* Dots */}
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

              <Button
                variant="outline"
                size="icon"
                onClick={goToNext}
                className="rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Counter */}
            <p className="text-center text-xs text-muted-foreground mt-4">
              {currentIndex + 1} / {testimonials.length}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
