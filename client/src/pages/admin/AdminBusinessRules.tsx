import { useState, useEffect } from "react";
import { Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useSettings, useUpdateSettings } from "@/lib/supabase-hooks";

interface BusinessRules {
  minimumOrderValue: string; deliveryFee: string; taxRate: string; discountPercentage: string; discountThreshold: string;
  minPartySize: string; maxPartySize: string; advanceBookingDays: string; cancellationWindowHours: string; reservationDurationHours: string;
  orderCancellationWindowMinutes: string; estimatedDeliveryMinutes: string; autoCompleteOrdersAfterHours: string;
  maxFeaturedItemsPerCategory: string; maxDescriptionLength: string;
  whatsappEnabled: string; emailEnabled: string; smsEnabled: string;
  orderRetentionDays: string; messageRetentionDays: string; customerDataRetentionDays: string;
  trackInventory: string; lowStockThreshold: string;
  loyaltyPointsPerUnit: string; loyaltyPointValue: string;
}

const defaultRules: BusinessRules = {
  minimumOrderValue: "500", deliveryFee: "100", taxRate: "16", discountPercentage: "10", discountThreshold: "5000",
  minPartySize: "1", maxPartySize: "50", advanceBookingDays: "30", cancellationWindowHours: "2", reservationDurationHours: "2",
  orderCancellationWindowMinutes: "15", estimatedDeliveryMinutes: "45", autoCompleteOrdersAfterHours: "24",
  maxFeaturedItemsPerCategory: "5", maxDescriptionLength: "500",
  whatsappEnabled: "true", emailEnabled: "true", smsEnabled: "false",
  orderRetentionDays: "180", messageRetentionDays: "90", customerDataRetentionDays: "365",
  trackInventory: "true", lowStockThreshold: "10",
  loyaltyPointsPerUnit: "1", loyaltyPointValue: "0.10",
};

export default function AdminBusinessRules() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();

  const [rules, setRules] = useState<BusinessRules>({ ...defaultRules });

  useEffect(() => {
    if (settings) {
      const newRules: Partial<BusinessRules> = {};
      Object.keys(defaultRules).forEach((key) => {
        newRules[key as keyof BusinessRules] = settings[key] ?? defaultRules[key as keyof BusinessRules];
      });
      setRules(newRules as BusinessRules);
    }
  }, [settings]);

  const handleSave = () => {
    const payload: Record<string, string> = {};
    Object.entries(rules).forEach(([k, v]) => { payload[k] = String(v ?? ""); });
    update.mutate(payload, { onSuccess: () => toast.success("Business rules updated successfully") });
  };

  const updateRule = (key: keyof BusinessRules, value: string) => setRules((prev) => ({ ...prev, [key]: value }));
  const toggleRule = (key: keyof BusinessRules) => setRules((prev) => ({ ...prev, [key]: prev[key] === "true" ? "false" : "true" }));

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

        <TabsContent value="pricing">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Pricing & Discounts</CardTitle>
              <CardDescription>Configure pricing policies and discount rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "minimumOrderValue", label: "Minimum Order Value (KES)", desc: "Minimum order total required for delivery" },
                  { key: "deliveryFee", label: "Delivery Fee (KES)", desc: "Fixed delivery charge per order" },
                  { key: "taxRate", label: "Tax Rate (%)", desc: "Sales tax percentage applied to orders" },
                  { key: "discountPercentage", label: "Bulk Discount (%)", desc: "Discount for orders above threshold" },
                  { key: "discountThreshold", label: "Discount Threshold (KES)", desc: "Order total to qualify for bulk discount" },
                ].map(({ key, label, desc }) => (
                  <div key={key}>
                    <Label className="text-foreground">{label}</Label>
                    <Input type="number" value={rules[key as keyof BusinessRules]} onChange={(e) => updateRule(key as keyof BusinessRules, e.target.value)} className="bg-input border-border text-foreground mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Reservation Policies</CardTitle>
              <CardDescription>Configure table booking constraints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "minPartySize", label: "Minimum Party Size", desc: "Minimum guests required for reservation" },
                  { key: "maxPartySize", label: "Maximum Party Size", desc: "Maximum guests per reservation" },
                  { key: "advanceBookingDays", label: "Advance Booking Days", desc: "How many days in advance customers can book" },
                  { key: "cancellationWindowHours", label: "Cancellation Window (Hours)", desc: "Hours before reservation to allow cancellation" },
                  { key: "reservationDurationHours", label: "Reservation Duration (Hours)", desc: "How long table is reserved per booking" },
                ].map(({ key, label, desc }) => (
                  <div key={key}>
                    <Label className="text-foreground">{label}</Label>
                    <Input type="number" value={rules[key as keyof BusinessRules]} onChange={(e) => updateRule(key as keyof BusinessRules, e.target.value)} className="bg-input border-border text-foreground mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Order Management</CardTitle>
              <CardDescription>Configure order processing and fulfillment rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "orderCancellationWindowMinutes", label: "Order Cancellation Window (Minutes)", desc: "Minutes after order to allow cancellation" },
                  { key: "estimatedDeliveryMinutes", label: "Estimated Delivery Time (Minutes)", desc: "Default delivery time estimate for customers" },
                  { key: "autoCompleteOrdersAfterHours", label: "Auto-Complete After (Hours)", desc: "Auto-mark completed after delivery time expires" },
                ].map(({ key, label, desc }) => (
                  <div key={key}>
                    <Label className="text-foreground">{label}</Label>
                    <Input type="number" value={rules[key as keyof BusinessRules]} onChange={(e) => updateRule(key as keyof BusinessRules, e.target.value)} className="bg-input border-border text-foreground mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communication">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Communication Channels</CardTitle>
              <CardDescription>Enable/disable notification methods</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "whatsappEnabled", label: "WhatsApp Notifications", desc: "Send order updates via WhatsApp" },
                { key: "emailEnabled", label: "Email Notifications", desc: "Send confirmations via email" },
                { key: "smsEnabled", label: "SMS Notifications", desc: "Send SMS updates (requires SMS provider)" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-input border border-border rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch checked={rules[key as keyof BusinessRules] === "true"} onCheckedChange={() => toggleRule(key as keyof BusinessRules)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced">
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Menu & Data Management</CardTitle>
                <CardDescription>Configure content constraints and data retention</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: "maxFeaturedItemsPerCategory", label: "Max Featured Items Per Category", desc: "Limit featured items to avoid clutter" },
                    { key: "maxDescriptionLength", label: "Max Description Length (Characters)", desc: "Character limit for item descriptions" },
                    { key: "orderRetentionDays", label: "Order Retention (Days)", desc: "How long to keep order records" },
                    { key: "messageRetentionDays", label: "Message Retention (Days)", desc: "How long to keep contact messages" },
                  ].map(({ key, label, desc }) => (
                    <div key={key}>
                      <Label className="text-foreground">{label}</Label>
                      <Input type="number" value={rules[key as keyof BusinessRules]} onChange={(e) => updateRule(key as keyof BusinessRules, e.target.value)} className="bg-input border-border text-foreground mt-1" />
                      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
