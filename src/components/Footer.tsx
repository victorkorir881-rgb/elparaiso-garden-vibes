import { MapPin, Phone, Clock, Facebook, Instagram, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-charcoal border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="mb-4">
              <p className="font-display font-bold text-2xl text-gradient-fire tracking-wider">ELPARAISO</p>
              <p className="font-display text-sm text-garden-light tracking-[0.25em] uppercase">Garden Kisii</p>
            </div>
            <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-xs">
              The ultimate chill spot in Kisii. Great food, cool music, and good vibes—24 hours a day.
            </p>
            <div className="flex gap-3 mt-5">
              {[
                { icon: <Facebook size={16} />, label: "Facebook" },
                { icon: <Instagram size={16} />, label: "Instagram" },
                { icon: <Twitter size={16} />, label: "X" },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="w-9 h-9 bg-charcoal-light border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-amber hover:border-amber/40 transition-all"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display text-sm tracking-[0.25em] uppercase text-foreground mb-5">Quick Links</h4>
            <div className="flex flex-col gap-3">
              {["Home", "The Vibe", "Menu", "Reviews", "Contact"].map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase().replace(" ", "")}`}
                  className="font-body text-sm text-muted-foreground hover:text-amber transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-sm tracking-[0.25em] uppercase text-foreground mb-5">Find Us</h4>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <MapPin size={15} className="text-amber mt-0.5 shrink-0" />
                <span className="font-body text-sm text-muted-foreground">
                  County Government Street, Kisii<br />
                  <span className="text-xs text-muted-foreground/60">8QCF+4R Kisii, Kenya</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={15} className="text-amber shrink-0" />
                <a href="tel:0791224513" className="font-body text-sm text-muted-foreground hover:text-amber transition-colors">
                  0791 224513
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={15} className="text-garden-light shrink-0" />
                <span className="font-body text-sm text-garden-light font-medium">Open 24/7</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Elparaiso Garden Kisii. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-garden-light animate-pulse" />
            <span className="font-display text-xs tracking-widest text-garden-light uppercase">Open Now</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
