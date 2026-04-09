import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShoppingCart, Trash2, Plus, Minus, Check } from "lucide-react";
import { toast } from "sonner";

export default function OrderPage() {
  const { data: categories = [] } = trpc.menuCategories.list.useQuery({});
  const { data: menuItems = [] } = trpc.menuItems.list.useQuery({});
  
  const { items, addItem, removeItem, updateQuantity, clearCart, total, itemCount } = useCart();
  
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway" | "delivery">("delivery");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  const createOrder = trpc.orders.create.useMutation({
    onSuccess: (result) => {
      setOrderNumber(result.orderNumber);
      setOrderPlaced(true);
      clearCart();
      toast.success("Order placed successfully!");
    },
    onError: () => {
      toast.error("Failed to place order. Please try again.");
      setIsCheckingOut(false);
    },
  });

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return menuItems;
    return menuItems.filter((item: any) => item.categoryId === selectedCategory);
  }, [menuItems, selectedCategory]);

  const handleAddToCart = (item: any) => {
    addItem({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
    });
    toast.success(`${item.name} added to cart`);
  };

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!customerPhone.trim()) {
      toast.error("Please enter your phone number");
      return;
    }
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      toast.error("Please enter delivery address");
      return;
    }

    setIsCheckingOut(true);

    await createOrder.mutateAsync({
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      totalAmount: total,
      orderType,
      deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
      specialInstructions: specialInstructions || undefined,
      estimatedTime: 30,
    });
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold font-display mb-4">Order Placed Successfully!</h1>
            <p className="text-foreground/60 mb-8">Your order has been received and is being prepared.</p>
            
            <Card className="p-8 mb-8 bg-muted">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-foreground/60 mb-1">Order Number</p>
                  <p className="text-2xl font-bold font-display text-primary">{orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground/60 mb-1">Total Amount</p>
                  <p className="text-xl font-semibold">KES {parseFloat(total).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground/60 mb-1">Estimated Time</p>
                  <p className="font-medium">30 minutes</p>
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              <p className="text-foreground/70">
                You can track your order status using your phone number or order number at:
              </p>
              <a href="/track" className="inline-block">
                <Button>Track Your Order</Button>
              </a>
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-foreground/60 mb-3">Need help?</p>
                <div className="flex gap-4 justify-center">
                  <a href="tel:0791224513" className="text-primary hover:underline text-sm font-medium">
                    📞 Call: 0791 224513
                  </a>
                  <a href="https://wa.me/254791224513" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm font-medium">
                    💬 WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-display mb-2">Place Your Order</h1>
          <p className="text-foreground/60">Browse our menu and place your order for delivery or pickup</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Menu Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Category Filter */}
            <Card className="p-4">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  onClick={() => setSelectedCategory(null)}
                  size="sm"
                >
                  All Items
                </Button>
                {categories.map((cat: any) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    onClick={() => setSelectedCategory(cat.id)}
                    size="sm"
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            </Card>

            {/* Menu Items Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {filteredItems.map((item: any) => (
                <Card key={item.id} className="overflow-hidden hover:border-primary/50 transition-colors">
                  {item.imageUrl && (
                    <div className="w-full h-40 bg-muted overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{item.name}</h3>
                        {item.badge && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-lg font-bold text-primary">KES {parseFloat(item.price).toLocaleString()}</p>
                    </div>
                    {item.description && (
                      <p className="text-sm text-foreground/60 mb-3">{item.description}</p>
                    )}
                    <Button
                      onClick={() => handleAddToCart(item)}
                      className="w-full"
                      disabled={!item.isAvailable}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {item.isAvailable ? "Add to Cart" : "Out of Stock"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Cart & Checkout Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-6">
              {/* Cart Summary */}
              <Card className="p-4 border-2 border-primary/20">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingCart className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">Your Cart</h2>
                  {itemCount > 0 && (
                    <Badge className="ml-auto">{itemCount}</Badge>
                  )}
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
                            <p className="text-xs text-foreground/60">
                              KES {parseFloat(item.price).toLocaleString()} x {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="text-xs font-semibold w-6 text-center">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-border pt-3 mb-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-foreground/60">Subtotal</span>
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

              {/* Order Type Selection */}
              {items.length > 0 && (
                <Card className="p-4">
                  <label className="text-sm font-medium mb-2 block">Order Type</label>
                  <Select value={orderType} onValueChange={(value: any) => setOrderType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dine-in">Dine In</SelectItem>
                      <SelectItem value="takeaway">Takeaway</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </Card>
              )}

              {/* Checkout Form */}
              {items.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-4">Delivery Details</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Full Name *</label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Phone Number *</label>
                      <Input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="0791 224513"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Email</label>
                      <Input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="your@email.com"
                      />
                    </div>
                    {orderType === "delivery" && (
                      <div>
                        <label className="text-sm font-medium mb-1 block">Delivery Address *</label>
                        <Textarea
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Street, building, apt number..."
                          rows={2}
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Special Instructions</label>
                      <Textarea
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="No onions, extra spicy, etc..."
                        rows={2}
                      />
                    </div>

                    <Button
                      onClick={handlePlaceOrder}
                      disabled={isCheckingOut || items.length === 0}
                      className="w-full"
                      size="lg"
                    >
                      {isCheckingOut ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Placing Order...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Place Order
                        </>
                      )}
                    </Button>

                    {items.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          clearCart();
                          toast.success("Cart cleared");
                        }}
                        className="w-full"
                      >
                        Clear Cart
                      </Button>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
