import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { createClient, type User, type Session } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
});

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
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
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
  const [role, profile] = await Promise.all([
    fetchAdminRole(user.id),
    fetchAdminProfile(user.id),
  ]);
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

  const loadUser = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setState({ user: null, session: null, loading: false, isAuthenticated: false });
      return;
    }
    try {
      const adminUser = await buildAdminUser(session.user);
      setState({ user: adminUser, session, loading: false, isAuthenticated: true });
    } catch {
      setState({ user: null, session: null, loading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session);
    });

    // Then get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUser(session);
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
        emailRedirectTo: "https://elparaisogardens.vercel.app/admin/login",
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ user: null, session: null, loading: false, isAuthenticated: false });
  }, []);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await loadUser(session);
  }, [loadUser]);

  const value = useMemo(() => ({
    ...state,
    signIn,
    signUp,
    signOut,
    refresh,
  }), [state, signIn, signUp, signOut, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
