import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// /admin/accept-invite?token=...&email=...
// One-time invitation acceptance: caller sets a password, the edge function
// validates the token + creates the auth user with the invited role.
export default function AcceptInvite() {
  const navigate = useNavigate();
  const params = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);
  const token = params.get("token") ?? "";
  const email = (params.get("email") ?? "").toLowerCase();

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token || !email) toast.error("This invitation link is missing required information.");
  }, [token, email]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-accept-invite", {
        body: { token, email, password, fullName },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string } | null;
      if (!payload?.ok) throw new Error(payload?.error ?? "Failed to accept invitation");

      // Sign the new admin in immediately.
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        toast.success("Account activated. Please sign in.");
        navigate({ to: "/admin/login" });
      } else {
        setDone(true);
        toast.success("Welcome to Elparaiso admin!");
        navigate({ to: "/admin" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept invitation";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-primary font-display font-bold text-2xl">E</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Accept invitation</h1>
          <p className="text-muted-foreground text-sm mt-1">Set your password to activate your admin account.</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          {(!token || !email) ? (
            <p className="text-sm text-destructive">This invitation link is invalid. Please ask the admin to send a new one.</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label className="text-foreground">Email</Label>
                <Input value={email} disabled className="bg-input border-border text-foreground mt-1" />
              </div>
              <div>
                <Label className="text-foreground">Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="bg-input border-border text-foreground mt-1" required />
              </div>
              <div>
                <Label className="text-foreground">Password</Label>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="bg-input border-border text-foreground mt-1" minLength={8} required />
              </div>
              <div>
                <Label className="text-foreground">Confirm password</Label>
                <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" className="bg-input border-border text-foreground mt-1" minLength={8} required />
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-semibold" disabled={submitting}>
                {submitting ? "Activating..." : "Activate account"}
              </Button>
            </form>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          This link is single-use and expires once accepted.
        </p>
      </div>
    </div>
  );
}
