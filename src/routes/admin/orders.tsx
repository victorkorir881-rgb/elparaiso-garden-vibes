import { createFileRoute } from "@tanstack/react-router";
import AdminOrders from "@/pages/admin/AdminOrders";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Admin · Orders — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminOrders,
});
