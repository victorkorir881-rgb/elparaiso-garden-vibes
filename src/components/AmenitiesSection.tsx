import {
  Clock,
  Accessibility,
  ParkingCircle,
  CreditCard,
  UtensilsCrossed,
  CalendarCheck,
  Wifi,
  Music,
} from "lucide-react";

const amenities = [
  {
    icon: <Clock size={28} />,
    title: "Open 24 Hours",
    desc: "Day or night, rain or shine—we're always here for you.",
    color: "text-amber",
    border: "hover:border-amber/40",
  },
  {
    icon: <Accessibility size={28} />,
    title: "Wheelchair Accessible",
    desc: "Accessible toilet facilities for all our guests.",
    color: "text-garden-light",
    border: "hover:border-garden/40",
  },
  {
    icon: <ParkingCircle size={28} />,
    title: "Free Ample Parking",
    desc: "Secure, spacious parking lot at no extra charge.",
    color: "text-amber",
    border: "hover:border-amber/40",
  },
  {
    icon: <CreditCard size={28} />,
    title: "NFC & Card Payments",
    desc: "Accepts NFC mobile payments and all major debit cards.",
    color: "text-garden-light",
    border: "hover:border-garden/40",
  },
  {
    icon: <UtensilsCrossed size={28} />,
    title: "Full Table Service",
    desc: "Attentive staff ready to serve you at your table.",
    color: "text-amber",
    border: "hover:border-amber/40",
  },
  {
    icon: <CalendarCheck size={28} />,
    title: "Reservations Accepted",
    desc: "Book your table in advance for guaranteed seating.",
    color: "text-garden-light",
    border: "hover:border-garden/40",
  },
  {
    icon: <Music size={28} />,
    title: "Live Music & DJ",
    desc: "Great vibes and curated playlists every evening.",
    color: "text-amber",
    border: "hover:border-amber/40",
  },
  {
    icon: <Wifi size={28} />,
    title: "Garden Atmosphere",
    desc: "Lush greenery and ambient lighting for the perfect chill.",
    color: "text-garden-light",
    border: "hover:border-garden/40",
  },
];

export default function AmenitiesSection() {
  return (
    <section
      id="amenities"
      className="section-pad"
      style={{ background: "var(--gradient-section)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="font-display text-amber tracking-[0.3em] text-sm uppercase">At a Glance</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-foreground mt-3">
            Amenities &amp; <span className="text-gradient-garden">Features</span>
          </h2>
          <div className="w-20 h-1 bg-gradient-garden rounded-full mx-auto mt-4" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {amenities.map((a) => (
            <div
              key={a.title}
              className={`bg-gradient-card border border-border rounded-2xl p-6 text-center shadow-card transition-all duration-300 ${a.border} hover:-translate-y-1 cursor-default`}
            >
              <div className={`flex justify-center mb-4 ${a.color}`}>{a.icon}</div>
              <h3 className="font-display font-semibold text-sm tracking-wider text-foreground mb-2">{a.title}</h3>
              <p className="font-body text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
