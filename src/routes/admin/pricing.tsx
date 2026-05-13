import { createFileRoute } from "@tanstack/react-router";
import AdminPricing from "@/pages/admin/AdminPricing";

export const Route = createFileRoute("/admin/pricing")({
  head: () => ({
    meta: [
      { title: "Admin · Pricing — Elparaiso Garden Kisii" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPricing,
});
