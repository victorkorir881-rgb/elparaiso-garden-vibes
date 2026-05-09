import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import AdminLayout from "@/components/admin/AdminLayout";

export const Route = createFileRoute("/admin")({
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  const location = useLocation();
  // /admin/login and /admin/accept-invite render standalone — no admin chrome
  // and no auth gate (the invite page is reached by unauthenticated users).
  if (location.pathname === "/admin/login" || location.pathname === "/admin/accept-invite") {
    return <Outlet />;
  }
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
