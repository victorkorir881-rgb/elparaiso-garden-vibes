import { Link } from "wouter";
import { Star, Clock, Car, Utensils, Music, Wifi, MapPin, Phone, ChevronRight, Flame, Wine, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import PublicLayout from "@/components/public/PublicLayout";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";

const HERO_BG = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80";
const FOOD_PLACEHOLDER = "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80";

const features = [
  { icon: Clock, title: "Open 24/7", desc: "We never close. Anytime is the right time." },
  { icon: Flame, title: "Nyama Choma & Grills", desc: "Authentic Kenyan grills, mutura, and platters." },
  { icon: Wine, title: "Full Bar", desc: "Cocktails, beer, wine, spirits, and soft drinks." },
  { icon: Music, title: "Music & Vibes", desc: "Live DJ nights, great music, and nightlife energy." },
  { icon: Truck, title: "Delivery & Drive-Through", desc: "Dine-in, takeaway, delivery, or drive-through." },
  { icon: Car, title: "Free Parking", desc: "Plenty of free parking for all guests." },
  { icon: Users, title: "Family & Friends", desc: "Perfect for groups, families, and social gatherings." },
  { icon: Utensils, title: "Table Service", desc: "Attentive table service and reservations available." },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-4 h-4 ${i <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const { data: settings } = trpc.settings.get.useQuery();
  const { data: featuredItems } = trpc.menuItems.list.useQuery({ featuredOnly: true, availableOnly: true });
  const { data: testimonials } = trpc.testimonials.list.useQuery({ featuredOnly: true });
  const { data: events } = trpc.events.list.useQuery({ activeOnly: true, homepageOnly: true });
  const { data: gallery } = trpc.gallery.list.useQuery({ featuredOnly: true });

  const phone = settings?.phone ?? "0791 224513";
  const whatsapp = settings?.whatsapp ?? "254791224513";
  const address = settings?.address ?? "County Government Street, Kisii, Kenya";
  const mapsEmbed = settings?.maps_embed ?? "";
  const mapsLink = settings?.maps_link ?? "https://maps.google.com/?q=Kisii+Kenya";

  return (
    <PublicLayout>
      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${settings?.hero_image ?? HERO_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        <div className="relative z-10 container text-center py-24">
          <Badge className="mb-6 bg-primary/20 text-primary border-primary/30 text-xs font-medium px-4 py-1.5">
            Open 24/7 · Kisii, Kenya
          </Badge>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
            {settings?.hero_headline ?? "Kisii's 24/7 Bar,"}
            <br />
            <span className="text-primary">Grill & Chill Spot</span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-8 leading-relaxed">
            {settings?.hero_subheadline ?? "Great food, chilled drinks, good music, and unforgettable vibes — dine in, drive-through, takeaway, or order delivery anytime."}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Link href="/menu">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8">
                View Menu
              </Button>
            </Link>
            <a href={mapsLink} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 font-semibold px-8">
                Get Directions
              </Button>
            </a>
            <a href={`tel:${phone}`}>
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 font-semibold px-8">
                <Phone className="w-4 h-4 mr-2" /> Call Now
              </Button>
            </a>
          </div>
          {/* Trust badges */}
          <div className="flex flex-wrap gap-3 justify-center">
            {["Open 24/7", "Dine-in", "Drive-through", "Delivery", "Free Parking", "Reservations"].map((badge) => (
              <span key={badge} className="text-xs text-white/70 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE US ── */}
      <section className="section-padding bg-background">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="section-title text-foreground">Why Elparaiso?</h2>
            <div className="gold-divider mx-auto mt-4 mb-4" />
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              More than a restaurant — a full experience for every occasion.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-6 card-hover text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED MENU ── */}
      {featuredItems && featuredItems.length > 0 && (
        <section className="section-padding bg-card/50">
          <div className="container">
            <div className="flex items-end justify-between mb-10">
              <div>
                <h2 className="section-title text-foreground">Featured Dishes</h2>
                <div className="gold-divider mt-4" />
              </div>
              <Link href="/menu" className="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1 transition-colors">
                Full Menu <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {featuredItems.slice(0, 8).map((item) => (
                <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden card-hover">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={item.imageUrl ?? FOOD_PLACEHOLDER}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                    {item.badge && (
                      <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs">{item.badge}</Badge>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground mb-1">{item.name}</h3>
                    {item.description && <p className="text-muted-foreground text-xs line-clamp-2 mb-3">{item.description}</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-primary font-bold">KES {Number(item.price).toLocaleString()}</span>
                      {!item.isAvailable && <Badge variant="outline" className="text-xs text-muted-foreground">Unavailable</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── EXPERIENCE SECTION ── */}
      <section className="section-padding bg-background">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="section-title text-foreground mb-4">The Elparaiso Experience</h2>
              <div className="gold-divider mb-6" />
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                Whether you're coming for a quiet lunch, a family dinner, a late-night bite, or a full night out — Elparaiso Garden is your destination in Kisii.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                We serve authentic Kenyan grills, mutura, and platters alongside a full bar with cocktails, beer, wine, and spirits. Our warm, energetic atmosphere blends premium casual dining with a nightlife vibe that keeps guests coming back.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {["Late-Night Energy", "Premium Casual", "Family Friendly", "24/7 Service"].map((tag) => (
                  <div key={tag} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {tag}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80",
                "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=80",
                "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400&q=80",
                "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80",
              ].map((src, i) => (
                <div key={i} className={`rounded-xl overflow-hidden ${i === 0 ? "row-span-2" : ""}`}>
                  <img src={src} alt="Elparaiso experience" className="w-full h-full object-cover" loading="lazy" style={{ minHeight: i === 0 ? "280px" : "130px" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="section-padding bg-card/50">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="section-title text-foreground">How We Serve You</h2>
            <div className="gold-divider mx-auto mt-4" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "Dine-In", icon: Utensils },
              { label: "Delivery", icon: Truck },
              { label: "Takeaway", icon: Utensils },
              { label: "Drive-Through", icon: Car },
              { label: "Reservations", icon: Users },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-5 text-center">
                <s.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <div className="text-sm font-medium text-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      {testimonials && testimonials.length > 0 && (
        <section className="section-padding bg-background">
          <div className="container">
            <div className="text-center mb-10">
              <h2 className="section-title text-foreground">What Guests Say</h2>
              <div className="gold-divider mx-auto mt-4 mb-4" />
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-primary text-primary" />)}</div>
                <span className="text-sm">Loved by Kisii</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {testimonials.slice(0, 6).map((t) => (
                <div key={t.id} className="bg-card border border-border rounded-xl p-6 card-hover">
                  <StarRating rating={t.rating} />
                  <p className="text-muted-foreground text-sm leading-relaxed mt-3 mb-4 italic">"{t.reviewText}"</p>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-foreground text-sm">{t.reviewerName}</div>
                    <Badge variant="outline" className="text-xs text-muted-foreground">{t.sourceLabel}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <a
                href="https://g.page/r/review"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-medium transition-colors"
              >
                Leave a Google Review <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── GALLERY PREVIEW ── */}
      {gallery && gallery.length > 0 && (
        <section className="section-padding bg-card/50">
          <div className="container">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="section-title text-foreground">Gallery</h2>
                <div className="gold-divider mt-4" />
              </div>
              <Link href="/gallery" className="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1 transition-colors">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {gallery.slice(0, 8).map((img) => (
                <div key={img.id} className="aspect-square rounded-xl overflow-hidden">
                  <img src={img.imageUrl} alt={img.altText ?? "Elparaiso Gallery"} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS CAROUSEL ── */}
      <TestimonialsCarousel />

      {/* ── EVENTS PREVIEW ── */}
      {events && events.length > 0 && (
        <section className="section-padding bg-background">
          <div className="container">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="section-title text-foreground">Events & Specials</h2>
                <div className="gold-divider mt-4" />
              </div>
              <Link href="/events" className="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1 transition-colors">
                All Events <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {events.slice(0, 3).map((evt) => (
                <div key={evt.id} className="bg-card border border-border rounded-xl overflow-hidden card-hover">
                  {evt.imageUrl && (
                    <div className="h-48 overflow-hidden">
                      <img src={evt.imageUrl} alt={evt.title} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-display font-semibold text-foreground text-lg mb-1">{evt.title}</h3>
                    {evt.subtitle && <p className="text-primary text-sm mb-2">{evt.subtitle}</p>}
                    {evt.description && <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{evt.description}</p>}
                    {evt.eventDate && (
                      <div className="text-xs text-muted-foreground mb-3">
                        {evt.eventDate} {evt.startTime && `· ${evt.startTime}`} {evt.endTime && `– ${evt.endTime}`}
                      </div>
                    )}
                    {evt.ctaLabel && evt.ctaUrl && (
                      <a href={evt.ctaUrl} className="text-primary text-sm font-medium hover:underline">{evt.ctaLabel}</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── LOCATION ── */}
      <section className="section-padding bg-card/50">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="section-title text-foreground">Find Us</h2>
            <div className="gold-divider mx-auto mt-4 mb-4" />
            <p className="text-muted-foreground">{address}</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold text-foreground mb-4">Contact & Hours</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span>{address}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    <a href={`tel:${phone}`} className="hover:text-primary transition-colors">{phone}</a>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-primary font-medium">Open 24 Hours, 7 Days a Week</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href={`tel:${phone}`} className="flex-1">
                  <Button className="w-full bg-primary text-primary-foreground">
                    <Phone className="w-4 h-4 mr-2" /> Call Now
                  </Button>
                </a>
                <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full border-border text-foreground hover:bg-accent">
                    <MapPin className="w-4 h-4 mr-2" /> Get Directions
                  </Button>
                </a>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10">
                    WhatsApp
                  </Button>
                </a>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border border-border h-72 bg-card">
              {mapsEmbed ? (
                <iframe src={mapsEmbed} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" title="Elparaiso Garden Location" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <MapPin className="w-10 h-10 text-primary" />
                  <p className="text-sm">County Government Street, Kisii, Kenya</p>
                  <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline">Open in Google Maps</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── RESERVATION CTA ── */}
      <section className="py-16 bg-primary/5 border-y border-primary/10">
        <div className="container text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready for an Unforgettable Evening?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Reserve your table now and let us take care of the rest.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/reservations">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-10">
                Reserve a Table
              </Button>
            </Link>
            <Link href="/menu">
              <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-accent font-semibold px-10">
                Browse Menu
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
