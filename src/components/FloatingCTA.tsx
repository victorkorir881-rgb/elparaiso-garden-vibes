import { Phone, ShoppingBag } from "lucide-react";
import { SITE_CONFIG } from "@/config/siteConfig";

export default function FloatingCTA() {
  return (
    // Offset right so the chatbot launcher has room.
    // On mobile: shift left of chatbot button. On desktop: hidden.
    <div className="fixed bottom-5 right-[4.25rem] sm:right-20 z-50 flex flex-col gap-2 md:hidden">
      <a
        href={SITE_CONFIG.contact.phoneTelHref}
        className="flex items-center gap-1.5 bg-gradient-fire text-primary-foreground font-display text-[11px] tracking-widest uppercase px-4 py-2.5 rounded-full shadow-amber transition-shadow duration-300 hover:shadow-[0_0_20px_hsl(var(--fire-amber)/0.5)]"
        aria-label={`Call ${SITE_CONFIG.contact.phoneDisplay}`}
      >
        <Phone size={14} />
        Call Now
      </a>
      <a
        href="#contact"
        className="flex items-center gap-1.5 bg-gradient-garden text-foreground font-display text-[11px] tracking-widest uppercase px-4 py-2.5 rounded-full shadow-green transition-shadow duration-300 hover:shadow-[0_0_18px_hsl(var(--garden-green)/0.4)]"
        aria-label="Make a reservation"
      >
        <ShoppingBag size={14} />
        Reserve
      </a>
    </div>
  );
}
