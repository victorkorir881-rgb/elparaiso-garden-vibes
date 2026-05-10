import { useMemo, useState } from "react";
import { Search, Plus, Minus, Sparkles, ShoppingBag, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMenuCategories, useMenuItems } from "@/lib/supabase-hooks";
import { useCart } from "@/contexts/CartContext";
import PublicLayout from "@/components/public/PublicLayout";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FOOD_PLACEHOLDER =
  "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80";

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: categories, isLoading: catsLoading } = useMenuCategories(true);
  const { data: items, isLoading: itemsLoading } = useMenuItems({
    categoryId: activeCategory ?? undefined,
    availableOnly: true,
    search: search || undefined,
  });

  const { items: cartItems, addItem, updateQuantity, openCart, itemCount } = useCart();

  const cartQtyById = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of cartItems) map.set(i.id, i.quantity);
    return map;
  }, [cartItems]);

  const isLoading = catsLoading || itemsLoading;

  const handleAdd = (item: any) => {
    addItem({
      id: item.id,
      categoryId: item.category_id,
      name: item.name,
      price: String(item.price),
      imageUrl: item.image_url,
    });
    toast.success(`${item.name} added to cart`, {
      action: { label: "View", onClick: () => openCart() },
    });
  };

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative pt-12 pb-10 md:pt-20 md:pb-14 border-b border-border overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 0%, oklch(74% 0.11 75 / 0.15), transparent 70%)",
          }}
        />
        <div className="container text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            <Sparkles className="w-3 h-3" />
            Crafted with care
          </div>
          <h1 className="section-title text-foreground mb-4">Our Menu</h1>
          <div className="gold-divider mx-auto mb-5" />
          <p className="text-muted-foreground text-base md:text-lg">
            Authentic Kenyan grills, signature cocktails and everything in between.
            Add what you love — checkout when you're ready.
          </p>
        </div>
      </section>

      {/* Sticky filter bar */}
      <div className="sticky top-16 md:top-20 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container py-3 md:py-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search dishes, drinks…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-9 bg-card border-border h-10 rounded-full"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {itemCount > 0 && (
              <Button
                onClick={openCart}
                className="rounded-full hidden sm:inline-flex"
                size="sm"
                style={{
                  background: "var(--gradient-gold)",
                  color: "var(--primary-foreground)",
                }}
              >
                <ShoppingBag className="w-4 h-4 mr-1.5" />
                {itemCount} in cart
              </Button>
            )}
          </div>

          {categories && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
              <CategoryPill
                active={activeCategory === null}
                onClick={() => setActiveCategory(null)}
              >
                All
              </CategoryPill>
              {categories.map((cat) => (
                <CategoryPill
                  key={cat.id}
                  active={activeCategory === cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.name}
                </CategoryPill>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <section className="py-8 md:py-12 bg-background">
        <div className="container">
          {isLoading ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label="Loading menu items"
            >
              <span className="sr-only">Loading menu…</span>
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-muted" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-9 bg-muted rounded-full mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : items && items.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {items.map((item) => {
                const inCart = cartQtyById.get(item.id) ?? 0;
                const price = parseFloat(String(item.price));
                return (
                  <article
                    key={item.id}
                    className="group bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-primary/40 transition-colors"
                    style={{ boxShadow: "var(--shadow-soft)" }}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      <img
                        src={item.image_url ?? FOOD_PLACEHOLDER}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent"
                      />
                      {item.is_featured && (
                        <Badge
                          className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-wider border-0 text-primary-foreground"
                          style={{ background: "var(--gradient-gold)" }}
                        >
                          ★ Featured
                        </Badge>
                      )}
                      {inCart > 0 && (
                        <div className="absolute top-3 right-3 min-w-6 h-6 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center tabular-nums">
                          {inCart}
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-foreground leading-snug line-clamp-1">
                          {item.name}
                        </h3>
                        <span className="text-primary font-bold text-sm shrink-0 tabular-nums">
                          KES {price.toLocaleString()}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-muted-foreground text-xs line-clamp-2 mb-4 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-auto">
                        {inCart === 0 ? (
                          <Button
                            onClick={() => handleAdd(item)}
                            size="sm"
                            className="w-full rounded-full font-medium"
                            variant="outline"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add to Cart
                          </Button>
                        ) : (
                          <div className="flex items-center justify-between border border-primary/40 rounded-full bg-primary/5 px-1.5 py-1">
                            <button
                              onClick={() => updateQuantity(item.id, inCart - 1)}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-foreground hover:bg-accent transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-sm font-semibold tabular-nums">
                              {inCart} in cart
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, inCart + 1)}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-primary-foreground transition-colors"
                              style={{ background: "var(--gradient-gold)" }}
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No matches found</h3>
              <p className="text-muted-foreground text-sm">
                Try a different search or category.
              </p>
              {(search || activeCategory) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-full"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory(null);
                  }}
                >
                  Reset filters
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Mobile sticky cart bar */}
      {itemCount > 0 && (
        <div className="md:hidden sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md p-3">
          <Button
            onClick={openCart}
            className="w-full rounded-full font-medium"
            size="lg"
            style={{
              background: "var(--gradient-gold)",
              color: "var(--primary-foreground)",
              boxShadow: "var(--shadow-gold)",
            }}
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            View Cart ({itemCount})
          </Button>
        </div>
      )}
    </PublicLayout>
  );
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
      )}
    >
      {children}
    </button>
  );
}
