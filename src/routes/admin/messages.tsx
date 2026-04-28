import { createFileRoute } from "@tanstack/react-router";
import AdminMessages from "@/pages/admin/AdminMessages";

export const Route = createFileRoute("/admin/messages")({
  head: () => ({ meta: [{ title: "Admin · Messages — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminMessages,
});
