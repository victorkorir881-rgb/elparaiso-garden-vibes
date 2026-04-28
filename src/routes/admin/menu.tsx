import { createFileRoute } from "@tanstack/react-router";
import AdminMenu from "@/pages/admin/AdminMenu";

export const Route = createFileRoute("/admin/menu")({
  head: () => ({ meta: [{ title: "Admin · Menu — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminMenu,
});
