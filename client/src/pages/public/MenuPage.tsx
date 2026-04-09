import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import PublicLayout from "@/components/public/PublicLayout";

const FOOD_PLACEHOLDER = "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80";

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: categories, isLoading: catsLoading } = trpc.menuCategories.list.useQuery({ activeOnly: true });
  const { data: items, isLoading: itemsLoading } = trpc.menuItems.list.useQuery({
    categoryId: activeCategory ?? undefined,
    availableOnly: true,
    search: search || undefined,
  });

  const isLoading = catsLoading || itemsLoading;

  return (
    <PublicLayout>
      {/* Header */}
      <section className="py-20 bg-card/50 border-b border-border">
        <div className="container text-center">
          <h1 className="section-title text-foreground mb-4">Our Menu</h1>
          <div className="gold-divider mx-auto mb-4" />
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From authentic Kenyan grills to cocktails and everything in between — crafted for every craving.
          </p>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container">
          {/* Search */}
          <div className="relative max-w-md mx-auto mb-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search menu items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Category Tabs */}
          {categories && categories.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mb-10">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeCategory === cat.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Items Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
                  <div className="h-48 bg-muted" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items && items.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {items.map((item) => (
                <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden card-hover">
                  <div className="relative h-48 overflow-hidden bg-muted">
                    <img
                      src={item.imageUrl ?? FOOD_PLACEHOLDER}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                    {item.badge && (
                      <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs">{item.badge}</Badge>
                    )}
                    {item.isFeatured && !item.badge && (
                      <Badge className="absolute top-3 left-3 bg-primary/80 text-primary-foreground text-xs">Featured</Badge>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground mb-1">{item.name}</h3>
                    {item.description && (
                      <p className="text-muted-foreground text-xs line-clamp-2 mb-3">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-primary font-bold text-sm">KES {Number(item.price).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">No items found.</p>
              {search && (
                <button onClick={() => setSearch("")} className="text-primary text-sm mt-2 hover:underline">
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
