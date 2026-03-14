import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Phone, Clock, Facebook, Instagram, Twitter, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  reservationSchema,
  type ReservationFormData,
  submitReservation,
} from "@/services/reservationService";
import { SITE_CONFIG } from "@/config/siteConfig";

// ─── Visually-hidden helper (accessible label trick without layout change) ────
function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">{children}</span>
  );
}

export default function ContactSection() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
  });

  const onSubmit = async (data: ReservationFormData) => {
    try {
      await submitReservation(data);
      toast({
        title: "Reservation Request Sent! 🎉",
        description:
          "We've received your request. We'll call you shortly to confirm your table.",
      });
      reset();
    } catch {
      toast({
        title: "Something went wrong",
        description:
          "We couldn't send your reservation. Please call us directly on " +
          SITE_CONFIG.contact.phoneDisplay +
          ".",
        variant: "destructive",
      });
    }
  };

  const activeSocialLinks = SITE_CONFIG.socialLinks.filter((s) => s.enabled && s.href);

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
              <h3 className="font-display font-bold text-xl tracking-wider text-foreground mb-6">
                Contact Information
              </h3>
              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-4">
                  <div className="bg-amber/10 border border-amber/20 text-amber rounded-xl p-3 shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="font-display text-sm tracking-wider text-foreground mb-1">Address</p>
                    <p className="font-body text-muted-foreground text-sm">
                      {SITE_CONFIG.location.streetAddress}
                      <br />
                      <span className="text-muted-foreground/60 text-xs">
                        Plus Code: {SITE_CONFIG.location.plusCode}
                      </span>
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
                      href={SITE_CONFIG.contact.phoneTelHref}
                      className="font-body text-amber hover:text-amber/80 transition-colors text-base font-medium"
                    >
                      {SITE_CONFIG.contact.phoneDisplay}
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
                      Open{" "}
                      <span className="text-garden-light font-semibold">
                        {SITE_CONFIG.business.hoursDisplay}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Social — only rendered when real URLs are configured */}
              {activeSocialLinks.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <p className="font-display text-sm tracking-widest text-muted-foreground mb-4 uppercase">
                    Follow Us
                  </p>
                  <div className="flex gap-3">
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
                          className="w-10 h-10 bg-charcoal-light border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-amber hover:border-amber/40 transition-all"
                        >
                          <Icon size={18} />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Reservation form */}
            <div className="bg-gradient-card border border-border rounded-2xl p-8 shadow-card">
              <h3 className="font-display font-bold text-xl tracking-wider text-foreground mb-6">
                Make a Reservation
              </h3>
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="reservation-name"
                      className="font-display text-xs tracking-wider text-foreground/70 uppercase"
                    >
                      Your Name <span className="text-amber">*</span>
                    </label>
                    <input
                      id="reservation-name"
                      type="text"
                      placeholder="e.g. John Kamau"
                      autoComplete="name"
                      {...register("name")}
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? "name-error" : undefined}
                      className="bg-background border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber transition-colors aria-[invalid=true]:border-destructive"
                    />
                    {errors.name && (
                      <p id="name-error" role="alert" className="font-body text-xs text-destructive">
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="reservation-phone"
                      className="font-display text-xs tracking-wider text-foreground/70 uppercase"
                    >
                      Phone Number <span className="text-amber">*</span>
                    </label>
                    <input
                      id="reservation-phone"
                      type="tel"
                      placeholder="e.g. 0712 345678"
                      autoComplete="tel"
                      {...register("phone")}
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? "phone-error" : undefined}
                      className="bg-background border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber transition-colors aria-[invalid=true]:border-destructive"
                    />
                    {errors.phone && (
                      <p id="phone-error" role="alert" className="font-body text-xs text-destructive">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Date/time */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="reservation-datetime"
                    className="font-display text-xs tracking-wider text-foreground/70 uppercase"
                  >
                    Date &amp; Time <span className="text-amber">*</span>
                  </label>
                  <input
                    id="reservation-datetime"
                    type="datetime-local"
                    {...register("datetime")}
                    aria-invalid={!!errors.datetime}
                    aria-describedby={errors.datetime ? "datetime-error" : undefined}
                    className="bg-background border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground focus:outline-none focus:border-amber transition-colors aria-[invalid=true]:border-destructive"
                  />
                  {errors.datetime && (
                    <p id="datetime-error" role="alert" className="font-body text-xs text-destructive">
                      {errors.datetime.message}
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="reservation-notes"
                    className="font-display text-xs tracking-wider text-foreground/70 uppercase"
                  >
                    Special Requests{" "}
                    <span className="text-muted-foreground normal-case font-body tracking-normal text-xs">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="reservation-notes"
                    placeholder="Any dietary requirements, occasion details, or questions..."
                    rows={3}
                    {...register("notes")}
                    aria-describedby={errors.notes ? "notes-error" : undefined}
                    className="bg-background border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber transition-colors resize-none"
                  />
                  {errors.notes && (
                    <p id="notes-error" role="alert" className="font-body text-xs text-destructive">
                      {errors.notes.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 bg-gradient-fire text-primary-foreground font-display text-sm tracking-widest uppercase px-8 py-4 rounded-full shadow-amber hover:opacity-90 transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reservation Request"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Map */}
          <div className="bg-gradient-card border border-border rounded-2xl overflow-hidden shadow-card h-full min-h-[500px] flex flex-col">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
              <MapPin size={18} className="text-amber" />
              <span className="font-display text-sm tracking-wider text-foreground">
                {SITE_CONFIG.business.shortName} — {SITE_CONFIG.location.city} Town
              </span>
            </div>
            <div className="flex-1">
              <iframe
                title="Elparaiso Garden Kisii Location"
                src={SITE_CONFIG.location.googleMapsEmbedUrl}
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
