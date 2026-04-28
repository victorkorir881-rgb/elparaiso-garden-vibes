import { createFileRoute } from "@tanstack/react-router";
import AdminReservations from "@/pages/admin/AdminReservations";

export const Route = createFileRoute("/admin/reservations")({
  head: () => ({ meta: [{ title: "Admin · Reservations — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminReservations,
});
