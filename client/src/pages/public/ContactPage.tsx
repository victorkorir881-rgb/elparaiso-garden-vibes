import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, MapPin, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import PublicLayout from "@/components/public/PublicLayout";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(9, "Valid phone number required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  inquiryType: z.string().min(1, "Please select an inquiry type"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type FormData = z.infer<typeof schema>;

const INQUIRY_TYPES = ["General Inquiry", "Reservation", "Private Event", "Delivery Question", "Feedback"];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const { data: settings } = trpc.settings.get.useQuery();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", inquiryType: "", message: "" },
  });

  const submitMutation = trpc.contact.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      form.reset();
    },
    onError: (err) => toast.error(err.message ?? "Failed to send message"),
  });

  const onSubmit = (data: FormData) => submitMutation.mutate(data);

  const phone = settings?.phone ?? "0791 224513";
  const whatsapp = settings?.whatsapp ?? "254791224513";
  const address = settings?.address ?? "County Government Street, Kisii, Kenya";
  const mapsEmbed = settings?.maps_embed ?? "";
  const mapsLink = settings?.maps_link ?? "https://maps.google.com/?q=Kisii+Kenya";

  return (
    <PublicLayout>
      <section className="py-20 bg-card/50 border-b border-border">
        <div className="container text-center">
          <h1 className="section-title text-foreground mb-4">Contact & Visit Us</h1>
          <div className="gold-divider mx-auto mb-4" />
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            We'd love to hear from you. Reach out for reservations, events, or any inquiries.
          </p>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <div className="bg-card border border-border rounded-xl p-6 mb-6">
                <h2 className="font-display font-semibold text-xl text-foreground mb-5">Get In Touch</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-foreground">Address</div>
                      <div className="text-muted-foreground text-sm">{address}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-foreground">Phone</div>
                      <a href={`tel:${phone}`} className="text-muted-foreground text-sm hover:text-primary transition-colors">{phone}</a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-foreground">Hours</div>
                      <div className="text-primary text-sm font-medium">Open 24/7 — Every Day</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <a href={`tel:${phone}`} className="flex-1">
                  <Button className="w-full bg-primary text-primary-foreground">
                    <Phone className="w-4 h-4 mr-2" /> Call Now
                  </Button>
                </a>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10">
                    WhatsApp Us
                  </Button>
                </a>
                <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full border-border text-foreground hover:bg-accent">
                    Directions
                  </Button>
                </a>
              </div>

              {/* Map */}
              <div className="rounded-xl overflow-hidden border border-border h-64 bg-card">
                {mapsEmbed ? (
                  <iframe src={mapsEmbed} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" title="Elparaiso Location" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <MapPin className="w-8 h-8 text-primary" />
                    <p className="text-sm">{address}</p>
                    <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline">Open in Google Maps</a>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-card border border-border rounded-xl p-6">
              {submitted ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <CheckCircle className="w-16 h-16 text-primary mb-4" />
                  <h3 className="font-display font-semibold text-xl text-foreground mb-2">Message Sent!</h3>
                  <p className="text-muted-foreground mb-6">Thank you for reaching out. We'll get back to you shortly.</p>
                  <Button onClick={() => setSubmitted(false)} variant="outline" className="border-border text-foreground hover:bg-accent">
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="font-display font-semibold text-xl text-foreground mb-5">Send Us a Message</h2>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground">Name *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Your name" className="bg-input border-border text-foreground placeholder:text-muted-foreground" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground">Phone *</FormLabel>
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
                      <FormField control={form.control} name="inquiryType" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Inquiry Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-input border-border text-foreground">
                                <SelectValue placeholder="Select inquiry type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-popover border-border">
                              {INQUIRY_TYPES.map((t) => (
                                <SelectItem key={t} value={t} className="text-foreground hover:bg-accent">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="message" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Message *</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="How can we help you?" rows={4} className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={submitMutation.isPending}>
                        {submitMutation.isPending ? "Sending..." : "Send Message"}
                      </Button>
                    </form>
                  </Form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
