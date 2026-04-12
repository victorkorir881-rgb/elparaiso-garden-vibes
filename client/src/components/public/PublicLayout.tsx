import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Phone, MapPin, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSettings } from "@/lib/supabase-hooks";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/order", label: "Order" },
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: settings } = useSettings();

  useEffect(() => {
    const handleScroll = () => { setScrolled(window.scrollY > 20); setShowScrollTop(window.scrollY > 400); };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const phone = settings?.phone ?? "0791 224513";
  const whatsapp = settings?.whatsapp ?? "254791224513";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/95 backdrop-blur-md shadow-lg border-b border-border" : "bg-transparent"}`}>
        <div className="container">
          <div className="flex items-center justify-between h-16 md:h-20 gap-4">
            <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-sm">E</div>
              <div className="hidden sm:block">
                <div className="font-display font-bold text-lg leading-tight text-foreground group-hover:text-primary transition-colors">Elparaiso</div>
                <div className="text-xs text-muted-foreground leading-tight">Garden Kisii</div>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-2 flex-1 justify-center">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${location === link.href ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>{link.label}</Link>
              ))}
            </nav>
            <div className="hidden md:flex items-center gap-3 flex-shrink-0">
              <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"><Phone className="w-4 h-4" /><span>{phone}</span></a>
              <Link href="/reservations"><Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Reserve a Table</Button></Link>
            </div>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild className="md:hidden"><Button variant="ghost" size="icon" className="text-foreground"><Menu className="w-5 h-5" /></Button></SheetTrigger>
              <SheetContent side="right" className="w-72 bg-card border-border p-0">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="font-display font-bold text-lg text-foreground">Elparaiso Garden</div>
                    <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}><X className="w-4 h-4" /></Button>
                  </div>
                  <nav className="flex flex-col gap-1 p-4 flex-1">
                    {navLinks.map((link) => (
                      <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${location === link.href ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>{link.label}</Link>
                    ))}
                  </nav>
                  <div className="p-4 border-t border-border space-y-3">
                    <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-4 h-4 text-primary" />{phone}</a>
                    <Link href="/reservations" onClick={() => setMobileOpen(false)}><Button className="w-full bg-primary text-primary-foreground">Reserve a Table</Button></Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex-1 pt-16 md:pt-20">{children}</main>
      <footer className="bg-card border-t border-border mt-auto">
        <div className="container py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-2">
              <div className="font-display font-bold text-2xl text-foreground mb-2">Elparaiso Garden</div>
              <p className="text-primary text-sm font-medium mb-3">Kisii's 24/7 Bar, Grill & Chill Spot</p>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">Great food, chilled drinks, good music, and unforgettable vibes. Open 24/7 — dine in, drive-through, takeaway, or order delivery anytime.</p>
              <div className="flex gap-3 mt-4">
                {settings?.facebook && <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors text-sm">Facebook</a>}
                {settings?.instagram && <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors text-sm">Instagram</a>}
                {settings?.twitter && <a href={settings.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors text-sm">X / Twitter</a>}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
              <ul className="space-y-2">
                {navLinks.map((link) => (<li key={link.href}><Link href={link.href} className="text-muted-foreground hover:text-primary transition-colors text-sm">{link.label}</Link></li>))}
                <li><Link href="/reservations" className="text-muted-foreground hover:text-primary transition-colors text-sm">Reservations</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Visit Us</h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-2"><MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span>{settings?.address ?? "County Government Street, Kisii, Kenya"}</span></div>
                <div className="flex gap-2"><Phone className="w-4 h-4 text-primary shrink-0 mt-0.5" /><a href={`tel:${phone}`} className="hover:text-primary transition-colors">{phone}</a></div>
                <div className="text-primary font-medium">Open 24/7</div>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors">WhatsApp Us</a>
              </div>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Elparaiso Garden Kisii. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
      <a href={`https://wa.me/${whatsapp}?text=Hello%20Elparaiso%20Garden!`} target="_blank" rel="noopener noreferrer" className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-24 right-6 z-40 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110" aria-label="Scroll to top"><ChevronUp className="w-5 h-5" /></button>
      )}
    </div>
  );
}
