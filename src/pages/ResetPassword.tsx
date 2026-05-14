import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    // Supabase parses the hash and emits PASSWORD_RECOVERY when the user
    // arrives via the reset email link. Until that event fires, do not allow
    // the form to submit (otherwise the user could update an unrelated session).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });
    // If the page is loaded outside a recovery flow and there's no recovery
    // token in the URL hash, show a friendly message.
    if (!window.location.hash.includes("type=recovery")) {
      // Allow if user is already in a recovery session, otherwise stay disabled.
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setRecoveryReady(true);
      });
    }
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. You can sign in now.");
    navigate({ to: "/admin/login" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandLogo eager className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full object-contain bg-white p-1 sm:p-1.5 border border-primary/20 text-base sm:text-lg" />
          <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
          <p className="text-muted-foreground text-sm mt-1">Choose a strong password you haven't used before.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <Label className="text-foreground">New password</Label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="bg-input border-border text-foreground mt-1" />
          </div>
          <div>
            <Label className="text-foreground">Confirm password</Label>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className="bg-input border-border text-foreground mt-1" />
          </div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-semibold" disabled={submitting || !recoveryReady}>
            {submitting ? "Updating..." : recoveryReady ? "Update password" : "Waiting for reset link..."}
          </Button>
        </form>
      </div>
    </div>
  );
}
