import { useEffect, useState } from "react";
import { Save, BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  on_duty: boolean;
  is_active: boolean;
};

export default function AdminProfile() {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDuty, setSavingDuty] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [onDuty, setOnDuty] = useState(false);
  const [authEmail, setAuthEmail] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const [profileRes, { data: authData }] = await Promise.all([
        supabase
          .from("admin_profiles")
          .select("id, full_name, email, phone, on_duty, is_active")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.auth.getUser(),
      ]);
      const profile = (profileRes.data as ProfileRow | null) ?? null;
      setFullName(profile?.full_name ?? user.name ?? "");
      setEmail(profile?.email ?? authData?.user?.email ?? "");
      setPhone(profile?.phone ?? "");
      setOnDuty(!!profile?.on_duty);
      setAuthEmail(authData?.user?.email ?? "");
      setLoading(false);
    })();
  }, [user?.id, user?.name]);

  const validatePhone = (p: string) => {
    if (!p) return true; // optional
    return /^\+?\d[\d\s-]{7,16}$/.test(p.trim());
  };

  const save = async () => {
    if (!user?.id) return;
    if (!fullName.trim()) return toast.error("Full name is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Enter a valid email.");
    if (!validatePhone(phone)) return toast.error("Enter a valid phone (e.g. +254712345678).");

    setSaving(true);
    try {
      const { error: profileErr } = await supabase
        .from("admin_profiles")
        .update({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
        } as never)
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      // Update auth email if changed — triggers a confirmation email to the new address.
      if (email.trim().toLowerCase() !== authEmail.toLowerCase()) {
        const { error: authErr } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
        if (authErr) throw authErr;
        toast.success("Profile saved. Confirm the new email from your inbox to finish the change.");
      } else {
        toast.success("Profile saved.");
      }

      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const toggleOnDuty = async (next: boolean) => {
    if (!user?.id) return;
    if (next && !phone.trim()) {
      return toast.error("Add your phone number first so you can receive SMS notifications.");
    }
    setSavingDuty(true);
    setOnDuty(next);
    const { error } = await supabase
      .from("admin_profiles")
      .update({ on_duty: next } as never)
      .eq("id", user.id);
    setSavingDuty(false);
    if (error) {
      setOnDuty(!next);
      toast.error(error.message);
    } else {
      toast.success(next ? "You're on duty — new orders will text you." : "You're off duty.");
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading profile…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Update your details and decide whether you're the one receiving new-order alerts today.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center ${onDuty ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              {onDuty ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </div>
            <div>
              <div className="font-medium text-foreground">On-duty for SMS alerts</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                When on, your phone receives a text every time a new paid order comes in.
              </div>
            </div>
          </div>
          <Switch checked={onDuty} onCheckedChange={toggleOnDuty} disabled={savingDuty} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Personal details</h2>

        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-input border-border text-foreground" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input border-border text-foreground" />
          <p className="text-xs text-muted-foreground">
            Changing your email sends a confirmation link to the new address. You stay signed in until you confirm.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone (for SMS notifications)</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+254712345678"
            className="bg-input border-border text-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Use the international format (e.g. +254712345678). Required to receive new-order SMS alerts.
          </p>
        </div>

        <div className="pt-2">
          <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
