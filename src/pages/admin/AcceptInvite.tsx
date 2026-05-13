import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  XCircle,
  Clock,
  Ban,
  Mail,
  Sparkles,
  Lock,
  Phone,
  User,
  ArrowRight,
} from "lucide-react";

type ErrorCode = "invalid" | "used" | "revoked" | "expired" | "missing" | "network";

type ValidationState =
  | { status: "loading" }
  | { status: "valid"; role: string; expiresAt: string }
  | { status: "error"; code: ErrorCode; message: string };

const ERROR_META: Record<
  ErrorCode,
  { title: string; icon: typeof AlertTriangle; tone: string; hint: string }
> = {
  invalid: {
    title: "Invitation not recognised",
    icon: XCircle,
    tone: "text-destructive",
    hint: "The link may have been mistyped or replaced by a newer invitation.",
  },
  used: {
    title: "Already activated",
    icon: CheckCircle2,
    tone: "text-emerald-500",
    hint: "This invitation has already been used. Sign in with your password instead.",
  },
  revoked: {
    title: "Invitation revoked",
    icon: Ban,
    tone: "text-destructive",
    hint: "An administrator has revoked this invitation.",
  },
  expired: {
    title: "Invitation expired",
    icon: Clock,
    tone: "text-amber-500",
    hint: "Invitations are valid for 7 days. Ask an admin to send a fresh one.",
  },
  missing: {
    title: "Link is incomplete",
    icon: AlertTriangle,
    tone: "text-destructive",
    hint: "The invitation link is missing required parameters.",
  },
  network: {
    title: "Couldn't verify the invitation",
    icon: AlertTriangle,
    tone: "text-destructive",
    hint: "Check your connection and try again, or request a new invitation.",
  },
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

const ROLE_DESCRIPTION: Record<string, string> = {
  super_admin: "Full control over users, settings, and all data.",
  admin: "Manage menu, orders, reservations, and content.",
  manager: "Oversee daily operations and approve actions.",
  staff: "Handle day-to-day orders and reservations.",
};

function formatExpiry(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = d.getTime() - Date.now();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (diffMs <= 0) return "expired";
  if (days >= 1) return `expires in ${days} day${days === 1 ? "" : "s"}`;
  if (hours >= 1) return `expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  return "expires soon";
}

// /admin/accept-invite?token=...&email=...
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
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activated, setActivated] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [continuing, setContinuing] = useState(false);

  // Optional phone — if provided, must look like a Kenyan number.
  const phoneTrimmed = phone.trim();
  const phoneValid =
    phoneTrimmed.length === 0 || /^(\+?254|0)[17]\d{8}$/.test(phoneTrimmed.replace(/\s+/g, ""));

  useEffect(() => {
    if (!token || !email) {
      setValidation({
        status: "error",
        code: "missing",
        message: "This link is missing the token or email.",
      });
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
          const ctx: any = (error as any).context;
          let code: any = "network";
          let message = error.message || "Could not verify invitation.";
          try {
            const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
            if (body?.code) code = body.code;
            if (body?.error) message = body.error;
          } catch {
            /* ignore */
          }
          setValidation({ status: "error", code, message });
          return;
        }
        const payload = data as { ok?: boolean; role?: string; expiresAt?: string } | null;
        if (!payload?.ok || !payload.role) {
          setValidation({
            status: "error",
            code: "invalid",
            message: "Invitation could not be verified.",
          });
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
    return () => {
      cancelled = true;
    };
  }, [token, email]);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      letter: /[A-Za-z]/.test(password),
      number: /\d/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
      match: password.length > 0 && password === confirm,
    }),
    [password, confirm],
  );
  const strengthScore =
    Number(passwordChecks.length) +
    Number(passwordChecks.letter) +
    Number(passwordChecks.number) +
    Number(passwordChecks.symbol);
  const strength =
    strengthScore <= 1
      ? { label: "Weak", color: "bg-destructive", text: "text-destructive", width: "w-1/4" }
      : strengthScore === 2
        ? { label: "Fair", color: "bg-amber-500", text: "text-amber-500", width: "w-2/4" }
        : strengthScore === 3
          ? { label: "Good", color: "bg-yellow-400", text: "text-yellow-500", width: "w-3/4" }
          : { label: "Strong", color: "bg-emerald-500", text: "text-emerald-500", width: "w-full" };

  const passwordOk =
    passwordChecks.length && passwordChecks.letter && passwordChecks.number && passwordChecks.match;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Please enter your full name.");
    if (!phoneValid) return toast.error("Enter a valid phone number (e.g. 0712 345 678) or leave it blank.");
    if (!passwordChecks.length) return toast.error("Password must be at least 8 characters.");
    if (!passwordChecks.letter || !passwordChecks.number)
      return toast.error("Use a mix of letters and numbers.");
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
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      const payload = data as { ok?: boolean; error?: string } | null;
      if (!payload?.ok) throw new Error(payload?.error ?? "Failed to accept invitation");

      // Sign in immediately so we can persist the phone via RLS-protected update.
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr || !signInData.user) {
        // Auth user exists but auto sign-in failed — surface the activation
        // confirmation anyway so the user knows the account is created.
        setActivated(true);
        setProfileSaved(false);
        toast.success("Account activated. You can sign in with your new password.");
        return;
      }

      // Persist the additional profile fields. full_name is already written by
      // the handle_new_user trigger using the value we passed to the edge fn.
      const updates: Record<string, string | null> = {
        full_name: fullName.trim(),
      };
      if (phoneTrimmed.length > 0) updates.phone = phoneTrimmed;

      const { error: profileErr } = await supabase
        .from("admin_profiles")
        .update(updates as never)
        .eq("id", signInData.user.id);

      setActivated(true);
      setProfileSaved(!profileErr);
      if (profileErr) {
        toast.warning("Account activated, but we couldn't save your phone. You can add it later in Profile.");
      } else {
        toast.success("Welcome to Elparaiso admin!");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept invitation";
      toast.error(msg);
      setSubmitting(false);
    }
  };

  const handleContinue = async () => {
    setContinuing(true);
    // Confirm we still have a session before sending the user to /admin.
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      navigate({ to: "/admin" });
    } else {
      navigate({ to: "/admin/login" });
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4 sm:p-6">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl" />
              <img
                src="/logo.png"
                alt="Elparaiso Garden Kisii logo"
                className="relative w-20 h-20 rounded-full object-cover bg-white border border-primary/30 shadow-lg"
              />
            </div>
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground tracking-tight">
            Welcome aboard
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
            You've been invited to join the Elparaiso admin team. Let's get your account set up.
          </p>
        </div>

        {/* Card */}
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
          {validation.status === "loading" && (
            <div className="flex flex-col items-center justify-center py-14 px-6 gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-md animate-pulse" />
                <Loader2 className="relative w-7 h-7 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Verifying your invitation…</p>
            </div>
          )}

          {validation.status === "error" &&
            (() => {
              const meta = ERROR_META[validation.code];
              const Icon = meta.icon;
              return (
                <div className="text-center px-6 py-8">
                  <div
                    className={`mx-auto w-14 h-14 rounded-full bg-muted/60 ring-1 ring-border flex items-center justify-center mb-4`}
                  >
                    <Icon className={`w-7 h-7 ${meta.tone}`} />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{meta.title}</h2>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {meta.hint}
                  </p>
                  {validation.message && validation.message !== meta.title && (
                    <p className="text-xs text-muted-foreground/70 mt-3 px-4 py-2 bg-muted/30 rounded-md font-mono">
                      {validation.message}
                    </p>
                  )}
                  <div className="mt-6 flex flex-col gap-2">
                    <Button asChild className="w-full h-11">
                      <Link to="/admin/login">Go to sign in</Link>
                    </Button>
                  </div>
                </div>
              );
            })()}

          {validation.status === "valid" && activated && (
            <div className="px-6 py-7">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center mb-4 animate-in zoom-in duration-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">You're all set</h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Your admin account has been created. Review your details below.
                </p>
              </div>

              <dl className="mt-6 rounded-xl border border-border bg-muted/20 divide-y divide-border overflow-hidden">
                <SummaryRow icon={User} label="Full name" value={fullName.trim()} ok />
                <SummaryRow icon={Mail} label="Email" value={email} ok />
                <SummaryRow
                  icon={Phone}
                  label="Phone"
                  value={phoneTrimmed || "Not provided"}
                  ok={profileSaved && phoneTrimmed.length > 0}
                  muted={phoneTrimmed.length === 0}
                />
                <SummaryRow
                  icon={ShieldCheck}
                  label="Role"
                  value={ROLE_LABEL[validation.role] ?? validation.role}
                  ok
                />
              </dl>

              {!profileSaved && phoneTrimmed.length > 0 && (
                <p className="mt-3 text-[11px] text-amber-500 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  We couldn't save your phone right now. You can add it later from your Profile page.
                </p>
              )}

              <Button
                onClick={handleContinue}
                disabled={continuing}
                className="w-full h-11 mt-6 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
              >
                {continuing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Opening dashboard…
                  </>
                ) : (
                  <>
                    Continue to dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center mt-3">
                Tip: bookmark <span className="font-mono text-foreground/80">/admin/login</span> on this device for faster access next time.
              </p>
            </div>
          )}

          {validation.status === "valid" && !activated && (
            <form onSubmit={onSubmit}>
              {/* Invitation summary */}
              <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/15 ring-1 ring-primary/25 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        Role
                      </span>
                      <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border border-primary/30 text-[10px] font-semibold uppercase tracking-wider">
                        {ROLE_LABEL[validation.role] ?? validation.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {ROLE_DESCRIPTION[validation.role] ?? "Admin access to the dashboard."}
                    </p>
                    {validation.expiresAt && (
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Invitation {formatExpiry(validation.expiresAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div>
                  <Label className="text-foreground text-xs font-medium flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    value={email}
                    disabled
                    className="bg-muted/40 border-border text-muted-foreground mt-1.5 h-10"
                  />
                </div>

                <div>
                  <Label className="text-foreground text-xs font-medium">Full name</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jane Mwangi"
                    className="bg-input border-border text-foreground mt-1.5 h-10"
                    autoComplete="name"
                    required
                  />
                </div>

                <div>
                  <Label className="text-foreground text-xs font-medium flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    Phone <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0712 345 678"
                    className="bg-input border-border text-foreground mt-1.5 h-10"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                  {phone.length > 0 && !phoneValid && (
                    <p className="mt-1.5 text-[11px] text-destructive flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      Use a Kenyan number like 0712 345 678 or +254712345678
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-foreground text-xs font-medium flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    Create password
                  </Label>
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="bg-input border-border text-foreground mt-1.5 h-10"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  {password.length > 0 && (
                    <div className="mt-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${strength.color} ${strength.width} transition-all duration-300`}
                          />
                        </div>
                        <span className={`text-[11px] font-medium ${strength.text}`}>
                          {strength.label}
                        </span>
                      </div>
                      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        <Check ok={passwordChecks.length}>8+ characters</Check>
                        <Check ok={passwordChecks.letter}>A letter</Check>
                        <Check ok={passwordChecks.number}>A number</Check>
                        <Check ok={passwordChecks.symbol}>A symbol (optional)</Check>
                      </ul>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-foreground text-xs font-medium">Confirm password</Label>
                  <PasswordInput
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    className="bg-input border-border text-foreground mt-1.5 h-10"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  {confirm.length > 0 && (
                    <p
                      className={`mt-1.5 text-[11px] flex items-center gap-1 ${
                        passwordChecks.match ? "text-emerald-500" : "text-destructive"
                      }`}
                    >
                      {passwordChecks.match ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {passwordChecks.match ? "Passwords match" : "Passwords don't match yet"}
                    </p>
                  )}
                </div>
              </div>

              <div className="px-6 pb-6 pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                  disabled={submitting || !passwordOk || !phoneValid || !fullName.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Activating your account…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Activate account
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-3">
                  By activating, you agree to follow the team's admin policies.
                </p>
              </div>
            </form>
          )}
        </div>

        <p className="text-xs text-muted-foreground/70 text-center mt-5">
          This link is single-use and expires once accepted.
        </p>
      </div>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li
      className={`flex items-center gap-1.5 transition-colors ${
        ok ? "text-emerald-500" : "text-muted-foreground"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="w-3 h-3 shrink-0" />
      ) : (
        <span className="w-3 h-3 rounded-full border border-muted-foreground/40 shrink-0" />
      )}
      <span className="truncate">{children}</span>
    </li>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  ok,
  muted,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  ok?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-background ring-1 ring-border flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={`text-sm truncate ${
            muted ? "text-muted-foreground italic" : "text-foreground font-medium"
          }`}
        >
          {value}
        </p>
      </div>
      {ok && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
    </div>
  );
}
