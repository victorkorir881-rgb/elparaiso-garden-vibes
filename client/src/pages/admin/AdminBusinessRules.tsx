import { useState, useEffect } from "react";
import { Save, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface BusinessRules {
  // Pricing rules
  minimumOrderValue: string;
  deliveryFee: string;
  taxRate: string;
  discountPercentage: string;
  discountThreshold: string;

  // Reservation rules
  minPartySize: string;
  maxPartySize: string;
  advanceBookingDays: string;
  cancellationWindowHours: string;
  reservationDurationHours: string;

  // Order rules
  orderCancellationWindowMinutes: string;
  estimatedDeliveryMinutes: string;
  autoCompleteOrdersAfterHours: string;

  // Menu rules
  maxFeaturedItemsPerCategory: string;
  maxDescriptionLength: string;

  // Communication rules
  whatsappEnabled: string;
  emailEnabled: string;
  smsEnabled: string;

  // Data retention rules
  orderRetentionDays: string;
  messageRetentionDays: string;
  customerDataRetentionDays: string;

  // Inventory rules
  trackInventory: string;
  lowStockThreshold: string;

  // Loyalty rules
  loyaltyPointsPerUnit: string;
  loyaltyPointValue: string;
}

export default function AdminBusinessRules() {
  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const update = trpc.settings.update.useMutation({
    onSuccess: () => toast.success("Business rules updated successfully"),
  });

  const [rules, setRules] = useState<BusinessRules>({
    minimumOrderValue: "500",
    deliveryFee: "100",
    taxRate: "16",
    discountPercentage: "10",
    discountThreshold: "5000",
    minPartySize: "1",
    maxPartySize: "50",
    advanceBookingDays: "30",
    cancellationWindowHours: "2",
    reservationDurationHours: "2",
    orderCancellationWindowMinutes: "15",
    estimatedDeliveryMinutes: "45",
    autoCompleteOrdersAfterHours: "24",
    maxFeaturedItemsPerCategory: "5",
    maxDescriptionLength: "500",
    whatsappEnabled: "true",
    emailEnabled: "true",
    smsEnabled: "false",
    orderRetentionDays: "180",
    messageRetentionDays: "90",
    customerDataRetentionDays: "365",
    trackInventory: "true",
    lowStockThreshold: "10",
    loyaltyPointsPerUnit: "1",
    loyaltyPointValue: "0.10",
  });

  useEffect(() => {
    if (settings) {
      const newRules: Partial<BusinessRules> = {};
      Object.keys(rules).forEach((key) => {
        newRules[key as keyof BusinessRules] = settings[key] ?? rules[key as keyof BusinessRules];
      });
      setRules(newRules as BusinessRules);
    }
  }, [settings]);

  const handleSave = () => {
    const payload: Record<string, string> = {};
    Object.entries(rules).forEach(([k, v]) => {
      payload[k] = String(v ?? "");
    });
    update.mutate(payload);
  };

  const updateRule = (key: keyof BusinessRules, value: string) => {
    setRules((prev) => ({ ...prev, [key]: value }));
  };

  const toggleRule = (key: keyof BusinessRules) => {
    setRules((prev) => ({
      ...prev,
      [key]: prev[key] === "true" ? "false" : "true",
    }));
  };

  if (isLoading) return <div className="text-muted-foreground p-8">Loading business rules...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Business Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure operational policies and constraints</p>
        </div>
        <Button className="bg-primary text-primary-foreground" onClick={handleSave} disabled={update.isPending}>
          <Save className="w-4 h-4 mr-1" /> {update.isPending ? "Saving..." : "Save All Rules"}
        </Button>
      </div>

      <Alert className="bg-blue-950 border-blue-800">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-100">
          Business rules are enforced at the database level through constraints and triggers. Changes take effect immediately across all operations.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="pricing" className="w-full">
        <TabsList className="bg-card border border-border grid w-full grid-cols-5">
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* PRICING RULES */}
        <TabsContent value="pricing">
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Pricing & Discounts</CardTitle>
                <CardDescription>Configure pricing policies and discount rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-foreground">Minimum Order Value (KES)</Label>
                    <Input
                      type="number"
                      value={rules.minimumOrderValue}
                      onChange={(e) => updateRule("minimumOrderValue", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Minimum order total required for delivery</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Delivery Fee (KES)</Label>
                    <Input
                      type="number"
                      value={rules.deliveryFee}
                      onChange={(e) => updateRule("deliveryFee", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Fixed delivery charge per order</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Tax Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={rules.taxRate}
                      onChange={(e) => updateRule("taxRate", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Sales tax percentage applied to orders</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Bulk Discount (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={rules.discountPercentage}
                      onChange={(e) => updateRule("discountPercentage", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Discount for orders above threshold</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Discount Threshold (KES)</Label>
                    <Input
                      type="number"
                      value={rules.discountThreshold}
                      onChange={(e) => updateRule("discountThreshold", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Order total to qualify for bulk discount</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* RESERVATION RULES */}
        <TabsContent value="reservations">
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Reservation Policies</CardTitle>
                <CardDescription>Configure table booking constraints</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-foreground">Minimum Party Size</Label>
                    <Input
                      type="number"
                      value={rules.minPartySize}
                      onChange={(e) => updateRule("minPartySize", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Minimum guests required for reservation</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Maximum Party Size</Label>
                    <Input
                      type="number"
                      value={rules.maxPartySize}
                      onChange={(e) => updateRule("maxPartySize", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Maximum guests per reservation</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Advance Booking Days</Label>
                    <Input
                      type="number"
                      value={rules.advanceBookingDays}
                      onChange={(e) => updateRule("advanceBookingDays", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">How many days in advance customers can book</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Cancellation Window (Hours)</Label>
                    <Input
                      type="number"
                      value={rules.cancellationWindowHours}
                      onChange={(e) => updateRule("cancellationWindowHours", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Hours before reservation to allow cancellation</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Reservation Duration (Hours)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={rules.reservationDurationHours}
                      onChange={(e) => updateRule("reservationDurationHours", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">How long table is reserved per booking</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ORDER RULES */}
        <TabsContent value="orders">
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Order Management</CardTitle>
                <CardDescription>Configure order processing and fulfillment rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-foreground">Order Cancellation Window (Minutes)</Label>
                    <Input
                      type="number"
                      value={rules.orderCancellationWindowMinutes}
                      onChange={(e) => updateRule("orderCancellationWindowMinutes", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Minutes after order to allow cancellation</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Estimated Delivery Time (Minutes)</Label>
                    <Input
                      type="number"
                      value={rules.estimatedDeliveryMinutes}
                      onChange={(e) => updateRule("estimatedDeliveryMinutes", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Default delivery time estimate for customers</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Auto-Complete After (Hours)</Label>
                    <Input
                      type="number"
                      value={rules.autoCompleteOrdersAfterHours}
                      onChange={(e) => updateRule("autoCompleteOrdersAfterHours", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Auto-mark completed after delivery time expires</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* COMMUNICATION RULES */}
        <TabsContent value="communication">
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Communication Channels</CardTitle>
                <CardDescription>Enable/disable notification methods</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-input border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">WhatsApp Notifications</p>
                      <p className="text-xs text-muted-foreground">Send order updates via WhatsApp</p>
                    </div>
                    <Switch
                      checked={rules.whatsappEnabled === "true"}
                      onCheckedChange={() => toggleRule("whatsappEnabled")}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-input border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">Email Notifications</p>
                      <p className="text-xs text-muted-foreground">Send confirmations via email</p>
                    </div>
                    <Switch
                      checked={rules.emailEnabled === "true"}
                      onCheckedChange={() => toggleRule("emailEnabled")}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-input border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">SMS Notifications</p>
                      <p className="text-xs text-muted-foreground">Send SMS updates (requires SMS provider)</p>
                    </div>
                    <Switch
                      checked={rules.smsEnabled === "true"}
                      onCheckedChange={() => toggleRule("smsEnabled")}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ADVANCED RULES */}
        <TabsContent value="advanced">
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Menu Management</CardTitle>
                <CardDescription>Configure menu content constraints</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-foreground">Max Featured Items Per Category</Label>
                    <Input
                      type="number"
                      value={rules.maxFeaturedItemsPerCategory}
                      onChange={(e) => updateRule("maxFeaturedItemsPerCategory", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Limit featured items to avoid clutter</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Max Description Length (Characters)</Label>
                    <Input
                      type="number"
                      value={rules.maxDescriptionLength}
                      onChange={(e) => updateRule("maxDescriptionLength", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Maximum characters for item descriptions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Data Retention</CardTitle>
                <CardDescription>Configure data retention and cleanup policies (GDPR compliance)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-foreground">Order Retention (Days)</Label>
                    <Input
                      type="number"
                      value={rules.orderRetentionDays}
                      onChange={(e) => updateRule("orderRetentionDays", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Keep completed/cancelled orders for this long</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Message Retention (Days)</Label>
                    <Input
                      type="number"
                      value={rules.messageRetentionDays}
                      onChange={(e) => updateRule("messageRetentionDays", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Keep contact messages for this long</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Customer Data Retention (Days)</Label>
                    <Input
                      type="number"
                      value={rules.customerDataRetentionDays}
                      onChange={(e) => updateRule("customerDataRetentionDays", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Keep customer information for this long</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Inventory & Loyalty</CardTitle>
                <CardDescription>Configure inventory tracking and loyalty rewards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-input border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">Track Inventory</p>
                      <p className="text-xs text-muted-foreground">Track menu item quantities</p>
                    </div>
                    <Switch
                      checked={rules.trackInventory === "true"}
                      onCheckedChange={() => toggleRule("trackInventory")}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label className="text-foreground">Low Stock Threshold (Units)</Label>
                    <Input
                      type="number"
                      value={rules.lowStockThreshold}
                      onChange={(e) => updateRule("lowStockThreshold", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Alert when inventory below this level</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Loyalty Points Per Unit (KES)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={rules.loyaltyPointsPerUnit}
                      onChange={(e) => updateRule("loyaltyPointsPerUnit", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Points earned per KES spent</p>
                  </div>
                  <div>
                    <Label className="text-foreground">Loyalty Point Value (KES)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={rules.loyaltyPointValue}
                      onChange={(e) => updateRule("loyaltyPointValue", e.target.value)}
                      className="bg-input border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">KES value of each loyalty point</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Alert className="bg-amber-950 border-amber-800">
        <AlertCircle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-amber-100">
          All changes are logged in the audit trail. Database triggers enforce these rules automatically. Test changes thoroughly before applying to production.
        </AlertDescription>
      </Alert>
    </div>
  );
}
