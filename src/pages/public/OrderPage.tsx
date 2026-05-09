import { useState, useMemo, useEffect } from "react";
import { useMenuCategories, useMenuItems, useCreateOrder } from "@/lib/supabase-hooks";
import { useInitiateMpesaPayment, usePaymentStatus } from "@/lib/payments";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, ShoppingCart, Trash2, Plus, Minus, Check, Home, UtensilsCrossed,
  MapPin, CalendarDays, Phone, Smartphone, X, ChevronRight, ChevronLeft, User, CreditCard, ClipboardList,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import PublicLayout from "@/components/public/PublicLayout";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

/** Accepts 9 digits starting with 7 or 1 (Safaricom/Airtel mobile). */
function isValidLocalMobile(local: string): boolean {
  return /^[17]\d{8}$/.test(local);
}
function isValidEmail(email: string): boolean {
  if (!email) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function OrderPage() {
  const { data: categories = [] } = useMenuCategories(true);
  const { data: menuItems = [] } = useMenuItems({ availableOnly: true });

  const { items, addItem, removeItem, updateQuantity, clearCart, total, itemCount } = useCart();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway" | "delivery">("delivery");
  // M-Pesa is the only accepted payment method — orders are not visible to
  // admins until payment_status flips to "paid" via the Daraja callback.
  const paymentChoice = "mpesa" as const;
  const [customerName, setCustomerName] = useState("");
  // Phone is captured WITHOUT country code; we always store the local 9-digit part.
  const [phoneLocal, setPhoneLocal] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  // Checkout step (only applies when there are items in the cart)
  const [step, setStep] = useState<Step>(1);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Payment state
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const initiatePayment = useInitiateMpesaPayment();
  const { data: paymentRow } = usePaymentStatus(paymentId);
  const createOrder = useCreateOrder();

  // React to payment status changes
  useEffect(() => {
    if (!paymentRow) return;
    if (paymentRow.status === "success") {
      toast.success(`Payment received${paymentRow.mpesa_receipt_number ? ` (${paymentRow.mpesa_receipt_number})` : ""}!`);
      setOrderPlaced(true);
      setPaymentOpen(false);
      clearCart();
      setIsCheckingOut(false);
    } else if (paymentRow.status === "failed" || paymentRow.status === "cancelled" || paymentRow.status === "timeout") {
      toast.error(paymentRow.result_desc ?? `Payment ${paymentRow.status}. Please try again.`);
      setIsCheckingOut(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentRow?.status]);

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return menuItems;
    return menuItems.filter((item: any) => item.category_id === selectedCategory);
  }, [menuItems, selectedCategory]);

  const fullPhone = phoneLocal ? `254${phoneLocal}` : "";
  const phoneValid = isValidLocalMobile(phoneLocal);
  const emailValid = isValidEmail(customerEmail.trim());
  const nameValid = customerName.trim().length >= 2;
  const addressValid = orderType !== "delivery" || deliveryAddress.trim().length >= 3;

  const detailsValid = nameValid && phoneValid && emailValid && addressValid;

  const handleAddToCart = (item: any) => {
    addItem({
      id: item.id,
      categoryId: item.category_id,
      name: item.name,
      price: item.price,
      imageUrl: item.image_url,
    });
    toast.success(`${item.name} added to cart`);
  };

  const generateOrderNumber = () => {
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${date}-${rand}`;
  };

  /** Phone input handler — strips non-digits, normalises common prefixes. */
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
      setStep(2);
      return;
    }

    setIsCheckingOut(true);
    const ordNum = generateOrderNumber();
    const amountKes = Math.max(1, Math.round(parseFloat(total)));

    createOrder.mutate(
      {
        order_number: ordNum,
        customer_name: customerName.trim(),
        customer_phone: fullPhone,
        customer_email: customerEmail.trim() || undefined,
        items: items.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
        total_amount: parseFloat(total),
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

          // M-Pesa is the only accepted method. Trigger STK push immediately;
          // the order remains hidden from admins until payment succeeds.
          initiatePayment.mutate(
            { orderId: created.id, phone: fullPhone, amount: amountKes },
            {
              onSuccess: (res) => {
                setPaymentId(res.paymentId);
                setPaymentOpen(true);
                toast.success(res.message);
              },
              onError: (err) => {
                toast.error(err.message ?? "Failed to start M-Pesa payment. Order not submitted.");
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
    const amountKes = Math.round(parseFloat(total) || (paymentRow as any)?.amount || 0);
    initiatePayment.mutate(
      { orderId: pendingOrderId, phone: fullPhone, amount: amountKes },
      {
        onSuccess: (res) => { setPaymentId(res.paymentId); toast.success(res.message); },
        onError: (err) => toast.error(err.message ?? "Failed to retry payment"),
      },
    );
  };

  if (orderPlaced) {
    return (
      <PublicLayout>
        <div className="bg-background py-8 sm:py-12 px-3 sm:px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display mb-4">Order Placed Successfully!</h1>
            <p className="text-foreground/60 mb-8">Your order has been received and is being prepared.</p>
            <Card className="p-6 sm:p-8 mb-8 bg-muted">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-foreground/60 mb-1">Order Number</p>
                  <p className="text-xl sm:text-2xl font-bold font-display text-primary break-all">{orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground/60 mb-1">Estimated Time</p>
                  <p className="font-medium">30 minutes</p>
                </div>
              </div>
            </Card>
            <div className="space-y-3">
              <Link to="/track" className="inline-block"><Button>Track Your Order</Button></Link>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Link to="/"><Button variant="outline" size="sm"><Home className="w-4 h-4 mr-1.5" />Home</Button></Link>
                <Link to="/menu"><Button variant="outline" size="sm"><UtensilsCrossed className="w-4 h-4 mr-1.5" />Menu</Button></Link>
                <Link to="/reservations"><Button variant="outline" size="sm"><CalendarDays className="w-4 h-4 mr-1.5" />Reserve</Button></Link>
              </div>
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-foreground/60 mb-3">Need help?</p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <a href="tel:0791224513" className="text-primary hover:underline text-sm font-medium">📞 Call: 0791 224513</a>
                  <a href="https://wa.me/254791224513" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm font-medium">💬 WhatsApp</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const stepperItems: { id: Step; label: string; icon: any }[] = [
    { id: 1, label: "Cart", icon: ShoppingCart },
    { id: 2, label: "Details", icon: User },
    { id: 3, label: "Review & Pay", icon: CreditCard },
  ];

  return (
    <PublicLayout>
      <div className="bg-background py-6 sm:py-12 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page navigation */}
          <nav aria-label="Order page navigation" className="mb-6 flex flex-wrap gap-2">
            <Link to="/"><Button variant="outline" size="sm"><Home className="w-4 h-4 mr-1.5" />Home</Button></Link>
            <Link to="/menu"><Button variant="outline" size="sm"><UtensilsCrossed className="w-4 h-4 mr-1.5" />Menu</Button></Link>
            <Link to="/track"><Button variant="outline" size="sm"><MapPin className="w-4 h-4 mr-1.5" />Track Order</Button></Link>
            <Link to="/reservations"><Button variant="outline" size="sm"><CalendarDays className="w-4 h-4 mr-1.5" />Reserve a Table</Button></Link>
            <a href="tel:0791224513"><Button variant="outline" size="sm"><Phone className="w-4 h-4 mr-1.5" />Call</Button></a>
          </nav>

          <div className="mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold font-display mb-2">Place Your Order</h1>
            <p className="text-foreground/60 text-sm sm:text-base">Browse our menu and check out in three quick steps.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
            {/* LEFT — menu */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-3 sm:p-4">
                <div className="flex gap-2 flex-wrap">
                  <Button variant={selectedCategory === null ? "default" : "outline"} onClick={() => setSelectedCategory(null)} size="sm">All Items</Button>
                  {categories.map((cat: any) => (
                    <Button key={cat.id} variant={selectedCategory === cat.id ? "default" : "outline"} onClick={() => setSelectedCategory(cat.id)} size="sm">{cat.name}</Button>
                  ))}
                </div>
              </Card>

              <div className="grid sm:grid-cols-2 gap-4 stagger">
                {filteredItems.map((item: any) => (
                  <Card key={item.id} className="overflow-hidden hover:border-primary/50 transition-colors">
                    {item.image_url && (
                      <div className="w-full h-40 bg-muted overflow-hidden">
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-lg font-bold text-primary">KES {parseFloat(item.price).toLocaleString()}</p>
                      </div>
                      {item.description && <p className="text-sm text-foreground/60 mb-3">{item.description}</p>}
                      <Button onClick={() => handleAddToCart(item)} className="w-full" disabled={!item.is_available}>
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        {item.is_available ? "Add to Cart" : "Out of Stock"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* RIGHT — checkout column */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-24 space-y-6">
                {/* Stepper */}
                {items.length > 0 && (
                  <Card className="p-3">
                    <ol className="flex items-center justify-between" aria-label="Checkout steps">
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
                                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors",
                                done && "bg-primary text-primary-foreground border-primary",
                                active && "bg-primary/10 text-primary border-primary",
                                !active && !done && "bg-muted text-foreground/50 border-border",
                              )}>
                                {done ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                              </span>
                              <span className={cn(
                                "text-xs font-medium hidden sm:inline",
                                active ? "text-foreground" : "text-foreground/60",
                              )}>{s.label}</span>
                            </button>
                            {idx < stepperItems.length - 1 && (
                              <span className={cn("flex-1 h-px mx-2", step > s.id ? "bg-primary" : "bg-border")} />
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </Card>
                )}

                {/* Cart card — visible on every step as summary */}
                <Card className="p-4 border-2 border-primary/20">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingCart className="w-5 h-5" />
                    <h2 className="text-lg font-semibold">Your Cart</h2>
                    {itemCount > 0 && <Badge className="ml-auto">{itemCount}</Badge>}
                  </div>
                  {items.length === 0 ? (
                    <p className="text-sm text-foreground/60 py-4">Your cart is empty. Add items from the menu to begin.</p>
                  ) : (
                    <>
                      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <p className="text-xs text-foreground/60">KES {parseFloat(item.price).toLocaleString()} × {item.quantity}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="Decrease quantity"><Minus className="w-3 h-3" /></Button>
                              <span className="text-xs font-semibold w-6 text-center">{item.quantity}</span>
                              <Button size="sm" variant="ghost" onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="Increase quantity"><Plus className="w-3 h-3" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)} aria-label="Remove item"><Trash2 className="w-3 h-3 text-red-500" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-border pt-3 space-y-1">
                        <div className="flex justify-between text-sm text-foreground/70">
                          <span>Subtotal</span>
                          <span>KES {parseFloat(total).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total</span>
                          <span className="text-primary">KES {parseFloat(total).toLocaleString()}</span>
                        </div>
                      </div>
                    </>
                  )}
                </Card>

                {/* STEP 1 — cart actions */}
                {items.length > 0 && step === 1 && (
                  <Card className="p-4 space-y-3">
                    <Button onClick={() => setStep(2)} className="w-full" size="lg">
                      Continue to Details <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button variant="outline" onClick={() => { clearCart(); toast.success("Cart cleared"); }} className="w-full">
                      Clear Cart
                    </Button>
                  </Card>
                )}

                {/* STEP 2 — details */}
                {items.length > 0 && step === 2 && (
                  <>
                    <Card className="p-4">
                      <label className="text-sm font-medium mb-2 block">Order Type</label>
                      <Select value={orderType} onValueChange={(value: any) => setOrderType(value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="delivery">Delivery</SelectItem>
                          <SelectItem value="takeaway">Takeaway</SelectItem>
                          <SelectItem value="dine-in">Dine In</SelectItem>
                        </SelectContent>
                      </Select>
                    </Card>

                    <Card className="p-4">
                      <h3 className="font-semibold mb-4 flex items-center gap-2"><User className="w-4 h-4" />Customer Details</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-1 block">Full Name *</label>
                          <Input
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                            placeholder="Your name"
                            aria-invalid={touched.name && !nameValid}
                          />
                          {touched.name && !nameValid && (
                            <p className="text-xs text-destructive mt-1">Please enter your full name.</p>
                          )}
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-1 block">Phone Number *</label>
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
                          {touched.phone && !phoneValid ? (
                            <p className="text-xs text-destructive mt-1">
                              Enter a 9-digit Kenyan mobile number starting with 7 or 1 (e.g. 712345678).
                            </p>
                          ) : (
                            <p className="text-xs text-foreground/50 mt-1">
                              We'll send the M-Pesa STK push to <span className="font-medium">{fullPhone || "+254 …"}</span>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-1 block">Email</label>
                          <Input
                            type="email"
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                            placeholder="your@email.com"
                            aria-invalid={touched.email && !emailValid}
                          />
                          {touched.email && !emailValid && (
                            <p className="text-xs text-destructive mt-1">Please enter a valid email or leave blank.</p>
                          )}
                        </div>

                        {orderType === "delivery" && (
                          <div>
                            <label className="text-sm font-medium mb-1 block">Delivery Address *</label>
                            <Textarea
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              onBlur={() => setTouched((t) => ({ ...t, address: true }))}
                              placeholder="Street, building, apt number, landmarks…"
                              rows={2}
                              aria-invalid={touched.address && !addressValid}
                            />
                            {touched.address && !addressValid && (
                              <p className="text-xs text-destructive mt-1">Please enter a delivery address.</p>
                            )}
                          </div>
                        )}

                        <div>
                          <label className="text-sm font-medium mb-1 block">Special Instructions</label>
                          <Textarea
                            value={specialInstructions}
                            onChange={(e) => setSpecialInstructions(e.target.value)}
                            placeholder="No onions, extra spicy, etc…"
                            rows={2}
                          />
                        </div>
                      </div>
                    </Card>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back
                      </Button>
                      <Button
                        onClick={() => {
                          setTouched({ name: true, phone: true, email: true, address: true });
                          if (!detailsValid) {
                            toast.error("Please fix the highlighted fields");
                            return;
                          }
                          setStep(3);
                        }}
                        className="flex-1"
                      >
                        Continue <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </>
                )}

                {/* STEP 3 — review & pay */}
                {items.length > 0 && step === 3 && (
                  <>
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" /> Review Your Order
                      </h3>
                      <dl className="text-sm space-y-1.5">
                        <div className="flex justify-between"><dt className="text-foreground/60">Name</dt><dd className="font-medium">{customerName}</dd></div>
                        <div className="flex justify-between"><dt className="text-foreground/60">Phone</dt><dd className="font-medium">{fullPhone}</dd></div>
                        {customerEmail && <div className="flex justify-between"><dt className="text-foreground/60">Email</dt><dd className="font-medium truncate ml-2">{customerEmail}</dd></div>}
                        <div className="flex justify-between"><dt className="text-foreground/60">Type</dt><dd className="font-medium capitalize">{orderType}</dd></div>
                        {orderType === "delivery" && (
                          <div className="flex justify-between gap-2"><dt className="text-foreground/60 shrink-0">Address</dt><dd className="font-medium text-right">{deliveryAddress}</dd></div>
                        )}
                      </dl>
                    </Card>

                    <Card className="p-4">
                      <label className="text-sm font-medium mb-2 block">Payment Method</label>
                      <div className="p-3 rounded-md border border-primary bg-primary/5 ring-2 ring-primary/30">
                        <div className="flex items-center gap-2 font-medium text-sm">
                          <Smartphone className="w-4 h-4 text-primary" /> M-Pesa (required)
                        </div>
                        <p className="text-xs text-foreground/60 mt-1">
                          Pay now via STK push. Your order will be sent to the kitchen
                          only after payment is confirmed.
                        </p>
                      </div>
                      <p className="text-xs text-foreground/60 mt-3">
                        You'll get an STK push prompt on <span className="font-medium text-foreground">{fullPhone}</span>. Enter your M-Pesa PIN to confirm.
                      </p>
                    </Card>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep(2)} className="flex-1" disabled={isCheckingOut}>
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back
                      </Button>
                      <Button onClick={handlePlaceOrder} disabled={isCheckingOut} className="flex-1" size="lg">
                        {isCheckingOut ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</>) : (
                          <>{paymentChoice === "mpesa" ? "Pay" : "Place Order"} · KES {parseFloat(total).toLocaleString()}</>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* M-Pesa Payment Modal */}
        {paymentOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
            <Card className="w-full max-w-md p-6 relative">
              <button
                type="button"
                onClick={() => { setPaymentOpen(false); setIsCheckingOut(false); }}
                className="absolute top-3 right-3 text-foreground/50 hover:text-foreground"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold font-display mb-2">Confirm M-Pesa Payment</h2>
                <p className="text-sm text-foreground/60 mb-4">
                  A prompt has been sent to <span className="font-medium text-foreground">{fullPhone}</span>.
                  Enter your M-Pesa PIN to pay <span className="font-semibold text-primary">KES {parseFloat(total).toLocaleString()}</span>.
                </p>

                {(!paymentRow || paymentRow.status === "pending") && (
                  <div className="flex items-center justify-center gap-2 py-4 text-foreground/70">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Waiting for confirmation…</span>
                  </div>
                )}

                {paymentRow?.status === "success" && (
                  <p className="text-green-600 font-medium py-4">Payment received!</p>
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