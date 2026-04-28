import { createFileRoute } from "@tanstack/react-router";
import AdminSEO from "@/pages/admin/AdminSEO";

export const Route = createFileRoute("/admin/seo")({
  head: () => ({ meta: [{ title: "Admin · SEO — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminSEO,
});
