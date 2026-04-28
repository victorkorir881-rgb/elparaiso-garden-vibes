import { createFileRoute } from "@tanstack/react-router";
import AdminUsers from "@/pages/admin/AdminUsers";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Admin · Users — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminUsers,
});
