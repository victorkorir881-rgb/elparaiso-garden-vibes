import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/pages/admin/AdminDashboard";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminDashboard,
});
