import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import AdminLayout from "@/components/admin/AdminLayout";

export const Route = createFileRoute("/admin")({
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  const location = useLocation();
  // /admin/login renders standalone, no admin chrome
  if (location.pathname === "/admin/login") {
    return <Outlet />;
  }
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
