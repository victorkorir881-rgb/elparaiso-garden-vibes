import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import PublicLayout from "@/components/public/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Mail, Lock, User as UserIcon, ArrowRight, Eye, EyeOff,
  CheckCircle2, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.74-6-6.1S8.7 6 12 6c1.9 0 3.16.8 3.88 1.5l2.65-2.55C16.86 3.4 14.6 2.4 12 2.4 6.85 2.4 2.7 6.55 2.7 11.7s4.15 9.3 9.3 9.3c5.36 0 8.92-3.77 8.92-9.07 0-.61-.07-1.08-.16-1.55H12z" />
    </svg>
  );
}

type View = "auth" | "forgot" | "check-email";

export default function CustomerLoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string };
  const redirectTo = search.redirect || "/account";

  const [view, setView] = useState<View>("auth");
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // If already signed in, leave the auth page immediately.
  useEffect(() => {
    if (!auth.loading && auth.isAuthenticated) {
      navigate({ to: redirectTo as any, replace: true });
    }
  }, [auth.loading, auth.isAuthenticated, redirectTo, navigate]);

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await auth.signInWithGoogle(redirectTo);
    if (error) {
      toast.error(error);
      setBusy(false);
    }
    // On success the browser is navigated away by Supabase to Google.
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await auth.signIn(email.trim(), password);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Welcome back!");
    navigate({ to: redirectTo as any, replace: true });
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (name.trim().length < 2) return toast.error("Please enter your full name");
    if (!acceptedTerms) return toast.error("Please accept the Terms and Privacy Policy to continue");
    setBusy(true);
    const { error, needsEmailConfirmation } = await auth.signUp(email.trim(), password, name.trim());
    setBusy(false);
    if (error) return toast.error(error);
    if (needsEmailConfirmation) {
      setPendingEmail(email.trim());
      setView("check-email");
      return;
    }
    toast.success(`Welcome to Elparaiso, ${name.split(" ")[0]}!`);
    navigate({ to: redirectTo as any, replace: true });
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Enter your email first");
    setBusy(true);
    const { error } = await auth.resetPassword(email.trim());
    setBusy(false);
    if (error) return toast.error(error);
    setPendingEmail(email.trim());
    setView("check-email");
  };

  // Don't show flash of form if we're going to navigate away
  if (auth.loading || auth.isAuthenticated) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="relative bg-background py-12 sm:py-20 px-3 sm:px-4 overflow-hidden min-h-[80vh]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 h-[420px] -z-10 opacity-70"
          style={{ background: "radial-gradient(50% 60% at 50% 0%, oklch(74% 0.11 75 / 0.18), transparent 70%)" }}
        />
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <BrandLogo eager size="md" className="mx-auto mb-4" />
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs font-medium uppercase tracking-[0.18em] text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Customer account
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold tracking-tight mb-3">
              Welcome to{" "}
              <span
                className="italic"
                style={{
                  background: "var(--gradient-gold)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Elparaiso
              </span>
            </h1>
            <p className="text-foreground/65 text-base">
              {view === "forgot"
                ? "We'll email you a link to reset your password."
                : view === "check-email"
                ? "Almost there — check your inbox to continue."
                : "Sign in to track orders, view history, and check out faster."}
            </p>
          </div>

          <Card
            className="p-6 sm:p-8 border-primary/20"
            style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-elegant)" }}
          >
            {/* === CHECK EMAIL VIEW === */}
            {view === "check-email" && (
              <div className="text-center py-2">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}
                >
                  <Mail className="w-7 h-7 text-primary-foreground" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Check your inbox</h2>
                <p className="text-sm text-foreground/65 mb-1">
                  We sent a confirmation link to
                </p>
                <p className="text-sm font-medium text-foreground mb-5 break-all">{pendingEmail}</p>
                <p className="text-xs text-foreground/50 mb-6">
                  Click the link in the email to finish. Don't see it? Check your spam folder.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setView("auth")}
                  className="w-full rounded-full"
                >
                  <ChevronLeft className="w-4 h-4 mr-1.5" /> Back to sign in
                </Button>
              </div>
            )}

            {/* === FORGOT PASSWORD VIEW === */}
            {view === "forgot" && (
              <form onSubmit={handleForgot} className="space-y-4">
                <Field
                  icon={Mail}
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
                <Button
                  type="submit"
                  disabled={busy}
                  size="lg"
                  className="w-full rounded-full font-medium"
                  style={{
                    background: "var(--gradient-gold)",
                    color: "var(--primary-foreground)",
                    boxShadow: "var(--shadow-gold)",
                  }}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset link"}
                </Button>
                <button
                  type="button"
                  onClick={() => setView("auth")}
                  className="w-full text-sm text-foreground/60 hover:text-foreground inline-flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to sign in
                </button>
              </form>
            )}

            {/* === MAIN AUTH VIEW === */}
            {view === "auth" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleGoogle}
                  disabled={busy}
                  className="w-full rounded-full font-medium border-border/80 bg-background hover:bg-accent"
                >
                  {busy ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <GoogleIcon className="w-5 h-5 mr-2" />
                  )}
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
                      <Field
                        icon={Mail}
                        label="Email"
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                      />
                      <PasswordField
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        show={showPassword}
                        onToggle={() => setShowPassword((s) => !s)}
                        rightSlot={
                          <button
                            type="button"
                            onClick={() => setView("forgot")}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Forgot password?
                          </button>
                        }
                      />
                      <Button
                        type="submit"
                        disabled={busy}
                        size="lg"
                        className="w-full rounded-full font-medium"
                        style={{
                          background: "var(--gradient-gold)",
                          color: "var(--primary-foreground)",
                          boxShadow: "var(--shadow-gold)",
                        }}
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Sign in <ArrowRight className="w-4 h-4 ml-1.5" />
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="mt-5">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <Field
                        icon={UserIcon}
                        label="Full name"
                        type="text"
                        value={name}
                        onChange={setName}
                        placeholder="Your name"
                        autoComplete="name"
                        required
                      />
                      <Field
                        icon={Mail}
                        label="Email"
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                      />
                      <PasswordField
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        minLength={8}
                        show={showPassword}
                        onToggle={() => setShowPassword((s) => !s)}
                        hint={
                          password.length === 0
                            ? "Use 8+ characters with a mix of letters and numbers."
                            : password.length < 8
                            ? `${8 - password.length} more character${8 - password.length === 1 ? "" : "s"} needed`
                            : "Looks good."
                        }
                      />
                      <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          required
                          className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                          aria-label="Accept terms and privacy policy"
                        />
                        <span className="text-xs text-foreground/70 leading-relaxed">
                          I agree to the{" "}
                          <Link to="/terms" target="_blank" className="text-primary underline hover:no-underline">
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link to="/privacy" target="_blank" className="text-primary underline hover:no-underline">
                            Privacy Policy
                          </Link>
                          .
                        </span>
                      </label>
                      <Button
                        type="submit"
                        disabled={busy || !acceptedTerms}
                        size="lg"
                        className="w-full rounded-full font-medium"
                        style={{
                          background: "var(--gradient-gold)",
                          color: "var(--primary-foreground)",
                          boxShadow: "var(--shadow-gold)",
                        }}
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Create account <ArrowRight className="w-4 h-4 ml-1.5" />
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </Card>

          {view === "auth" && (
            <p className="text-center text-sm text-foreground/55 mt-6">
              Just want to track an order?{" "}
              <Link to="/track" search={{ q: undefined }} className="text-primary hover:underline font-medium">
                Track without signing in
              </Link>
            </p>
          )}
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

function PasswordField({
  label, value, onChange, placeholder, autoComplete, minLength, show, onToggle, hint, rightSlot,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string; minLength?: number;
  show: boolean; onToggle: () => void; hint?: string; rightSlot?: React.ReactNode;
}) {
  const meetsMin = !minLength || value.length >= minLength;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium">{label}</label>
        {rightSlot}
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          className="pl-10 pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-accent transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && (
        <p
          className={cn(
            "text-xs mt-1 inline-flex items-center gap-1",
            meetsMin && value.length > 0 ? "text-emerald-400" : "text-foreground/50",
          )}
        >
          {meetsMin && value.length > 0 ? <CheckCircle2 className="w-3 h-3" /> : null}
          {hint}
        </p>
      )}
    </div>
  );
}
