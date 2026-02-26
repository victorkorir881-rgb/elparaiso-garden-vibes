import { MapPin, Phone, Clock, Facebook, Instagram, Twitter } from "lucide-react";

export default function ContactSection() {
  return (
    <section id="contact" className="section-pad bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="font-display text-amber tracking-[0.3em] text-sm uppercase">Find Us</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-foreground mt-3">
            Get in <span className="text-gradient-fire">Touch</span>
          </h2>
          <div className="w-20 h-1 bg-gradient-fire rounded-full mx-auto mt-4" />
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Info + Form */}
          <div className="flex flex-col gap-8">
            {/* Contact details */}
            <div className="bg-gradient-card border border-border rounded-2xl p-8 shadow-card">
              <h3 className="font-display font-bold text-xl tracking-wider text-foreground mb-6">Contact Information</h3>
              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-4">
                  <div className="bg-amber/10 border border-amber/20 text-amber rounded-xl p-3 shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="font-display text-sm tracking-wider text-foreground mb-1">Address</p>
                    <p className="font-body text-muted-foreground text-sm">
                      County Government Street, Kisii<br />
                      <span className="text-muted-foreground/60 text-xs">Plus Code: 8QCF+4R Kisii</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-amber/10 border border-amber/20 text-amber rounded-xl p-3 shrink-0">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="font-display text-sm tracking-wider text-foreground mb-1">Phone</p>
                    <a
                      href="tel:0791224513"
                      className="font-body text-amber hover:text-amber/80 transition-colors text-base font-medium"
                    >
                      0791 224513
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-garden/20 border border-garden/30 text-garden-light rounded-xl p-3 shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="font-display text-sm tracking-wider text-foreground mb-1">Hours</p>
                    <p className="font-body text-muted-foreground text-sm">
                      Open <span className="text-garden-light font-semibold">24 hours a day, 7 days a week</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Social */}
              <div className="mt-8 pt-6 border-t border-border">
                <p className="font-display text-sm tracking-widest text-muted-foreground mb-4 uppercase">Follow Us</p>
                <div className="flex gap-3">
                  {[
                    { icon: <Facebook size={18} />, label: "Facebook", href: "#" },
                    { icon: <Instagram size={18} />, label: "Instagram", href: "#" },
                    { icon: <Twitter size={18} />, label: "X (Twitter)", href: "#" },
                  ].map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      aria-label={s.label}
                      className="w-10 h-10 bg-charcoal-light border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-amber hover:border-amber/40 transition-all"
                    >
                      {s.icon}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Reservation form */}
            <div className="bg-gradient-card border border-border rounded-2xl p-8 shadow-card">
              <h3 className="font-display font-bold text-xl tracking-wider text-foreground mb-6">Make a Reservation</h3>
              <form className="flex flex-col gap-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Your Name"
                    className="bg-background border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber transition-colors"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    className="bg-background border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber transition-colors"
                  />
                </div>
                <input
                  type="datetime-local"
                  className="bg-background border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground focus:outline-none focus:border-amber transition-colors"
                />
                <textarea
                  placeholder="Special requests or message..."
                  rows={3}
                  className="bg-background border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber transition-colors resize-none"
                />
                <button
                  type="submit"
                  className="bg-gradient-fire text-primary-foreground font-display text-sm tracking-widest uppercase px-8 py-4 rounded-full shadow-amber hover:opacity-90 transition-all hover:scale-[1.02]"
                >
                  Send Reservation Request
                </button>
              </form>
            </div>
          </div>

          {/* Map */}
          <div className="bg-gradient-card border border-border rounded-2xl overflow-hidden shadow-card h-full min-h-[500px] flex flex-col">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
              <MapPin size={18} className="text-amber" />
              <span className="font-display text-sm tracking-wider text-foreground">Elparaiso Garden — Kisii Town</span>
            </div>
            <div className="flex-1">
              <iframe
                title="Elparaiso Garden Kisii Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.819449635268!2d34.76606!3d-0.67895!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182a907a6d11f00d%3A0x88e9ca0a5e2e9a00!2sKisii%2C%20Kenya!5e0!3m2!1sen!2sus!4v1690000000000!5m2!1sen!2sus"
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: "450px" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
