import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, Clock, MapPin, CheckCircle2, AlertCircle } from "lucide-react";

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", icon: <Clock className="w-5 h-5" /> },
  confirmed: { bg: "bg-blue-50", text: "text-blue-700", icon: <CheckCircle2 className="w-5 h-5" /> },
  preparing: { bg: "bg-purple-50", text: "text-purple-700", icon: <Loader2 className="w-5 h-5 animate-spin" /> },
  ready: { bg: "bg-green-50", text: "text-green-700", icon: <CheckCircle2 className="w-5 h-5" /> },
  "out-for-delivery": { bg: "bg-indigo-50", text: "text-indigo-700", icon: <MapPin className="w-5 h-5" /> },
  completed: { bg: "bg-emerald-50", text: "text-emerald-700", icon: <CheckCircle2 className="w-5 h-5" /> },
  cancelled: { bg: "bg-red-50", text: "text-red-700", icon: <AlertCircle className="w-5 h-5" /> },
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready for Pickup",
  "out-for-delivery": "Out for Delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function OrderTrackingPage() {
  const [phone, setPhone] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [searchType, setSearchType] = useState<"phone" | "number">("phone");

  const trackByPhone = trpc.orders.trackByPhone.useQuery(
    { phone },
    { enabled: searchType === "phone" && phone.length > 0 }
  );

  const trackByNumber = trpc.orders.trackByNumber.useQuery(
    { orderNumber },
    { enabled: searchType === "number" && orderNumber.length > 0 }
  );

  const orders = (searchType === "phone" ? trackByPhone.data : trackByNumber.data) as any[] | undefined;
  const isLoading = searchType === "phone" ? trackByPhone.isLoading : trackByNumber.isLoading;
  const error = searchType === "phone" ? trackByPhone.error : trackByNumber.error;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Queries are auto-triggered by the enabled condition
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold font-display mb-4">Track Your Order</h1>
          <p className="text-foreground/60">Enter your phone number or order number to check your delivery status</p>
        </div>

        {/* Search Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => {
              setSearchType("phone");
              setOrderNumber("");
            }}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              searchType === "phone"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            <Phone className="w-4 h-4 inline mr-2" />
            By Phone
          </button>
          <button
            onClick={() => {
              setSearchType("number");
              setPhone("");
            }}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              searchType === "number"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            By Order #
          </button>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-12">
          <div className="flex gap-2">
            <Input
              type={searchType === "phone" ? "tel" : "text"}
              placeholder={searchType === "phone" ? "Enter your phone number" : "Enter order number (e.g., ORD-20260404-ABC12)"}
              value={searchType === "phone" ? phone : orderNumber}
              onChange={(e) => {
                if (searchType === "phone") {
                  setPhone(e.target.value);
                } else {
                  setOrderNumber(e.target.value);
                }
              }}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || (searchType === "phone" ? !phone : !orderNumber)}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
            </Button>
          </div>
        </form>

        {/* Results */}
        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
            <p className="text-foreground/60">Searching for your order...</p>
          </div>
        )}

        {error && (
          <Card className="p-6 border-red-200 bg-red-50">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-red-700 text-sm">Unable to load orders. Please try again.</p>
              </div>
            </div>
          </Card>
        )}

        {!isLoading && !error && orders && orders.length === 0 && (phone || orderNumber) && (
          <Card className="p-8 text-center border-amber-200 bg-amber-50">
            <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
            <h3 className="font-semibold text-amber-900 mb-2">No Orders Found</h3>
            <p className="text-amber-700">
              {searchType === "phone"
                ? "No orders found for this phone number. Please check and try again."
                : "No order found with this order number. Please verify and try again."}
            </p>
          </Card>
        )}

        {orders && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order: any) => {
              const status = statusColors[order.status] || statusColors.pending;
              const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items;

              return (
                <Card key={order.id} className="p-6 border-2 border-border hover:border-primary/50 transition-colors">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left: Order Info */}
                    <div>
                      <div className="mb-4">
                        <p className="text-sm text-foreground/60 mb-1">Order Number</p>
                        <p className="text-lg font-semibold font-display">{order.orderNumber}</p>
                      </div>

                      <div className="mb-4">
                        <p className="text-sm text-foreground/60 mb-1">Customer Name</p>
                        <p className="font-medium">{order.customerName}</p>
                      </div>

                      <div className="mb-4">
                        <p className="text-sm text-foreground/60 mb-1">Order Type</p>
                        <Badge variant="outline" className="capitalize">
                          {order.orderType}
                        </Badge>
                      </div>

                      {order.deliveryAddress && (
                        <div className="mb-4">
                          <p className="text-sm text-foreground/60 mb-1">Delivery Address</p>
                          <p className="text-sm">{order.deliveryAddress}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-sm text-foreground/60 mb-1">Total Amount</p>
                        <p className="text-xl font-bold text-primary">KES {parseFloat(order.totalAmount).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Right: Status & Items */}
                    <div>
                      {/* Status */}
                      <div className={`p-4 rounded-lg mb-4 ${status.bg}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {status.icon}
                          <span className={`font-semibold ${status.text}`}>{statusLabels[order.status]}</span>
                        </div>
                        {order.estimatedTime && (
                          <p className={`text-sm ${status.text}`}>
                            Estimated: {order.estimatedTime} minutes
                          </p>
                        )}
                      </div>

                      {/* Items */}
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-foreground/60 mb-2">Items</p>
                        <div className="space-y-1 text-sm">
                          {Array.isArray(items) &&
                            items.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between">
                                <span>
                                  {item.name} x{item.quantity}
                                </span>
                                <span className="text-foreground/60">KES {(parseFloat(item.price) * item.quantity).toLocaleString()}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Payment Status */}
                      <div>
                        <p className="text-sm text-foreground/60 mb-1">Payment Status</p>
                        <Badge variant={order.paymentStatus === "paid" ? "default" : "secondary"} className="capitalize">
                          {order.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-sm font-semibold text-foreground/60 mb-3">Order Timeline</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span>Order placed: {new Date(order.createdAt).toLocaleString()}</span>
                      </div>
                      {order.actualDeliveryTime && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span>Completed: {new Date(order.actualDeliveryTime).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 p-6 bg-muted rounded-lg">
          <h3 className="font-semibold mb-3">Need Help?</h3>
          <p className="text-sm text-foreground/70 mb-3">
            If you can't find your order or have questions, please contact us:
          </p>
          <div className="flex gap-4">
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
  );
}
