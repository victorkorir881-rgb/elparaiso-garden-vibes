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
import { Loader2, ShoppingCart, Trash2, Plus, Minus, Check, Home, UtensilsCrossed, MapPin, CalendarDays, Phone, Smartphone, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export default function OrderPage() {
  const { data: categories = [] } = useMenuCategories(true);
  const { data: menuItems = [] } = useMenuItems({ availableOnly: true });
  
  const { items, addItem, removeItem, updateQuantity, clearCart, total, itemCount } = useCart();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway" | "delivery">("delivery");
  const [paymentChoice, setPaymentChoice] = useState<"mpesa" | "cash">("mpesa");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  // Payment state
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const initiatePayment = useInitiateMpesaPayment();
  const { data: paymentRow } = usePaymentStatus(paymentId);

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

  const createOrder = useCreateOrder();

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return menuItems;
    return menuItems.filter((item: any) => item.category_id === selectedCategory);
  }, [menuItems, selectedCategory]);

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

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) { toast.error("Please enter your name"); return; }
    if (!customerPhone.trim()) { toast.error("Please enter your phone number"); return; }
    if (items.length === 0) { toast.error("Your cart is empty"); return; }
    if (orderType === "delivery" && !deliveryAddress.trim()) { toast.error("Please enter delivery address"); return; }

    // basic phone validation for kenyan numbers (07XX… / 2547XX… / +2547XX…)
    const digits = customerPhone.replace(/\D/g, "");
    const phoneOk = /^(254[17]\d{8}|0[17]\d{8}|[17]\d{8})$/.test(digits);
    if (paymentChoice === "mpesa" && !phoneOk) {
      toast.error("Enter a valid Safaricom number (07XX… or 2547XX…) for M-Pesa");
      return;
    }

    setIsCheckingOut(true);
    const ordNum = generateOrderNumber();
    const amountKes = Math.max(1, Math.round(parseFloat(total)));

    createOrder.mutate(
      {
        order_number: ordNum,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
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

          // cash on delivery / pickup — skip M-Pesa, mark order as placed
          if (paymentChoice === "cash") {
            toast.success("Order placed! Pay on delivery / pickup.");
            setOrderPlaced(true);
            clearCart();
            setIsCheckingOut(false);
            return;
          }

          // m-pesa — trigger STK push
          initiatePayment.mutate(
            { orderId: created.id, phone: customerPhone, amount: amountKes },
            {
              onSuccess: (res) => {
                setPaymentId(res.paymentId);
                setPaymentOpen(true);
                toast.success(res.message);
              },
              onError: (err) => {
                toast.error(err.message ?? "Failed to start M-Pesa payment");
                // order is already saved — surface success page so customer can pay later
                setOrderPlaced(true);
                clearCart();
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
      { orderId: pendingOrderId, phone: customerPhone, amount: amountKes },
      {
        onSuccess: (res) => {
          setPaymentId(res.paymentId);
          toast.success(res.message);
        },
        onError: (err) => toast.error(err.message ?? "Failed to retry payment"),
      },
    );
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background py-8 sm:py-12 px-3 sm:px-4">
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
    );
  }

  return (
    <div className="min-h-screen bg-background py-6 sm:py-12 px-3 sm:px-4">
      <div className="max-w-7xl mx-auto">
        {/* Page navigation buttons */}
        <nav aria-label="Order page navigation" className="mb-6 flex flex-wrap gap-2">
          <Link to="/"><Button variant="outline" size="sm"><Home className="w-4 h-4 mr-1.5" />Home</Button></Link>
          <Link to="/menu"><Button variant="outline" size="sm"><UtensilsCrossed className="w-4 h-4 mr-1.5" />Menu</Button></Link>
          <Link to="/track"><Button variant="outline" size="sm"><MapPin className="w-4 h-4 mr-1.5" />Track Order</Button></Link>
          <Link to="/reservations"><Button variant="outline" size="sm"><CalendarDays className="w-4 h-4 mr-1.5" />Reserve a Table</Button></Link>
          <a href="tel:0791224513"><Button variant="outline" size="sm"><Phone className="w-4 h-4 mr-1.5" />Call</Button></a>
        </nav>

        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold font-display mb-2">Place Your Order</h1>
          <p className="text-foreground/60 text-sm sm:text-base">Browse our menu and place your order for delivery or pickup</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
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
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
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

          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-6">
              <Card className="p-4 border-2 border-primary/20">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingCart className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">Your Cart</h2>
                  {itemCount > 0 && <Badge className="ml-auto">{itemCount}</Badge>}
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-foreground/60 py-4">Your cart is empty</p>
                ) : (
                  <>
                    <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-foreground/60">KES {parseFloat(item.price).toLocaleString()} x {item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus className="w-3 h-3" /></Button>
                            <span className="text-xs font-semibold w-6 text-center">{item.quantity}</span>
                            <Button size="sm" variant="ghost" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border pt-3 mb-4">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-primary">KES {parseFloat(total).toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                )}
              </Card>

              {items.length > 0 && (
                <>
                  <Card className="p-4">
                    <label className="text-sm font-medium mb-2 block">Order Type</label>
                    <Select value={orderType} onValueChange={(value: any) => setOrderType(value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dine-in">Dine In</SelectItem>
                        <SelectItem value="takeaway">Takeaway</SelectItem>
                        <SelectItem value="delivery">Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                  </Card>

                  <Card className="p-4">
                    <h3 className="font-semibold mb-4">Delivery Details</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Full Name *</label>
                        <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Your name" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Phone Number *</label>
                        <Input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="0791 224513" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Email</label>
                        <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="your@email.com" />
                      </div>
                      {orderType === "delivery" && (
                        <div>
                          <label className="text-sm font-medium mb-1 block">Delivery Address *</label>
                          <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Street, building, apt number..." rows={2} />
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium mb-1 block">Special Instructions</label>
                        <Textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} placeholder="No onions, extra spicy, etc..." rows={2} />
                      </div>
                      <Button onClick={handlePlaceOrder} disabled={isCheckingOut || items.length === 0} className="w-full" size="lg">
                        {isCheckingOut ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" />Placing Order...</>) : (<><ShoppingCart className="w-4 h-4 mr-2" />Place Order</>)}
                      </Button>
                      <Button variant="outline" onClick={() => { clearCart(); toast.success("Cart cleared"); }} className="w-full">Clear Cart</Button>
                    </div>
                  </Card>
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
                A prompt has been sent to <span className="font-medium text-foreground">{customerPhone}</span>.
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
  );
}

