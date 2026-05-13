import { useEffect, useMemo, useState } from "react";
import { Save, BellRing, BellOff, KeyRound, Eye, EyeOff, Mail, CheckCircle2, Clock, RefreshCw } from "lucide-react";
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
  phone: string | null;
  on_duty: boolean;
  is_active: boolean;
};

const PHONE_RE = /^\+?\d[\d\s-]{7,16}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminProfile() {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDuty, setSavingDuty] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [onDuty, setOnDuty] = useState(false);

  // Original values to detect changes
  const [orig, setOrig] = useState({ fullName: "", email: "", phone: "" });
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const loadProfile = useMemo(
    () =>
      async (uid: string, fallbackName?: string | null) => {
        const [profileRes, { data: authData }] = await Promise.all([
          supabase
            .from("admin_profiles")
            .select("id, full_name, phone, on_duty, is_active")
            .eq("id", uid)
            .maybeSingle(),
          supabase.auth.getUser(),
        ]);
        const profile = (profileRes.data as ProfileRow | null) ?? null;
        const currentEmail = authData?.user?.email ?? "";
        const newEmail = (authData?.user as { new_email?: string } | null)?.new_email ?? null;
        const fn = profile?.full_name ?? fallbackName ?? "";
        const ph = profile?.phone ?? "";
        setFullName(fn);
        setEmail(currentEmail);
        setPhone(ph);
        setOnDuty(!!profile?.on_duty);
        setOrig({ fullName: fn, email: currentEmail, phone: ph });
        setPendingEmail(newEmail);
        return { currentEmail, newEmail };
      },
    [],
  );

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadProfile(user.id, user.name);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.name, loadProfile]);

  // Watch for email-change confirmation. When Supabase fires USER_UPDATED
  // and the auth email matches what we had pending, surface a toast and
  // refresh the status card so the active address swaps over automatically.
  useEffect(() => {
    if (!user?.id) return;
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "USER_UPDATED" || !session?.user) return;
      const newAuthEmail = session.user.email ?? "";
      const stillPending = (session.user as { new_email?: string } | null)?.new_email ?? null;
      const wasPending = pendingEmail;
      const result = await loadProfile(user.id, user.name);
      if (wasPending && !stillPending && newAuthEmail.toLowerCase() === wasPending.toLowerCase()) {
        toast.success(`Email confirmed — you now sign in with ${newAuthEmail}.`);
      } else if (wasPending && !stillPending && result.currentEmail.toLowerCase() !== wasPending.toLowerCase()) {
        toast.error("Email change was cancelled or failed. The previous address is still active.");
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [user?.id, user?.name, pendingEmail, loadProfile]);


  const dirty = useMemo(
    () =>
      fullName.trim() !== orig.fullName.trim() ||
      email.trim().toLowerCase() !== orig.email.toLowerCase() ||
      phone.trim() !== orig.phone.trim(),
    [fullName, email, phone, orig],
  );

  const save = async () => {
    if (!user?.id) return;
    if (!fullName.trim()) return toast.error("Full name is required.");
    if (!EMAIL_RE.test(email.trim())) return toast.error("Enter a valid email.");
    if (phone.trim() && !PHONE_RE.test(phone.trim())) {
      return toast.error("Enter a valid phone (e.g. +254712345678).");
    }
    if (onDuty && !phone.trim()) {
      return toast.error("You're on duty — a phone number is required for SMS alerts.");
    }

    setSaving(true);
    try {
      const profileChanged =
        fullName.trim() !== orig.fullName.trim() ||
        phone.trim() !== orig.phone.trim();

      if (profileChanged) {
        const { error: profileErr } = await supabase
          .from("admin_profiles")
          .update({
            full_name: fullName.trim(),
            phone: phone.trim() || null,
          } as never)
          .eq("id", user.id);
        if (profileErr) throw profileErr;
      }

      const newEmail = email.trim().toLowerCase();
      let emailMsg: string | null = null;
      if (newEmail !== orig.email.toLowerCase()) {
        const { error: authErr } = await supabase.auth.updateUser({ email: newEmail });
        if (authErr) throw authErr;
        setPendingEmail(newEmail);
        emailMsg = `Confirmation sent to ${newEmail}. Click the link to finish the change.`;
      }

      // Reset baseline so the Save button disables again
      setOrig({
        fullName: fullName.trim(),
        email: emailMsg ? orig.email : newEmail, // real auth email only updates after confirm
        phone: phone.trim(),
      });

      toast.success(emailMsg ?? "Profile saved.");
      await refresh();
    } catch (e: unknown) {
      console.error("[AdminProfile] save failed", e);
      const msg =
        (e as { message?: string } | null)?.message ||
        (typeof e === "string" ? e : "") ||
        "Failed to save profile.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleOnDuty = async (next: boolean) => {
    if (!user?.id) return;
    if (next && !phone.trim()) {
      return toast.error("Add and save your phone number first so you can receive SMS alerts.");
    }
    if (next && phone.trim() !== orig.phone.trim()) {
      return toast.error("Save your phone number first, then turn on duty.");
    }
    setSavingDuty(true);
    setOnDuty(next);
    // Upsert so the toggle persists even if the admin_profiles row was
    // never written with on_duty before — a plain UPDATE would silently
    // no-op and the switch would flip back on the next refresh.
    const { error } = await supabase
      .from("admin_profiles")
      .upsert(
        { id: user.id, on_duty: next, full_name: fullName.trim() || (user.name ?? "") } as never,
        { onConflict: "id" },
      );
    setSavingDuty(false);
    if (error) {
      setOnDuty(!next);
      toast.error(error.message);
    } else {
      toast.success(next ? "You're on duty — new orders will text you." : "You're off duty.");
    }
  };


  const changePassword = async () => {
    if (newPassword.length < 8) return toast.error("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return toast.error("Passwords don't match.");
    if (!currentPassword) return toast.error("Enter your current password to confirm.");
    if (!email) return toast.error("Email not loaded yet — try again in a moment.");

    setChangingPw(true);
    try {
      // Verify current password by re-authenticating
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: orig.email,
        password: currentPassword,
      });
      if (signInErr) throw new Error("Current password is incorrect.");

      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } catch (e: unknown) {
      const msg =
        (e as { message?: string } | null)?.message ||
        (typeof e === "string" ? e : "") ||
        "Failed to update password.";
      toast.error(msg);
    } finally {
      setChangingPw(false);
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

      <EmailStatusCard
        activeEmail={orig.email}
        pendingEmail={pendingEmail && pendingEmail.toLowerCase() !== orig.email.toLowerCase() ? pendingEmail : null}
        onResend={async () => {
          if (!pendingEmail) return;
          const { error } = await supabase.auth.updateUser({ email: pendingEmail });
          if (error) toast.error(error.message);
          else toast.success(`Confirmation re-sent to ${pendingEmail}.`);
        }}
      />

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center ${onDuty ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              {onDuty ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </div>
            <div>
              <div className="font-medium text-foreground">On-duty for SMS alerts</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                When on, your phone receives a text every time a new paid order comes in. If no admin is on duty, every active admin with a phone is texted as a fallback.
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
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input border-border text-foreground" />
          <p className="text-xs text-muted-foreground">
            Changing your email sends a confirmation link to the new address. You stay signed in until you confirm.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label htmlFor="phone">Phone (for SMS notifications)</Label>
            <span className="text-[11px] text-muted-foreground">
              Currently saved:{" "}
              <span className="font-mono text-foreground">
                {orig.phone || "— none —"}
              </span>
            </span>
          </div>
          <div className="relative">
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={orig.phone || "+254712345678"}
              className="bg-input border-border text-foreground pr-20"
            />
            {orig.phone && phone !== orig.phone && (
              <button
                type="button"
                onClick={() => setPhone(orig.phone)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Use the international format (e.g. +254712345678). Required to receive new-order SMS alerts.
          </p>
        </div>

        <div className="pt-2">
          <Button onClick={save} disabled={saving || !dirty} className="bg-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving…" : dirty ? "Save changes" : "No changes"}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Change password</h2>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current password</Label>
          <div className="relative">
            <Input
              id="currentPassword"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-input border-border text-foreground pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-input border-border text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-input border-border text-foreground"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">At least 8 characters. You'll stay signed in after the change.</p>

        <div className="pt-2">
          <Button
            onClick={changePassword}
            disabled={changingPw || !currentPassword || !newPassword || !confirmPassword}
            className="bg-primary text-primary-foreground"
          >
            <KeyRound className="w-4 h-4 mr-2" />
            {changingPw ? "Updating…" : "Update password"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmailStatusCard({
  activeEmail,
  pendingEmail,
  onResend,
}: {
  activeEmail: string;
  pendingEmail: string | null;
  onResend: () => Promise<void>;
}) {
  const [resending, setResending] = useState(false);
  const pending = !!pendingEmail;

  return (
    <div
      className={`rounded-xl p-5 border ${
        pending
          ? "bg-amber-500/5 border-amber-500/30"
          : "bg-emerald-500/5 border-emerald-500/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center ${
            pending ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"
          }`}
        >
          <Mail className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              {pending ? (
                <>
                  <Clock className="w-4 h-4 text-amber-300" />
                  Email change pending confirmation
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  Email confirmed
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pending
                ? "Your sign-in email won't change until you click the confirmation link sent to the new address."
                : "This is the address you sign in with and where account notices are delivered."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-card border border-border p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Currently active
              </div>
              <div className="text-sm font-medium text-foreground mt-1 truncate" title={activeEmail}>
                {activeEmail || "—"}
              </div>
              <div className="text-[11px] text-emerald-300 mt-1 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Confirmed · used to sign in
              </div>
            </div>

            <div
              className={`rounded-lg border p-3 ${
                pending ? "bg-card border-amber-500/30" : "bg-muted/30 border-dashed border-border"
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Pending change
              </div>
              <div
                className={`text-sm font-medium mt-1 truncate ${
                  pending ? "text-foreground" : "text-muted-foreground"
                }`}
                title={pendingEmail ?? ""}
              >
                {pendingEmail ?? "None"}
              </div>
              <div
                className={`text-[11px] mt-1 inline-flex items-center gap-1 ${
                  pending ? "text-amber-300" : "text-muted-foreground"
                }`}
              >
                <Clock className="w-3 h-3" />
                {pending ? "Awaiting confirmation from new address" : "No change in progress"}
              </div>
            </div>
          </div>

          {pending && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                disabled={resending}
                onClick={async () => {
                  setResending(true);
                  try {
                    await onResend();
                  } finally {
                    setResending(false);
                  }
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${resending ? "animate-spin" : ""}`} />
                {resending ? "Sending…" : "Resend confirmation"}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Didn't get it? Check spam, then resend.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
