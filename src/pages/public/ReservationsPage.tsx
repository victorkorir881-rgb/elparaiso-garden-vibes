import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v3";
import { CheckCircle, Calendar, Clock, Users, Phone, Smartphone, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { useSettings, useCreateReservation } from "@/lib/supabase-hooks";
import { useInitiateMpesaPayment, usePaymentStatus, useClaimManualPayment } from "@/lib/payments";
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
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [depositPaid, setDepositPaid] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentTimedOut, setPaymentTimedOut] = useState(false);
  const [manualRef, setManualRef] = useState("");
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: settings } = useSettings();
  const depositAmount = Math.max(0, parseInt(settings?.reservation_deposit_amount ?? "0", 10) || 0);

  const initiatePayment = useInitiateMpesaPayment();
  const { data: paymentRow, refetch: refetchPayment } = usePaymentStatus(paymentId);
  const claimManual = useClaimManualPayment();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", date: "", time: "", guests: 2, specialRequest: "" },
  });

  const createMutation = useCreateReservation();

  // Surface a timeout if the M-Pesa callback hasn't arrived in ~120s so the
  // user can retry the STK push or submit a manual reference, without ever
  // creating a duplicate reservation (we keep the same reservationId).
  useEffect(() => {
    if (!paymentId) return;
    if (paymentRow && paymentRow.status !== "pending") return;
    setPaymentTimedOut(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setPaymentTimedOut(true), 120_000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [paymentId, paymentRow?.status]);

  // React to payment state changes
  useEffect(() => {
    if (!paymentRow) return;
    if (paymentRow.status === "success") {
      toast.success(`Deposit received${paymentRow.mpesa_receipt_number ? ` (${paymentRow.mpesa_receipt_number})` : ""}!`);
      setDepositPaid(true);
      setPaymentOpen(false);
      setPaymentId(null);
      setPaymentTimedOut(false);
    } else if (paymentRow.status === "failed" || paymentRow.status === "cancelled" || paymentRow.status === "timeout") {
      toast.error(paymentRow.result_desc ?? `Payment ${paymentRow.status}. Please try again.`);
    }
    if (paymentRow.manual_claim_status === "rejected") {
      toast.error(
        paymentRow.manual_notes
          ? `Reference rejected: ${paymentRow.manual_notes}`
          : "Admin couldn't verify your M-Pesa reference. Please retry payment.",
      );
      setManualSubmitted(false);
      setManualRef("");
      setPaymentTimedOut(true);
      setPaymentOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentRow?.status, paymentRow?.manual_claim_status]);

  const onSubmit = (data: FormData) => {
    createMutation.mutate(
      {
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        date: data.date,
        time: data.time,
        party_size: data.guests,
        notes: data.specialRequest || undefined,
        source: "website",
        // Persist configured deposit amount on the reservation row so the
        // edge function can validate the requested amount on retry.
        ...(depositAmount > 0 ? { deposit_amount: depositAmount } : {}),
      } as any,
      {
        onSuccess: (created: any) => {
          setSubmitted(true);
          setSubmittedData(data);
          setReservationId(created?.id ?? null);
        },
        onError: (err) => toast.error(err.message ?? "Failed to submit reservation"),
      }
    );
  };

  const handlePayDeposit = () => {
    if (!reservationId || !submittedData || depositAmount <= 0) return;
    // Reset transient retry state — we re-use the same reservationId so no
    // duplicate reservation is created on subsequent attempts.
    setPaymentTimedOut(false);
    setManualRef("");
    setManualSubmitted(false);
    setPaymentId(null);
    initiatePayment.mutate(
      { reservationId, phone: submittedData.phone, amount: depositAmount },
      {
        onSuccess: (res) => {
          setPaymentId(res.paymentId);
          setPaymentOpen(true);
          toast.success(res.message);
        },
        onError: (err) => toast.error(err.message ?? "Failed to start M-Pesa payment"),
      },
    );
  };

  const whatsapp = settings?.whatsapp ?? "254791224513";
  const today = new Date().toISOString().split("T")[0];
  const isPaying = paymentRow?.status === "pending" || initiatePayment.isPending;

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
                Thank you, <strong className="text-foreground">{submittedData.name}</strong>! Your reservation request has been received{depositAmount > 0 && !depositPaid ? "." : ". We'll confirm shortly."}
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

              {/* Deposit step — only when configured > 0 */}
              {depositAmount > 0 && (
                <div className="bg-background border border-primary/40 rounded-xl p-5 mb-6 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">
                      {depositPaid ? "Deposit Paid" : "Confirm with M-Pesa Deposit"}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {depositPaid
                      ? `We've received your KES ${depositAmount.toLocaleString()} deposit. Your booking is confirmed — see you soon!`
                      : `Pay a KES ${depositAmount.toLocaleString()} deposit via M-Pesa to lock your slot. We'll send an STK Push prompt to ${submittedData.phone}.`}
                  </p>
                  {!depositPaid && !paymentTimedOut && (
                    <div className="space-y-2">
                      <Button
                        onClick={handlePayDeposit}
                        disabled={isPaying}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
                      >
                        {isPaying ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Awaiting payment…</>
                        ) : (
                          <><Smartphone className="w-4 h-4 mr-2" />Pay KES {depositAmount.toLocaleString()} Deposit</>
                        )}
                      </Button>
                      {paymentId && paymentRow?.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => refetchPayment()}
                          className="text-xs text-primary hover:underline block"
                        >
                          I've paid — check status now
                        </button>
                      )}
                    </div>
                  )}

                  {!depositPaid && paymentTimedOut && (
                    <div className="space-y-3 mt-2">
                      <p className="text-amber-400 text-sm">
                        We didn't receive a confirmation from M-Pesa. If you completed payment, enter the reference code from the SMS so admin can verify it. Otherwise, retry the prompt — your reservation is preserved either way.
                      </p>

                      <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
                        <label className="text-xs font-medium text-foreground/70 block">
                          M-Pesa reference code
                        </label>
                        <Input
                          value={manualRef}
                          onChange={(e) => setManualRef(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))}
                          placeholder="e.g. QGH7X8Y9ZA"
                          maxLength={20}
                          className="font-mono uppercase"
                          disabled={claimManual.isPending || manualSubmitted}
                        />
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={!paymentId || manualRef.length < 8 || claimManual.isPending || manualSubmitted}
                          onClick={() => {
                            if (!paymentId) return;
                            claimManual.mutate(
                              { paymentId, reference: manualRef },
                              {
                                onSuccess: () => {
                                  setManualSubmitted(true);
                                  toast.success("Reference submitted — admin will verify shortly.");
                                  setPaymentTimedOut(false);
                                  setPaymentOpen(false);
                                },
                                onError: (e) => toast.error(e.message ?? "Failed to submit reference"),
                              },
                            );
                          }}
                        >
                          {claimManual.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                          Submit reference for verification
                        </Button>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => { setPaymentTimedOut(false); refetchPayment(); }} className="flex-1">
                          Check status
                        </Button>
                        <Button variant="outline" onClick={handlePayDeposit} disabled={initiatePayment.isPending} className="flex-1">
                          {initiatePayment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Smartphone className="w-4 h-4 mr-2" />}
                          Retry STK push
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href={`https://wa.me/${whatsapp}?text=Hi%20Elparaiso%20Garden!%20I%20just%20made%20a%20reservation%20for%20${submittedData.guests}%20guests%20on%20${submittedData.date}%20at%20${submittedData.time}.%20My%20name%20is%20${encodeURIComponent(submittedData.name)}.`} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-green-600 hover:bg-green-500 text-white">Confirm via WhatsApp</Button>
                </a>
                <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => {
                  setSubmitted(false); setSubmittedData(null); setReservationId(null);
                  setDepositPaid(false); setPaymentId(null); form.reset();
                }}>
                  Make Another Reservation
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="font-display font-semibold text-xl text-foreground mb-6">Reservation Details</h2>
              {depositAmount > 0 && (
                <p className="text-sm text-muted-foreground mb-5 bg-background border border-border rounded-md p-3">
                  A KES <strong className="text-foreground">{depositAmount.toLocaleString()}</strong> M-Pesa deposit will be requested after you submit, to secure your slot.
                </p>
              )}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Full Name *</FormLabel>
                        <FormControl><Input {...field} placeholder="Your name" className="bg-input border-border text-foreground placeholder:text-muted-foreground" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Phone Number *</FormLabel>
                        <FormControl><Input {...field} placeholder="07XX XXX XXX" className="bg-input border-border text-foreground placeholder:text-muted-foreground" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Email (optional)</FormLabel>
                      <FormControl><Input {...field} type="email" placeholder="your@email.com" className="bg-input border-border text-foreground placeholder:text-muted-foreground" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem className="sm:col-span-1">
                        <FormLabel className="text-foreground">Date *</FormLabel>
                        <FormControl><Input {...field} type="date" min={today} className="bg-input border-border text-foreground" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="time" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Time *</FormLabel>
                        <FormControl>
                          <select {...field} className="w-full h-10 px-3 rounded-md bg-input border border-border text-foreground text-sm">
                            <option value="">Select time</option>
                            {TIME_SLOTS.map((t) => (<option key={t} value={t}>{t}</option>))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="guests" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Guests *</FormLabel>
                        <FormControl><Input {...field} type="number" min={1} max={100} className="bg-input border-border text-foreground" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="specialRequest" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Special Requests (optional)</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Any dietary requirements, special occasions, seating preferences..." rows={3} className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none" /></FormControl>
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

      {/* Payment polling modal */}
      {paymentOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">M-Pesa Deposit</h3>
              </div>
              <button onClick={() => setPaymentOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center py-6">
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
              <p className="text-sm text-foreground mb-1">Check your phone</p>
              <p className="text-xs text-muted-foreground">
                Enter your M-Pesa PIN to confirm KES {depositAmount.toLocaleString()}.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handlePayDeposit}
              disabled={initiatePayment.isPending}
            >
              {initiatePayment.isPending ? "Sending…" : "Resend STK Push"}
            </Button>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}
