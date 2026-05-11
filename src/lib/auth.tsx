import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { type User, type Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { siteUrl } from "@/lib/site-url";
import { setSentryUser } from "@/lib/sentry";

export { supabase };


type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

type AuthState = {
  user: AdminUser | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
};

type AuthContextType = AuthState & {
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (redirectPath?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchAdminRole(userId: string): Promise<string> {
  const { data } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1);
  return data?.[0]?.role ?? "user";
}

async function fetchAdminProfile(userId: string): Promise<{ name: string | null; email: string | null }> {
  const { data } = await supabase
    .from("admin_profiles")
    .select("full_name, email")
    .eq("id", userId)
    .limit(1);
  return { name: data?.[0]?.full_name ?? null, email: data?.[0]?.email ?? null };
}

async function buildAdminUser(user: User): Promise<AdminUser> {
  // Only query admin tables when the user is actually inside the admin
  // portal. On the customer site, we treat everyone as role "user" so no
  // admin-related requests appear in the customer's network panel.
  const onAdminRoute =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/admin");

  const role = onAdminRoute ? await fetchAdminRole(user.id) : "user";
  const profile = onAdminRoute && role !== "user"
    ? await fetchAdminProfile(user.id)
    : { name: null as string | null, email: null as string | null };
  return {
    id: user.id,
    name: profile.name ?? user.user_metadata?.full_name ?? user.email,
    email: profile.email ?? user.email ?? null,
    role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isAuthenticated: false,
  });

  // Track which user id we've already linked guest orders for, so the RPC
  // fires once per real sign-in — not on every TOKEN_REFRESHED / focus event.
  const linkedUserIdRef = useRef<string | null>(null);

  const loadUser = useCallback(async (session: Session | null, opts?: { runLinkRpc?: boolean }) => {
    if (!session?.user) {
      linkedUserIdRef.current = null;
      setSentryUser(null);
      setState({ user: null, session: null, loading: false, isAuthenticated: false });
      return;
    }
    try {
      const adminUser = await buildAdminUser(session.user);
      setSentryUser({ id: adminUser.id, email: adminUser.email });
      setState({ user: adminUser, session, loading: false, isAuthenticated: true });
      // Backfill past guest orders only on real sign-in, and only once per
      // user id per page session — not on every token refresh.
      if (opts?.runLinkRpc && linkedUserIdRef.current !== adminUser.id) {
        linkedUserIdRef.current = adminUser.id;
        void (supabase.rpc as any)("link_orders_to_current_user").then(() => {}, () => {});
      }
    } catch {
      setSentryUser(null);
      setState({ user: null, session: null, loading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange fires an INITIAL_SESSION event on subscribe, so we
    // don't need a separate getSession() call — that was causing loadUser to
    // run twice on every page load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only run the guest-order-link RPC on actual sign-in events.
      const runLinkRpc = event === "SIGNED_IN" || event === "INITIAL_SESSION";
      loadUser(session, { runLinkRpc });
    });

    return () => subscription.unsubscribe();
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: siteUrl("/admin/login"),
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signInWithGoogle = useCallback(async (redirectPath?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: siteUrl(redirectPath ?? "/account") },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ user: null, session: null, loading: false, isAuthenticated: false });
  }, []);

  // ── 5-minute idle timeout (admin/staff only) ───────────────────────────
  // Customers stay signed in indefinitely; only privileged sessions get the
  // forced logout for security.
  const isPrivileged = state.user?.role && state.user.role !== "user";
  useEffect(() => {
    if (!state.isAuthenticated || !isPrivileged) return;
    const IDLE_MS = 5 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void supabase.auth.signOut().then(() => {
          setState({ user: null, session: null, loading: false, isAuthenticated: false });
          if (typeof window !== "undefined") {
            // notify the user once via a session flag so reloads don't spam it
            try { sessionStorage.setItem("idle-logout", "1"); } catch { /* ignore */ }
          }
        });
      }, IDLE_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [state.isAuthenticated, isPrivileged]);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await loadUser(session);
  }, [loadUser]);

  const value = useMemo(() => ({
    ...state,
    error: null as string | null,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    refresh,
    logout: signOut,
  }), [state, signIn, signUp, signInWithGoogle, signOut, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
