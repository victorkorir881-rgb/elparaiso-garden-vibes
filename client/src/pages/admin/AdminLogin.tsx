import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { isAuthenticated, user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated && ["super_admin", "admin", "manager", "staff"].includes(user?.role ?? "")) {
    navigate("/admin");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) toast.error(error);
      else navigate("/admin");
    } else {
      const { error } = await signUp(email, password, fullName);
      if (error) toast.error(error);
      else toast.success("Account created! Check your email to confirm, then sign in.");
    }
    setSubmitting(false);
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
          <div className="flex mb-6">
            <button onClick={() => setMode("login")} className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${mode === "login" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Sign In</button>
            <button onClick={() => setMode("register")} className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${mode === "register" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Register</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <Label className="text-foreground">Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" className="bg-input border-border text-foreground mt-1" required />
              </div>
            )}
            <div>
              <Label className="text-foreground">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@elparaiso.com" className="bg-input border-border text-foreground mt-1" required />
            </div>
            <div>
              <Label className="text-foreground">Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="bg-input border-border text-foreground mt-1" required minLength={6} />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-semibold" disabled={submitting}>
              {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Register"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <a href="/" className="text-muted-foreground text-xs hover:text-primary transition-colors">← Back to Website</a>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          First registered user automatically becomes super admin.
        </p>
      </div>
    </div>
  );
}
