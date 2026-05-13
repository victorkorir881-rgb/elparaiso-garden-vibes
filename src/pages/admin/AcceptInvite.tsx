import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle, Clock, Ban } from "lucide-react";

type ErrorCode = "invalid" | "used" | "revoked" | "expired" | "missing" | "network";

type ValidationState =
  | { status: "loading" }
  | { status: "valid"; role: string; expiresAt: string }
  | { status: "error"; code: ErrorCode; message: string };

const ERROR_META: Record<ErrorCode, { title: string; icon: typeof AlertTriangle; tone: string }> = {
  invalid: { title: "Invitation not recognised", icon: XCircle, tone: "text-destructive" },
  used: { title: "Already activated", icon: CheckCircle2, tone: "text-muted-foreground" },
  revoked: { title: "Invitation revoked", icon: Ban, tone: "text-destructive" },
  expired: { title: "Invitation expired", icon: Clock, tone: "text-muted-foreground" },
  missing: { title: "Link is incomplete", icon: AlertTriangle, tone: "text-destructive" },
  network: { title: "Couldn't verify the invitation", icon: AlertTriangle, tone: "text-destructive" },
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

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

  const [validation, setValidation] = useState<ValidationState>({ status: "loading" });
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activated, setActivated] = useState(false);

  // Pre-validate the invitation on mount so users see a clear state before
  // typing a password into a dead link.
  useEffect(() => {
    if (!token || !email) {
      setValidation({ status: "error", code: "missing", message: "This link is missing the token or email." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("admin-accept-invite", {
          body: { token, email, validateOnly: true },
        });
        if (cancelled) return;
        if (error) {
          // supabase-js wraps non-2xx responses; try to extract a code.
          const ctx: any = (error as any).context;
          let code: any = "network";
          let message = error.message || "Could not verify invitation.";
          try {
            const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
            if (body?.code) code = body.code;
            if (body?.error) message = body.error;
          } catch { /* ignore */ }
          setValidation({ status: "error", code, message });
          return;
        }
        const payload = data as { ok?: boolean; role?: string; expiresAt?: string } | null;
        if (!payload?.ok || !payload.role) {
          setValidation({ status: "error", code: "invalid", message: "Invitation could not be verified." });
          return;
        }
        setValidation({ status: "valid", role: payload.role, expiresAt: payload.expiresAt ?? "" });
      } catch (err) {
        if (cancelled) return;
        setValidation({
          status: "error",
          code: "network",
          message: err instanceof Error ? err.message : "Network error",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [token, email]);

  const passwordChecks = useMemo(() => ({
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
    match: password.length > 0 && password === confirm,
  }), [password, confirm]);
  const passwordOk = passwordChecks.length && passwordChecks.letter && passwordChecks.number && passwordChecks.match;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordChecks.length) return toast.error("Password must be at least 8 characters.");
    if (!passwordChecks.letter || !passwordChecks.number) return toast.error("Use a mix of letters and numbers.");
    if (!passwordChecks.match) return toast.error("Passwords do not match.");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-accept-invite", {
        body: { token, email, password, fullName: fullName.trim() },
      });
      if (error) {
        const ctx: any = (error as any).context;
        let message = error.message || "Failed to accept invitation";
        try {
          const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
          if (body?.error) message = body.error;
        } catch { /* ignore */ }
        throw new Error(message);
      }
      const payload = data as { ok?: boolean; error?: string } | null;
      if (!payload?.ok) throw new Error(payload?.error ?? "Failed to accept invitation");

      setActivated(true);

      // Sign the new admin in immediately.
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        toast.success("Account activated. Please sign in.");
        setTimeout(() => navigate({ to: "/admin/login" }), 800);
      } else {
        toast.success("Welcome to Elparaiso admin!");
        setTimeout(() => navigate({ to: "/admin" }), 800);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept invitation";
      toast.error(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Elparaiso Garden Kisii logo"
            className="w-20 h-20 rounded-full object-cover bg-white mx-auto mb-4 border border-primary/20"
          />
          <h1 className="text-2xl font-bold text-foreground">Accept invitation</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set your password to activate your admin account.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          {validation.status === "loading" && (
            <div className="flex flex-col items-center justify-center py-6 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Verifying your invitation…</p>
            </div>
          )}

          {validation.status === "error" && (() => {
            const meta = ERROR_META[validation.code];
            const Icon = meta.icon;
            return (
              <div className="text-center py-2">
                <div className={`mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3`}>
                  <Icon className={`w-6 h-6 ${meta.tone}`} />
                </div>
                <h2 className="text-base font-semibold text-foreground">{meta.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{validation.message}</p>
                <p className="text-xs text-muted-foreground mt-4">
                  Please ask an administrator to send you a fresh invitation.
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <Button asChild variant="outline" className="w-full border-border text-foreground hover:bg-accent">
                    <Link to="/admin/login">Go to sign in</Link>
                  </Button>
                </div>
              </div>
            );
          })()}

          {validation.status === "valid" && activated && (
            <div className="text-center py-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Account activated</h2>
              <p className="text-sm text-muted-foreground mt-1">Signing you in…</p>
              <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto mt-4" />
            </div>
          )}

          {validation.status === "valid" && !activated && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 border border-primary/20">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs text-foreground">
                  You're being added as{" "}
                  <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] mx-0.5">
                    {ROLE_LABEL[validation.role] ?? validation.role}
                  </Badge>
                </p>
              </div>

              <div>
                <Label className="text-foreground">Email</Label>
                <Input
                  value={email}
                  disabled
                  className="bg-input border-border text-foreground mt-1"
                />
              </div>
              <div>
                <Label className="text-foreground">Full name</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="bg-input border-border text-foreground mt-1"
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <Label className="text-foreground">Password</Label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="bg-input border-border text-foreground mt-1"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <ul className="mt-2 space-y-1 text-[11px]">
                  <Check ok={passwordChecks.length}>At least 8 characters</Check>
                  <Check ok={passwordChecks.letter}>Contains a letter</Check>
                  <Check ok={passwordChecks.number}>Contains a number</Check>
                </ul>
              </div>
              <div>
                <Label className="text-foreground">Confirm password</Label>
                <PasswordInput
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="bg-input border-border text-foreground mt-1"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                {confirm.length > 0 && (
                  <p className={`mt-1 text-[11px] ${passwordChecks.match ? "text-primary" : "text-destructive"}`}>
                    {passwordChecks.match ? "Passwords match" : "Passwords don't match yet"}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-semibold"
                disabled={submitting || !passwordOk}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Activating…
                  </>
                ) : (
                  "Activate account"
                )}
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

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? "text-primary" : "text-muted-foreground"}`}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-muted-foreground/40" />}
      <span>{children}</span>
    </li>
  );
}
