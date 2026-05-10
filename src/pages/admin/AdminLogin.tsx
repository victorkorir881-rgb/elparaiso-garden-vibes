import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { useAuth, supabase } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { isAuthenticated, user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

  // Public registration is only available until the first super_admin exists.
  // After that, additional admins must be added via invitation.
  useEffect(() => {
    let active = true;
    (supabase.rpc as any)("has_super_admin").then(({ data, error }: { data: unknown; error: unknown }) => {
      if (!active) return;
      // Default to closed on error so we never accidentally expose the form.
      setRegistrationOpen(error ? false : !data);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (registrationOpen === false && mode === "register") setMode("login");
  }, [registrationOpen, mode]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("idle-logout") === "1") {
        sessionStorage.removeItem("idle-logout");
        toast.info("You were signed out after 5 minutes of inactivity. Please sign in again.");
      }
    } catch { /* ignore */ }
  }, []);


  if (!loading && isAuthenticated && ["super_admin", "admin", "manager", "staff"].includes(user?.role ?? "")) {
    navigate({ to: "/admin" });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) toast.error(error);
        else navigate({ to: "/admin" });
      } else if (mode === "register") {
        const { error } = await signUp(email, password, fullName);
        if (error) toast.error(error);
        else toast.success("Account created! Check your email to confirm, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: siteUrl("/reset-password"),
        });
        if (error) toast.error(error.message);
        else toast.success("Check your email for the reset link.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: siteUrl("/admin") },
    });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-primary font-display font-bold text-2xl">E</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground text-sm mt-1">Elparaiso Garden Kisii</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          {mode !== "forgot" && registrationOpen && (
            <div className="flex mb-6">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${mode === "login" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${mode === "register" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              >
                Register (first admin)
              </button>
            </div>
          )}

          {mode !== "forgot" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full border-border text-foreground h-11 font-medium mb-4"
                onClick={handleGoogle}
                disabled={submitting}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
                Continue with Google
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <Label className="text-foreground">Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="bg-input border-border text-foreground mt-1" required />
              </div>
            )}
            <div>
              <Label className="text-foreground">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@elparaiso.com" className="bg-input border-border text-foreground mt-1" required />
            </div>
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Password</Label>
                  {mode === "login" && (
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                      Forgot?
                    </button>
                  )}
                </div>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-input border-border text-foreground mt-1" required minLength={6} />
              </div>
            )}
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-semibold" disabled={submitting}>
              {submitting ? "Please wait..." : mode === "login" ? "Sign In" : mode === "register" ? "Register" : "Send reset link"}
            </Button>
            {mode === "forgot" && (
              <button type="button" onClick={() => setMode("login")} className="w-full text-center text-xs text-muted-foreground hover:text-primary">
                ← Back to sign in
              </button>
            )}
          </form>

          <div className="mt-4 text-center">
            <Link to="/" className="text-muted-foreground text-xs hover:text-primary transition-colors">← Back to Website</Link>
          </div>
        </div>



        <p className="text-xs text-muted-foreground text-center mt-4">
          {registrationOpen
            ? "The first registered user becomes super admin. After that, new admins join by invitation only."
            : "Admin accounts are by invitation only. Ask a super admin to send you an invite."}
          {" "}For security, sign in is required each browser session.
        </p>
      </div>
    </div>
  );
}
