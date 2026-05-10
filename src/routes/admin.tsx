import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/auth";

const ADMIN_ROLES = ["super_admin", "admin", "manager", "staff"];
// Routes inside /admin that must remain reachable by unauthenticated users.
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/accept-invite"]);

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
      throw redirect({ to: "/admin/login" });
    }

    const { data: roles } = await supabase
      .from("admin_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const role = roles?.[0]?.role ?? "user";
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
