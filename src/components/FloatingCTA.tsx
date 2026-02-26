import { Phone, ShoppingBag } from "lucide-react";

export default function FloatingCTA() {
  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-3 md:hidden">
      <a
        href="tel:0791224513"
        className="flex items-center gap-2 bg-gradient-fire text-primary-foreground font-display text-xs tracking-widest uppercase px-5 py-3 rounded-full shadow-amber animate-pulse-amber"
        aria-label="Call Now"
      >
        <Phone size={15} />
        Call Now
      </a>
      <a
        href="#contact"
        className="flex items-center gap-2 bg-gradient-garden text-foreground font-display text-xs tracking-widest uppercase px-5 py-3 rounded-full shadow-green"
        aria-label="Order Delivery"
      >
        <ShoppingBag size={15} />
        Order
      </a>
    </div>
  );
}
