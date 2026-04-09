import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import PublicLayout from "@/components/public/PublicLayout";

export default function EventsPage() {
  const { data: events, isLoading } = trpc.events.list.useQuery({ activeOnly: true });

  return (
    <PublicLayout>
      <section className="py-20 bg-card/50 border-b border-border">
        <div className="container text-center">
          <h1 className="section-title text-foreground mb-4">Events & Specials</h1>
          <div className="gold-divider mx-auto mb-4" />
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From DJ nights to choma specials — there's always something happening at Elparaiso.
          </p>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
                  <div className="h-52 bg-muted" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : events && events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((evt) => {
                const isFuture = evt.eventDate && new Date(evt.eventDate) >= new Date();
                return (
                  <div key={evt.id} className="bg-card border border-border rounded-xl overflow-hidden card-hover">
                    {evt.imageUrl && (
                      <div className="h-52 overflow-hidden">
                        <img src={evt.imageUrl} alt={evt.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-display font-semibold text-foreground text-lg">{evt.title}</h3>
                        {isFuture && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs shrink-0">Upcoming</Badge>}
                      </div>
                      {evt.subtitle && <p className="text-primary text-sm font-medium mb-2">{evt.subtitle}</p>}
                      {evt.description && <p className="text-muted-foreground text-sm leading-relaxed mb-4">{evt.description}</p>}
                      {(evt.eventDate || evt.startTime) && (
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
                          {evt.eventDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-primary" />
                              {evt.eventDate}
                            </div>
                          )}
                          {evt.startTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              {evt.startTime}{evt.endTime ? ` – ${evt.endTime}` : ""}
                            </div>
                          )}
                        </div>
                      )}
                      {evt.ctaLabel && evt.ctaUrl && (
                        <a href={evt.ctaUrl} className="inline-flex items-center text-primary text-sm font-medium hover:underline">
                          {evt.ctaLabel} →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">No upcoming events at the moment.</p>
              <p className="text-muted-foreground text-sm mt-2">Follow us on social media for the latest updates.</p>
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
