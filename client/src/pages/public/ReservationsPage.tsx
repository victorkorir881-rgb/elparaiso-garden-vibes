import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v3";
import { CheckCircle, Calendar, Clock, Users, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import PublicLayout from "@/components/public/PublicLayout";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(9, "Valid phone number required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  guests: z.coerce.number().min(1, "At least 1 guest").max(100, "Max 100 guests"),
  specialRequest: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TIME_SLOTS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
  "19:00", "20:00", "21:00", "22:00", "23:00", "00:00",
];

export default function ReservationsPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<FormData | null>(null);
  const { data: settings } = trpc.settings.get.useQuery();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", date: "", time: "", guests: 2, specialRequest: "" },
  });

  const createMutation = trpc.reservations.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setSubmittedData(form.getValues());
    },
    onError: (err) => toast.error(err.message ?? "Failed to submit reservation"),
  });

  const onSubmit = (data: FormData) => createMutation.mutate(data);

  const whatsapp = settings?.whatsapp ?? "254791224513";

  const today = new Date().toISOString().split("T")[0];

  return (
    <PublicLayout>
      <section className="py-20 bg-card/50 border-b border-border">
        <div className="container text-center">
          <h1 className="section-title text-foreground mb-4">Reserve a Table</h1>
          <div className="gold-divider mx-auto mb-4" />
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Secure your spot at Elparaiso Garden. We're open 24/7 — reserve for any time.
          </p>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container max-w-2xl">
          {submitted && submittedData ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="font-display font-bold text-2xl text-foreground mb-2">Reservation Submitted!</h2>
              <p className="text-muted-foreground mb-6">
                Thank you, <strong className="text-foreground">{submittedData.name}</strong>! Your reservation request has been received. We'll confirm shortly.
              </p>
              <div className="bg-background border border-border rounded-xl p-5 mb-6 text-left space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Date:</span>
                  <span className="text-foreground font-medium">{submittedData.date}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Time:</span>
                  <span className="text-foreground font-medium">{submittedData.time}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Guests:</span>
                  <span className="text-foreground font-medium">{submittedData.guests}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="text-foreground font-medium">{submittedData.phone}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={`https://wa.me/${whatsapp}?text=Hi%20Elparaiso%20Garden!%20I%20just%20made%20a%20reservation%20for%20${submittedData.guests}%20guests%20on%20${submittedData.date}%20at%20${submittedData.time}.%20My%20name%20is%20${encodeURIComponent(submittedData.name)}.`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="bg-green-600 hover:bg-green-500 text-white">Confirm via WhatsApp</Button>
                </a>
                <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => { setSubmitted(false); form.reset(); }}>
                  Make Another Reservation
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="font-display font-semibold text-xl text-foreground mb-6">Reservation Details</h2>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Full Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Your name" className="bg-input border-border text-foreground placeholder:text-muted-foreground" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Phone Number *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="07XX XXX XXX" className="bg-input border-border text-foreground placeholder:text-muted-foreground" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Email (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="your@email.com" className="bg-input border-border text-foreground placeholder:text-muted-foreground" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem className="sm:col-span-1">
                        <FormLabel className="text-foreground">Date *</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" min={today} className="bg-input border-border text-foreground" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="time" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Time *</FormLabel>
                        <FormControl>
                          <select {...field} className="w-full h-10 px-3 rounded-md bg-input border border-border text-foreground text-sm">
                            <option value="">Select time</option>
                            {TIME_SLOTS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="guests" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Guests *</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={1} max={100} className="bg-input border-border text-foreground" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="specialRequest" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Special Requests (optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Any dietary requirements, special occasions, seating preferences..." rows={3} className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-semibold" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Submitting..." : "Reserve My Table"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    We'll confirm your reservation by phone. For immediate assistance, call <a href="tel:0791224513" className="text-primary hover:underline">0791 224513</a>.
                  </p>
                </form>
              </Form>
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
