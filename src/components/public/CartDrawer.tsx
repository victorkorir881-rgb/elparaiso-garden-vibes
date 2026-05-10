import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCart } from "@/contexts/CartContext";

const PLACEHOLDER = "https://images.unsplash.com/photo-1544025162-d76694265947?w=200&q=70";

export default function CartDrawer() {
  const { items, isOpen, setOpen, updateQuantity, removeItem, clearCart, total, itemCount } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col bg-background border-l border-border"
      >
        <SheetHeader className="px-5 py-4 border-b border-border flex-row items-center justify-between space-y-0">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Your Cart
            {itemCount > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({itemCount} {itemCount === 1 ? "item" : "items"})
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Your cart is empty</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Browse our menu and add your favourite dishes.
            </p>
            <Link to="/menu" onClick={() => setOpen(false)}>
              <Button className="rounded-full">Browse Menu</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((item) => {
                const lineTotal = parseFloat(item.price) * item.quantity;
                return (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
                      <img
                        src={item.imageUrl || PLACEHOLDER}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                          {item.name}
                        </h4>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 -m-1 shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        KES {parseFloat(item.price).toLocaleString()} each
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="inline-flex items-center border border-border rounded-full overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center text-sm font-medium tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          KES {lineTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={clearCart}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1.5 pt-2"
              >
                <Trash2 className="w-3 h-3" /> Clear cart
              </button>
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-card/30 px-5 py-4 space-y-3 shrink-0">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">KES {parseFloat(total).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Delivery</span>
                <span>Calculated at checkout</span>
              </div>
              <Separator />
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-medium text-foreground">Total</span>
                <span className="text-xl font-bold text-primary tabular-nums">
                  KES {parseFloat(total).toLocaleString()}
                </span>
              </div>
              <Link to="/order" onClick={() => setOpen(false)} className="block">
                <Button
                  className="w-full rounded-full font-medium"
                  size="lg"
                  style={{
                    background: "var(--gradient-gold)",
                    color: "var(--primary-foreground)",
                    boxShadow: "var(--shadow-gold)",
                  }}
                >
                  Checkout <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
              <p className="text-[11px] text-muted-foreground text-center">
                Secure M-Pesa checkout · Order confirmed after payment
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
