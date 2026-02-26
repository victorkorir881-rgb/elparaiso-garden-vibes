import heroBg from "@/assets/hero-bg.jpg";
import { ChevronDown, Calendar, UtensilsCrossed } from "lucide-react";

export default function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt="Elparaiso Garden Kisii ambiance"
          className="w-full h-full object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{ background: "var(--gradient-hero)" }}
        />
      </div>

      {/* Decorative amber line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber to-transparent opacity-60" />

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto pt-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 border border-amber/40 bg-amber/10 backdrop-blur-sm text-amber font-body text-sm px-4 py-2 rounded-full mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
          Open 24 Hours · Kisii, Kenya
        </div>

        <h1
          className="font-display font-bold text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-foreground leading-none mb-6 animate-fade-up"
          style={{ animationDelay: "0.1s", opacity: 0 }}
        >
          Welcome to{" "}
          <span className="text-gradient-fire block mt-1">Elparaiso Garden</span>
        </h1>

        <p
          className="font-body text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto mb-10 animate-fade-up"
          style={{ animationDelay: "0.25s", opacity: 0 }}
        >
          The ultimate chill spot in Kisii. Great food, cool music, and good vibes—open 24 hours.
        </p>

        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up"
          style={{ animationDelay: "0.4s", opacity: 0 }}
        >
          <a
            href="#contact"
            className="flex items-center gap-2 bg-gradient-fire text-primary-foreground font-display text-sm tracking-widest uppercase px-8 py-4 rounded-full shadow-amber hover:opacity-90 transition-all hover:scale-105"
          >
            <Calendar size={16} />
            Make a Reservation
          </a>
          <a
            href="#menu"
            className="flex items-center gap-2 border border-foreground/30 bg-foreground/5 backdrop-blur-sm text-foreground font-display text-sm tracking-widest uppercase px-8 py-4 rounded-full hover:border-amber hover:text-amber transition-all"
          >
            <UtensilsCrossed size={16} />
            View Menu Highlights
          </a>
        </div>

        {/* Scroll hint */}
        <div className="mt-20 flex justify-center animate-float">
          <a href="#vibe" aria-label="Scroll down">
            <ChevronDown size={28} className="text-amber/70" />
          </a>
        </div>
      </div>
    </section>
  );
}
