import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import PublicLayout from "@/components/public/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.74-6-6.1S8.7 6 12 6c1.9 0 3.16.8 3.88 1.5l2.65-2.55C16.86 3.4 14.6 2.4 12 2.4 6.85 2.4 2.7 6.55 2.7 11.7s4.15 9.3 9.3 9.3c5.36 0 8.92-3.77 8.92-9.07 0-.61-.07-1.08-.16-1.55H12z"/>
    </svg>
  );
}

export default function CustomerLoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string };
  const redirectTo = search.redirect || "/account";

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await auth.signInWithGoogle(redirectTo);
    if (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await auth.signIn(email.trim(), password);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Welcome back!");
    navigate({ to: redirectTo });
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    const { error } = await auth.signUp(email.trim(), password, name.trim());
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Account created! Check your inbox to verify your email.");
    setTab("signin");
  };

  return (
    <PublicLayout>
      <div className="relative bg-background py-12 sm:py-20 px-3 sm:px-4 overflow-hidden min-h-[80vh]">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-32 h-[420px] -z-10 opacity-70"
          style={{ background: "radial-gradient(50% 60% at 50% 0%, oklch(74% 0.11 75 / 0.18), transparent 70%)" }} />
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs font-medium uppercase tracking-[0.18em] text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Customer account
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold tracking-tight mb-3">
              Welcome to{" "}
              <span className="italic" style={{ background: "var(--gradient-gold)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Elparaiso
              </span>
            </h1>
            <p className="text-foreground/65 text-base">
              Sign in to track orders, view history, and check out faster.
            </p>
          </div>

          <Card className="p-6 sm:p-8 border-primary/20" style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-elegant)" }}>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleGoogle}
              disabled={busy}
              className="w-full rounded-full font-medium border-border/80 bg-background hover:bg-accent"
            >
              <GoogleIcon className="w-5 h-5 mr-2" />
              Continue with Google
            </Button>

            <div className="my-5 flex items-center gap-3 text-xs text-foreground/40 uppercase tracking-wider">
              <span className="flex-1 h-px bg-border" />
              or
              <span className="flex-1 h-px bg-border" />
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" required />
                  <Field icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" required />
                  <Button type="submit" disabled={busy} size="lg" className="w-full rounded-full font-medium"
                    style={{ background: "var(--gradient-gold)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-gold)" }}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4 ml-1.5" /></>}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-5">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <Field icon={UserIcon} label="Full name" type="text" value={name} onChange={setName} placeholder="Your name" autoComplete="name" required />
                  <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" required />
                  <Field icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" required minLength={8} />
                  <Button type="submit" disabled={busy} size="lg" className="w-full rounded-full font-medium"
                    style={{ background: "var(--gradient-gold)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-gold)" }}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create account <ArrowRight className="w-4 h-4 ml-1.5" /></>}
                  </Button>
                  <p className="text-xs text-foreground/50 text-center">
                    By creating an account you agree to our{" "}
                    <Link to="/terms" className="underline hover:text-primary">Terms</Link> and{" "}
                    <Link to="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </Card>

          <p className="text-center text-sm text-foreground/55 mt-6">
            Just want to track an order?{" "}
            <Link to="/track" className="text-primary hover:underline font-medium">Track without signing in</Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

function Field({
  icon: Icon, label, type, value, onChange, placeholder, autoComplete, required, minLength,
}: {
  icon: any; label: string; type: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string; required?: boolean; minLength?: number;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-1.5 block">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className="pl-10"
        />
      </div>
    </div>
  );
}
