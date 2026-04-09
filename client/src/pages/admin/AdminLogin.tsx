import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { isAuthenticated, user, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated && ["admin", "manager", "editor"].includes(user?.role ?? "")) {
      navigate("/admin");
    }
  }, [isAuthenticated, user, loading, navigate]);

  const loginUrl = getLoginUrl();

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
          <p className="text-muted-foreground text-sm text-center mb-6">
            Sign in with your Manus account to access the admin panel.
          </p>
          <a href={loginUrl} className="block">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-semibold">
              Sign In to Admin Panel
            </Button>
          </a>
          <div className="mt-4 text-center">
            <a href="/" className="text-muted-foreground text-xs hover:text-primary transition-colors">
              ← Back to Website
            </a>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Access is restricted to authorized staff only.
        </p>
      </div>
    </div>
  );
}
