import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/auth";

const ADMIN_ROLES = ["super_admin", "admin", "manager", "staff"] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

// Routes inside /admin that must remain reachable by unauthenticated users.
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/accept-invite"]);

// In-memory cache so tab switches inside /admin don't re-hit Supabase on
// every navigation. Short TTL so demotions / sign-outs take effect quickly.
// Cleared on every auth state change below.
const ROLE_CACHE_TTL_MS = 30_000;
let roleCache: { userId: string; role: string | null; expires: number } | null = null;

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange(() => {
    roleCache = null;
  });
}

/**
 * Authoritative admin check.
 *
 * Calls the SECURITY DEFINER RPC `public.get_current_admin_role()` which
 * runs server-side in Postgres and returns the caller's admin role (or
 * null) based solely on `auth.uid()`. This does NOT depend on RLS or on
 * trusting any client state — the role is computed by the database from
 * the caller's verified JWT.
 *
 * Fail-closed: any error (network, RPC missing, etc.) returns null so the
 * guard redirects the user away from /admin/* rather than letting them in.
 */
async function fetchAdminRoleAuthoritative(): Promise<string | null> {
  try {
    const { data, error } = await (supabase.rpc as any)("get_current_admin_role");
    if (error) return null;
    if (typeof data !== "string") return null;
    return ADMIN_ROLES.includes(data as AdminRole) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Route-level guard for the entire /admin/* tree.
 *
 * Runs before every admin page renders (and before each loader). Anyone who
 * isn't authenticated with a server-verified admin role is redirected away,
 * so customers never see admin URLs, layouts, or a flash of admin content.
 *
 * The authoritative source of truth is `public.get_current_admin_role()`
 * (SECURITY DEFINER) — not client state, not in-memory caches, not RLS on
 * admin_roles. RLS remains the backstop on every admin data fetch.
 *
 * Skips during SSR / prerender (no Supabase session available there).
 */
export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    if (PUBLIC_ADMIN_PATHS.has(location.pathname)) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      roleCache = null;
      throw redirect({ to: "/admin/login" });
    }

    const userId = session.user.id;
    const now = Date.now();
    let role: string | null;
    if (roleCache && roleCache.userId === userId && roleCache.expires > now) {
      role = roleCache.role;
    } else {
      role = await fetchAdminRoleAuthoritative();
      roleCache = { userId, role, expires: now + ROLE_CACHE_TTL_MS };
    }

    if (!role || !ADMIN_ROLES.includes(role as AdminRole)) {
      // Non-admins are bounced to the public homepage — no admin trace.
      // Fail-closed: any RPC error also lands here.
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  const location = useLocation();
  if (PUBLIC_ADMIN_PATHS.has(location.pathname)) {
    return <Outlet />;
  }
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

