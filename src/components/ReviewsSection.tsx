import { Star, Quote } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const reviews = [
  {
    name: "James M.",
    avatar: "JM",
    rating: 5,
    text: "Great place to unwind, enjoy some music and dance. The food and atmosphere are amazing! Definitely my go-to spot in Kisii.",
    date: "2 weeks ago",
  },
  {
    name: "Sarah W.",
    avatar: "SW",
    rating: 5,
    text: "Convenient place to have your car cleaned as you snack when in Kisii town. The choma is absolutely divine and the service is top notch.",
    date: "1 month ago",
  },
  {
    name: "Peter O.",
    avatar: "PO",
    rating: 4,
    text: "Delicious mutura and fresh food. Nice ambiance, good food, and nice music. I love the garden feel—very relaxing after a long day.",
    date: "3 weeks ago",
  },
  {
    name: "Grace A.",
    avatar: "GA",
    rating: 4,
    text: "What a hidden gem! The outdoor setting is beautiful, especially at night with all the lights. Great cocktails and the staff is very friendly.",
    date: "1 month ago",
  },
];

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= rating ? "text-amber fill-amber" : "text-muted-foreground/40 fill-muted-foreground/20"}
        />
      ))}
    </div>
  );
}

export default function ReviewsSection() {
  const [active, setActive] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActive((a) => (a + 1) % reviews.length);
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <section id="reviews" className="section-pad bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="font-display text-amber tracking-[0.3em] text-sm uppercase">What People Say</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-foreground mt-3">
            Guest <span className="text-gradient-fire">Reviews</span>
          </h2>
          <div className="w-20 h-1 bg-gradient-fire rounded-full mx-auto mt-4" />
        </div>

        {/* Overall rating */}
        <div className="flex flex-col items-center gap-2 mb-14">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-5xl text-amber">4.1</span>
            <div className="flex flex-col gap-1">
              <StarRating rating={4} size={20} />
              <span className="font-body text-sm text-muted-foreground">Based on Google Reviews</span>
            </div>
          </div>
        </div>

        {/* Desktop grid */}
        <div className="hidden md:grid grid-cols-2 gap-6">
          {reviews.map((r, i) => (
            <div
              key={i}
              className="bg-gradient-card border border-border rounded-2xl p-7 shadow-card hover:border-amber/30 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-fire flex items-center justify-center font-display font-bold text-primary-foreground text-sm">
                    {r.avatar}
                  </div>
                  <div>
                    <p className="font-display font-semibold text-foreground tracking-wide">{r.name}</p>
                    <p className="font-body text-xs text-muted-foreground">{r.date}</p>
                  </div>
                </div>
                <Quote size={20} className="text-amber/40" />
              </div>
              <StarRating rating={r.rating} />
              <p className="font-body text-muted-foreground text-sm leading-relaxed mt-3">"{r.text}"</p>
            </div>
          ))}
        </div>

        {/* Mobile carousel */}
        <div className="md:hidden">
          <div className="bg-gradient-card border border-border rounded-2xl p-7 shadow-card min-h-[200px]">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-fire flex items-center justify-center font-display font-bold text-primary-foreground text-sm">
                  {reviews[active].avatar}
                </div>
                <div>
                  <p className="font-display font-semibold text-foreground tracking-wide">{reviews[active].name}</p>
                  <p className="font-body text-xs text-muted-foreground">{reviews[active].date}</p>
                </div>
              </div>
              <Quote size={20} className="text-amber/40" />
            </div>
            <StarRating rating={reviews[active].rating} />
            <p className="font-body text-muted-foreground text-sm leading-relaxed mt-3">"{reviews[active].text}"</p>
          </div>
          {/* Dots */}
          <div className="flex justify-center gap-2 mt-5">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === active ? "bg-amber w-6" : "bg-muted-foreground/30"}`}
                aria-label={`Review ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
