import { createFileRoute } from "@tanstack/react-router";
import AdminSettings from "@/pages/admin/AdminSettings";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Admin · Settings — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminSettings,
});
