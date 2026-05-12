import { createFileRoute } from "@tanstack/react-router";
import AdminProfile from "@/pages/admin/AdminProfile";

export const Route = createFileRoute("/admin/profile")({
  head: () => ({ meta: [{ title: "Admin · My Profile — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminProfile,
});
