import { MapPin, Phone, Clock, Facebook, Instagram, Twitter } from "lucide-react";
import { SITE_CONFIG } from "@/config/siteConfig";

export default function Footer() {
  const activeSocialLinks = SITE_CONFIG.socialLinks.filter((s) => s.enabled && s.href);

  return (
    <footer className="bg-charcoal border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="mb-4">
              <p className="font-display font-bold text-2xl text-gradient-fire tracking-wider">
                {SITE_CONFIG.business.shortName}
              </p>
              <p className="font-display text-sm text-garden-light tracking-[0.25em] uppercase">
                {SITE_CONFIG.business.tagline}
              </p>
            </div>
            <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-xs">
              {SITE_CONFIG.business.description}
            </p>

            {/* Social icons — only rendered when real URLs are configured */}
            {activeSocialLinks.length > 0 && (
              <div className="flex gap-3 mt-5">
                {activeSocialLinks.map((s) => {
                  const Icon =
                    s.label === "Facebook"
                      ? Facebook
                      : s.label === "Instagram"
                        ? Instagram
                        : Twitter;
                  return (
                    <a
                      key={s.label}
                      href={s.href!}
                      aria-label={s.label}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 bg-charcoal-light border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-amber hover:border-amber/40 transition-all"
                    >
                      <Icon size={16} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Links — derived from the same navLinks config as Navbar */}
          <div>
            <h4 className="font-display text-sm tracking-[0.25em] uppercase text-foreground mb-5">
              Quick Links
            </h4>
            <div className="flex flex-col gap-3">
              {SITE_CONFIG.navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-body text-sm text-muted-foreground hover:text-amber transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/admin/login"
                className="font-body text-sm text-muted-foreground hover:text-amber transition-colors"
              >
                Admin Panel
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-sm tracking-[0.25em] uppercase text-foreground mb-5">
              Find Us
            </h4>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <MapPin size={15} className="text-amber mt-0.5 shrink-0" />
                <span className="font-body text-sm text-muted-foreground">
                  {SITE_CONFIG.location.streetAddress}
                  <br />
                  <span className="text-xs text-muted-foreground/60">
                    {SITE_CONFIG.location.plusCode}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={15} className="text-amber shrink-0" />
                <a
                  href={SITE_CONFIG.contact.phoneTelHref}
                  className="font-body text-sm text-muted-foreground hover:text-amber transition-colors"
                >
                  {SITE_CONFIG.contact.phoneDisplay}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={15} className="text-garden-light shrink-0" />
                <span className="font-body text-sm text-garden-light font-medium">
                  {SITE_CONFIG.business.hours}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} {SITE_CONFIG.business.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-garden-light animate-pulse" />
            <span className="font-display text-xs tracking-widest text-garden-light uppercase">
              Open Now
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
