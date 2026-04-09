import { Link } from "wouter";
import { Clock, Car, Users, Utensils, Music, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/public/PublicLayout";

export default function AboutPage() {
  return (
    <PublicLayout>
      <section className="py-20 bg-card/50 border-b border-border">
        <div className="container text-center">
          <h1 className="section-title text-foreground mb-4">About Elparaiso Garden</h1>
          <div className="gold-divider mx-auto mb-4" />
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Kisii's favourite 24/7 bar, grill, and chill spot — where great food meets unforgettable vibes.
          </p>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <h2 className="section-title text-foreground mb-4">Our Story</h2>
              <div className="gold-divider mb-6" />
              <p className="text-muted-foreground leading-relaxed mb-4">
                Elparaiso Garden was born from a simple idea: Kisii deserves a place where you can enjoy great food, cold drinks, and good music at any hour of the day or night. We set out to create a space that feels premium but welcoming — a true local destination.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Located on County Government Street in the heart of Kisii, we've become the go-to spot for families, friends, professionals, and night owls alike. Whether you're grabbing a quick lunch, celebrating with friends, or unwinding after a long day, Elparaiso is always ready.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We take pride in our authentic Kenyan grills — nyama choma, mutura, and grilled platters — alongside a full bar, table service, and the kind of warm hospitality that keeps guests coming back.
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden h-96">
              <img
                src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80"
                alt="Elparaiso Garden atmosphere"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Values */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            {[
              { icon: Clock, title: "Always Open", desc: "We operate 24/7, 365 days a year. No matter when hunger strikes or the mood hits, we're here." },
              { icon: Utensils, title: "Authentic Grills", desc: "Our nyama choma, mutura, and grilled platters are prepared with care and seasoned to perfection." },
              { icon: Music, title: "Music & Nightlife", desc: "From background ambience to DJ nights and live entertainment — the vibes are always right." },
              { icon: Users, title: "Community First", desc: "We're proud to be a Kisii institution. A place for families, friends, and the local community." },
              { icon: Car, title: "Convenient Access", desc: "Free parking, wheelchair accessibility, drive-through, delivery, and takeaway — we make it easy." },
              { icon: Star, title: "Premium Hospitality", desc: "Attentive table service, clean environment, and a team that genuinely cares about your experience." },
            ].map((v) => (
              <div key={v.title} className="bg-card border border-border rounded-xl p-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <v.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{v.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center bg-card border border-border rounded-2xl p-10">
            <h2 className="section-title text-foreground mb-4">Come Experience It Yourself</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
              Words only go so far. The real Elparaiso experience is best felt in person.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/reservations">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 px-8">
                  Reserve a Table
                </Button>
              </Link>
              <Link href="/menu">
                <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-accent px-8">
                  View Our Menu
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
