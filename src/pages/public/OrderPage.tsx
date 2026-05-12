import { useState, useEffect, useRef } from "react";
import { useCreateOrder, useSettings } from "@/lib/supabase-hooks";
import { useInitiateMpesaPayment, usePaymentStatus, useClaimManualPayment } from "@/lib/payments";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, ShoppingBag, Trash2, Plus, Minus, Check, Home, UtensilsCrossed,
  CalendarDays, Phone, Smartphone, X, ChevronRight, ChevronLeft, User,
  CreditCard, ClipboardList, Truck, Store, Utensils, Lock, ArrowRight,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import PublicLayout from "@/components/public/PublicLayout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

type Step = 1 | 2;

function isValidLocalMobile(local: string): boolean {
  return /^[17]\d{8}$/.test(local);
}
function isValidEmail(email: string): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function OrderPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const {
    items, removeItem, updateQuantity, clearCart, total, itemCount, openCart,
  } = useCart();

  const [orderType, setOrderType] = useState<"dine-in" | "takeaway" | "delivery">("delivery");
  const paymentChoice = "mpesa" as const;
  const [customerName, setCustomerName] = useState(auth.user?.name ?? "");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [customerEmail, setCustomerEmail] = useState(auth.user?.email ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Scroll to the top of the page whenever the checkout step changes so
  // customers always see the new step from the start instead of mid-page.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [step]);

  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [paymentTimedOut, setPaymentTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initiatePayment = useInitiateMpesaPayment();
  const { data: paymentRow, refetch: refetchPayment } = usePaymentStatus(paymentId);
  const claimManual = useClaimManualPayment();
  const [manualRef, setManualRef] = useState("");
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const createOrder = useCreateOrder();
  const { data: settings } = useSettings();

  // Pre-fill from auth when it loads
  useEffect(() => {
    if (auth.user?.name && !customerName) setCustomerName(auth.user.name);
    if (auth.user?.email && !customerEmail) setCustomerEmail(auth.user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user]);

  // Stop polling and surface a timeout if the callback hasn't arrived
  // within the M-Pesa STK push window (~90s safety margin).
  useEffect(() => {
    if (!paymentId) return;
    if (paymentRow && paymentRow.status !== "pending") return;
    setPaymentTimedOut(false);
    timeoutRef.current = setTimeout(() => setPaymentTimedOut(true), 120_000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [paymentId, paymentRow?.status]);

  useEffect(() => {
    if (!paymentRow) return;
    if (paymentRow.status === "success") {
      toast.success(`Payment received${paymentRow.mpesa_receipt_number ? ` (${paymentRow.mpesa_receipt_number})` : ""}!`);
      setOrderPlaced(true);
      setPendingVerification(false);
      setPaymentOpen(false);
      setPaymentId(null);
      setPaymentTimedOut(false);
      clearCart();
      setIsCheckingOut(false);
    } else if (paymentRow.status === "failed" || paymentRow.status === "cancelled" || paymentRow.status === "timeout") {
      toast.error(paymentRow.result_desc ?? `Payment ${paymentRow.status}. Please try again.`);
      setIsCheckingOut(false);
    }
    // React to admin decisions on a manual M-Pesa claim.
    if (paymentRow.manual_claim_status === "rejected") {
      toast.error(
        paymentRow.manual_notes
          ? `Payment reference rejected: ${paymentRow.manual_notes}`
          : "Admin couldn't verify your M-Pesa reference. Please retry payment.",
      );
      setPendingVerification(false);
      setOrderPlaced(false);
      setManualSubmitted(false);
      setManualRef("");
      setPaymentTimedOut(true);
      setPaymentOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentRow?.status, paymentRow?.manual_claim_status]);

  const fullPhone = phoneLocal ? `254${phoneLocal}` : "";
  const phoneValid = isValidLocalMobile(phoneLocal);
  const emailValid = isValidEmail(customerEmail.trim());
  const nameValid = customerName.trim().length >= 2;
  const addressValid = orderType !== "delivery" || deliveryAddress.trim().length >= 3;
  const detailsValid = nameValid && phoneValid && emailValid && addressValid;

  const subtotalNum = parseFloat(total) || 0;
  // Delivery fee + minimum order are admin-controlled via Business Rules.
  const adminDeliveryFee = Math.max(0, Number(settings?.deliveryFee ?? 200));
  const adminMinimumOrder = Math.max(0, Number(settings?.minimumOrderValue ?? 0));
  const deliveryFee = orderType === "delivery" && subtotalNum > 0 ? adminDeliveryFee : 0;
  const grandTotal = subtotalNum + deliveryFee;

  const generateOrderNumber = () => {
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${date}-${rand}`;
  };

  const handlePhoneChange = (raw: string) => {
    let d = raw.replace(/\D/g, "");
    if (d.startsWith("254")) d = d.slice(3);
    else if (d.startsWith("0")) d = d.slice(1);
    setPhoneLocal(d.slice(0, 9));
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) { toast.error("Your cart is empty"); return; }
    setTouched({ name: true, phone: true, email: true, address: true });
    if (!detailsValid) {
      toast.error("Please fix the highlighted fields before continuing");
      setStep(1);
      return;
    }

    setIsCheckingOut(true);
    const ordNum = generateOrderNumber();
    const amountKes = Math.max(1, Math.round(grandTotal));

    createOrder.mutate(
      {
        order_number: ordNum,
        customer_name: customerName.trim(),
        customer_phone: fullPhone,
        customer_email: customerEmail.trim() || undefined,
        items: items.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
        total_amount: grandTotal,
        order_type: orderType,
        delivery_address: orderType === "delivery" ? deliveryAddress.trim() : undefined,
        special_instructions: specialInstructions.trim() || undefined,
        estimated_time: 30,
        payment_method: paymentChoice,
      },
      {
        onSuccess: (created: any) => {
          setOrderNumber(ordNum);
          setPendingOrderId(created.id);
          initiatePayment.mutate(
            { orderId: created.id, phone: fullPhone, amount: amountKes },
            {
              onSuccess: (res) => {
                setPaymentId(res.paymentId);
                setPaymentOpen(true);
                toast.success(res.message);
              },
              onError: (err) => {
                toast.error(err.message ?? "Failed to start M-Pesa payment.");
                setIsCheckingOut(false);
              },
            },
          );
        },
        onError: (err: any) => {
          toast.error(err?.message ?? "Failed to place order. Please try again.");
          setIsCheckingOut(false);
        },
      },
    );
  };

  const handleRetryPayment = () => {
    if (!pendingOrderId) return;
    const amountKes = Math.max(1, Math.round(grandTotal));
    setPaymentTimedOut(false);
    setPaymentId(null);
    initiatePayment.mutate(
      { orderId: pendingOrderId, phone: fullPhone, amount: amountKes },
      {
        onSuccess: (res) => { setPaymentId(res.paymentId); toast.success(res.message); },
        onError: (err) => toast.error(err.message ?? "Failed to retry payment"),
      },
    );
  };

  // ----- SUCCESS STATE -----
  if (orderPlaced) {
    return (
      <PublicLayout>
        <div className="relative bg-background py-12 sm:py-20 px-3 sm:px-4 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-60"
            style={{ background: "radial-gradient(60% 50% at 50% 0%, oklch(74% 0.11 75 / 0.18), transparent 70%)" }} />
          <div className="max-w-2xl mx-auto text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full blur-xl" style={{ background: "var(--gradient-gold)", opacity: 0.45 }} />
              <div className="relative w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
                <Check className="w-9 h-9 text-primary-foreground" strokeWidth={3} />
              </div>
            </div>
            <Badge variant="outline" className="mb-3 border-primary/40 text-primary">
              {pendingVerification ? "Awaiting payment verification" : "Order confirmed"}
            </Badge>
            <h1 className="text-3xl sm:text-5xl font-bold font-display mb-3 tracking-tight">
              {pendingVerification ? "Thanks — we're verifying your payment" : "Thank you for your order"}
            </h1>
            <p className="text-foreground/60 mb-8 text-base sm:text-lg">
              {pendingVerification
                ? "Our team is cross-checking the M-Pesa reference you provided. You'll get an SMS and email the moment it's approved."
                : "We've received your order and the kitchen is on it."}
            </p>
            <Card className="p-6 sm:p-8 mb-8 border-primary/20" style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-elegant)" }}>
              <div className="grid sm:grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-xs uppercase tracking-wider text-foreground/50 mb-1">Order Number</p>
                  <p className="text-lg sm:text-xl font-bold font-display text-primary break-all">{orderNumber}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-foreground/50 mb-1">Estimated Time</p>
                  <p className="text-lg font-semibold">30 minutes</p>
                </div>
              </div>
            </Card>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/track"><Button>Track Your Order <ArrowRight className="w-4 h-4 ml-1.5" /></Button></Link>
              <Link to="/menu"><Button variant="outline"><UtensilsCrossed className="w-4 h-4 mr-1.5" />Order more</Button></Link>
              <Link to="/"><Button variant="outline"><Home className="w-4 h-4 mr-1.5" />Home</Button></Link>
            </div>
            <div className="pt-6 mt-6 border-t border-border">
              <p className="text-sm text-foreground/60 mb-3">Need help?</p>
              <div className="flex flex-wrap gap-4 justify-center">
                <a href="tel:0791224513" className="text-primary hover:underline text-sm font-medium">📞 0791 224513</a>
                <a href="https://wa.me/254791224513" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm font-medium">💬 WhatsApp</a>
              </div>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // ----- EMPTY CART STATE -----
  if (items.length === 0) {
    return (
      <PublicLayout>
        <div className="container py-16 md:py-24 max-w-xl text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-10 h-10 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold mb-3 tracking-tight">Your cart is empty</h1>
          <p className="text-muted-foreground mb-8">
            Browse the menu, add what you love, and come back here to check out.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={() => navigate({ to: "/menu" })} size="lg" className="rounded-full"
              style={{ background: "var(--gradient-gold)", color: "var(--primary-foreground)" }}>
              <UtensilsCrossed className="w-4 h-4 mr-1.5" /> Browse Menu
            </Button>
            <Link to="/"><Button variant="outline" size="lg" className="rounded-full"><Home className="w-4 h-4 mr-1.5" />Home</Button></Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // ----- CHECKOUT -----
  const stepperItems: { id: Step; label: string; icon: any }[] = [
    { id: 1, label: "Details", icon: User },
    { id: 2, label: "Review & Pay", icon: CreditCard },
  ];

  const orderTypeOptions: { id: typeof orderType; label: string; icon: any; desc: string }[] = [
    { id: "delivery", label: "Delivery", icon: Truck, desc: "Our riders bring it to you" },
    { id: "takeaway", label: "Takeaway", icon: Store, desc: "Pick up ready" },
    { id: "dine-in", label: "Dine in", icon: Utensils, desc: "Eat with us" },
  ];

  return (
    <PublicLayout>
      <div className="bg-background min-h-screen">
        <div className="container py-6 md:py-10 max-w-6xl">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <Link to="/menu" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" /> Back to menu
            </Link>
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Secure checkout
            </div>
          </div>

          <header className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight mb-2">
              Checkout
            </h1>
            <p className="text-muted-foreground text-sm">
              {itemCount} {itemCount === 1 ? "item" : "items"} · KES {grandTotal.toLocaleString()}
            </p>
          </header>

          {/* Stepper */}
          <ol className="flex items-center gap-2 mb-8 max-w-md" aria-label="Checkout steps">
            {stepperItems.map((s, idx) => {
              const Icon = s.icon;
              const active = step === s.id;
              const done = step > s.id;
              return (
                <li key={s.id} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className="flex items-center gap-2 group"
                    aria-current={active ? "step" : undefined}
                  >
                    <span className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors shrink-0",
                      done && "bg-primary text-primary-foreground border-primary",
                      active && "bg-primary/10 text-primary border-primary",
                      !active && !done && "bg-muted text-foreground/50 border-border",
                    )}>
                      {done ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                    </span>
                    <span className={cn(
                      "text-sm font-medium hidden sm:inline",
                      active ? "text-foreground" : "text-foreground/60",
                    )}>{s.label}</span>
                  </button>
                  {idx < stepperItems.length - 1 && (
                    <span className={cn("flex-1 h-px mx-3", step > s.id ? "bg-primary" : "bg-border")} />
                  )}
                </li>
              );
            })}
          </ol>

          <div className="grid lg:grid-cols-[1fr_380px] gap-6 lg:gap-10 items-start">
            {/* LEFT — form */}
            <div className="space-y-6 min-w-0">
              {step === 1 && (
                <>
                  {/* Order type */}
                  <Card className="p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      How would you like it?
                    </h2>
                    <div className="grid grid-cols-3 gap-2">
                      {orderTypeOptions.map((opt) => {
                        const Icon = opt.icon;
                        const sel = orderType === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setOrderType(opt.id)}
                            className={cn(
                              "p-3 rounded-xl border text-left transition-all",
                              sel
                                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                                : "border-border hover:border-primary/40 hover:bg-accent/30",
                            )}
                          >
                            <Icon className={cn("w-5 h-5 mb-2", sel ? "text-primary" : "text-muted-foreground")} />
                            <div className="text-sm font-semibold text-foreground">{opt.label}</div>
                            <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                    {orderType === "delivery" && (
                      <p className="mt-3 text-xs text-muted-foreground flex items-start gap-1.5">
                        <Truck className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                        Elparaiso handles delivery in-house — our own riders will bring your order. A flat delivery fee of KES {adminDeliveryFee.toLocaleString()} applies.
                      </p>
                    )}
                  </Card>

                  {/* Customer details */}
                  <Card className="p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                      Contact details
                    </h2>
                    <div className="space-y-4">
                      <Field label="Full name" required error={touched.name && !nameValid ? "Please enter your full name." : undefined}>
                        <Input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                          placeholder="Your name"
                          aria-invalid={touched.name && !nameValid}
                        />
                      </Field>

                      <Field
                        label="Phone number"
                        required
                        hint={!touched.phone || phoneValid ? `We'll send the M-Pesa STK push to ${fullPhone || "+254 …"}` : undefined}
                        error={touched.phone && !phoneValid ? "Enter a 9-digit Kenyan mobile (e.g. 712345678)." : undefined}
                      >
                        <div className={cn(
                          "flex items-stretch rounded-md border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring",
                          touched.phone && !phoneValid && "border-destructive",
                        )}>
                          <span className="inline-flex items-center px-3 bg-muted text-sm font-medium text-foreground/70 border-r">
                            🇰🇪 +254
                          </span>
                          <Input
                            type="tel"
                            inputMode="numeric"
                            value={phoneLocal}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                            placeholder="712 345 678"
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            maxLength={9}
                            aria-invalid={touched.phone && !phoneValid}
                          />
                        </div>
                      </Field>

                      <Field label="Email" hint="Optional — for receipts" error={touched.email && !emailValid ? "Please enter a valid email." : undefined}>
                        <Input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                          placeholder="your@email.com"
                          aria-invalid={touched.email && !emailValid}
                        />
                      </Field>

                      {orderType === "delivery" && (
                        <Field label="Delivery address" required error={touched.address && !addressValid ? "Please enter a delivery address." : undefined}>
                          <Textarea
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            onBlur={() => setTouched((t) => ({ ...t, address: true }))}
                            placeholder="Street, building, apt, landmarks…"
                            rows={2}
                            aria-invalid={touched.address && !addressValid}
                          />
                        </Field>
                      )}

                      <Field label="Special instructions" hint="Optional">
                        <Textarea
                          value={specialInstructions}
                          onChange={(e) => setSpecialInstructions(e.target.value)}
                          placeholder="No onions, extra spicy, allergies…"
                          rows={2}
                        />
                      </Field>
                    </div>
                  </Card>

                  <div className="flex gap-2">
                    <Link to="/menu" className="flex-1">
                      <Button variant="outline" className="w-full">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Continue Shopping
                      </Button>
                    </Link>
                    <Button
                      onClick={() => {
                        setTouched({ name: true, phone: true, email: true, address: true });
                        if (!detailsValid) { toast.error("Please fix the highlighted fields"); return; }
                        setStep(2);
                      }}
                      className="flex-1"
                      size="lg"
                    >
                      Continue to payment <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <Card className="p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" /> Review your order
                    </h2>
                    <dl className="text-sm space-y-2.5">
                      <Row label="Name" value={customerName} />
                      <Row label="Phone" value={fullPhone} />
                      {customerEmail && <Row label="Email" value={customerEmail} />}
                      <Row label="Order type" value={orderType.replace("-", " ")} />
                      {orderType === "delivery" && <Row label="Delivery to" value={deliveryAddress} />}
                      {specialInstructions && <Row label="Notes" value={specialInstructions} />}
                    </dl>
                  </Card>

                  <Card className="p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                      Payment method
                    </h2>
                    <div className="p-4 rounded-xl border-2 border-primary bg-primary/5">
                      <div className="flex items-center gap-3 mb-1.5">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-gold)" }}>
                          <Smartphone className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">M-Pesa</div>
                          <div className="text-[11px] text-muted-foreground">Pay securely via STK push</div>
                        </div>
                        <Check className="w-5 h-5 text-primary ml-auto" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        You'll receive an STK prompt on <span className="font-medium text-foreground">{fullPhone}</span>.
                        Your order is sent to the kitchen only after payment is confirmed.
                      </p>
                    </div>
                  </Card>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1" disabled={isCheckingOut}>
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button
                      onClick={handlePlaceOrder}
                      disabled={isCheckingOut}
                      className="flex-[2] font-semibold"
                      size="lg"
                      style={{ background: "var(--gradient-gold)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-gold)" }}
                    >
                      {isCheckingOut ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</>
                      ) : (
                        <><Lock className="w-4 h-4 mr-2" />Pay KES {grandTotal.toLocaleString()}</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* RIGHT — Order summary */}
            <aside className="lg:sticky lg:top-24">
              <Card className="overflow-hidden border-border/60" style={{ background: "var(--gradient-surface)" }}>
                <div className="p-5 border-b border-border/60 flex items-center justify-between">
                  <h2 className="font-semibold flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-primary" /> Order summary
                  </h2>
                  <button onClick={openCart} className="text-xs text-primary hover:underline">
                    Edit
                  </button>
                </div>

                <div className="max-h-[340px] overflow-y-auto p-4 space-y-3">
                  {items.map((item) => {
                    const lineTotal = parseFloat(item.price) * item.quantity;
                    return (
                      <div key={item.id} className="flex gap-3">
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                              <UtensilsCrossed className="w-5 h-5" />
                            </div>
                          )}
                          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center tabular-nums">
                            {item.quantity}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground line-clamp-1">{item.name}</div>
                          <div className="text-xs text-muted-foreground">KES {parseFloat(item.price).toLocaleString()}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-accent"
                              aria-label="Decrease"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-accent"
                              aria-label="Increase"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="ml-1 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive"
                              aria-label="Remove"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums shrink-0">
                          KES {lineTotal.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-5 border-t border-border/60 space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">KES {subtotalNum.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{orderType === "delivery" ? "Delivery fee" : "Service fee"}</span>
                    <span className="tabular-nums">{deliveryFee > 0 ? `KES ${deliveryFee.toLocaleString()}` : "Free"}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-medium text-foreground">Total</span>
                    <span className="text-2xl font-bold text-primary tabular-nums">
                      KES {grandTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Card>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <a href="tel:0791224513" className="inline-flex items-center gap-1.5 hover:text-primary"><Phone className="w-3.5 h-3.5" /> 0791 224513</a>
                <Link to="/track" className="inline-flex items-center gap-1.5 hover:text-primary"><CalendarDays className="w-3.5 h-3.5" /> Track order</Link>
              </div>
            </aside>
          </div>
        </div>

        {/* M-Pesa Payment Modal */}
        {paymentOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
            <Card className="w-full max-w-md p-6 relative" style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-elegant)" }}>
              <button
                type="button"
                onClick={() => {
                  setPaymentOpen(false);
                  setPaymentId(null);
                  setPaymentTimedOut(false);
                  setIsCheckingOut(false);
                }}
                className="absolute top-3 right-3 text-foreground/50 hover:text-foreground p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
                  <Smartphone className="w-7 h-7 text-primary-foreground" />
                </div>
                <h2 className="text-xl font-bold font-display mb-2">Confirm M-Pesa Payment</h2>
                <p className="text-sm text-foreground/60 mb-4">
                  A prompt has been sent to <span className="font-medium text-foreground">{fullPhone}</span>.
                  Enter your M-Pesa PIN to pay <span className="font-semibold text-primary">KES {grandTotal.toLocaleString()}</span>.
                </p>

                {(!paymentRow || paymentRow.status === "pending") && !paymentTimedOut && (
                  <div className="flex flex-col items-center gap-2 py-4 text-foreground/70">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Waiting for confirmation…</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => refetchPayment()}
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      I've paid — check status now
                    </button>
                  </div>
                )}

                {(!paymentRow || paymentRow.status === "pending") && paymentTimedOut && (
                  <div className="py-4 space-y-3 text-left">
                    <p className="text-amber-400 text-sm">
                      We didn't receive a confirmation from M-Pesa. If you completed payment, enter the M-Pesa reference code from the SMS — admin will verify and confirm your order. Otherwise, retry the prompt.
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
                                setPendingVerification(true);
                                toast.success("Reference submitted — admin will verify shortly.");
                                setOrderPlaced(true);
                                setPaymentOpen(false);
                                // Keep paymentId so usePaymentStatus keeps
                                // polling — when admin approves/rejects we
                                // flip the UI automatically.
                                setPaymentTimedOut(false);
                                clearCart();
                                setIsCheckingOut(false);
                              },
                              onError: (e) => toast.error(e.message ?? "Failed to submit reference"),
                            },
                          );
                        }}
                      >
                        {claimManual.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                        Submit reference for verification
                      </Button>
                      <p className="text-[11px] text-foreground/50">
                        The code looks like <span className="font-mono">QGH7X8Y9ZA</span> — find it in the M-Pesa SMS that confirmed your payment.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <Button variant="outline" onClick={() => { setPaymentTimedOut(false); refetchPayment(); }} className="flex-1">
                        Check status
                      </Button>
                      <Button variant="outline" onClick={handleRetryPayment} className="flex-1">
                        <Smartphone className="w-4 h-4 mr-2" /> Retry STK push
                      </Button>
                    </div>
                  </div>
                )}

                {paymentRow?.status === "success" && (
                  <div className="py-4 space-y-1">
                    <p className="text-emerald-400 font-medium">Payment received!</p>
                    {paymentRow.mpesa_receipt_number && (
                      <p className="text-xs text-foreground/60 font-mono">{paymentRow.mpesa_receipt_number}</p>
                    )}
                  </div>
                )}

                {paymentRow && ["failed", "cancelled", "timeout"].includes(paymentRow.status) && (
                  <div className="py-4 space-y-3">
                    <p className="text-destructive text-sm">
                      {paymentRow.result_desc ?? `Payment ${paymentRow.status}.`}
                    </p>
                    <Button onClick={handleRetryPayment} className="w-full">
                      <Smartphone className="w-4 h-4 mr-2" /> Retry Payment
                    </Button>
                  </div>
                )}

                <p className="text-xs text-foreground/50 mt-4">
                  Order number: <span className="font-mono">{orderNumber}</span>
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

function Field({
  label, required, hint, error, children,
}: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-1.5 block">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-foreground/60 shrink-0">{label}</dt>
      <dd className="font-medium text-right capitalize">{value}</dd>
    </div>
  );
}
