import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/auth";

const ADMIN_ROLES = ["super_admin", "admin", "manager", "staff"];
// Routes inside /admin that must remain reachable by unauthenticated users.
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/accept-invite"]);

// In-memory cache so tab switches inside /admin don't re-hit Supabase
// (getSession + admin_roles query) on every navigation. Keyed by user id,
// short TTL so role changes still take effect quickly.
const ROLE_CACHE_TTL_MS = 60_000;
let roleCache: { userId: string; role: string; expires: number } | null = null;

if (typeof window !== "undefined") {
  // Invalidate on auth changes so sign-out / role swap is picked up immediately.
  supabase.auth.onAuthStateChange(() => {
    roleCache = null;
  });
}

/**
 * Route-level guard for the entire /admin/* tree.
 *
 * Runs before any admin page renders (and before the loader). Anyone who isn't
 * authenticated with an admin role is redirected to the public site root, so
 * customers never see admin URLs, layouts, or even a flash of admin content.
 *
 * Skips during SSR / prerender (no Supabase session available there) — the
 * AdminLayout's client-side check is the second line of defence and any
 * server data still requires RLS.
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
    let role: string;
    if (roleCache && roleCache.userId === userId && roleCache.expires > now) {
      role = roleCache.role;
    } else {
      const { data: roles } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", userId);
      role = roles?.[0]?.role ?? "user";
      roleCache = { userId, role, expires: now + ROLE_CACHE_TTL_MS };
    }

    if (!ADMIN_ROLES.includes(role)) {
      // Non-admins are bounced to the public homepage — no admin trace.
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
