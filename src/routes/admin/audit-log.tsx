import { createFileRoute } from "@tanstack/react-router";
import AdminAuditLog from "@/pages/admin/AdminAuditLog";

export const Route = createFileRoute("/admin/audit-log")({
  head: () => ({
    meta: [
      { title: "Admin · Audit Log — Elparaiso Garden Kisii" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminAuditLog,
});
