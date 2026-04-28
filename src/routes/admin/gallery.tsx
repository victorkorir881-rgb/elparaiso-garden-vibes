import { createFileRoute } from "@tanstack/react-router";
import AdminGallery from "@/pages/admin/AdminGallery";

export const Route = createFileRoute("/admin/gallery")({
  head: () => ({ meta: [{ title: "Admin · Gallery — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminGallery,
});
