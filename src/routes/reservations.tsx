import { createFileRoute } from "@tanstack/react-router";
import ReservationsPage from "@/pages/public/ReservationsPage";

export const Route = createFileRoute("/reservations")({
  head: () => ({
    meta: [
      { title: "Reservations — Elparaiso Garden Kisii" },
      { name: "description", content: "Reserve a table for dining, drinks or events." },
      { property: "og:title", content: "Reservations — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Reserve a table for dining, drinks or events." },
    ],
  }),
  component: ReservationsPage,
});
