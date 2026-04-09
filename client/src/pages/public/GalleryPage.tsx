import { useState } from "react";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import PublicLayout from "@/components/public/PublicLayout";

const CATEGORIES = ["All", "Food & Drinks", "Ambience", "Outdoor Seating", "Night Vibes", "Events", "Bar Area"];

export default function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data: images, isLoading } = trpc.gallery.list.useQuery({
    category: activeCategory !== "All" ? activeCategory : undefined,
  });

  return (
    <PublicLayout>
      <section className="py-20 bg-card/50 border-b border-border">
        <div className="container text-center">
          <h1 className="section-title text-foreground mb-4">Gallery</h1>
          <div className="gold-divider mx-auto mb-4" />
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            A glimpse into the Elparaiso experience — food, vibes, and unforgettable moments.
          </p>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden bg-muted animate-pulse" style={{ height: `${150 + (i % 3) * 80}px` }} />
              ))}
            </div>
          ) : images && images.length > 0 ? (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="rounded-xl overflow-hidden cursor-pointer break-inside-avoid"
                  onClick={() => setLightbox(img.imageUrl)}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.altText ?? "Elparaiso Gallery"}
                    className="w-full object-cover hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No gallery images yet. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightbox}
            alt="Gallery"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </PublicLayout>
  );
}
