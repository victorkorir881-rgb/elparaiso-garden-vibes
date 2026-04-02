import { useState, useEffect } from "react";
import { Menu, X, Phone, Shield } from "lucide-react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { useAuth } from "@/hooks/useAuth";

const MOBILE_MENU_ID = "mobile-nav-menu";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAdmin } = useAuth();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-charcoal/95 backdrop-blur-md shadow-card border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a href="#home" className="flex flex-col leading-tight group">
            <span className="font-display text-xl md:text-2xl font-bold text-gradient-fire tracking-wider">
              {SITE_CONFIG.business.shortName}
            </span>
            <span className="font-display text-xs md:text-sm text-garden-light tracking-[0.25em] uppercase">
              {SITE_CONFIG.business.tagline}
            </span>
          </a>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            {SITE_CONFIG.navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="font-display text-sm tracking-widest uppercase text-muted-foreground hover:text-amber transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
            {isAdmin && (
              <a
                href="/admin"
                className="flex items-center gap-1.5 font-display text-sm tracking-widest uppercase text-amber hover:text-amber/80 transition-colors duration-200"
              >
                <Shield size={14} />
                Admin
              </a>
            )}
            <a
              href={SITE_CONFIG.contact.phoneTelHref}
              className="flex items-center gap-2 bg-gradient-fire text-primary-foreground font-display text-sm tracking-widest px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity shadow-amber"
            >
              <Phone size={14} />
              Call Now
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden text-foreground p-2"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls={MOBILE_MENU_ID}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div
          id={MOBILE_MENU_ID}
          className="md:hidden bg-charcoal/98 backdrop-blur-md border-b border-border"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="px-4 py-4 flex flex-col gap-4">
            {SITE_CONFIG.navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="font-display text-base tracking-widest uppercase text-muted-foreground hover:text-amber py-2 border-b border-border/40 transition-colors"
              >
                {link.label}
              </a>
            ))}
            {isAdmin && (
              <a
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 font-display text-sm tracking-widest uppercase text-amber border border-amber/30 px-5 py-3 rounded-full"
              >
                <Shield size={14} />
                Admin Panel
              </a>
            )}
            <a
              href={SITE_CONFIG.contact.phoneTelHref}
              className="flex items-center justify-center gap-2 bg-gradient-fire text-primary-foreground font-display text-sm tracking-widest px-5 py-3 rounded-full mt-2"
            >
              <Phone size={14} />
              Call Now — {SITE_CONFIG.contact.phoneDisplay}
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
