import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AdminSettings() {
  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const update = trpc.settings.update.useMutation({ onSuccess: () => toast.success("Settings saved") });

  const [form, setForm] = useState({
    siteName: "", tagline: "", description: "", phone: "", phone2: "", email: "", address: "", city: "", mapUrl: "",
    whatsapp: "", facebook: "", instagram: "", twitter: "", tiktok: "", youtube: "",
    openingHours: {} as Record<string, { open: string; close: string; closed: boolean }>,
    enableReservations: true, enableGallery: true, enableEvents: true, enableTestimonials: true,
    heroTitle: "", heroSubtitle: "", heroCtaLabel: "", heroCtaUrl: "",
    announcementBar: "", announcementBarEnabled: false,
  });

  useEffect(() => {
    if (settings) {
      const hours: Record<string, { open: string; close: string; closed: boolean }> = {};
      DAYS.forEach((d) => {
        const existing = (settings.openingHours as any)?.[d] ?? {};
        hours[d] = { open: existing.open ?? "07:00", close: existing.close ?? "23:00", closed: existing.closed ?? false };
      });
      setForm({
        siteName: settings.siteName ?? "Elparaiso Garden",
        tagline: settings.tagline ?? "",
        description: settings.description ?? "",
        phone: settings.phone ?? "",
        phone2: settings.phone2 ?? "",
        email: settings.email ?? "",
        address: settings.address ?? "",
        city: settings.city ?? "",
        mapUrl: settings.mapUrl ?? "",
        whatsapp: settings.whatsapp ?? "",
        facebook: settings.facebook ?? "",
        instagram: settings.instagram ?? "",
        twitter: settings.twitter ?? "",
        tiktok: settings.tiktok ?? "",
        youtube: settings.youtube ?? "",
        openingHours: hours,
        enableReservations: settings.enableReservations !== "false",
        enableGallery: settings.enableGallery !== "false",
        enableEvents: settings.enableEvents !== "false",
        enableTestimonials: settings.enableTestimonials !== "false",
        heroTitle: settings.heroTitle ?? "",
        heroSubtitle: settings.heroSubtitle ?? "",
        heroCtaLabel: settings.heroCtaLabel ?? "",
        heroCtaUrl: settings.heroCtaUrl ?? "",
        announcementBar: settings.announcementBar ?? "",
        announcementBarEnabled: settings.announcementBarEnabled === "true",
      });
    }
  }, [settings]);

  const save = () => {
    const payload: Record<string, string> = {};
    const { openingHours, enableReservations, enableGallery, enableEvents, enableTestimonials, announcementBarEnabled, ...rest } = form;
    Object.entries(rest).forEach(([k, v]) => { payload[k] = String(v ?? ""); });
    payload.openingHours = JSON.stringify(openingHours);
    payload.enableReservations = String(enableReservations);
    payload.enableGallery = String(enableGallery);
    payload.enableEvents = String(enableEvents);
    payload.enableTestimonials = String(enableTestimonials);
    payload.announcementBarEnabled = String(announcementBarEnabled);
    update.mutate(payload);
  };

  const setHours = (day: string, field: string, value: any) => {
    setForm((p) => ({ ...p, openingHours: { ...p.openingHours, [day]: { ...p.openingHours[day], [field]: value } } }));
  };

  if (isLoading) return <div className="text-muted-foreground p-8">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Site Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage business information and site configuration</p>
        </div>
        <Button className="bg-primary text-primary-foreground" onClick={save} disabled={update.isPending}>
          <Save className="w-4 h-4 mr-1" /> {update.isPending ? "Saving..." : "Save All"}
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="general" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">General</TabsTrigger>
          <TabsTrigger value="contact" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">Contact</TabsTrigger>
          <TabsTrigger value="social" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">Social</TabsTrigger>
          <TabsTrigger value="hours" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">Hours</TabsTrigger>
          <TabsTrigger value="features" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">Features</TabsTrigger>
          <TabsTrigger value="hero" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">Hero</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Site Name</Label>
                <Input value={form.siteName} onChange={(e) => setForm((p) => ({ ...p, siteName: e.target.value }))} className="bg-input border-border text-foreground mt-1" />
              </div>
              <div>
                <Label className="text-foreground">Tagline</Label>
                <Input value={form.tagline} onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="e.g. Where Every Meal Becomes a Memory" />
              </div>
            </div>
            <div>
              <Label className="text-foreground">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="bg-input border-border text-foreground mt-1 resize-none" rows={3} />
            </div>
            <div>
              <Label className="text-foreground">Announcement Bar</Label>
              <div className="flex items-center gap-3 mt-1">
                <Switch checked={form.announcementBarEnabled} onCheckedChange={(v) => setForm((p) => ({ ...p, announcementBarEnabled: v }))} />
                <Input value={form.announcementBar} onChange={(e) => setForm((p) => ({ ...p, announcementBar: e.target.value }))} className="bg-input border-border text-foreground" placeholder="e.g. Now Open 24/7! 🎉" />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contact">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Primary Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="0791 224513" />
              </div>
              <div>
                <Label className="text-foreground">Secondary Phone</Label>
                <Input value={form.phone2} onChange={(e) => setForm((p) => ({ ...p, phone2: e.target.value }))} className="bg-input border-border text-foreground mt-1" />
              </div>
              <div>
                <Label className="text-foreground">Email</Label>
                <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="bg-input border-border text-foreground mt-1" type="email" />
              </div>
              <div>
                <Label className="text-foreground">WhatsApp Number (international)</Label>
                <Input value={form.whatsapp} onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="254791224513" />
              </div>
            </div>
            <div>
              <Label className="text-foreground">Address</Label>
              <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="bg-input border-border text-foreground mt-1" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">City</Label>
                <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="Kisii" />
              </div>
              <div>
                <Label className="text-foreground">Google Maps URL</Label>
                <Input value={form.mapUrl} onChange={(e) => setForm((p) => ({ ...p, mapUrl: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="https://maps.google.com/..." />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="social">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            {[
              { key: "facebook", label: "Facebook URL" },
              { key: "instagram", label: "Instagram URL" },
              { key: "twitter", label: "Twitter / X URL" },
              { key: "tiktok", label: "TikTok URL" },
              { key: "youtube", label: "YouTube URL" },
            ].map(({ key, label }) => (
              <div key={key}>
                <Label className="text-foreground">{label}</Label>
                <Input value={(form as any)[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="https://..." />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="hours">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Set opening hours for each day. Toggle "Closed" for days the restaurant is not open.</p>
            {DAYS.map((day) => {
              const h = form.openingHours[day] ?? { open: "07:00", close: "23:00", closed: false };
              return (
                <div key={day} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                  <div className="w-24 text-sm font-medium text-foreground">{day}</div>
                  <Switch checked={!h.closed} onCheckedChange={(v) => setHours(day, "closed", !v)} />
                  {!h.closed ? (
                    <>
                      <Input type="time" value={h.open} onChange={(e) => setHours(day, "open", e.target.value)} className="bg-input border-border text-foreground w-32" />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input type="time" value={h.close} onChange={(e) => setHours(day, "close", e.target.value)} className="bg-input border-border text-foreground w-32" />
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm italic">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="features">
          <div className="bg-card border border-border rounded-xl p-5 space-y-5">
            {[
              { key: "enableReservations", label: "Online Reservations", desc: "Allow customers to submit reservation requests" },
              { key: "enableGallery", label: "Gallery Page", desc: "Show the photo gallery on the public website" },
              { key: "enableEvents", label: "Events & Offers", desc: "Show events and special offers section" },
              { key: "enableTestimonials", label: "Testimonials", desc: "Display customer reviews on the homepage" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="text-foreground font-medium text-sm">{label}</div>
                  <div className="text-muted-foreground text-xs mt-0.5">{desc}</div>
                </div>
                <Switch checked={(form as any)[key]} onCheckedChange={(v) => setForm((p) => ({ ...p, [key]: v }))} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="hero">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div>
              <Label className="text-foreground">Hero Title</Label>
              <Input value={form.heroTitle} onChange={(e) => setForm((p) => ({ ...p, heroTitle: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="Welcome to Elparaiso Garden" />
            </div>
            <div>
              <Label className="text-foreground">Hero Subtitle</Label>
              <Textarea value={form.heroSubtitle} onChange={(e) => setForm((p) => ({ ...p, heroSubtitle: e.target.value }))} className="bg-input border-border text-foreground mt-1 resize-none" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">CTA Button Label</Label>
                <Input value={form.heroCtaLabel} onChange={(e) => setForm((p) => ({ ...p, heroCtaLabel: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="Reserve a Table" />
              </div>
              <div>
                <Label className="text-foreground">CTA Button URL</Label>
                <Input value={form.heroCtaUrl} onChange={(e) => setForm((p) => ({ ...p, heroCtaUrl: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="/reservations" />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
