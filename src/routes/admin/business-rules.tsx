import { createFileRoute } from "@tanstack/react-router";
import AdminBusinessRules from "@/pages/admin/AdminBusinessRules";

export const Route = createFileRoute("/admin/business-rules")({
  head: () => ({ meta: [{ title: "Admin · Business Rules — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminBusinessRules,
});
