import { Phone, ShoppingBag } from "lucide-react";
import { SITE_CONFIG } from "@/config/siteConfig";

export default function FloatingCTA() {
  return (
    // Offset right so the chatbot launcher (bottom-6 right-4) has room.
    // On mobile: shift left of chatbot button (right-20). On desktop: hidden.
    <div className="fixed bottom-6 right-20 sm:right-24 z-50 flex flex-col gap-3 md:hidden">
      <a
        href={SITE_CONFIG.contact.phoneTelHref}
        className="flex items-center gap-2 bg-gradient-fire text-primary-foreground font-display text-xs tracking-widest uppercase px-5 py-3 rounded-full shadow-amber animate-pulse-amber"
        aria-label={`Call ${SITE_CONFIG.contact.phoneDisplay}`}
      >
        <Phone size={15} />
        Call Now
      </a>
      <a
        href="#contact"
        className="flex items-center gap-2 bg-gradient-garden text-foreground font-display text-xs tracking-widest uppercase px-5 py-3 rounded-full shadow-green"
        aria-label="Make a reservation"
      >
        <ShoppingBag size={15} />
        Reserve
      </a>
    </div>
  );
}
