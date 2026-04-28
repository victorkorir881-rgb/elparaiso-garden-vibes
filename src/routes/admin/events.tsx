import { createFileRoute } from "@tanstack/react-router";
import AdminEvents from "@/pages/admin/AdminEvents";

export const Route = createFileRoute("/admin/events")({
  head: () => ({ meta: [{ title: "Admin · Events — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminEvents,
});
