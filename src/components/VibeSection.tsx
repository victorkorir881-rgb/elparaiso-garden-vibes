import friendsVibing from "@/assets/friends-vibing.jpg";
import carWash from "@/assets/car-wash.jpg";
import { Car, ParkingCircle, Clock } from "lucide-react";

export default function VibeSection() {
  return (
    <section id="vibe" className="section-pad bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Section label */}
        <div className="text-center mb-16">
          <span className="font-display text-amber tracking-[0.3em] text-sm uppercase">The Experience</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-foreground mt-3">
            Your Perfect <span className="text-gradient-fire">Chill Spot</span>
          </h2>
          <div className="w-20 h-1 bg-gradient-fire rounded-full mx-auto mt-4" />
        </div>

        {/* Two-col layout */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
          {/* Image */}
          <div className="relative rounded-2xl overflow-hidden shadow-card group">
            <img
              src={friendsVibing}
              alt="Friends enjoying at Elparaiso Garden"
              className="w-full h-80 md:h-[480px] object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex items-center gap-2 bg-amber/90 text-primary-foreground font-display text-xs tracking-widest uppercase px-4 py-2 rounded-full w-fit">
                <Clock size={12} />
                Open Every Single Day, All Day & Night
              </div>
            </div>
          </div>

          {/* Text */}
          <div>
            <p className="font-body text-lg text-muted-foreground leading-relaxed mb-6">
              Whether you are looking for a solo lunch, a casual dine-in with family, or a place to party and unwind with friends,{" "}
              <span className="text-amber font-medium">Elparaiso Garden is the place to be.</span>
            </p>
            <p className="font-body text-base text-muted-foreground leading-relaxed mb-8">
              Nestled in the heart of Kisii town, our lush garden setting, thumping music, and unmatched choma create an atmosphere you won't find anywhere else in the region.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Dine-In", icon: "🍽️" },
                { label: "Takeaway", icon: "🥡" },
                { label: "Delivery", icon: "🛵" },
                { label: "Drive-Through", icon: "🚗" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-3 bg-charcoal-light border border-border rounded-xl px-4 py-3"
                >
                  <span className="text-xl">{s.icon}</span>
                  <span className="font-display text-sm tracking-wider text-foreground/90">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Car Wash USP */}
        <div className="relative rounded-3xl overflow-hidden border border-border shadow-card">
          <div className="absolute inset-0">
            <img src={carWash} alt="On-site car wash at Elparaiso" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-charcoal/88" />
          </div>
          <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center p-8 md:p-14">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-garden p-3 rounded-full shadow-green">
                  <Car size={22} className="text-foreground" />
                </div>
                <span className="font-display text-garden-light tracking-[0.25em] text-sm uppercase">
                  Unique Feature
                </span>
              </div>
              <h3 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">
                Car Wash &amp; <span className="text-gradient-garden">Dine Experience</span>
              </h3>
              <p className="font-body text-muted-foreground text-base leading-relaxed">
                Enjoy our famous choma or a quick snack while we clean your ride at our on-site car wash. Your car gets pampered while you do the same.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              {[
                { icon: <Car size={18} />, text: "Full on-site car wash service while you eat" },
                { icon: <ParkingCircle size={18} />, text: "Plenty of free, secure parking available" },
                { icon: <Clock size={18} />, text: "Available any time of day or night" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 bg-foreground/5 border border-border/40 rounded-xl px-5 py-4">
                  <div className="text-amber shrink-0">{item.icon}</div>
                  <span className="font-body text-foreground/80 text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
