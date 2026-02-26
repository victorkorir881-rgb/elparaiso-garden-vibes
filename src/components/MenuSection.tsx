import nyamaChoma from "@/assets/nyama-choma.jpg";
import mutura from "@/assets/mutura.jpg";
import cocktails from "@/assets/cocktails.jpg";
import { Flame, GlassWater, Truck } from "lucide-react";

const menuCards = [
  {
    image: nyamaChoma,
    category: "The Grill",
    icon: <Flame size={18} />,
    title: "Great Choma",
    description:
      "Slow-roasted nyama choma to perfection over charcoal. Served with kachumbari, ugali, and our secret house dip.",
    price: "From KES 500 – 1,000",
    tag: "Most Popular",
    tagColor: "bg-gradient-fire",
  },
  {
    image: mutura,
    category: "The Grill",
    icon: <Flame size={18} />,
    title: "Delicious Mutura",
    description:
      "Authentic Kenyan mutura grilled to smoky perfection. A street-food classic elevated in a garden setting.",
    price: "From KES 200 – 500",
    tag: "Local Favourite",
    tagColor: "bg-gradient-garden",
  },
  {
    image: cocktails,
    category: "The Bar",
    icon: <GlassWater size={18} />,
    title: "Drinks & Cocktails",
    description:
      "Cold beers, premium spirits, an extensive wine list, and expertly mixed cocktails. Your perfect pour awaits.",
    price: "Ask Bartender",
    tag: "Full Bar",
    tagColor: "bg-amber/20 border border-amber/40 text-amber",
    tagText: true,
  },
];

const serviceIcons = [
  { icon: "🍽️", label: "Dine-In" },
  { icon: "🥡", label: "Takeaway" },
  { icon: "🛵", label: "Delivery" },
  { icon: "🚗", label: "Drive-Through" },
];

export default function MenuSection() {
  return (
    <section id="menu" className="section-pad" style={{ background: "var(--gradient-section)" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="font-display text-amber tracking-[0.3em] text-sm uppercase">What We Serve</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-foreground mt-3">
            Menu <span className="text-gradient-fire">Highlights</span>
          </h2>
          <div className="w-20 h-1 bg-gradient-fire rounded-full mx-auto mt-4" />
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
          {menuCards.map((card) => (
            <div
              key={card.title}
              className="bg-gradient-card rounded-2xl overflow-hidden border border-border shadow-card group hover:border-amber/30 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="relative overflow-hidden h-52">
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 to-transparent" />
                <div className="absolute top-4 left-4">
                  <span
                    className={`font-display text-xs tracking-widest uppercase px-3 py-1.5 rounded-full ${
                      card.tagText
                        ? card.tagColor
                        : `${card.tagColor} text-primary-foreground`
                    }`}
                  >
                    {card.tag}
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <div className="text-amber">{card.icon}</div>
                  <span className="font-display text-xs tracking-[0.2em] text-amber uppercase">{card.category}</span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-display font-bold text-xl text-foreground mb-2">{card.title}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">{card.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-display text-amber text-sm tracking-wide">{card.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Service badges */}
        <div className="bg-charcoal-light border border-border rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Truck size={20} className="text-amber" />
            <h3 className="font-display text-lg tracking-wider text-foreground">We Serve You Your Way</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {serviceIcons.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center gap-2 bg-background border border-border rounded-xl py-5 px-3 hover:border-amber/40 transition-colors"
              >
                <span className="text-3xl">{s.icon}</span>
                <span className="font-display text-sm tracking-wider text-foreground/80">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
