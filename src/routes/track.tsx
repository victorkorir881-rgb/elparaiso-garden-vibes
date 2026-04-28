import { createFileRoute } from "@tanstack/react-router";
import OrderTrackingPage from "@/pages/public/OrderTrackingPage";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track Your Order — Elparaiso Garden Kisii" },
      { name: "description", content: "Track your delivery or takeaway order by phone number." },
      { property: "og:title", content: "Track Your Order — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Track your delivery or takeaway order by phone number." },
    ],
  }),
  component: OrderTrackingPage,
});
